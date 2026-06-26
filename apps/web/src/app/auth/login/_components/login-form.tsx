"use client";

import { authClient } from "@/lib/auth-client";
import { Atom, useAtom } from "@effect-atom/atom-react";
import { type Maybe, None, Some, isSome } from "@fabric/types";
import { Button, Input } from "@fabric/ui";
import { useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { loginAction } from "../_lib/actions";

export type SocialProvider = "google" | "facebook" | "line";

const PROVIDER_META: Record<SocialProvider, { label: string; color: string; icon: ReactNode }> = {
  line: {
    label: "LINE",
    color: "#06C755",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#06C755" aria-hidden="true">
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125zM14.469 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63h-1.755v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63h-1.755v1.125zm-4.671 2.756c0 .344-.282.629-.63.629-.346 0-.63-.285-.63-.629V8.108c0-.345.284-.63.63-.63.348 0 .63.285.63.63zm-2.53.629H4.882c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v3.755h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
      </svg>
    ),
  },
  google: {
    label: "Google",
    color: "#4285F4",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  facebook: {
    label: "Facebook",
    color: "#1877F2",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.884v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
  },
};

const showPasswordAtom = Atom.make(false);
const pendingProviderAtom = Atom.make<SocialProvider | null>(null);
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

export function LoginForm({ enabledProviders }: { enabledProviders: SocialProvider[] }) {
  const [callbackUrl] = useQueryState("callbackUrl", { defaultValue: "/products" });
  const [errorMsg] = useQueryState("error");
  const [show, setShow] = useAtom(showPasswordAtom);
  const [pendingProvider, setPendingProvider] = useAtom(pendingProviderAtom);
  const [socialError, setSocialError] = useAtom(socialErrorAtom);

  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialError(None());
    setPendingProvider(provider);
    try {
      if (provider === "line") {
        await authClient.signIn.oauth2({ providerId: "line", callbackURL: callbackUrl });
      } else {
        await authClient.signIn.social({ provider, callbackURL: callbackUrl });
      }
    } catch {
      setSocialError(
        Some(`${PROVIDER_META[provider].label} login is unavailable. Please sign in with email.`)
      );
    } finally {
      setPendingProvider(null);
    }
  };

  const hasSocial = enabledProviders.length > 0;

  return (
    <div className="space-y-5">
      <form action={loginAction} className="space-y-5">
        <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>

        {errorMsg !== null && errorMsg !== "" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive-subtle px-4 py-3">
            <p className="text-sm text-destructive">{errorMsg}</p>
          </div>
        )}

        {isSome(socialError) && (
          <div className="rounded-lg border border-warning/40 bg-warning-subtle px-4 py-3">
            <p className="text-sm text-foreground">{socialError.value}</p>
          </div>
        )}

        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email address
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative mt-1">
            <Input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center border-none bg-transparent text-muted-foreground hover:text-foreground"
            >
              {show ? <IconEyeOn /> : <IconEyeOff />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>

      {hasSocial && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div
            className={`grid gap-2 ${enabledProviders.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
          >
            {enabledProviders.map((provider) => {
              const meta = PROVIDER_META[provider];
              const isPending = pendingProvider === provider;
              return (
                <Button
                  key={provider}
                  type="button"
                  variant="outline"
                  data-testid={`${provider}-login-btn`}
                  onClick={() => handleSocialLogin(provider)}
                  disabled={pendingProvider !== null}
                  className="w-full"
                >
                  {meta.icon}
                  <span>{isPending ? "…" : meta.label}</span>
                </Button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
