import { Gate } from '@/components/Gate';
import { Glass } from '@/components/Glass';

export default function TrainPage() {
  return (
    <Gate allowedRoles={['ramp-agent', 'trainer']} heading="Training deck access">
      <div className="grid gap-6 md:grid-cols-2">
        <Glass className="flex flex-col gap-4 p-6" ariaLabel="Training readiness">
          <h1 className="text-2xl font-semibold text-sky-100">Training readiness</h1>
          <p className="text-sm text-sky-100/75">
            Access curated cold weather drills and real-time ramp feedback. Track crew proficiency and
            respond to scenario heat maps in seconds.
          </p>
          <ul className="grid gap-2 text-xs text-sky-100/70">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true" />
              12 open drills awaiting validation
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true" />
              Ramp crew cohesion at 86%
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true" />
              Trainer review cycle due in 3 hours
            </li>
          </ul>
        </Glass>
        <Glass className="flex flex-col gap-4 p-6" ariaLabel="Live sim timeline">
          <h2 className="text-xl font-semibold text-sky-100">Live sim timeline</h2>
          <ol className="grid gap-3 text-sm text-sky-100/75">
            <li>
              07:30 &mdash; IFR snow squall refresh <span className="text-emerald-300">Ready</span>
            </li>
            <li>
              09:15 &mdash; Boil-off mitigation briefing <span className="text-amber-300">Pending</span>
            </li>
            <li>
              12:20 &mdash; Equipment redundancy check <span className="text-sky-200">Locked</span>
            </li>
          </ol>
        </Glass>
      </div>
    </Gate>
  );
}
