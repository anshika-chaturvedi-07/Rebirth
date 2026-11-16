import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

type Variant = "coral" | "lavender" | "light" | "lime";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  coral: "bg-coral text-white",
  lavender: "bg-lavender text-white",
  lime: "bg-lime text-plum",
  light: "bg-card text-plum",
};
const SIZES: Record<Size, string> = {
  sm: "px-4 py-2 text-[0.92rem]",
  md: "px-6 py-3 text-[1.05rem]",
};

export function buttonClass(variant: Variant = "light", size: Size = "md", extra?: string) {
  return clsx(
    "clay-sm inline-flex items-center justify-center gap-2 rounded-full font-display font-bold",
    "transition-transform duration-200 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)]",
    "hover:-translate-y-0.5 hover:scale-[1.03] active:translate-y-px active:scale-95",
    "disabled:opacity-60 disabled:pointer-events-none cursor-pointer",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className, ...rest }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({ href, variant, size, className, children }: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
