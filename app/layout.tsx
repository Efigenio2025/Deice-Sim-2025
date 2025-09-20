import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Polar Ice Ops | De-Ice Trainer",
  description:
    "Polar Ice Ops is the frosted-glass command center for the De-Ice Trainer. Launch desktop or mobile sims and stay ahead of the storm.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
