import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import {
  getEmployeeProfile,
  isAllowedEmployeeId,
} from '../../lib/employeeProfiles';
import {
  clearStoredEmployeeId,
  getStoredEmployeeId,
  storeEmployeeId,
} from '../../lib/employeeSession';

function statusBadgeClass(status = '') {
  const base =
    'self-start rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.3em]';
  const normalized = status.toLowerCase();

  if (normalized.includes('alert') || normalized.includes('action')) {
    return `${base} border-amber-400/50 bg-amber-500/15 text-amber-200`;
  }

  if (normalized.includes('follow') || normalized.includes('queue') || normalized.includes('draft')) {
    return `${base} border-sky-300/40 bg-sky-500/10 text-sky-100`;
  }

  return `${base} border-emerald-400/40 bg-emerald-500/10 text-emerald-200`;
}

function QuickLinkButton({ link }) {
  const className =
    'frost-action relative inline-flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-neutral-100 shadow-[0_6px_24px_rgba(12,74,110,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200';
  const isExternal = /^https?:/i.test(link.href);

  if (isExternal) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        <span>{link.label}</span>
        <span aria-hidden className="text-xs uppercase tracking-[0.4em] text-sky-200/80">
          ↗
        </span>
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      <span>{link.label}</span>
      <span aria-hidden className="text-xs uppercase tracking-[0.4em] text-sky-200/80">
        ➜
      </span>
    </Link>
  );
}

function FocusCard({ focus }) {
  return (
    <div className="frost-card relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-6 text-sky-100 shadow-[0_8px_30px_rgba(3,105,161,0.12)] backdrop-blur-xl">
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/60">Focus item</span>
      <h3 className="text-xl font-semibold text-neutral-100">{focus.title}</h3>
      <p className="text-sm leading-relaxed text-sky-200/80">{focus.detail}</p>
      <span className={statusBadgeClass(focus.status)}>{focus.status}</span>
    </div>
  );
}

export default function EmployeeProfilePage() {
  const router = useRouter();
  const { employeeId } = router.query;
  const [profile, setProfile] = useState(null);
  const [resolvedId, setResolvedId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    const idParam = typeof employeeId === 'string' ? employeeId : '';
    if (!idParam) {
      setLoading(false);
      return;
    }

    if (!isAllowedEmployeeId(idParam)) {
      const stored = getStoredEmployeeId();
      if (stored && isAllowedEmployeeId(stored)) {
        router.replace(`/profile/${stored}`);
      } else {
        clearStoredEmployeeId();
        router.replace('/');
      }
      return;
    }

    const stored = getStoredEmployeeId();
    if (stored && stored !== idParam) {
      if (isAllowedEmployeeId(stored)) {
        router.replace(`/profile/${stored}`);
        return;
      }
      clearStoredEmployeeId();
    }

    if (stored !== idParam) {
      storeEmployeeId(idParam);
    }

    const data = getEmployeeProfile(idParam);
    setProfile(data);
    setResolvedId(idParam);
    setLoading(false);
  }, [employeeId, router, router.isReady]);

  const handleLogout = () => {
    clearStoredEmployeeId();
    router.replace('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sky-100">
        <span className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-200/80">
          Loading profile…
        </span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sky-100">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-6 text-center text-sky-100">
          <p className="text-lg font-semibold">Profile unavailable</p>
          <p className="mt-2 text-sm text-sky-200/70">
            We could not load the requested profile. Please return to the access portal and try again.
          </p>
          <button
            onClick={handleLogout}
            className="mt-4 inline-flex items-center justify-center rounded-2xl border border-cyan-100/30 bg-cyan-500/20 px-5 py-2.5 text-sm font-semibold text-neutral-100 shadow-[0_8px_30px_rgba(3,105,161,0.18)] backdrop-blur-lg transition-colors duration-300 hover:bg-cyan-400/30"
          >
            Back to portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{profile.name} | Polar Ops Profile</title>
        <meta
          name="description"
          content={`Personalized dashboard for ${profile.name} in the Polar Ice Ops training environment.`}
        />
      </Head>
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-sky-950/80 to-cyan-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(125,211,252,0.22),transparent_60%),radial-gradient(circle_at_85%_12%,rgba(14,165,233,0.16),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(8,47,73,0.55)_0%,rgba(12,74,110,0.35)_45%,rgba(14,116,144,0.28)_100%)] mix-blend-screen" />

        <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-16 sm:px-8 lg:px-12">
          <header className="frost-card relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-8 text-sky-100 shadow-[0_10px_40px_rgba(3,105,161,0.15)] backdrop-blur-xl sm:p-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-1 flex-col gap-4">
                <span className="inline-flex w-fit items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">
                  Employee {resolvedId}
                </span>
                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold text-neutral-100 sm:text-5xl">{profile.name}</h1>
                  <div className="flex flex-wrap gap-3 text-sm uppercase tracking-[0.25em] text-sky-200/60">
                    <span className="rounded-full border border-white/15 px-3 py-1">{profile.role}</span>
                    <span className="rounded-full border border-white/15 px-3 py-1">{profile.location}</span>
                    <span className="rounded-full border border-white/15 px-3 py-1">Shift {profile.shift}</span>
                  </div>
                  <p className="text-base leading-relaxed text-sky-200/80">{profile.summary}</p>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {profile.quickLinks.map((link) => (
                    <QuickLinkButton key={`${link.href}-${link.label}`} link={link} />
                  ))}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="self-start rounded-2xl border border-amber-100/30 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-100 transition-all duration-300 hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
              >
                Switch account
              </button>
            </div>
          </header>

          <section className="mt-10 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-100">Focus watchlist</h2>
                <p className="text-sm text-sky-200/70">
                  Key items to watch for the current shift.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {profile.focusAreas.map((focus) => (
                <FocusCard key={focus.title} focus={focus} />
              ))}
            </div>
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="frost-card relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-8 text-sky-100 shadow-[0_10px_40px_rgba(3,105,161,0.15)] backdrop-blur-xl">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-neutral-100">Upcoming training</h3>
                <p className="text-sm text-sky-200/70">
                  {profile.upcomingTraining.module}
                </p>
                <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.25em] text-sky-200/60">
                  <span className="rounded-full border border-white/15 px-3 py-1">Due {profile.upcomingTraining.due}</span>
                  <span className="rounded-full border border-white/15 px-3 py-1">{profile.upcomingTraining.notes}</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {profile.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="frost-chip flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-sky-100 backdrop-blur-lg"
                  >
                    <span className="text-xs uppercase tracking-[0.3em] text-sky-200/60">{metric.label}</span>
                    <span className="text-2xl font-semibold text-neutral-100">{metric.value}</span>
                    <span className="text-xs uppercase tracking-[0.3em] text-sky-200/50">{metric.trend}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="frost-card relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-8 text-sky-100 shadow-[0_10px_40px_rgba(3,105,161,0.15)] backdrop-blur-xl">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-neutral-100">Shift checklist</h3>
                <p className="text-sm text-sky-200/70">
                  Track the tasks that keep the operation on pace.
                </p>
              </div>
              <ul className="space-y-3 text-sm text-sky-100">
                {profile.checklists.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300/80 shadow-[0_0_6px_rgba(125,211,252,0.7)]" />
                    <span className="flex-1 leading-relaxed text-sky-200/80">{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </main>
      </div>
    </>
  );
}
