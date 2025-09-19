import { memo } from "react";

type ProgressRingProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
};

export const ProgressRing = memo(function ProgressRing({
  value,
  size = 80,
  strokeWidth = 6
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - clamped * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Timer progress ${Math.round(clamped * 100)} percent`}
      className="text-sky-500"
    >
      <circle
        className="text-slate-800"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
        opacity={0.25}
      />
      <circle
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        className="transition-all duration-150 ease-linear"
      />
    </svg>
  );
});
