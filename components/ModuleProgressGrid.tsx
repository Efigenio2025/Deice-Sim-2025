'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';
import { Glass } from './Glass';

interface ModuleProgress {
  id: string;
  name: string;
  progress: number;
  status: string;
  delta: string;
}

const modules: ModuleProgress[] = [
  {
    id: 'weather',
    name: 'Weather Pattern Intercept',
    progress: 82,
    status: 'Phase 3 · live ops validation',
    delta: '+6.1% efficiency lift',
  },
  {
    id: 'crew',
    name: 'Crew Sync & Dispatch',
    progress: 64,
    status: 'Phase 2 · training rollout',
    delta: '+3 crew certified',
  },
  {
    id: 'automation',
    name: 'Automation Supervisor',
    progress: 48,
    status: 'Phase 1 · modeling',
    delta: 'Risk review scheduled',
  },
  {
    id: 'reporting',
    name: 'Incident Reporting Surface',
    progress: 91,
    status: 'Phase 3 · analytics',
    delta: 'Ready for release',
  },
];

function ProgressRing({ value }: { value: number }) {
  const gradientId = useId();
  const normalized = Math.min(100, Math.max(0, value));
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;

  return (
    <svg
      role="img"
      aria-label={`Progress ${normalized} percent`}
      viewBox="0 0 72 72"
      className="h-20 w-20"
    >
      <circle cx="36" cy="36" r={radius} stroke="rgba(148, 163, 184, 0.35)" strokeWidth="8" fill="transparent" />
      <motion.circle
        cx="36"
        cy="36"
        r={radius}
        stroke={`url(#${gradientId})`}
        strokeWidth="8"
        strokeLinecap="round"
        fill="transparent"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
        strokeDasharray={`${circumference} ${circumference}`}
      />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(56, 189, 248, 0.9)" />
          <stop offset="100%" stopColor="rgba(250, 204, 21, 0.85)" />
        </linearGradient>
      </defs>
      <text
        x="50%"
        y="52%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="fill-sky-50 text-sm font-semibold"
      >
        {normalized}
      </text>
    </svg>
  );
}

export function ModuleProgressGrid() {
  return (
    <section aria-labelledby="module-progress-heading" className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 id="module-progress-heading" className="text-2xl font-semibold text-sky-100">
          Module progress
        </h2>
        <span className="text-xs uppercase tracking-[0.3em] text-sky-100/60">Ring telemetry</span>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {modules.map((module, index) => (
          <Glass key={module.id} interactive ariaLabel={`${module.name} progress`} className="p-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ delay: index * 0.05, duration: 0.5, ease: 'easeOut' }}
              className="flex items-center gap-6"
            >
              <ProgressRing value={module.progress} />
              <div className="flex flex-col gap-1 text-sm">
                <h3 className="text-base font-semibold text-sky-100">{module.name}</h3>
                <p className="text-sky-100/70">{module.status}</p>
                <span className="text-xs text-emerald-300/80">{module.delta}</span>
              </div>
            </motion.div>
          </Glass>
        ))}
      </div>
    </section>
  );
}
