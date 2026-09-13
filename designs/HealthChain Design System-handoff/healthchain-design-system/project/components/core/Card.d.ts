import * as React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  padding?: 'sm' | 'md' | 'lg';
  elevation?: 'flat' | 'low' | 'raised';
  /** Adds a press-scale animation when the card is tappable. */
  interactive?: boolean;
  /** Optional left accent stripe color (e.g. a priority/status color). Use sparingly. */
  accent?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** White surface container — the base for visit cards, request cards, sections. */
export function Card(props: CardProps): JSX.Element;
