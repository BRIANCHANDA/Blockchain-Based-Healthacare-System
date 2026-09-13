import * as React from 'react';
import { IconName } from '../core/Icon';

export interface TabItem {
  id: string;
  label: string;
  icon: IconName;
  /** Optional badge count (e.g. pending access requests). */
  badge?: number | string;
}

/**
 * Props for the primary bottom tab bar.
 * @startingPoint section="Navigation" subtitle="Bottom tab bar with center FAB" viewport="390x110"
 */
export interface TabBarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'style'> {
  /** Id of the active tab. */
  active?: string;
  onSelect?: (id: string) => void;
  /** Defaults to Records / Access / History / Referrals. */
  tabs?: TabItem[];
  /** Central floating action (Appointments). */
  onFab?: () => void;
  fabIcon?: IconName;
  style?: React.CSSProperties;
}

/**
 * Primary bottom tab bar — four sections split around a central floating
 * appointment action. 64px tall, safe-area aware.
 */
export function TabBar(props: TabBarProps): JSX.Element;
