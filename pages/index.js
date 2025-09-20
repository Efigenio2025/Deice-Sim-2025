import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import {
  EMPLOYEE_IDS,
  getEmployeeProfile,
  isAllowedEmployeeId,
  normalizeEmployeeId,
} from '../lib/employeeProfiles';
import { getStoredEmployeeId, storeEmployeeId } from '../lib/employeeSession';

const SNOWFLAKES = Array.from({ length: 28 }, (_, index) => {
  const left = (index * 37) % 100;
  const delay = ((index * 1.7) % 12).toFixed(2);
  const duration = 10 + (index % 5) * 2;
  const size = 3 + (index % 4);
  const drift = index % 2 === 0 ? -18 : 14;

  return {
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    size: `${size}px`,
    opacity: 0.25 + (index % 4) * 0.15,
    drift: `${drift}px`,
  };
});

export default function LoginPortal() {
  const router = useRouter();
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  const employees = useMemo(
    () =>
      EMPLOYEE_IDS.map((id) => {
        const profile = getEmployeeProfile(id);
        return {
          id,
          name: profile?.name ?? 'Employee',
          role: profile?.role ?? '',
        };
      }),
    []
  );

  useEffect(() => {
    const existing = getStoredEmployeeId();
    if (existing && isAllowedEmployeeId(existing)) {
      router.replace(`/profile/${existing}`);
      return;
    }

    setCheckingSession(false);
  }, [router]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalized = normalizeEmployeeId(employeeNumber);
    if (!normalized) {
      setError('Enter your employee number to continue.');
      return;
    }

    if (!isAllowedEmployeeId(normalized)) {
      setError('Employee number not recognized. Contact the ops supervisor to be added.');
      return;
    }

    storeEmployeeId(normalized);
    router.push(`/profile/${normalized}`);
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sky-100">
        <span className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-200/80">
          Loading portal…
        </span>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Polar Ops Access Portal</title>
        <meta
          name="description"
          content="Secure employee access for the Polar Ice Ops training environment."
        />
      </Head>

      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-sky-950/80 to-cyan-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(125,211,252,0.22),transparent_60%),radial-gradient(circle_at_85%_12%,rgba(14,165,233,0.16),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(8,47,73,0.55)_0%,rgba(12,74,110,0.35)_45%,rgba(14,116,144,0.28)_100%)] mix-blend-screen" />

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {SNOWFLAKES.map((flake, index) => (
            <span
              key={index}
              className="snowflake"
              style={{
                left: flake.left,
                animationDelay: flake.animationDelay,
                animationDuration: flake.animationDuration,
                width: flake.size,
                height: flake.size,
                '--drift': flake.drift,
                '--opacity': flake.opacity,
              }}
            />
          ))}
        </div>

        <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-16 sm:px-8 lg:px-12">
          <div className="flex flex-1 flex-col justify-center gap-12 lg:flex-row lg:items-stretch">
            <section className="frost-card relative flex-1 overflow-hidden rounded-3xl border border-sky-100/10 bg-white/10 p-8 text-sky-100 shadow-[0_8px_30px_rgba(3,105,161,0.12)] backdrop-blur-xl sm:p-12">
              <div className="flex w-full flex-col gap-6">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-200/70">
                  Polar Ops Secure Entry
                </span>
                <h1 className="text-4xl font-semibold text-neutral-100 sm:text-5xl">Employee access portal</h1>
                <p className="text-base leading-relaxed text-sky-200/80">
                  Verify your employee number to load your personalized training dashboard and launch tools tailored
                  to your role.
                </p>

                <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
                  <label className="flex flex-col gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-sky-200/60">
                    Employee Number
                    <input
                      value={employeeNumber}
                      onChange={(event) => {
                        const digitsOnly = event.target.value.replace(/\D+/g, '');
                        setEmployeeNumber(digitsOnly);
                        setError('');
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="e.g. 50731"
                      className="w-full rounded-2xl border border-white/20 bg-slate-950/60 px-4 py-3 text-base font-normal tracking-[0.1em] text-sky-100 placeholder:text-sky-200/40 focus:border-cyan-300/60 focus:outline-none"
                    />
                  </label>

                  {error ? (
                    <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className="frost-action relative inline-flex items-center justify-center overflow-hidden rounded-2xl border border-cyan-100/30 bg-cyan-500/20 px-6 py-3 text-base font-semibold text-neutral-100 shadow-[0_8px_30px_rgba(3,105,161,0.18)] backdrop-blur-lg transition-all duration-300 hover:bg-cyan-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                  >
                    Enter secure area
                  </button>
                </form>

                <p className="text-xs uppercase tracking-[0.2em] text-sky-200/50">
                  Need access? Contact <span className="text-sky-100">ops-supervisor@polarops.example</span>
                </p>
              </div>
            </section>

            <aside className="frost-card relative flex w-full max-w-md flex-col justify-between gap-8 overflow-hidden rounded-3xl border border-sky-100/10 bg-white/5 p-6 text-sky-200/80 shadow-[0_8px_30px_rgba(3,105,161,0.12)] backdrop-blur-xl sm:p-8">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-neutral-100">Authorized roster</h2>
                <p className="text-sm leading-relaxed text-sky-200/80">
                  The following employee numbers are currently provisioned for the simulator. IDs are case sensitive and
                  managed by the operations supervisor.
                </p>
              </div>

              <ul className="grid gap-4">
                {employees.map((employee) => (
                  <li
                    key={employee.id}
                    className="frost-chip flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-sky-100 backdrop-blur-lg"
                  >
                    <span className="text-xs uppercase tracking-[0.25em] text-sky-200/60">{employee.id}</span>
                    <span className="text-lg font-semibold text-neutral-100">{employee.name}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-sky-200/60">{employee.role}</span>
                  </li>
                ))}
              </ul>

              <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3 text-xs uppercase tracking-[0.25em] text-sky-200/70">
                Access is logged for compliance. Shared credentials are prohibited.
              </div>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}
