import * as React from 'react';
import { IconName } from '../core/Icon';

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style' | 'title'> {
  /** 'empty' (default), 'loading' (pulsing) or 'error' (coral). */
  mode?: 'empty' | 'loading' | 'error';
  icon?: IconName;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Optional action element (e.g. a Button). */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Empty / loading / error placeholder for any data-driven screen. */
export function EmptyState(props: EmptyStateProps): JSX.Element;
