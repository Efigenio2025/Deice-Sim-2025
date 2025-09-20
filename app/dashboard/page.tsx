import { Gate } from '@/components/Gate';
import { Glass } from '@/components/Glass';

export default function DashboardPage() {
  return (
    <Gate allowedRoles={['shift-manager', 'gm']} heading="Executive dashboard">
      <div className="grid gap-6 md:grid-cols-2">
        <Glass className="flex flex-col gap-5 p-6" ariaLabel="Operations tempo">
          <h1 className="text-2xl font-semibold text-sky-100">Operations tempo</h1>
          <div className="grid gap-3 text-sm text-sky-100/80">
            <p>
              Throughput pacing at <span className="text-emerald-300">94%</span> with two gates holding for crew swap.
            </p>
            <p>Downtime delta: <span className="text-amber-300">-7m vs plan</span>.</p>
          </div>
          <div className="grid gap-2 text-xs text-sky-100/70">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
              Compliance &mdash; No deviations detected
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
              Budget &mdash; Glycol spend +4.6% (watch)
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true" />
              Staffing &mdash; Shift 3 short two techs
            </div>
          </div>
        </Glass>
        <Glass className="flex flex-col gap-4 p-6" ariaLabel="Strategic initiatives">
          <h2 className="text-xl font-semibold text-sky-100">Strategic initiatives</h2>
          <ul className="grid gap-3 text-sm text-sky-100/75">
            <li className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.3em] text-sky-100/60">Apron digital twin</span>
              <span>Thermal scan alignment &mdash; milestone 2 delivered (88% confidence).</span>
            </li>
            <li className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.3em] text-sky-100/60">Fleet electrification</span>
              <span>Charging lanes 5 & 6 energized. Incentives review queued.</span>
            </li>
            <li className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.3em] text-sky-100/60">Risk mitigation</span>
              <span>Scenario board highlights 3 watch items. Summit scheduled 14:00.</span>
            </li>
          </ul>
        </Glass>
      </div>
    </Gate>
  );
}
