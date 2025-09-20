
'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowRight, GaugeCircle, Radar, ShieldCheck, Thermometer } from 'lucide-react';
import { DeckCard } from './DeckCard';
import { Glass } from './Glass';
import { cn } from '@/lib/utils';

const metrics = [
  {
    id: 'turn-readiness',
    label: 'Turn readiness',
    value: '+12% lift',
    icon: GaugeCircle,
  },
  {
    id: 'glycol',
    label: 'Anti-ice glycol',
    value: 'Optimal · 68°F',
    icon: Thermometer,
  },
  {
    id: 'telemetry',
    label: 'Vehicle telemetry',
    value: 'All lanes nominal',
    icon: Radar,
  },
  {
    id: 'alerts',
    label: 'Critical alerts',
    value: '1 ramp hold',
    icon: AlertTriangle,
  },
];

export function HeroSplitPanel() {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-labelledby="hero-heading" className="grid gap-8 md:grid-cols-[1.15fr_0.85fr]">
      <Glass interactive className="p-10">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { duration: 0.55, ease: 'easeOut' }}
          className="flex flex-col gap-6"
        >
          <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-800/80 bg-neutral-900/70 px-4 py-1 text-xs uppercase tracking-[0.28em] text-neutral-400">
            Dark Glass Flight Deck
          </div>
          <div>
            <h1 id="hero-heading" className="text-4xl font-semibold leading-tight text-neutral-50 md:text-5xl">
              Precision-guided deicing orchestration.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-300/80">
              Welcome to the control surface engineered for ramp-side velocity. Audit readiness, unlock training
              scenarios, and coordinate shifts through a single pane of tempered glass.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <motion.a
              href="/gateway"
              whileHover={reduceMotion ? undefined : { x: 4 }}
              className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-500/30 transition-transform"
            >
              Enter user gateway
              <ArrowRight aria-hidden className="h-4 w-4" />
            </motion.a>
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-400">Access tiers guided by scope</span>
          </div>
        </motion.div>
      </Glass>
      <DeckCard
        ariaLabel="Systems snapshot"
        title="Systems snapshot"
        description="Live telemetry threads keep your ramp, crews, and compliance nodes synchronized."
        eyebrow="Operational pulse"
        icon={ShieldCheck}
        tone="sky"
        className="min-h-full"
      >
        <motion.ul
          initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { duration: 0.5, ease: 'easeOut', delay: 0.08 }}
          className="grid gap-4 text-sm text-neutral-300/80"
        >
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const accent = metric.id === 'alerts' ? 'text-amber-400' : 'text-sky-400';
            return (
              <li key={metric.id} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-3">
                  <Icon aria-hidden className={cn('h-4 w-4', accent)} />
                  {metric.label}
                </span>
                <span className={cn('font-semibold', accent)}>{metric.value}</span>
              </li>
            );
          })}
        </motion.ul>
      </DeckCard>
    </section>
  );
}
