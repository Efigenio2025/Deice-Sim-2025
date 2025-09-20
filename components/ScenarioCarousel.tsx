'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Glass } from './Glass';

interface Scenario {
  id: string;
  title: string;
  detail: string;
  tags: string[];
  status: string;
}

const scenarios: Scenario[] = [
  {
    id: 'whiteout-approach',
    title: 'Whiteout approach — RWY 22',
    detail: 'Integrate low-visibility taxi choreography with heated boom staging.',
    tags: ['IFR', 'Low vis', '4 crews'],
    status: 'Ready',
  },
  {
    id: 'nozzle-freeze',
    title: 'Nozzle freeze recovery',
    detail: 'Diagnose line pressure anomalies and reroute truck deployment mid-cycle.',
    tags: ['Diagnostics', 'Time critical'],
    status: 'In review',
  },
  {
    id: 'unexpected-hold',
    title: 'Unexpected hold release',
    detail: 'Coordinate rapid resume after tower-imposed hold with staggered departures.',
    tags: ['Tower', 'Coordination'],
    status: 'Ready',
  },
  {
    id: 'glycol-shortage',
    title: 'Glycol shortage escalation',
    detail: 'Blend resource-sharing matrix with emergency procurement overlays.',
    tags: ['Logistics', 'Critical'],
    status: 'Escalated',
  },
];

export function ScenarioCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const children = Array.from(container.children) as HTMLElement[];
      const center = container.scrollLeft + container.clientWidth / 2;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      children.forEach((child, index) => {
        const childCenter = child.offsetLeft + child.clientWidth / 2;
        const distance = Math.abs(center - childCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActive((current) => (current === closestIndex ? current : closestIndex));
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToIndex = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const clamped = Math.min(scenarios.length - 1, Math.max(0, index));
    const target = container.children[clamped] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    setActive(clamped);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollToIndex(active + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollToIndex(active - 1);
    }
  };

  return (
    <section aria-labelledby="scenario-carousel-heading" className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 id="scenario-carousel-heading" className="text-2xl font-semibold text-sky-100">
          Scenario carousel
        </h2>
        <span className="text-xs uppercase tracking-[0.3em] text-sky-100/60">Scroll + arrow keys</span>
      </div>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-slate-950/60 to-transparent" aria-hidden="true" />
        <div className="absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-slate-950/60 to-transparent" aria-hidden="true" />
        <div className="scroll-shadow rounded-3xl">
          <div
            ref={containerRef}
            tabIndex={0}
            role="listbox"
            aria-roledescription="Scenario carousel"
            aria-activedescendant={`scenario-${scenarios[active].id}`}
            onKeyDown={handleKeyDown}
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 py-6 focus:ring-0"
          >
            {scenarios.map((scenario, index) => (
              <Glass
                key={scenario.id}
                ariaLabel={scenario.title}
                className="snap-center shrink-0 basis-[80%] p-6 md:basis-[60%]"
                interactive
              >
                <motion.div
                  id={`scenario-${scenario.id}`}
                  role="option"
                  aria-selected={active === index}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="flex h-full flex-col gap-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-xl font-semibold text-sky-50">{scenario.title}</h3>
                    <span
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-sky-100/80"
                    >
                      {scenario.status}
                    </span>
                  </div>
                  <p className="text-sm text-sky-100/80">{scenario.detail}</p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {scenario.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-sky-500/10 px-3 py-1 text-xs text-sky-100/70"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.div>
              </Glass>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-sky-100/60">
          <div aria-live="polite">{scenarios[active].title}</div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => scrollToIndex(active - 1)}
              className="focus-ring rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sky-200"
              aria-label="Previous scenario"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollToIndex(active + 1)}
              className="focus-ring rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sky-200"
              aria-label="Next scenario"
            >
              →
            </button>
          </div>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={scenarios[active].id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="text-sm text-sky-100/70"
        >
          {scenarios[active].detail}
        </motion.p>
      </AnimatePresence>
    </section>
  );
}
