import { FrostCard } from '../components/frost/FrostCard';

const achievements = [
  { label: 'Runs Completed', value: '32' },
  { label: 'Best Accuracy', value: '96%' },
  { label: 'Manual Saves', value: '12' },
];

export default function ProfilePage() {
  return (
    <div className="space-y-8 pb-20">
      <header className="space-y-3">
        <p className="frost-pill muted w-fit">Profile</p>
        <h1 className="font-display text-3xl font-semibold text-slate-100">Iceman Profile</h1>
        <p className="max-w-2xl text-sm text-slate-300/80">
          Your profile adopts the Frost Dashboard layout: arctic gradients, frosted cards, and responsive spacing.
        </p>
      </header>

      <FrostCard padding="lg" interactive={false}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500/30 via-cyan-400/20 to-transparent text-3xl">
              ❄️
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold text-slate-100">Avery Iceman</h2>
              <p className="text-sm text-slate-300/80">Ramp Operations • OMA Station</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="frost-btn text-xs">Edit Profile</button>
            <button className="frost-btn ghost text-xs">Sign Out</button>
          </div>
        </div>
      </FrostCard>

      <div className="grid gap-4 md:grid-cols-3">
        {achievements.map((item) => (
          <FrostCard key={item.label} padding="lg" interactive={false}>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
            <p className="text-4xl font-semibold text-slate-100">{item.value}</p>
          </FrostCard>
        ))}
      </div>

      <FrostCard padding="lg" interactive={false}>
        <h2 className="font-display text-2xl font-semibold text-slate-100">Recent Sessions</h2>
        <div className="mt-4 space-y-3">
          {['Full Body Type I Only', 'Hold Short Variation', 'Anti-Ice Refresher'].map((session) => (
            <div key={session} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <span>{session}</span>
              <span className="frost-pill muted">Completed</span>
            </div>
          ))}
        </div>
      </FrostCard>
    </div>
  );
}
