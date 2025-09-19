import Link from "next/link";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";

const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const primaryButton =
  "bg-sky-500 text-slate-950 hover:bg-sky-400 active:bg-sky-300";
const secondaryButton =
  "border border-slate-700 bg-slate-900/70 text-slate-200 hover:border-sky-500/60 hover:text-sky-200";

const featureBadges = ["Live transcript", "Highlights", "Token scoring", "Scenario cues"];

function DevicePreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-3xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/40 backdrop-blur ${
        compact ? "max-w-sm" : "max-w-md"
      }`}
    >
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-300">
        <span>Scenario · Ramp prep</span>
        <Badge tone="sky">Live</Badge>
      </div>
      <div className="mt-4 space-y-2 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 text-sm text-slate-300">
        <p className="font-semibold text-slate-200">Coordinator</p>
        <p className="text-slate-400">Stand 3 ready for inbound Piedmont 443 · expect Type IV</p>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Transcript</p>
          <p className="mt-2 text-sm text-slate-200">
            Pilot: "Piedmont 443 ready for spray."<br />
            Coordinator: "Copy, hold position."
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold">
        {[
          { label: "Prepare Mic", tone: "default" },
          { label: "Start", tone: "sky" },
          { label: "Pause", tone: "default" }
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            className={`rounded-full border border-slate-800/70 bg-slate-950/80 px-3 py-2 text-slate-100 transition hover:border-sky-500/60 hover:text-sky-200 ${
              action.tone === "sky" ? "bg-sky-500/20 text-sky-200" : ""
            }`}
            aria-label={action.label}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
        <Badge tone="sky">Score: 84%</Badge>
        <Badge>Mic: Ready</Badge>
        <Badge>Highlights queued</Badge>
      </div>
    </div>
  );
}

function MobileHome() {
  return (
    <div className="space-y-10 px-4 pb-28 pt-8">
      <header className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-base font-bold text-slate-950">
          DI
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Piedmont • OMA</Badge>
          <Badge tone="sky">De-Ice Trainer</Badge>
        </div>
      </header>

      <section className="space-y-4">
        <h1 className="text-3xl font-bold leading-tight text-slate-50">
          Communicate clear, calm, and station-ready.
        </h1>
        <p className="text-sm text-slate-300">
          Pocket training for OMA de-ice crews. Run the quick mic prep, rehearse live transcript,
          and launch right into situational drills.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/mobile_train" className={`${buttonBase} ${primaryButton}`} aria-label="Start mobile training">
            Start
          </Link>
          <Link href="/desktop_train" className={`${buttonBase} ${secondaryButton}`} aria-label="Open desktop trainer">
            Desktop
          </Link>
        </div>
      </section>

      <DevicePreview compact />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-100">Feature snapshot</h2>
        <div className="flex flex-wrap gap-2">
          {featureBadges.map((feature) => (
            <Badge key={feature}>{feature}</Badge>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Modules</h2>
        <Card
          title="Phonetic Alphabet — Timed Quiz"
          subtitle="Sharpen letter, number, and callsign recall"
          action={
            <div className="flex gap-2">
              <Link href="/quiz/phonetic" className={`${buttonBase} ${primaryButton}`} aria-label="Open phonetic quiz">
                Launch
              </Link>
              <Link
                href="/quiz/phonetic?mode=settings"
                className={`${buttonBase} ${secondaryButton}`}
                aria-label="Open phonetic quiz settings"
              >
                Settings
              </Link>
            </div>
          }
        >
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
            <li>Modes: letters, numbers, mixed, callsigns</li>
            <li>Metrics: accuracy, streak, tokens hit</li>
            <li>Save best rounds per mode locally</li>
          </ul>
        </Card>
        <Card
          title="Aircraft Movement Verbiage Simulator"
          subtitle="Practice read-backs with safety-critical cues"
          action={
            <div className="flex gap-2">
              <Link href="/sim/movement" className={`${buttonBase} ${primaryButton}`} aria-label="Open movement simulator">
                Launch
              </Link>
              <Link href="/sim/movement#scenarios" className={`${buttonBase} ${secondaryButton}`} aria-label="View scenarios">
                Scenarios
              </Link>
            </div>
          }
        >
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
            <li>Scenarios: Ramp In, Pushback, Taxi handoff</li>
            <li>Coach or Assessment mode toggles</li>
            <li>Tracks latency penalties per cue</li>
          </ul>
        </Card>
      </section>

      <section className="rounded-3xl border border-sky-500/30 bg-sky-500/10 p-6 text-center shadow-lg">
        <h2 className="text-2xl font-semibold text-slate-100">Jump right in</h2>
        <p className="mt-2 text-sm text-slate-200">
          Choose how you want to train today and stay sharp for the next spray window.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link href="/desktop_train" className={`${buttonBase} ${secondaryButton}`} aria-label="Go to desktop trainer">
            Desktop Trainer
          </Link>
          <Link href="/mobile_train" className={`${buttonBase} ${primaryButton}`} aria-label="Go to mobile trainer">
            Mobile Session
          </Link>
        </div>
      </section>

      <footer className="pb-12 text-center text-xs text-slate-500">
        V2 • For training purposes only • OMA Station • 2025
      </footer>
    </div>
  );
}

function DesktopHome() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-8 py-16">
      <header className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-lg font-bold text-slate-950 shadow-lg shadow-sky-900/40">
            DI
          </div>
          <Badge>Piedmont • OMA</Badge>
          <span className="text-3xl font-semibold text-slate-100">De-Ice Trainer</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="sky">V2</Badge>
          <Badge>For training only</Badge>
          <Badge>2025</Badge>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <Card
          className="relative overflow-hidden"
          title="de-ice / anti-ice comms"
          subtitle="Structured scenarios, real-world phrasing"
          action={
            <div className="flex gap-3">
              <Link href="/desktop_train" className={`${buttonBase} ${primaryButton}`} aria-label="Start desktop trainer">
                Desktop Session
              </Link>
              <Link href="/mobile_train" className={`${buttonBase} ${secondaryButton}`} aria-label="Start mobile trainer">
                Mobile Prep
              </Link>
            </div>
          }
        >
          <p className="text-base leading-relaxed text-slate-300">
            Build consistency across the crew. Track live transcripts, highlight safety language, and rehearse
            the key phrases that keep aircraft moving safely out of OMA.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {featureBadges.map((feature) => (
              <Badge key={feature}>{feature}</Badge>
            ))}
          </div>
        </Card>
        <div className="flex items-center justify-center">
          <DevicePreview />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card title="Live Transcript" subtitle="Instant playback for every crew call">
          Capture every exchange, flag key tokens, and review when latency creeps in.
        </Card>
        <Card title="Scenario Cues" subtitle="Stay ahead of changing aircraft states">
          Pre-scripted cues simulate the ramp flow from stand entry through anti-ice clearance.
        </Card>
        <Card title="Station-Ready" subtitle="Built for Piedmont OMA">
          Align language across shifts with quick refreshers and micro-drills.
        </Card>
      </section>

      <section className="grid gap-8 lg:grid-cols-2" id="modules">
        <Card
          title="Phonetic Alphabet — Timed Quiz"
          subtitle="Stay sharp with rapid recall drills"
          action={
            <div className="flex gap-3">
              <Link href="/quiz/phonetic" className={`${buttonBase} ${primaryButton}`} aria-label="Launch phonetic quiz">
                Launch Quiz
              </Link>
              <Link
                href="/quiz/phonetic?mode=settings"
                className={`${buttonBase} ${secondaryButton}`}
                aria-label="Open phonetic settings"
              >
                Settings
              </Link>
            </div>
          }
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>Switch between letters, numbers, mixed, or callsigns</li>
            <li>Track accuracy, streaks, and words-per-minute</li>
            <li>Persist your personal bests per mode locally</li>
          </ul>
        </Card>
        <Card
          title="Aircraft Movement Verbiage Simulator"
          subtitle="Practice confident, complete read-backs"
          action={
            <div className="flex gap-3">
              <Link href="/sim/movement" className={`${buttonBase} ${primaryButton}`} aria-label="Launch movement simulator">
                Launch Simulator
              </Link>
              <Link href="/sim/movement#scenarios" className={`${buttonBase} ${secondaryButton}`} aria-label="View simulator scenarios">
                Scenarios
              </Link>
            </div>
          }
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>Ramp In, Pushback, and Taxi Handoff drills</li>
            <li>Coach mode reveals exemplars after each cue</li>
            <li>Assessment mode waits until the end for review</li>
          </ul>
        </Card>
      </section>

      <section className="flex flex-col items-center gap-6 rounded-3xl border border-sky-500/40 bg-gradient-to-r from-sky-500/10 via-slate-900/60 to-sky-500/10 p-10 text-center shadow-2xl">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold text-slate-100">Jump right in</h2>
          <p className="text-base text-slate-300">
            Launch the full trainer or run the mobile prep before you head out to the pad.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/desktop_train" className={`${buttonBase} ${primaryButton}`} aria-label="Open desktop trainer">
            Desktop Trainer
          </Link>
          <Link href="/mobile_train" className={`${buttonBase} ${secondaryButton}`} aria-label="Open mobile trainer">
            Mobile Session
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-800/70 pt-8 text-center text-sm text-slate-500">
        V2 • For training purposes only • OMA Station • 2025
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="sm:hidden">
        <MobileHome />
      </div>
      <div className="hidden sm:block">
        <DesktopHome />
      </div>
    </div>
  );
}
