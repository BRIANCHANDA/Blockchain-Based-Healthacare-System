import { useId } from "react";

export function Logo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const gradId = `hcShieldGrad-${useId()}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="MedLink"
      className={className}
    >
      <path
        d="M48 6 L82 18 V46 C82 68 67 82 48 90 C29 82 14 68 14 46 V18 Z"
        fill="var(--brand)"
      />
      <path
        d="M48 6 L82 18 V46 C82 68 67 82 48 90 C29 82 14 68 14 46 V18 Z"
        fill={`url(#${gradId})`}
        fillOpacity="0.18"
      />
      <g stroke="var(--white)" strokeWidth="7" strokeLinecap="round" fill="none">
        <rect x="40.5" y="24" width="15" height="48" rx="7.5" />
        <rect x="24" y="40.5" width="48" height="15" rx="7.5" />
      </g>
      <rect x="40.5" y="40.5" width="15" height="15" rx="3" fill="var(--brand)" />
      <rect x="44" y="44" width="8" height="8" rx="2.5" fill="var(--white)" />
      <defs>
        <linearGradient
          id={gradId}
          x1="48"
          y1="6"
          x2="48"
          y2="90"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--white)" />
          <stop offset="1" stopColor="var(--brand-deep)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
