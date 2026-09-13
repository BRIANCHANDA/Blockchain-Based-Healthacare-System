import * as React from 'react';

export interface ScreenHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'style' | 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Renders a back arrow when provided. */
  onBack?: () => void;
  /** Right-aligned slot (IconButtons, TrustBadge, etc.). */
  right?: React.ReactNode;
  /** Large title style for top-level screens. */
  large?: boolean;
  style?: React.CSSProperties;
}

/** Screen header — large title for top-level screens, back header for detail views. */
export function ScreenHeader(props: ScreenHeaderProps): JSX.Element;
