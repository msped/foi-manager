import { betterAuth } from "better-auth";
import type { GenericEndpointContext, HookEndpointContext } from "@better-auth/core";
import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { getChunkedCookie, setCookieCache, setSessionCookie } from "better-auth/cookies";
import { symmetricDecodeJWT } from "better-auth/crypto";
import { customSession, genericOAuth } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import * as z from "zod";

export const getSession = async () => {
    const { headers } = await import("next/headers");
    const { authClient } = await import("@/lib/auth-client");
    const result = await authClient.getSession({
        fetchOptions: { headers: await headers() },
    });
    return result.data;
};

const SESSION_LIFETIME = 8 * 60 * 60; // 8 hours in seconds

function getApiBase() {
    return `${process.env.DJANGO_API_URL ?? "http://localhost:8000"}/api/v1`;
}

async function callDjango(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`${getApiBase()}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(err.detail || "Authentication failed");
    }
    return res.json() as Promise<Record<string, unknown>>;
}

const REFRESH_COOKIE = "django_rt";
const REFRESH_COOKIE_MAX_AGE = 24 * 60 * 60;

function setRefreshCookie(ctx: GenericEndpointContext, value: string) {
    ctx.setCookie(REFRESH_COOKIE, value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: REFRESH_COOKIE_MAX_AGE,
        path: "/",
    });
}

function parseRefreshCookie(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(
        new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE}=([^;]*)`)
    );
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
                    body: z.object({
                        email: z.string().email(),
                        password: z.string(),
                    }),
                },
                async (ctx) => {
                    const { email, password } = ctx.body;

                    let djangoData: Record<string, unknown>;
                    try {
                        djangoData = await callDjango("auth/login/", {
                            email,
                            password,
                        });
                    } catch {
                        throw new APIError("UNAUTHORIZED", {
                            message: "Invalid email or password",
                        });
                    }

                    const djangoUser = djangoData.user as Record<string, unknown> | undefined;
                    const resolvedEmail = (djangoUser?.email as string | undefined) || email;
                    const name = (djangoUser?.username as string | undefined) || email.split("@")[0];

                    const existing =
                        await ctx.context.internalAdapter.findUserByEmail(resolvedEmail);
                    let user;
                    const isAdmin =
                        ((djangoUser?.is_staff as boolean | undefined) ||
                            (djangoUser?.is_superuser as boolean | undefined)) ?? false;

                    if (existing?.user) {
                        const updateFields: Record<string, unknown> = {
                            djangoAccessToken: djangoData.access,
                            djangoRefreshToken: djangoData.refresh,
                            isAdmin,
                        };
                        user =
                            (await ctx.context.internalAdapter.updateUser(
                                existing.user.id,
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                updateFields as any
                            )) || existing.user;
                    } else {
                        user = await ctx.context.internalAdapter.createUser({
                            email: resolvedEmail,
                            name,
                            emailVerified: true,
                            djangoAccessToken: djangoData.access as string,
                            djangoRefreshToken: djangoData.refresh as string,
                            isAdmin,
                        });
                    }

                    const session =
                        await ctx.context.internalAdapter.createSession(
                            user.id
                        );
                    await setSessionCookie(ctx, { session, user });

                    return ctx.json({ user, token: session.token });
                }
            ),
            refreshDjangoToken: createAuthEndpoint(
                "/refresh-django-token",
                { method: "POST" },
                async (ctx) => {
                    const cookieHeader = ctx.request?.headers.get("cookie") ?? null;
                    const refreshToken = parseRefreshCookie(cookieHeader);
                    if (!refreshToken) {
                        throw new APIError("UNAUTHORIZED", { message: "No refresh token" });
                    }

                    const sessionDataCookie = getChunkedCookie(
                        ctx,
                        ctx.context.authCookies.sessionData.name
                    );
                    if (!sessionDataCookie) {
                        throw new APIError("UNAUTHORIZED", { message: "No session" });
                    }

                    const payload = await symmetricDecodeJWT(
                        sessionDataCookie,
                        ctx.context.secretConfig,
                        "better-auth-session"
                    );
                    if (!payload?.session || !payload?.user) {
                        throw new APIError("UNAUTHORIZED", { message: "Invalid session" });
                    }

                    let djangoData: Record<string, unknown>;
                    try {
                        djangoData = await callDjango("auth/token/refresh/", {
                            refresh: refreshToken,
                        });
                    } catch {
                        throw new APIError("UNAUTHORIZED", {
                            message: "Django token refresh failed",
                        });
                    }

                    type CookieSession = Parameters<typeof setCookieCache>[1];
                    const updatedUser = Object.assign(
                        {},
                        payload.user as CookieSession["user"],
                        { djangoAccessToken: djangoData.access as string }
                    );
                    await setCookieCache(
                        ctx,
                        {
                            session: payload.session as CookieSession["session"],
                            user: updatedUser,
                        },
                        false
                    );

                    if (djangoData.refresh) {
                        setRefreshCookie(ctx, djangoData.refresh as string);
                    }

                    return ctx.json({ access_token: djangoData.access });
                }
            ),
        },
        hooks: {
            after: [
                {
                    matcher: (ctx: HookEndpointContext) =>
                        !!(ctx.context.newSession?.user as Record<string, unknown> | undefined)?.djangoRefreshToken,
                    handler: createAuthMiddleware(async (ctx) => {
                        const token = (ctx.context.newSession?.user as Record<string, unknown> | undefined)?.djangoRefreshToken as string | undefined;
                        if (token) setRefreshCookie(ctx as GenericEndpointContext, token);
                    }),
                },
            ],
        },
    };
}

function buildMicrosoftProvider() {
    if (
        !process.env.BETTER_AUTH_MICROSOFT_CLIENT_ID ||
        !process.env.BETTER_AUTH_MICROSOFT_CLIENT_SECRET
    )
        return null;

    const tenantId =
        process.env.BETTER_AUTH_MICROSOFT_TENANT_ID || "common";

    return genericOAuth({
        config: [
            {
                providerId: "microsoft",
                clientId: process.env.BETTER_AUTH_MICROSOFT_CLIENT_ID,
                clientSecret:
                    process.env.BETTER_AUTH_MICROSOFT_CLIENT_SECRET,
                authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
                tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
                scopes: ["openid", "profile", "email", "User.Read"],
                getUserInfo: async ({ accessToken }) => {
                    const graphRes = await fetch(
                        "https://graph.microsoft.com/v1.0/me",
                        {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                            },
                        }
                    );
                    if (!graphRes.ok)
                        throw new APIError("BAD_REQUEST", {
                            message: "Microsoft Graph request failed",
                        });
                    const graphUser = await graphRes.json() as Record<string, string>;

                    const djangoData = await callDjango("auth/microsoft/", {
                        access_token: accessToken,
                    });

                    const djangoUser = djangoData.user as Record<string, unknown> | undefined;

                    return {
                        id: graphUser.id,
                        email: graphUser.mail || graphUser.userPrincipalName,
                        name: graphUser.displayName,
                        emailVerified: true,
                        djangoAccessToken: djangoData.access as string,
                        djangoRefreshToken: djangoData.refresh as string,
                        isAdmin:
                            ((djangoUser?.is_staff as boolean | undefined) ||
                                (djangoUser?.is_superuser as boolean | undefined)) ?? false,
                    };
                },
            },
        ],
    });
}

const microsoftProvider = buildMicrosoftProvider();

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    rateLimit: {
        window: 60,
        max: 100,
        customRules: {
            "/sign-in/username": { window: 60, max: 5 },
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
            djangoAccessToken: {
                type: "string",
                required: false,
                returned: true,
            },
            djangoRefreshToken: {
                type: "string",
                required: false,
                returned: false,
            },
            isAdmin: {
                type: "boolean",
                required: false,
                returned: true,
                defaultValue: false,
            },
        },
    },
    plugins: [
        djangoCredentialsPlugin(),
        customSession(async ({ user, session }) => {
            const u = user as typeof user & { djangoAccessToken?: string; djangoRefreshToken?: string };
            const { djangoAccessToken, djangoRefreshToken: _dr, ...safeUser } = u;
            void _dr;
            return {
                user: {
                    ...safeUser,
                    access_token: djangoAccessToken,
                },
                session,
            };
        }),
        nextCookies(),
        ...(microsoftProvider ? [microsoftProvider] : []),
    ],
});
