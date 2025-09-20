'use client';

import { HeroSplitPanel } from './HeroSplitPanel';
import { ModuleProgressGrid } from './ModuleProgressGrid';
import { ScenarioCarousel } from './ScenarioCarousel';

export function IndexSections() {
  return (
    <div className="flex flex-col gap-16">
      <HeroSplitPanel />
      <ModuleProgressGrid />
      <ScenarioCarousel />
    </div>
  );
}
