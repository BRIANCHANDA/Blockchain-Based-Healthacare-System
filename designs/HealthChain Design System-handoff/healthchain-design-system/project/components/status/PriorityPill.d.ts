import * as React from 'react';

export type Priority = 'routine' | 'urgent' | 'emergency' | 'critical';

export interface PriorityPillProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'style'> {
  /** Clinical priority — color, icon and weight all escalate with severity. */
  priority: Priority;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

/** Priority pill — routine → urgent → emergency → critical. Critical is a solid fill so it cannot be missed. */
export function PriorityPill(props: PriorityPillProps): JSX.Element;
