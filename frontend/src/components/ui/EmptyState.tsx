import type { ReactNode } from "react";
import { Chhotu } from "@/components/characters/Chhotu";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="clay-sm flex flex-col items-center rounded-[2rem] bg-card px-6 py-8 text-center">
      <Chhotu className="w-28 animate-bob" />
      <h3 className="mt-3 text-xl font-bold">{title}</h3>
      {children && <p className="mt-1 max-w-md text-plum-soft">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Fetching…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-12 text-plum-soft" role="status">
      <Chhotu className="w-20 animate-bob" />
      <p className="mt-2 font-bold">{label}</p>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-2xl bg-coral-t px-4 py-3 font-bold">{children}</p>;
}
