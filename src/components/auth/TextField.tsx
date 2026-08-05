"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/auth/icons";

export function TextField({
  label,
  type = "text",
  placeholder,
  icon,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  label: string;
  type?: "text" | "email" | "password";
  placeholder?: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-medium text-white/70"
      >
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
          {icon}
        </span>
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-10 text-sm text-white placeholder-white/25 outline-none transition focus:border-indigo-400/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-indigo-500/10"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/35 transition hover:text-white/70"
          >
            {show ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
