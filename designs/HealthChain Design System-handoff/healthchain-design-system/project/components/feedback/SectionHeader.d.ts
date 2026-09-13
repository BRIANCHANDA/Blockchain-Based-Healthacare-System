import * as React from 'react';
import { IconName } from '../core/Icon';

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style' | 'title'> {
  title: React.ReactNode;
  /** Optional count chip. */
  count?: number | string;
  icon?: IconName;
  /** Right-aligned action (e.g. "See all"). */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

/** In-screen section header with optional icon, count chip and action. */
export function SectionHeader(props: SectionHeaderProps): JSX.Element;
