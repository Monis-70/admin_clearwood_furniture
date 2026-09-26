export const CART_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ABANDONED: 'Abandoned',
  CONVERTED: 'Became an order',
  MERGED: 'Merged at sign-in',
  EXPIRED: 'Expired',
};

export const bpPercent = (bp: number) =>
  `${(bp / 100).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
