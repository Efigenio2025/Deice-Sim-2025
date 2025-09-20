'use client';

import { type LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { Glass } from './Glass';
import { cn } from '@/lib/utils';

const toneStyles: Record<DeckCardTone, string> = {
  neutral: 'text-neutral-100',
  emerald: 'text-emerald-400',
  sky: 'text-sky-400',
  amber: 'text-amber-400',
};

type DeckCardTone = 'neutral' | 'emerald' | 'sky' | 'amber';

interface DeckCardProps extends Omit<React.ComponentProps<typeof Glass>, 'children'> {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  tone?: DeckCardTone;
  media?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function DeckCard({
  title,
  description,
  eyebrow,
  icon: Icon,
  tone = 'neutral',
  media,
  actions,
  children,
  className,
  ...glassProps
}: DeckCardProps) {
  return (
    <Glass {...glassProps} className={cn('flex flex-col gap-6 p-8', className)}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          {(eyebrow || Icon) && (
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400">
              {Icon && <Icon aria-hidden className={cn('h-4 w-4', toneStyles[tone])} />}
              {eyebrow && <span className="truncate">{eyebrow}</span>}
            </div>
          )}
          <h3 className="text-xl font-semibold text-neutral-100">{title}</h3>
          {description && <p className="max-w-prose text-sm text-neutral-300/80">{description}</p>}
        </div>
        {media && <div className="shrink-0">{media}</div>}
      </div>
      {children}
      {actions && <div className="mt-auto flex flex-wrap items-center gap-3 text-sm">{actions}</div>}
    </Glass>
  );
}

