import * as React from 'react';

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  /** Full name — used for initials fallback and alt text. */
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'brand' | 'info' | 'accent' | 'neutral';
  /** Optional image URL; falls back to initials. */
  src?: string;
  style?: React.CSSProperties;
}

/** Circular avatar with initials fallback — patients, clinicians, institutions. */
export function Avatar(props: AvatarProps): JSX.Element;
