import * as React from 'react';

export type LockPhase = 'locked' | 'pending' | 'granted' | 'denied';

/**
 * Props for the access-metaphor state tile.
 * @startingPoint section="Access" subtitle="Locked → pending → granted access tile" viewport="700x140"
 */
export interface LockStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style' | 'title'> {
  /** The core access metaphor phase: locked → pending → granted (or denied). */
  phase?: LockPhase;
  /** Override default title / body copy. */
  title?: string;
  body?: string;
  /** Action handler (e.g. send request). Button only renders when provided. */
  onAction?: () => void;
  actionLabel?: string;
  style?: React.CSSProperties;
}

/**
 * Tactile state tile for away-institution records: locked → request → pending → granted.
 * The product's core access metaphor.
 */
export function LockState(props: LockStateProps): JSX.Element;
