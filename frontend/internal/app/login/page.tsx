"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import type { FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    try {
      const result = await authClient.$fetch("/sign-in/email", {
        method: "POST",
        body: { email, password },
      });

      if ((result as any).error) {
        setError((result as any).error.message ?? "Sign-in failed. Check your email and password.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--govuk-template-background-colour, #f4f8fb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#fff", padding: 40, border: "1px solid var(--govuk-border-colour, #cecece)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <span
            style={{
              width: 32, height: 32,
              background: "#1d70b8",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 16, color: "#fff",
            }}
          >F</span>
          <span style={{ fontWeight: 700, fontSize: 17 }}>FOI Manager</span>
        </div>

        <h1 className="govuk-heading-l">Sign in</h1>

        {error && (
          <div className="govuk-error-summary" data-module="govuk-error-summary" role="alert">
            <div className="govuk-error-summary__body">
              <p className="govuk-body" style={{ margin: 0, color: "var(--govuk-error-colour)" }}>
                {error}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} method="post" noValidate>
          <div className="govuk-form-group">
            <label className="govuk-label govuk-label--s" htmlFor="email">
              Email address
            </label>
            <input
              className="govuk-input"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              required
              disabled={loading}
            />
          </div>

          <div className="govuk-form-group">
            <label className="govuk-label govuk-label--s" htmlFor="password">
              Password
            </label>
            <input
              className="govuk-input"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="govuk-button govuk-!-margin-bottom-0"
            disabled={loading}
            aria-disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {process.env.NEXT_PUBLIC_BETTER_AUTH_MICROSOFT_CLIENT_ID && (
          <>
            <hr className="govuk-section-break govuk-section-break--m govuk-section-break--visible" style={{ marginTop: 24 }} />
            <p className="govuk-body">
              <button
                type="button"
                className="govuk-link"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
                onClick={() => authClient.signIn.oauth2({ providerId: "microsoft", callbackURL: "/dashboard" })}
              >
                Sign in with Microsoft
              </button>
            </p>
          </>
        )}

        <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0, marginTop: 16 }}>
          Having trouble? Contact your information governance lead.
        </p>
      </div>
    </div>
  );
}
