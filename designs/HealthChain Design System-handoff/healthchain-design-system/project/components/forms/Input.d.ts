import * as React from 'react';
import { IconName } from '../core/Icon';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  label?: string;
  /** Leading icon name. */
  icon?: IconName;
  /** Error message — turns the field coral and shows an alert glyph. */
  error?: string;
  /** Helper text shown when there is no error. */
  helper?: string;
  style?: React.CSSProperties;
}

/** Labeled text field. Pass type="password" for a built-in show/hide toggle. 52px tall touch target. */
export function Input(props: InputProps): JSX.Element;
