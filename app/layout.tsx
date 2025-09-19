import type { Metadata } from "next";
import "./globals.css";
import { ReactNode } from "react";
import { StickyNav } from "../components/StickyNav";

export const metadata: Metadata = {
  title: "De-Ice Trainer",
  description: "OMA station de-ice / anti-ice communication training tools"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="relative flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>
        </div>
        <StickyNav />
      </body>
    </html>
  );
}
