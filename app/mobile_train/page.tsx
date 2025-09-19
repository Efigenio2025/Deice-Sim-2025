import Link from "next/link";
import { Badge } from "../../components/Badge";

const buttonBase =
  "inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-500/60 hover:text-sky-200";

const controls = ["Prepare Mic", "Check Levels", "Start", "Pause"];

function DeviceShell() {
  return (
    <div className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-300">
        <span>Scenario · Ramp prep</span>
        <Badge tone="sky">Live</Badge>
      </div>
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-wide text-slate-500">Transcript staging</p>
        <p className="mt-2 text-slate-200">
          Coordinator: "Stand three secure, Type I complete."<br />
          Pilot: "Copy, standing by for Type IV."
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {controls.map((label) => (
          <button
            key={label}
            type="button"
            className="rounded-full border border-slate-800/80 bg-slate-950/70 px-3 py-2 font-semibold text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
            aria-label={label}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
        <Badge tone="sky">Score: 84%</Badge>
        <Badge>Mic: Ready</Badge>
        <Badge>Signal: Strong</Badge>
      </div>
    </div>
  );
}

export default function MobileTrainPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 pb-28 pt-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 text-base font-bold text-slate-950">
            DI
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-100">Mobile Trainer</p>
            <p className="text-xs text-slate-400">Quick mic prep &amp; transcript drill</p>
          </div>
        </div>
        <Badge>OMA • 2025</Badge>
      </header>

      <main className="mt-10 space-y-10">
        <section className="space-y-3">
          <h1 className="text-3xl font-bold text-slate-50">Prep your comms before stepping out</h1>
          <p className="text-sm text-slate-300">
            Run the mic workflow, practice the standard script, and confirm the crew briefing tokens before
            you hit the pad.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/desktop_train" className={buttonBase} aria-label="Switch to desktop trainer">
              Open desktop
            </Link>
            <Link href="/" className={buttonBase} aria-label="Return home">
              Back to home
            </Link>
          </div>
        </section>

        <DeviceShell />

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Mic control checklist</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>Confirm aircraft tail in the ops panel</li>
            <li>Brief Type I / Type IV split with de-ice coordinator</li>
            <li>Spot check the aircraft movement plan and safety hold short</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
