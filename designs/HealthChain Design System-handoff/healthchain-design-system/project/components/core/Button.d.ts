import * as React from 'react';
import { IconName } from './Icon';

/**
 * Props for the primary action button.
 * @startingPoint section="Core" subtitle="Buttons — primary, secondary, destructive" viewport="700x180"
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  /** Visual style. Default 'primary'. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'tint' | 'destructive';
  /** Default 'md'. All sizes keep a >=38px (sm) / 48px (md) touch target. */
  size?: 'sm' | 'md' | 'lg';
  /** Icon name shown before the label. */
  iconLeft?: IconName;
  /** Icon name shown after the label. */
  iconRight?: IconName;
  /** Shows a spinner glyph and blocks interaction. */
  loading?: boolean;
  /** Stretch to container width. */
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

/**
 * Primary action button. Green primary for the single main action per screen,
 * secondary/tint/ghost for supporting actions, destructive (coral) for revoke/deny.
 */
export function Button(props: ButtonProps): JSX.Element;
