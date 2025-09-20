import Link from 'next/link';
import type { Metadata } from 'next';
import { Plane } from 'lucide-react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Dark Glass Flight Deck',
  description:
    'Deice Flight Deck control surface showcasing user gateway and training index modules.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased bg-neutral-950 text-neutral-100">
        <Providers>
          <a
            href="#content"
            className="focus-ring sr-only focus:not-sr-only fixed left-4 top-4 z-50 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-900 shadow-lg shadow-emerald-500/30"
          >
            Skip to main content
          </a>
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-40 border-b border-neutral-800/70 bg-neutral-950/80 backdrop-blur-xl">
              <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-5 text-sm font-semibold tracking-wide text-neutral-300/80">
                <span aria-label="Dark Glass Flight Deck" className="flex items-center gap-3 text-neutral-200">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-neutral-800/70 bg-neutral-900/70 shadow-[0_10px_25px_rgba(0,0,0,0.35)]">
                    <Plane aria-hidden className="h-5 w-5 text-emerald-400" />
                  </span>
                  Flight Deck
                </span>
                <div className="flex gap-6">
                  <Link href="/" className="focus-ring transition-colors hover:text-neutral-100">
                    Index
                  </Link>
                  <Link href="/gateway" className="focus-ring transition-colors hover:text-neutral-100">
                    Gateway
                  </Link>
                  <Link href="/train" className="focus-ring transition-colors hover:text-neutral-100">
                    Train
                  </Link>
                  <Link href="/dashboard" className="focus-ring transition-colors hover:text-neutral-100">
                    Dashboard
                  </Link>
                </div>
              </nav>
            </header>
            <main id="content" className="flex-1 px-4 pb-20 pt-12 sm:px-6 lg:px-8">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-16">{children}</div>
            </main>
            <footer className="border-t border-neutral-800/70 bg-neutral-950/80 py-8 text-center text-xs text-neutral-400">
              Deice Control Systems &middot; Dark Glass Flight Deck simulation layer
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
