import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState } from 'react';
import clsx from 'clsx';

export function FrostNav({ items = [] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const renderLink = (item) => {
    const active = router.pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={clsx(
          'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
          active
            ? 'bg-cyan-400/20 text-cyan-100 shadow-[0_0_0_1px_rgba(56,189,248,0.4)]'
            : 'text-slate-200/80 hover:text-white hover:bg-white/10'
        )}
        onClick={() => setOpen(false)}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header className="supports-backdrop:bg-black/30 supports-backdrop:frost-glass safe-px safe-pt sticky top-0 z-50 bg-black/50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.35em] text-slate-200">
          <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-cyan-500/30 via-cyan-400/20 to-transparent shadow-[0_12px_32px_rgba(56,189,248,0.35)]" />
          Frost Dashboard
        </Link>

        <nav className="hidden items-center gap-2 md:flex">{items.map(renderLink)}</nav>

        <div className="flex items-center gap-2">
          <Link href="/desktop_train" className="hidden sm:inline-flex frost-btn text-xs">
            Launch Trainer
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-slate-200 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <span className="sr-only">Toggle navigation</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M3 6h14M3 10h14M3 14h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden">
          <div className="mt-4 grid gap-2 rounded-3xl border border-white/10 bg-black/60 p-4 text-sm text-slate-200">
            {items.map(renderLink)}
            <Link
              href="/desktop_train"
              className="frost-btn w-full justify-center text-xs"
              onClick={() => setOpen(false)}
            >
              Launch Trainer
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default FrostNav;
