"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

interface FieldProps extends ComponentProps<"input"> {
  id: string;
  label: string;
  icon: ReactNode;
  iconBg?: string;
  error?: string;
}

/** Rounded clay input with a round coloured icon badge, as in the REBIRTH sign-in design. */
export function Field({ id, label, icon, iconBg = "bg-lavender", error, type = "text", ...rest }: FieldProps) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className={`clay-inset flex items-center gap-3 rounded-full bg-cream py-1.5 pl-1.5 pr-4 ${error ? "outline-2 outline-coral" : ""}`}>
        <span className={`clay-sm grid h-10 w-10 flex-none place-items-center rounded-full text-white ${iconBg}`} aria-hidden="true">{icon}</span>
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          placeholder={label}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 font-semibold text-plum placeholder:text-plum-soft/70 focus:outline-none"
          {...rest}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="text-plum-soft hover:text-plum">
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {error && <p id={`${id}-error`} className="mt-1 pl-5 text-sm font-bold text-[#D9534F]">{error}</p>}
    </div>
  );
}
