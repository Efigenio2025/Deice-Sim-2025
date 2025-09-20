'use client';

import {
  type HTMLMotionProps,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/utils';

interface GlassProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  ariaLabel?: string;
  hoverLift?: boolean;
  flip?: boolean;
}

export function Glass({
  children,
  className,
  interactive = false,
  ariaLabel,
  hoverLift = true,
  flip = false,
  tabIndex,
  role,
  onClick,
  style,
  transition,
  onKeyDown,
  ...motionProps
}: GlassProps) {
  const id = useId();
  const reduceMotion = useReducedMotion();
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

  const motionInitial = reduceMotion ? undefined : { opacity: 0, scale: 0.98 };
  const motionAnimate = reduceMotion ? undefined : { opacity: 1, scale: 1 };
  const motionTransition = reduceMotion
    ? transition
    : transition ?? { duration: 0.45, ease: 'easeOut' as const };

  return (
    <motion.div
      role={ariaLabel ? role ?? 'group' : role}
      aria-label={ariaLabel}
      tabIndex={tabIndex ?? (interactive && (onClick || onKeyDown) ? 0 : undefined)}
      aria-describedby={ariaLabel ? `${id}-desc` : undefined}
      onMouseLeave={interactive ? resetTilt : undefined}
      onMouseMove={interactive ? handleMove : undefined}
      initial={motionInitial}
      animate={motionAnimate}
      transition={motionTransition}
      whileHover={hoverLift ? { y: -4 } : undefined}
      whileFocus={hoverLift ? { y: -2 } : undefined}
      style={{
        ...(style ?? {}),
        ...(flip ? { transformStyle: 'preserve-3d' } : {}),
        ...(interactive ? { rotateX, rotateY } : {}),
      }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40 text-neutral-100 shadow-[0_25px_45px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-transform duration-300',
        'before:pointer-events-none before:absolute before:inset-px before:rounded-[inherit] before:border before:border-white/5 before:opacity-60 before:mix-blend-screen before:content-[""]',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),_transparent_60%)] after:opacity-70 after:content-[""]',
        'focus-ring',
        interactive && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      onKeyDown={onKeyDown}
      {...motionProps}
    >
      <div id={ariaLabel ? `${id}-desc` : undefined} className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
