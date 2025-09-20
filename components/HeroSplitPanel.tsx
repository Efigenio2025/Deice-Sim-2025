'use client';

import { motion } from 'framer-motion';
import { Glass } from './Glass';

export function HeroSplitPanel() {
  return (
    <section aria-labelledby="hero-heading" className="grid gap-8 md:grid-cols-[1.15fr_0.85fr]">
      <Glass interactive className="p-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col gap-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.28em] text-sky-200/80">
            Dark Glass Flight Deck
          </div>
          <div>
            <h1 id="hero-heading" className="text-4xl font-semibold leading-tight text-sky-50 md:text-5xl">
              Precision-guided deicing orchestration.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-sky-100/80">
              Welcome to the control surface engineered for ramp-side velocity. Audit readiness, unlock
              training scenarios, and coordinate shifts through a single pane of frosted glass.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <motion.a
              href="/gateway"
              whileHover={{ x: 4 }}
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-sky-400/80 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/40"
            >
              Enter user gateway
              <span aria-hidden="true" className="text-base">
                →
              </span>
            </motion.a>
            <span className="text-xs uppercase tracking-[0.3em] text-sky-100/60">Access tiers guided by scope</span>
          </div>
        </motion.div>
      </Glass>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.7, ease: 'easeOut' }}
        className="glass-border relative overflow-hidden p-8"
        aria-label="Systems snapshot"
      >
        <div className="relative z-10 flex flex-col gap-6">
          <h2 className="text-lg font-semibold text-sky-100">Systems snapshot</h2>
          <ul className="grid gap-4 text-sm text-sky-100/80">
            <li className="flex items-start justify-between gap-4">
              <span>Turn readiness</span>
              <span className="text-sky-200">+12% trending up</span>
            </li>
            <li className="flex items-start justify-between gap-4">
              <span>Anti-ice glycol</span>
              <span className="text-sky-200">Optimal &bull; 68°F</span>
            </li>
            <li className="flex items-start justify-between gap-4">
              <span>Vehicle telemetry</span>
              <span className="text-sky-200">All lanes nominal</span>
            </li>
            <li className="flex items-start justify-between gap-4">
              <span>Critical alerts</span>
              <span className="text-amber-300">1 ramp hold &mdash; crew en route</span>
            </li>
          </ul>
        </div>
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 top-1/3 h-52 w-52 rounded-full bg-sky-500/20 blur-3xl"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        />
      </motion.div>
    </section>
  );
}
