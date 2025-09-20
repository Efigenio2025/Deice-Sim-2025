'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';
import { Target } from 'lucide-react';
import { DeckCard } from './DeckCard';

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
  const reduceMotion = useReducedMotion();
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
      <circle cx="36" cy="36" r={radius} stroke="rgba(82, 82, 91, 0.45)" strokeWidth="8" fill="transparent" />
      <motion.circle
        cx="36"
        cy="36"
        r={radius}
        stroke={`url(#${gradientId})`}
        strokeWidth="8"
        strokeLinecap="round"
        fill="transparent"
        initial={reduceMotion ? undefined : { strokeDashoffset: circumference }}
        animate={reduceMotion ? undefined : { strokeDashoffset: offset }}
        transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
        strokeDasharray={`${circumference} ${circumference}`}
      />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(16, 185, 129, 0.95)" />
          <stop offset="100%" stopColor="rgba(14, 165, 233, 0.95)" />
        </linearGradient>
      </defs>
      <text
        x="50%"
        y="52%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="fill-neutral-100 text-sm font-semibold"
      >
        {normalized}
      </text>
    </svg>
  );
}

export function ModuleProgressGrid() {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-labelledby="module-progress-heading" className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 id="module-progress-heading" className="text-2xl font-semibold text-neutral-100">
          Module progress
        </h2>
        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-neutral-400">
          <Target aria-hidden className="h-4 w-4 text-sky-400" /> Ring telemetry
        </span>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {modules.map((module, index) => (
          <DeckCard
            key={module.id}
            ariaLabel={`${module.name} progress`}
            title={module.name}
            description={module.status}
            eyebrow="Module cadence"
            tone="emerald"
            className="gap-4"
            media={<ProgressRing value={module.progress} />}
            hoverLift
          >
            <motion.p
              initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.45, ease: 'easeOut', delay: index * 0.05 }}
              className="text-xs font-medium text-emerald-400"
            >
              {module.delta}
            </motion.p>
          </DeckCard>
        ))}
      </div>
    </section>
  );
}
