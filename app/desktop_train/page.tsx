import Link from "next/link";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";

const buttonClass =
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const primaryButton = "bg-sky-500 text-slate-950 hover:bg-sky-400";
const secondaryButton = "border border-slate-700 bg-slate-900/70 text-slate-200 hover:border-sky-500/60";

function DeviceMock() {
  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl shadow-slate-950/40">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-300">
        <span>Scenario · Taxi Handoff</span>
        <Badge tone="sky">Live</Badge>
      </div>
      <div className="mt-4 space-y-2 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-wide text-slate-500">Transcript</p>
        <p className="text-slate-200">
          Captain: "Ready to taxi, tail 443."<br />
          Coordinator: "Hold short taxiway Alpha, expect Type IV."
        </p>
      </div>
      <div className="mt-4 flex gap-3">
        {[
          "Prepare Mic",
          "Start Session",
          "Pause",
          "Mark Highlight"
        ].map((label) => (
          <button
            key={label}
            type="button"
            className="flex-1 rounded-full border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
            aria-label={label}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
        <Badge tone="sky">Score: 84%</Badge>
        <Badge>Mic: Ready</Badge>
        <Badge>Highlights: 2</Badge>
      </div>
    </div>
  );
}

export default function DesktopTrainPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-8 py-14">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-lg font-bold text-slate-950 shadow-lg">
              DI
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-100">Desktop Trainer</h1>
              <p className="text-sm text-slate-400">Full scenario playback with crew coordination highlights</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge tone="sky">Live beta</Badge>
            <Badge>OMA Station</Badge>
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <Card
            title="Session kickoff"
            subtitle="Confirm crew and aircraft details before start"
            action={
              <div className="flex gap-3">
                <Link href="/" className={`${buttonClass} ${secondaryButton}`} aria-label="Back to home">
                  Home
                </Link>
                <Link href="/mobile_train" className={`${buttonClass} ${secondaryButton}`} aria-label="Open mobile trainer">
                  Mobile prep
                </Link>
              </div>
            }
          >
            <p className="text-sm text-slate-300">
              Use the controls to coordinate with the on-pad crew. Keep transcripts accurate and note any
              irregularities using highlights for later review.
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-300">
              <li>Verify aircraft tail, type, and gate assignment</li>
              <li>Confirm Type I and Type IV fluid timing</li>
              <li>Brief hold-short and pushback path</li>
            </ul>
          </Card>
          <DeviceMock />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">Next steps</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/quiz/phonetic" className={`${buttonClass} ${primaryButton}`} aria-label="Open phonetic quiz">
              Launch phonetic quiz
            </Link>
            <Link href="/sim/movement" className={`${buttonClass} ${secondaryButton}`} aria-label="Open movement simulator">
              Movement simulator
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
