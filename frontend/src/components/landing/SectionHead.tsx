import type { ReactNode } from "react";

export function SectionHead({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-1.5 text-[0.8rem] font-extrabold uppercase tracking-[0.08em] text-violet">{kicker}</p>
        <h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold">{title}</h2>
      </div>
      {children && <p className="max-w-md text-plum-soft">{children}</p>}
    </div>
  );
}
