import { FrostCard } from '../components/frost/FrostCard';

const accuracyCards = [
  {
    label: 'Overall Accuracy',
    value: '88%',
    delta: '+6% vs last week',
    tone: 'up',
  },
  {
    label: 'Average Response',
    value: '11.8s',
    delta: '-1.4s vs target',
    tone: 'down',
  },
  {
    label: 'Retries per Run',
    value: '0.8',
    delta: '-0.2 vs baseline',
    tone: 'up',
  },
];

const heatmap = [
  { label: 'Captain Brief', value: '92%', tone: 'high' },
  { label: 'Hold Short', value: '84%', tone: 'mid' },
  { label: 'Anti-Ice Confirm', value: '76%', tone: 'low' },
  { label: 'Exit Clearance', value: '90%', tone: 'high' },
];

export default function MetricsPage() {
  return (
    <div className="space-y-8 pb-20">
      <header className="space-y-3">
        <p className="frost-pill muted w-fit">Performance Metrics</p>
        <h1 className="font-display text-3xl font-semibold text-slate-100">Frost Dashboard Metrics</h1>
        <p className="max-w-2xl text-sm text-slate-300/80">
          Track every iceman run with a cool arctic palette. These cards reuse FrostCard for tilt, glow, and frost-wipe effects on
          desktop while keeping touch interactions crisp on mobile.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {accuracyCards.map((card) => (
          <FrostCard key={card.label} padding="lg" floating={card.tone === 'up'}>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{card.label}</p>
            <p className="text-4xl font-semibold text-slate-100">{card.value}</p>
            <p
              className={card.tone === 'down' ? 'text-xs text-rose-200' : 'text-xs text-emerald-200'}
            >
              {card.delta}
            </p>
          </FrostCard>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <FrostCard padding="lg" interactive={false}>
          <h2 className="font-display text-2xl font-semibold text-slate-100">Scenario Heatmap</h2>
          <p className="text-sm text-slate-300/80">
            Highlight where iceman calls succeed or freeze up. Higher cyan glow means tighter comms.
          </p>
          <div className="mt-6 grid gap-3">
            {heatmap.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
              >
                <span>{row.label}</span>
                <span
                  className={
                    row.tone === 'high'
                      ? 'frost-pill'
                      : row.tone === 'mid'
                      ? 'frost-pill muted'
                      : 'inline-flex items-center rounded-full border border-rose-400/30 bg-rose-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-100'
                  }
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </FrostCard>

        <FrostCard padding="lg" interactive={false}>
          <h2 className="font-display text-2xl font-semibold text-slate-100">Theme Snippet</h2>
          <p className="text-sm text-slate-300/80">
            Apply FrostCard to wrap analytics tiles with gradients, blur, and cyan hover rings. The snippet below shows how the
            metrics grid uses Tailwind utilities from the Frost plugin.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs text-cyan-100">
{`<div className="grid gap-4 md:grid-cols-3">
  {metrics.map((m) => (
    <FrostCard key={m.id} padding="lg" floating>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{m.label}</p>
      <p className="text-4xl font-semibold text-slate-100">{m.value}</p>
      <p className="text-xs text-emerald-200">{m.delta}</p>
    </FrostCard>
  ))}
</div>`}
          </pre>
        </FrostCard>
      </div>
    </div>
  );
}
