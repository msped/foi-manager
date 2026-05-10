import { betterAuth } from "better-auth";
import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { setCookieCache, setSessionCookie } from "better-auth/cookies";
import { customSession, genericOAuth } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import * as z from "zod";

const DJANGO = process.env.DJANGO_API_URL ?? "http://localhost:8000";
const REFRESH_COOKIE = "foi_refresh";
const SESSION_LIFETIME = 8 * 60 * 60;

async function callDjangoAuth(email: string, password: string) {
  const res = await fetch(`${DJANGO}/api/v1/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).non_field_errors?.[0] ?? (err as any).detail ?? "Invalid credentials");
  }
  return res.json() as Promise<{
    access: string;
    refresh: string;
    user: { id: number; email: string; first_name: string; last_name: string; role: string; department: string };
  }>;
}

function setRefreshCookie(ctx: any, value: string) {
  ctx.setCookie(REFRESH_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

function parseRefreshCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function djangoCredentialsPlugin() {
  return {
    id: "django-credentials",
    endpoints: {
      signInEmail: createAuthEndpoint(
        "/sign-in/email",
        {
          method: "POST",
          body: z.object({ email: z.string(), password: z.string() }),
        },
        async (ctx: any) => {
          const { email, password } = ctx.body;

          let result: Awaited<ReturnType<typeof callDjangoAuth>>;
          try {
            result = await callDjangoAuth(email, password);
          } catch (e: any) {
            throw APIError.from("UNAUTHORIZED", { code: "INVALID_CREDENTIALS", message: e.message ?? "Invalid email or password" });
          }

          const { access, refresh, user: djangoUser } = result;
          const name = `${djangoUser.first_name} ${djangoUser.last_name}`.trim();
          const existing = await ctx.context.internalAdapter.findUserByEmail(email);

          let user: any;
          if (existing?.user) {
            user =
              (await ctx.context.internalAdapter.updateUser(existing.user.id, {
                djangoAccessToken: access,
                djangoRefreshToken: refresh,
                foiRole: djangoUser.role,
                department: djangoUser.department,
                djangoId: djangoUser.id,
              })) ?? existing.user;
          } else {
            user = await ctx.context.internalAdapter.createUser({
              email,
              name,
              emailVerified: true,
              djangoAccessToken: access,
              djangoRefreshToken: refresh,
              foiRole: djangoUser.role,
              department: djangoUser.department,
              djangoId: djangoUser.id,
            });
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user }, false);
          setRefreshCookie(ctx, refresh);

          return ctx.json({ user, token: session.token });
        }
      ),

      refreshDjangoToken: createAuthEndpoint(
        "/refresh-django-token",
        { method: "POST" },
        async (ctx: any) => {
          const cookieHeader = ctx.request.headers.get("cookie");
          const refreshToken = parseRefreshCookie(cookieHeader);
          if (!refreshToken) throw APIError.from("UNAUTHORIZED", { code: "NO_REFRESH_TOKEN", message: "No refresh token" });

          const { symmetricDecodeJWT } = await import("better-auth/crypto");
          const { getChunkedCookie } = await import("better-auth/cookies");

          const sessionDataCookie = getChunkedCookie(
            ctx,
            ctx.context.authCookies.sessionData.name
          );
          if (!sessionDataCookie) throw APIError.from("UNAUTHORIZED", { code: "NO_SESSION", message: "No session" });

          const payload = await symmetricDecodeJWT(
            sessionDataCookie,
            ctx.context.secretConfig,
            "better-auth-session"
          );
          if (!payload?.session || !payload?.user) {
            throw APIError.from("UNAUTHORIZED", { code: "INVALID_SESSION", message: "Invalid session" });
          }

          const res = await fetch(`${DJANGO}/api/v1/auth/token/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken }),
          });
          if (!res.ok) throw APIError.from("UNAUTHORIZED", { code: "REFRESH_FAILED", message: "Token refresh failed" });

          const data = await res.json() as { access: string; refresh?: string };

          await setCookieCache(ctx, {
            session: payload.session,
            user: { ...payload.user, djangoAccessToken: data.access },
          }, false);

          if (data.refresh) setRefreshCookie(ctx, data.refresh);

          return ctx.json({ access_token: data.access });
        }
      ),
    },

    hooks: {
      after: [
        {
          matcher: (ctx: any) => !!ctx.context.newSession?.user?.djangoRefreshToken,
          handler: createAuthMiddleware(async (ctx: any) => {
            setRefreshCookie(ctx, ctx.context.newSession.user.djangoRefreshToken);
          }),
        },
      ],
    },
  };
}

function buildMicrosoftProvider() {
  if (!process.env.BETTER_AUTH_MICROSOFT_CLIENT_ID || !process.env.BETTER_AUTH_MICROSOFT_CLIENT_SECRET) {
    return null;
  }
  const tenantId = process.env.BETTER_AUTH_MICROSOFT_TENANT_ID ?? "common";
  return genericOAuth({
    config: [
      {
        providerId: "microsoft",
        clientId: process.env.BETTER_AUTH_MICROSOFT_CLIENT_ID,
        clientSecret: process.env.BETTER_AUTH_MICROSOFT_CLIENT_SECRET,
        authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        scopes: ["openid", "profile", "email", "User.Read"],
        getUserInfo: async (oauthTokens: any) => {
          const accessToken: string = oauthTokens.accessToken ?? "";
          const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!graphRes.ok) throw APIError.from("BAD_REQUEST", { code: "GRAPH_FAILED", message: "Microsoft Graph request failed" });
          const graphUser = await graphRes.json() as any;

          let tokens: { access: string; refresh: string };
          try {
            const res = await fetch(`${DJANGO}/api/v1/auth/microsoft/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ access_token: accessToken }),
            });
            if (!res.ok) throw new Error();
            tokens = await res.json();
          } catch {
            throw APIError.from("UNAUTHORIZED", { code: "MICROSOFT_EXCHANGE_FAILED", message: "Microsoft SSO exchange failed" });
          }

          return {
            id: graphUser.id,
            email: graphUser.mail ?? graphUser.userPrincipalName,
            name: graphUser.displayName,
            emailVerified: true,
            djangoAccessToken: tokens.access,
            djangoRefreshToken: tokens.refresh,
          };
        },
      },
    ],
  });
}

const microsoftProvider = buildMicrosoftProvider();

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  rateLimit: {
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  session: {
    expiresIn: SESSION_LIFETIME,
    cookieCache: {
      enabled: true,
      maxAge: SESSION_LIFETIME,
      strategy: "jwe",
    },
  },
  user: {
    additionalFields: {
      djangoAccessToken: { type: "string", required: false, returned: true },
      djangoRefreshToken: { type: "string", required: false, returned: false },
      foiRole: { type: "string", required: false, returned: true },
      department: { type: "string", required: false, returned: true },
      djangoId: { type: "number", required: false, returned: true },
    },
  },
  plugins: [
    djangoCredentialsPlugin(),
    customSession(async ({ user, session }: { user: any; session: any }) => {
      const { djangoRefreshToken: _r, djangoAccessToken, ...safeUser } = user;
      return {
        user: { ...safeUser, access_token: djangoAccessToken },
        session,
      };
    }),
    nextCookies(),
    ...(microsoftProvider ? [microsoftProvider] : []),
  ],
});
