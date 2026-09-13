import * as React from 'react';
import { IconName } from '../core/Icon';

export interface VitalStatProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** Change vs previous reading, e.g. "+0.4". */
  delta?: React.ReactNode;
  deltaDir?: 'up' | 'down' | 'flat';
  /** Flags an out-of-range / safety-critical value (color + icon + position). */
  critical?: boolean;
  icon?: IconName;
  compact?: boolean;
  style?: React.CSSProperties;
}

/** A single vital reading with optional delta and a critical (out-of-range) flag. */
export function VitalStat(props: VitalStatProps): JSX.Element;
