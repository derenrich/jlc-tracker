// Up to 5 decimals so closely spaced chart axis ticks stay distinguishable.
export const usd = (v: number) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}`;

export const count = (v: number) => v.toLocaleString();

// For chart axes, where "800,000,000" doesn't fit: 800M, 1.2B.
export const compact = (v: number) =>
  v.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 });
