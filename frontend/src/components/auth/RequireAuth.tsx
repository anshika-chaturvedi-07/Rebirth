"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { User } from "@/lib/types";
import { LoadingState } from "@/components/ui/EmptyState";
import { useAuth } from "./AuthProvider";

/** Renders children only for signed-in users; otherwise sends them to /login and back afterwards. */
export function RequireAuth({ children }: { children: (user: User) => ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, user, router, path]);

  if (!user) return <LoadingState label={loading ? "Checking your account…" : "Taking you to sign in…"} />;
  return <>{children(user)}</>;
}
