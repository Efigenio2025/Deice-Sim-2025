'use client';

import { type HTMLMotionProps, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/utils';

interface GlassProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  ariaLabel?: string;
}

export function Glass({
  children,
  className,
  interactive = false,
  ariaLabel,
  tabIndex,
  role,
  onClick,
  ...rest
}: GlassProps) {
  const id = useId();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 120, damping: 12, mass: 0.8 });
  const springY = useSpring(y, { stiffness: 120, damping: 12, mass: 0.8 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-10, 10]);

  const resetTilt = () => {
    x.set(0);
    y.set(0);
  };

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const inputX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const inputY = (event.clientY - bounds.top) / bounds.height - 0.5;
    x.set(Math.max(-0.5, Math.min(0.5, inputX)));
    y.set(Math.max(-0.5, Math.min(0.5, inputY)));
  };

  return (
    <motion.div
      role={ariaLabel ? role ?? 'group' : role}
      aria-label={ariaLabel}
      tabIndex={tabIndex ?? (interactive && (onClick || rest.onKeyDown) ? 0 : undefined)}
      aria-describedby={ariaLabel ? `${id}-desc` : undefined}
      onMouseLeave={interactive ? resetTilt : undefined}
      onMouseMove={interactive ? handleMove : undefined}
      whileHover={interactive ? { scale: 1.015 } : undefined}
      whileFocus={interactive ? { scale: 1.01 } : undefined}
      style={interactive ? { rotateX, rotateY } : undefined}
      className={cn(
        'glass-border relative overflow-hidden border border-white/10 bg-slate-900/50 text-slate-100 transition-transform duration-300',
        'focus-ring',
        interactive && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      {...rest}
    >
      <div id={ariaLabel ? `${id}-desc` : undefined} className="relative z-10">
        {children}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)] opacity-70"
      />
    </motion.div>
  );
}
