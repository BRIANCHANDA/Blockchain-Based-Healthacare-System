import * as React from 'react';

export type StatusKind =
  | 'in-progress' | 'completed' | 'cancelled' | 'pending' | 'accepted' | 'rejected'
  | 'prescribed' | 'dispensing' | 'dispensed' | 'ordered' | 'resulted'
  | 'locked' | 'granted' | 'revoked' | 'expired' | 'approved' | 'denied';

export interface StatusPillProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'style'> {
  /** Lifecycle status — drives color, icon and label together. */
  status: StatusKind;
  size?: 'sm' | 'md';
  /** Solid fill instead of soft tint. */
  solid?: boolean;
  style?: React.CSSProperties;
}

/** Status pill — the one status vocabulary, reused everywhere. Color + icon + label, never color alone. */
export function StatusPill(props: StatusPillProps): JSX.Element;
