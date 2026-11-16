import type { Metadata } from "next";
// Self-hosted fonts (no network needed at build time).
// Baloo 2 includes Devanagari, so headings work in Hindi as well as English.
import "@fontsource/baloo-2/500.css";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import { ClayDefs } from "@/components/characters/ClayDefs";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "REBIRTH", template: "%s · REBIRTH" },
  description: "A world where everything gets a second chance. Give surplus food, furniture, electronics and more to people and organisations who need them.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen overflow-x-hidden antialiased">
        <ClayDefs />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
