import * as React from 'react';

export type IconName =
  | 'lock' | 'unlock' | 'shield' | 'shield-check' | 'shield-alert'
  | 'check' | 'check-circle' | 'x' | 'x-circle'
  | 'alert-triangle' | 'alert-octagon' | 'activity' | 'heart-pulse' | 'droplet'
  | 'qr-code' | 'chevron-right' | 'chevron-down' | 'chevron-left'
  | 'arrow-left' | 'arrow-right' | 'plus' | 'clock' | 'calendar'
  | 'file-text' | 'pill' | 'flask' | 'scan' | 'stethoscope'
  | 'user' | 'bell' | 'eye' | 'eye-off' | 'fingerprint' | 'building'
  | 'trending-up' | 'trending-down' | 'send' | 'settings' | 'log-out'
  | 'help-circle' | 'link' | 'search' | 'info' | 'map-pin';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon name from the HealthChain set (mirrors Lucide). */
  name: IconName;
  /** Pixel size (width = height). Default 20. */
  size?: number;
  /** Stroke color. Defaults to currentColor. */
  color?: string;
  /** Stroke width. Default 2. */
  strokeWidth?: number;
}

/** Inline stroke icon from the HealthChain set. */
export function Icon(props: IconProps): JSX.Element;
