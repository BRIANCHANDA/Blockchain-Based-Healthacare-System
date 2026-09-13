import * as React from 'react';
import { IconName } from './Icon';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  /** Icon name to render. */
  icon: IconName;
  /** Default 'md' (44px touch target). */
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'surface' | 'tint';
  /** Accessible label (required — icon-only control). */
  label: string;
  /** Show a small notification dot (e.g. unread alerts). */
  badge?: boolean;
  style?: React.CSSProperties;
}

/** Square icon-only button for headers, toolbars and list affordances. */
export function IconButton(props: IconButtonProps): JSX.Element;
