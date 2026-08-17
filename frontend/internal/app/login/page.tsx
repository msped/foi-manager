"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import Header from "@/components/govuk/Header";
import Footer from "@/components/govuk/Footer";
import SkipLink from "@/components/govuk/SkipLink";
import { branding } from "@/lib/branding";
import type { SubmitEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
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

      const session = await authClient.getSession();
      const role = (session.data?.user as any)?.foiRole;
      const dest = role === "assignee" ? "/consultations" : "/dashboard";
      router.push(dest);
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SkipLink />
      <Header organisationName={branding.organisationName} />

      <div className="govuk-width-container">
        <main className="govuk-main-wrapper" id="main-content">
          <div className="govuk-grid-row">
            <div className="govuk-grid-column-one-half">
              <h1 className="govuk-heading-l">Sign in</h1>

              {error && (
                <div
                  className="govuk-error-summary"
                  data-module="govuk-error-summary"
                  role="alert"
                >
                  <h2 className="govuk-error-summary__title">There is a problem</h2>
                  <div className="govuk-error-summary__body">
                    <ul className="govuk-list govuk-error-summary__list">
                      <li>
                        <a href="#email">{error}</a>
                      </li>
                    </ul>
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
                  className="govuk-button"
                  data-module="govuk-button"
                  disabled={loading}
                  aria-disabled={loading}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>

              {process.env.NEXT_PUBLIC_BETTER_AUTH_MICROSOFT_CLIENT_ID && (
                <>
                  <hr className="govuk-section-break govuk-section-break--m govuk-section-break--visible" />
                  <p className="govuk-body">
                    <button
                      type="button"
                      className="govuk-link"
                      onClick={() => authClient.signIn.oauth2({ providerId: "microsoft", callbackURL: "/auth/role-redirect" })}
                    >
                      Sign in with Microsoft
                    </button>
                  </p>
                </>
              )}

              <p className="govuk-hint">
                Having trouble? Contact your information governance lead.
              </p>
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </>
  );
}
