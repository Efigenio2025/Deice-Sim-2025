import { Gate } from '@/components/Gate';
import { Glass } from '@/components/Glass';
import { Briefcase, ClipboardList, Gauge, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  return (
    <Gate allowedRoles={['shift-manager', 'gm']} heading="Executive dashboard">
      <div className="grid gap-6 md:grid-cols-2">
        <Glass className="flex flex-col gap-5 p-8" ariaLabel="Operations tempo">
          <h1 className="flex items-center gap-3 text-2xl font-semibold text-neutral-100">
            <Gauge aria-hidden className="h-6 w-6 text-emerald-500" />
            Operations tempo
          </h1>
          <div className="grid gap-3 text-sm text-neutral-300/80">
            <p>
              Throughput pacing at <span className="text-emerald-300">94%</span> with two gates holding for crew swap.
            </p>
            <p>
              Downtime delta: <span className="text-amber-300">-7m vs plan</span>.
            </p>
          </div>
          <div className="grid gap-2 text-xs text-neutral-300/80">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-3 py-2">
              <span className="flex items-center gap-2">
                <TrendingUp aria-hidden className="h-4 w-4 text-emerald-400" /> Compliance
              </span>
              <span className="text-emerald-300">No deviations detected</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-3 py-2">
              <span className="flex items-center gap-2">
                <TrendingUp aria-hidden className="h-4 w-4 text-amber-400" /> Budget
              </span>
              <span className="text-amber-300">Glycol spend +4.6%</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-3 py-2">
              <span className="flex items-center gap-2">
                <TrendingUp aria-hidden className="h-4 w-4 text-sky-400" /> Staffing
              </span>
              <span className="text-sky-300">Shift 3 short two techs</span>
            </div>
          </div>
        </Glass>
        <Glass className="flex flex-col gap-4 p-8" ariaLabel="Strategic initiatives">
          <h2 className="flex items-center gap-3 text-xl font-semibold text-neutral-100">
            <Briefcase aria-hidden className="h-5 w-5 text-sky-500" />
            Strategic initiatives
          </h2>
          <ul className="grid gap-3 text-sm text-neutral-300/80">
            <li className="flex items-start gap-3 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-4 py-3">
              <ClipboardList aria-hidden className="h-5 w-5 text-emerald-400" />
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.3em] text-neutral-500">Apron digital twin</span>
                <span>Thermal scan alignment &mdash; milestone 2 delivered (88% confidence).</span>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-4 py-3">
              <ClipboardList aria-hidden className="h-5 w-5 text-sky-400" />
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.3em] text-neutral-500">Fleet electrification</span>
                <span>Charging lanes 5 &amp; 6 energized. Incentives review queued.</span>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-4 py-3">
              <ClipboardList aria-hidden className="h-5 w-5 text-amber-400" />
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.3em] text-neutral-500">Risk mitigation</span>
                <span>Scenario board highlights 3 watch items. Summit scheduled 14:00.</span>
              </div>
            </li>
          </ul>
        </Glass>
      </div>
    </Gate>
  );
}
