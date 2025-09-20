import { Gate } from '@/components/Gate';
import { Glass } from '@/components/Glass';
import { Activity, Snowflake, Timer } from 'lucide-react';

export default function TrainPage() {
  return (
    <Gate allowedRoles={['ramp-agent', 'trainer']} heading="Training deck access">
      <div className="grid gap-6 md:grid-cols-2">
        <Glass className="flex flex-col gap-4 p-8" ariaLabel="Training readiness">
          <h1 className="flex items-center gap-3 text-2xl font-semibold text-neutral-100">
            <Snowflake aria-hidden className="h-6 w-6 text-sky-500" />
            Training readiness
          </h1>
          <p className="text-sm text-neutral-300/80">
            Access curated cold weather drills and real-time ramp feedback. Track crew proficiency and respond to scenario heat maps in seconds.
          </p>
          <ul className="grid gap-2 text-xs text-neutral-300/80">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              12 open drills awaiting validation
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Ramp crew cohesion at 86%
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Trainer review cycle due in 3 hours
            </li>
          </ul>
        </Glass>
        <Glass className="flex flex-col gap-4 p-8" ariaLabel="Live sim timeline">
          <h2 className="flex items-center gap-3 text-xl font-semibold text-neutral-100">
            <Activity aria-hidden className="h-5 w-5 text-emerald-500" />
            Live sim timeline
          </h2>
          <ol className="grid gap-3 text-sm text-neutral-300/80">
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-neutral-300">
                <Timer aria-hidden className="h-4 w-4 text-neutral-500" /> 07:30 &mdash; IFR snow squall refresh
              </span>
              <span className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                Ready
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-neutral-300">
                <Timer aria-hidden className="h-4 w-4 text-neutral-500" /> 09:15 &mdash; Boil-off mitigation briefing
              </span>
              <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                Pending
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-neutral-300">
                <Timer aria-hidden className="h-4 w-4 text-neutral-500" /> 12:20 &mdash; Equipment redundancy check
              </span>
              <span className="rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
                Locked
              </span>
            </li>
          </ol>
        </Glass>
      </div>
    </Gate>
  );
}
