import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

const MotionDiv = motion.div;

const paddingMap = {
  none: 'p-0',
  xs: 'p-3',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function FrostCard({
  as: Component = 'div',
  href,
  className,
  children,
  padding = 'md',
  floating = false,
  interactive = true,
  ...rest
}) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const handler = (event) => setIsCoarsePointer(event.matches);
    setIsCoarsePointer(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springX = useSpring(tiltX, { stiffness: 120, damping: 14, mass: 0.5 });
  const springY = useSpring(tiltY, { stiffness: 120, damping: 14, mass: 0.5 });
  const rotateX = useTransform(springY, (value) => `${value}deg`);
  const rotateY = useTransform(springX, (value) => `${value}deg`);

  const resetTilt = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  const handlePointerMove = (event) => {
    if (!interactive || reduceMotion || isCoarsePointer) return;
    const node = containerRef.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left;
    const offsetY = event.clientY - bounds.top;
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    const ratioX = (offsetX - centerX) / centerX;
    const ratioY = (offsetY - centerY) / centerY;
    tiltX.set(ratioX * 6);
    tiltY.set(-ratioY * 6);
  };

  const handlePointerLeave = () => {
    resetTilt();
  };

  useEffect(() => {
    if (!interactive || reduceMotion) {
      resetTilt();
    }
  }, [interactive, reduceMotion]);

  const paddingClass = paddingMap[padding] ?? paddingMap.md;

  const coreClasses = useMemo(
    () =>
      clsx(
        'group/frost relative overflow-hidden rounded-3xl border border-white/10 bg-frost-panel text-slate-100 shadow-frost transition-all duration-500 ease-out',
        'supports-backdrop:bg-white/5 supports-backdrop:frost-glass supports-backdrop:border-white/5',
        floating && 'motion-safe:animate-float-gentle',
        paddingClass,
        className
      ),
    [className, floating, paddingClass]
  );

  const sheenClasses =
    'pointer-events-none absolute -inset-[120%] aspect-[2/1] rotate-12 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 transition-opacity duration-500 group-hover/frost:opacity-100 group-focus-visible/frost:opacity-100 group-active/frost:opacity-100 motion-safe:group-hover/frost:animate-frost-wipe motion-safe:group-focus-visible/frost:animate-frost-wipe motion-safe:group-active/frost:animate-frost-wipe';

  const glowClasses =
    'pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent transition duration-500 group-hover/frost:border-cyan-300/25 group-focus-visible/frost:border-cyan-300/35 group-active/frost:border-cyan-200/35';

  const cardContent = (
    <MotionDiv
      ref={containerRef}
      style={{ rotateX, rotateY }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={coreClasses}
      {...rest}
    >
      <span className={glowClasses} aria-hidden="true" />
      <span className={sheenClasses} aria-hidden="true" />
      <div className="relative z-10 space-y-4">{children}</div>
    </MotionDiv>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={clsx(
          'group/frost block rounded-3xl focus-visible:outline-none',
          interactive &&
            'focus-visible:ring-2 focus-visible:ring-cyan-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-frost-midnight'
        )}
      >
        {cardContent}
      </Link>
    );
  }

  if (Component === 'div') {
    return cardContent;
  }

  return (
    <Component
      className={clsx(
        'group/frost block focus-visible:outline-none',
        interactive &&
          'rounded-3xl focus-visible:ring-2 focus-visible:ring-cyan-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-frost-midnight'
      )}
    >
      {cardContent}
    </Component>
  );
}

export default FrostCard;
