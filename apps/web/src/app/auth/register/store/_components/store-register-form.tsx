"use client";
import { Atom, useAtom } from "@effect-atom/atom-react";
import { Button, Input } from "@fabric/ui";
import { regex } from "arkregex";
import { useQueryState } from "nuqs";
import type React from "react";
import { useCallback, useMemo } from "react";
import { registerStoreAction } from "../_lib/actions";

const rUpper = regex("[A-Z]");
const rLower = regex("[a-z]");
const rDigit = regex("[0-9]");
const rSpecial = regex("[!@#$%^&*]");
const rLatin = regex("^[\\u0020-\\u007E]*$");

interface PasswordValidation {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  specialChar: boolean;
}

function validatePassword(pw: string): PasswordValidation {
  return {
    length: pw.length >= 8,
    uppercase: rUpper.test(pw),
    lowercase: rLower.test(pw),
    number: rDigit.test(pw),
    specialChar: rSpecial.test(pw),
  };
}

function isLatinOnly(pw: string) {
  return pw === "" || rLatin.test(pw);
}

const RULES: { label: string; key: keyof PasswordValidation }[] = [
  { label: "At least 8 characters long", key: "length" },
  { label: "At least 1 uppercase letter (A-Z)", key: "uppercase" },
  { label: "At least 1 lowercase letter (a-z)", key: "lowercase" },
  { label: "At least 1 number (0-9)", key: "number" },
  { label: "At least 1 special character (!, @, #, $, %, ^, &, *)", key: "specialChar" },
];

const storePasswordAtom = Atom.make("");
const showStorePasswordAtom = Atom.make(false);
const showStoreConfirmPasswordAtom = Atom.make(false);

function EyeOn() {
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

function EyeOff() {
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

function PasswordField({
  id,
  name,
  autoComplete,
  showAtom,
  value,
  onChange,
  placeholder = "••••••••",
  minLength,
}: {
  id: string;
  name: string;
  autoComplete: string;
  showAtom: typeof showStorePasswordAtom;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  minLength?: number;
}) {
  const [show, setShow] = useAtom(showAtom);
  return (
    <div className="relative mt-1">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="pr-10"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center border-none bg-transparent text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOn /> : <EyeOff />}
      </button>
    </div>
  );
}

function ValidationChecklist({ validation }: { validation: PasswordValidation }) {
  return (
    <ul className="mt-2 space-y-1">
      {RULES.map(({ label, key }) => {
        const valid = validation[key];
        return (
          <li
            key={key}
            className={`flex items-center gap-2 text-xs ${valid ? "text-success" : "text-muted-foreground"}`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${valid ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground"}`}
            >
              {valid ? "✓" : "·"}
            </span>
            {label}
          </li>
        );
      })}
    </ul>
  );
}

export function StoreRegisterForm() {
  const [errorMsg] = useQueryState("error");
  const [password, setPassword] = useAtom(storePasswordAtom);

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setPassword(isLatinOnly(raw) ? raw : raw.replace(/[\u0080-\uFFFF]/gu, ""));
    },
    [setPassword]
  );

  const validation = useMemo(() => validatePassword(password), [password]);
  const allValid = Object.values(validation).every(Boolean);

  return (
    <form action={registerStoreAction} className="space-y-5">
      <h2 className="text-xl font-semibold text-foreground">Open your store</h2>
      {errorMsg && errorMsg !== "" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive-subtle px-4 py-3">
          <p className="text-sm text-destructive">{errorMsg}</p>
        </div>
      )}
      <div>
        <label htmlFor="storeName" className="block text-sm font-medium text-foreground">
          Store name
        </label>
        <Input
          id="storeName"
          name="storeName"
          type="text"
          required
          minLength={2}
          maxLength={80}
          placeholder="My Awesome Store"
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Your name
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder="Your name"
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Business email
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
        <PasswordField
          id="password"
          name="password"
          autoComplete="new-password"
          showAtom={showStorePasswordAtom}
          minLength={8}
          value={password}
          onChange={handlePasswordChange}
        />
        {password.length > 0 && <ValidationChecklist validation={validation} />}
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
          Confirm password
        </label>
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          showAtom={showStoreConfirmPasswordAtom}
        />
      </div>
      <Button type="submit" variant="success" disabled={!allValid} className="w-full">
        Create store account
      </Button>
      <p className="text-center text-xs text-gray-500">
        Start free — upgrade your plan anytime from the merchant dashboard.
      </p>
    </form>
  );
}
