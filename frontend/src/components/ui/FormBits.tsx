import type { ComponentProps, ReactNode } from "react";

const control =
  "clay-inset w-full rounded-2xl bg-cream px-4 py-3 font-semibold text-plum placeholder:text-plum-soft/60 focus:outline-3 focus:outline-lavender";

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block font-display text-[1.05rem] font-bold">
      {children}
      {hint && <span className="ml-1.5 font-sans text-sm font-semibold text-plum-soft">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${control} cursor-pointer ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${control} min-h-28 ${props.className ?? ""}`} />;
}

export function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return <p id={id} className="mt-1 text-sm font-bold text-[#D9534F]">{children}</p>;
}

/** Local datetime-local value ("YYYY-MM-DDTHH:mm") n hours from now. */
export function localDateTime(hoursFromNow: number) {
  const d = new Date(Date.now() + hoursFromNow * 3600_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
