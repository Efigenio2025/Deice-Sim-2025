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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sky-100">
        <span className="text-sm font-medium uppercase tracking-[0.3em] text-sky-200/70">Loading…</span>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Employee Login</title>
        <meta name="description" content="Sign in with your employee number to access your profile." />
      </Head>

      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-slate-100 shadow-xl">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold">Employee Login</h1>
            <p className="text-sm text-slate-300">
              Enter your employee number to open your personal profile page.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-left text-sm font-medium text-slate-200">
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
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </label>

            {error ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              Log In
            </button>
          </form>

          <button
            type="button"
            className="mt-6 w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-200 hover:border-slate-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Admin
          </button>
        </div>
      </div>
    </>
  );
}
