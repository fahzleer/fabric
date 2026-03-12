"use client";
import { Atom, useAtom } from "@effect-atom/atom-react";
import { regex } from "arkregex";
import { useQueryState } from "nuqs";
import type React from "react";
import { useCallback, useMemo } from "react";
import { registerAction } from "../_lib/actions";

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

function isLatinOnly(pw: string): boolean {
  return pw === "" || rLatin.test(pw);
}

const RULES: { label: string; key: keyof PasswordValidation }[] = [
  { label: "At least 8 characters long", key: "length" },
  { label: "At least 1 uppercase letter (A-Z)", key: "uppercase" },
  { label: "At least 1 lowercase letter (a-z)", key: "lowercase" },
  { label: "At least 1 number (0-9)", key: "number" },
  { label: "At least 1 special character (!, @, #, $, %, ^, &, *)", key: "specialChar" },
];

const passwordAtom = Atom.make("");
const showPasswordAtom = Atom.make(false);
const showConfirmPasswordAtom = Atom.make(false);

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

interface PasswordFieldProps {
  id: string;
  name: string;
  autoComplete: string;
  showAtom: typeof showPasswordAtom;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  minLength?: number;
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
}: PasswordFieldProps) {
  const [show, setShow] = useAtom(showAtom);
  return (
    <div className="relative mt-1">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
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
            className={`flex items-center gap-2 text-xs ${valid ? "text-green-600" : "text-gray-400"}`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${valid ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
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

export function RegisterForm() {
  const [errorMsg] = useQueryState("error");
  const [password, setPassword] = useAtom(passwordAtom);

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
    <form action={registerAction} className="space-y-5">
      <h2 className="text-xl font-semibold text-gray-900">Create your account</h2>
      {errorMsg !== null && errorMsg !== "" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Display name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder="Your name"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>
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
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <PasswordField
          id="password"
          name="password"
          autoComplete="new-password"
          showAtom={showPasswordAtom}
          minLength={8}
          value={password}
          onChange={handlePasswordChange}
        />
        {password.length > 0 && <ValidationChecklist validation={validation} />}
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
          Confirm password
        </label>
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          showAtom={showConfirmPasswordAtom}
        />
      </div>
      <button
        type="submit"
        disabled={!allValid}
        className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Create account
      </button>
      <p className="text-center text-xs text-gray-500">
        By creating an account, you agree to our <span className="underline">Terms of Service</span>{" "}
        and <span className="underline">Privacy Policy</span>.
      </p>
    </form>
  );
}
