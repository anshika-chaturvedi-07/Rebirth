import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-[60vh] max-w-6xl px-4 pb-10 sm:px-6">{children}</main>
      <Footer />
    </>
  );
}
