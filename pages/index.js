import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { isAllowedEmployeeId, normalizeEmployeeId } from "../lib/employeeProfiles";
import { getStoredEmployeeId, storeEmployeeId } from "../lib/employeeSession";

export default function LoginPortal() {
  const router = useRouter();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

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
      setError("Enter your employee number to continue.");
      return;
    }

    if (!isAllowedEmployeeId(normalized)) {
      setError("Employee number not recognized. Contact the ops supervisor to be added.");
      return;
    }

    storeEmployeeId(normalized);
    router.push(`/profile/${normalized}`);
  };

  if (checkingSession) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-sky-950/80 to-cyan-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(125,211,252,0.2),transparent_55%),radial-gradient(circle_at_82%_18%,rgba(14,165,233,0.16),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(8,47,73,0.55)_0%,rgba(12,74,110,0.35)_45%,rgba(14,116,144,0.28)_100%)] mix-blend-screen" />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
          <span className="rounded-full border border-white/15 bg-white/10 px-6 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-sky-200/80">
            Loading…
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Employee Login</title>
        <meta name="description" content="Sign in with your employee number to access your profile." />
      </Head>

      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-sky-950/80 to-cyan-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(125,211,252,0.2),transparent_55%),radial-gradient(circle_at_88%_22%,rgba(14,165,233,0.16),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(8,47,73,0.55)_0%,rgba(12,74,110,0.35)_45%,rgba(14,116,144,0.28)_100%)] mix-blend-screen" />

        <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-16 sm:px-8">
          <div className="w-full max-w-4xl">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/10 text-sky-100 shadow-[0_18px_65px_rgba(8,47,73,0.35)] backdrop-blur-2xl">
              <div className="grid gap-0 divide-y divide-white/5 md:grid-cols-[1.2fr,1fr] md:divide-x md:divide-y-0">
                <div className="flex flex-col gap-6 p-8 sm:p-10">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-sky-200/70">
                    Polar Ops Access
                  </span>
                  <div className="space-y-3">
                    <h1 className="text-3xl font-semibold text-neutral-100 sm:text-4xl">Employee Login Portal</h1>
                    <p className="text-sm leading-relaxed text-sky-200/80">
                      Enter your assigned employee number to load your personalized profile dashboard for today's operations.
                    </p>
                  </div>

                  <div className="space-y-3 text-sm text-sky-200/70">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="font-semibold uppercase tracking-[0.3em] text-sky-200/80">Security Reminder</p>
                      <p className="mt-2 leading-relaxed">
                        Keep your employee number private. Contact the operations supervisor if you need roster updates or profile
                        assistance.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6 p-8 sm:p-10">
                  <form className="space-y-5" onSubmit={handleSubmit}>
                    <label className="block text-sm font-medium uppercase tracking-[0.25em] text-sky-200/70">
                      Employee Number
                      <input
                        value={employeeNumber}
                        onChange={(event) => {
                          const digitsOnly = event.target.value.replace(/\D+/g, "");
                          setEmployeeNumber(digitsOnly);
                          setError("");
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="e.g. 50731"
                        className="mt-3 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-base font-semibold text-neutral-100 placeholder:text-sky-200/50 shadow-[0_10px_35px_rgba(12,74,110,0.25)] transition focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                      />
                    </label>

                    {error ? (
                      <p className="rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-100 shadow-[0_8px_24px_rgba(217,119,6,0.25)]">
                        {error}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      className="w-full rounded-2xl border border-cyan-200/30 bg-cyan-400/90 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-950 transition hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                    >
                      Log In
                    </button>
                  </form>

                  <button
                    type="button"
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-sky-100 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
                  >
                    Admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
