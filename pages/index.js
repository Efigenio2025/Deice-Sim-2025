import Head from 'next/head';

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

const FEATURE_CARDS = [
  {
    title: 'Live Ops Transcript',
    description:
      'Pinpoint the captain’s phrasing with real-time transcription tuned for icy ramp comms.',
    badge: 'Signal clarity',
  },
  {
    title: 'Scenario Intelligence',
    description:
      'Surface runway, holdover, and fluid cues instantly so your callouts stay arctic-sharp.',
    badge: 'Holdover tracking',
  },
  {
    title: 'Confidence Metrics',
    description:
      'Receive frost-blue scoring, timing deltas, and next actions the second you key off.',
    badge: 'Scoring pulse',
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>Polar Ice Ops | De-Ice Trainer</title>
        <meta
          name="description"
          content="Polar Ice Ops is the frosted-glass command center for the De-Ice Trainer. Launch desktop or mobile sims and stay ahead of the storm."
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

        <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-16 sm:px-8 lg:px-12">
          <div className="flex flex-1 flex-col justify-center gap-12">
            <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center">
              <div className="frost-card relative overflow-hidden rounded-3xl border border-neutral-200/30 bg-white/10 p-8 text-sky-200/80 shadow-[0_8px_30px_rgba(3,105,161,0.12)] backdrop-blur-xl transition-all duration-500 sm:p-12">
                <div className="flex flex-col gap-6">
                  <span className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-200/60">
                    Polar Ice Ops
                  </span>
                  <h1 className="text-4xl font-semibold text-neutral-100 sm:text-5xl">
                    Frost-forged comms, ready for every pushback.
                  </h1>
                  <p className="text-lg leading-relaxed text-sky-200/80">
                    Run simulated de-ice conversations with crystal clarity. Desktop crews and
                    mobile ramp agents coordinate against the cold front with synchronized
                    scoring, transcripts, and holdover intel.
                  </p>
                  <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
                    <a
                      href="/desktop_train"
                      className="frost-action relative overflow-hidden rounded-2xl border border-neutral-200/30 bg-cyan-500/20 px-6 py-3.5 text-center text-base font-semibold text-neutral-100 shadow-[0_8px_30px_rgba(3,105,161,0.12)] backdrop-blur-lg transition-all duration-300 hover:bg-cyan-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                    >
                      Launch Desktop Training
                    </a>
                    <a
                      href="/mobile_train"
                      className="frost-action relative overflow-hidden rounded-2xl border border-neutral-200/30 bg-slate-900/40 px-6 py-3.5 text-center text-base font-semibold text-neutral-100 shadow-[0_8px_30px_rgba(3,105,161,0.12)] backdrop-blur-lg transition-all duration-300 hover:bg-slate-800/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                    >
                      Launch Mobile Training
                    </a>
                  </div>
                </div>
              </div>

              <aside className="frost-card relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-3xl border border-neutral-200/30 bg-white/5 p-6 text-sky-200/80 shadow-[0_8px_30px_rgba(3,105,161,0.12)] backdrop-blur-xl sm:p-8">
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold text-neutral-100">De-Ice Status Board</h2>
                  <p className="max-w-sm text-base leading-relaxed text-sky-200/80">
                    Monitor scenario readiness, mic checks, and anti-ice coverage at a glance. The
                    Polar matrix keeps ops aligned when temps drop.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="frost-chip rounded-2xl border border-neutral-200/20 bg-white/5 px-4 py-4 text-sm text-sky-200/80 backdrop-blur-lg">
                    <span className="block text-xs uppercase tracking-[0.2em] text-sky-200/60">
                      Holdover Window
                    </span>
                    <span className="mt-2 block text-2xl font-semibold text-neutral-100">+18 min</span>
                    <span className="mt-1 block text-xs text-sky-200/70">Type IV fluid · Moderate snow</span>
                  </div>
                  <div className="frost-chip rounded-2xl border border-neutral-200/20 bg-white/5 px-4 py-4 text-sm text-sky-200/80 backdrop-blur-lg">
                    <span className="block text-xs uppercase tracking-[0.2em] text-sky-200/60">
                      Comm Link
                    </span>
                    <span className="mt-2 block text-2xl font-semibold text-neutral-100">Green</span>
                    <span className="mt-1 block text-xs text-sky-200/70">Signal 96% · Auto log enabled</span>
                  </div>
                </div>
              </aside>
            </section>

            <section className="grid gap-6 md:grid-cols-3">
              {FEATURE_CARDS.map((feature) => (
                <article
                  key={feature.title}
                  className="frost-card group relative overflow-hidden rounded-2xl border border-neutral-200/30 bg-white/10 p-6 shadow-[0_8px_30px_rgba(3,105,161,0.12)] backdrop-blur-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/60">
                    <span className="h-2 w-2 rounded-full bg-cyan-300/70 shadow-[0_0_8px_rgba(125,211,252,0.8)]" />
                    {feature.badge}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-neutral-100">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-sky-200/80">{feature.description}</p>
                  <div className="mt-6 flex items-center gap-2 text-sm text-sky-200/70">
                    <span className="h-1.5 w-12 rounded-full bg-gradient-to-r from-sky-200/40 via-cyan-300/50 to-sky-200/30" />
                    Always-on telemetry
                  </div>
                </article>
              ))}
            </section>
          </div>

          <footer className="mt-16 flex flex-col gap-6 border-t border-white/10 pt-8 text-xs text-sky-200/60 sm:flex-row sm:items-center sm:justify-between">
            <span>V2 • Polar Ice Ops • For training purposes only • OMA Station • 2025</span>
            <div className="flex flex-wrap items-center gap-3 text-sky-200/50">
              <span className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.25em] text-sky-200/70">
                Frostline Ready
              </span>
              <span className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.25em] text-sky-200/70">
                Crew Safe
              </span>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
