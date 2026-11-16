/** Responsive starting points from the supplied HTML foundations. */
export const layoutTokens = {
  mobile: { columns: 4, gutter: 16, margin: 16 },
  tablet: { columns: 8, gutter: 24, margin: 24 },
  desktop: { columns: 12, gutter: 24, margin: 32 },
  minTouchTarget: 44,
  cardRadius: 16,
} as const;
