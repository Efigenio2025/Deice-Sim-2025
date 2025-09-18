import Link from 'next/link';
import { FrostCard } from '../components/frost/FrostCard';

const heroStats = [
  { label: 'Live Scenarios', value: '4', meta: 'with captain voiceovers' },
  { label: 'Avg. Response Time', value: '12.4s', meta: 'across last session' },
  { label: 'Accuracy Peak', value: '94%', meta: 'top iceman performance' },
];

export default function Home({ scenarios = [] }) {
  return (
    <div className="space-y-12 pb-24">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <FrostCard className="relative overflow-hidden" floating>
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.4em] text-cyan-200/90">
              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-300 animate-pulse" aria-hidden="true" />
              Frost Dashboard
            </div>
            <div className="space-y-4">
              <h1 className="font-display text-4xl font-semibold leading-tight text-slate-100 sm:text-5xl">
                Train de-ice calls with a cinematic arctic cockpit
              </h1>
              <p className="max-w-xl text-base text-slate-300">
                Practice captain-to-iceman communication with immersive audio, adaptive scoring, and session analytics. Built for
                mobile readiness with frost-layered cards and responsive controls.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/desktop_train" className="frost-btn">
                Launch Desktop Trainer
              </Link>
              <Link href="/mobile_train" className="frost-btn ghost">
                Mobile Mode
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.3em] text-slate-400/90">
              <span>Voice-Activated</span>
              <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
              <span>Scored Debriefs</span>
              <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
              <span>Scenario Library</span>
            </div>
          </div>
        </FrostCard>

        <div className="grid gap-4 sm:grid-cols-3">
          {heroStats.map((stat) => (
            <FrostCard key={stat.label} padding="sm" interactive={false} className="bg-white/5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{stat.label}</p>
              <p className="text-3xl font-semibold text-slate-100">{stat.value}</p>
              <p className="text-xs text-slate-400">{stat.meta}</p>
            </FrostCard>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-slate-100">Scenario Lineup</h2>
            <p className="text-sm text-slate-300/80">Choose a scenario to pre-load captain cues with frost-wipe cards.</p>
          </div>
          <Link href="/resources" className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            View training resources →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((scenario, index) => (
            <FrostCard key={scenario.id} href="/desktop_train" padding="sm" floating={index % 2 === 1}>
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-cyan-200/80">
                <span>Scenario {index + 1}</span>
                <span>{scenario.id.replace(/_/g, ' ')}</span>
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-100">{scenario.label}</h3>
              <p className="text-sm text-slate-300/80">
                Simulated captain + iceman exchange with transcript diffing, manual override, and CSV exports.
              </p>
              <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                <span>Type I Pad • Omaha</span>
                <span className="frost-pill">3 rounds</span>
              </div>
            </FrostCard>
          ))}
          {scenarios.length === 0 && (
            <FrostCard padding="sm" interactive={false}>
              <p className="text-sm text-slate-300">Scenario library loading…</p>
            </FrostCard>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <FrostCard padding="lg" interactive={false}>
          <h3 className="font-display text-xl font-semibold text-slate-100">Frosted Metrics</h3>
          <p className="text-sm text-slate-300/80">
            Track accuracy, pace, and retries with gradient dashboards that match the new Frost palette.
          </p>
          <Link href="/metrics" className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Explore metrics →
          </Link>
        </FrostCard>
        <FrostCard padding="lg" interactive={false}>
          <h3 className="font-display text-xl font-semibold text-slate-100">Audio Lab</h3>
          <p className="text-sm text-slate-300/80">
            Test microphone readiness, preview captain cues, and calibrate frost-wipe levels for every device.
          </p>
          <Link href="/audio-lab" className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Open audio lab →
          </Link>
        </FrostCard>
        <FrostCard padding="lg" interactive={false}>
          <h3 className="font-display text-xl font-semibold text-slate-100">Resource Vault</h3>
          <p className="text-sm text-slate-300/80">
            Quick-start guides, station checklists, and frost-style reference sheets for new hires.
          </p>
          <Link href="/resources" className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Browse resources →
          </Link>
        </FrostCard>
      </section>
    </div>
  );
}

export async function getStaticProps() {
  try {
    const data = await import('../public/scenarios/index.json');
    return { props: { scenarios: data.default || [] } };
  } catch (err) {
    return { props: { scenarios: [] } };
  }
}
