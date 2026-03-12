"use client";

import { authClient } from "@/lib/auth-client";
import { type Maybe, None, Some, isSome } from "@/lib/maybe";
import { Atom, useAtom } from "@effect-atom/atom-react";
import { useQueryState } from "nuqs";
import { loginAction } from "../_lib/actions";

const showPasswordAtom = Atom.make(false);
const fbPendingAtom = Atom.make(false);
const socialErrorAtom = Atom.make<Maybe<string>>(None());

function IconEyeOn() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.884v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

export function LoginForm({ facebookEnabled }: { facebookEnabled: boolean }) {
  const [callbackUrl] = useQueryState("callbackUrl", { defaultValue: "/products" });
  const [errorMsg] = useQueryState("error");
  const [show, setShow] = useAtom(showPasswordAtom);
  const [fbPending, setFbPending] = useAtom(fbPendingAtom);
  const [socialError, setSocialError] = useAtom(socialErrorAtom);

  const handleFacebookLogin = async () => {
    setSocialError(None());
    setFbPending(true);
    try {
      await authClient.signIn.social({
        provider: "facebook",
        callbackURL: callbackUrl,
      });
    } catch {
      setSocialError(Some("Facebook login is unavailable. Please sign in with email."));
    } finally {
      setFbPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <form action={loginAction} className="space-y-5">
        <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>

        {errorMsg !== null && errorMsg !== "" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {isSome(socialError) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">{socialError.value}</p>
          </div>
        )}

        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Password — endAdornment pattern */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="relative mt-1">
            <input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="block w-full rounded-lg border border-gray-300 py-2 pl-3 pr-10 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center border-none bg-transparent text-gray-400 hover:text-gray-600"
            >
              {show ? <IconEyeOn /> : <IconEyeOff />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          Sign in
        </button>
      </form>

      {facebookEnabled && (
        <>
          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Facebook OAuth — initiates redirect-based OAuth flow via better-auth */}
          <button
            type="button"
            data-testid="facebook-login-btn"
            onClick={handleFacebookLogin}
            disabled={fbPending}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconFacebook />
            {fbPending ? "Redirecting…" : "Continue with Facebook"}
          </button>
        </>
      )}
    </div>
  );
}
