import * as React from 'react';
import { IconName } from '../core/Icon';

export interface ListRowProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'title'> {
  icon?: IconName;
  iconTone?: 'neutral' | 'brand' | 'info' | 'accent' | 'critical';
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Right-aligned content (value, StatusPill, etc.). */
  right?: React.ReactNode;
  chevron?: boolean;
  /** Coral title + icon for destructive rows (sign out, revoke). */
  destructive?: boolean;
  style?: React.CSSProperties;
}

/** Tappable list row — settings, access grants, navigation. Group inside a Card and divide with hairlines. */
export function ListRow(props: ListRowProps): JSX.Element;
