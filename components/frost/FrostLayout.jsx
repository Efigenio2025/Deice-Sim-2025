import { FrostNav } from './FrostNav';
import { FrostFooter } from './FrostFooter';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/router';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Desktop Trainer', href: '/desktop_train' },
  { label: 'Mobile Trainer', href: '/mobile_train' },
  { label: 'Metrics', href: '/metrics' },
  { label: 'Audio Lab', href: '/audio-lab' },
  { label: 'Resources', href: '/resources' },
  { label: 'Profile', href: '/profile' },
];

export function FrostLayout({ children }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-frost-radial">
      <FrostNav items={navItems} />
      <main className="safe-px relative z-0 mx-auto mt-8 w-full max-w-6xl flex-1 pb-16">
        {children}
      </main>
      <FrostFooter />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/60 py-2 safe-pb backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-around text-xs font-medium text-slate-300">
          {navItems.slice(0, 4).map((item) => {
            const active = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex w-full flex-col items-center gap-1 rounded-2xl px-3 py-2 transition',
                  active ? 'text-cyan-200' : 'text-slate-300/80 hover:text-white'
                )}
              >
                <span className={clsx('h-1 w-8 rounded-full transition', active ? 'bg-cyan-400/70' : 'bg-transparent')} />
                {item.label.replace(' Trainer', '')}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default FrostLayout;
