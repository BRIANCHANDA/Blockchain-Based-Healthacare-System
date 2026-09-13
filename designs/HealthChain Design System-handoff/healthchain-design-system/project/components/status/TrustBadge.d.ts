import * as React from 'react';

export type TrustKind = 'blockchain' | 'verified' | 'encrypted' | 'audited' | 'id-only';

export interface TrustBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'style'> {
  kind?: TrustKind;
  /** Override the default label. */
  label?: string;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

/** Trust signal for consent + blockchain audit moments. Use purposefully, never decoratively. */
export function TrustBadge(props: TrustBadgeProps): JSX.Element;
