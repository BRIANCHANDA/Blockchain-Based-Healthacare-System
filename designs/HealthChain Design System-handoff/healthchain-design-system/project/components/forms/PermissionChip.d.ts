import * as React from 'react';
import { IconName } from '../core/Icon';

export type PermissionScope =
  | 'visits' | 'vitals' | 'diagnoses' | 'prescriptions' | 'lab-results' | 'imaging';

export interface PermissionChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'onToggle'> {
  /** Permission scope — drives label + icon. */
  scope: PermissionScope | string;
  label?: string;
  icon?: IconName;
  selected?: boolean;
  /** Render as a static summary chip (no toggle). */
  readOnly?: boolean;
  onToggle?: (scope: string) => void;
  style?: React.CSSProperties;
}

/** Multi-select chip for access permissions (visits, vitals, diagnoses, prescriptions, lab results, imaging). */
export function PermissionChip(props: PermissionChipProps): JSX.Element;
