import Link from 'next/link';
import type { Metadata } from 'next';
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
      <body className="antialiased">
        <Providers>
          <a
            href="#content"
            className="focus-ring sr-only focus:not-sr-only fixed left-4 top-4 z-50 rounded-full bg-sky-500/80 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg"
          >
            Skip to main content
          </a>
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-40 backdrop-blur-lg">
              <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-6 text-sm font-semibold tracking-wide text-sky-200">
                <span aria-label="Dark Glass Flight Deck" className="flex items-center gap-2 text-sky-100">
                  <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.8)]" aria-hidden="true" />
                  Flight Deck
                </span>
                <div className="flex gap-6">
                  <Link href="/" className="focus-ring">
                    Index
                  </Link>
                  <Link href="/gateway" className="focus-ring">
                    Gateway
                  </Link>
                  <Link href="/train" className="focus-ring">
                    Train
                  </Link>
                  <Link href="/dashboard" className="focus-ring">
                    Dashboard
                  </Link>
                </div>
              </nav>
            </header>
            <main id="content" className="flex-1 px-4 pb-16 pt-10">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">{children}</div>
            </main>
            <footer className="border-t border-white/10 bg-slate-900/40 py-8 text-center text-xs text-sky-200/70">
              Deice Control Systems &middot; Dark Glass Flight Deck simulation layer
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
