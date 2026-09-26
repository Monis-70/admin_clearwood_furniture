/** Reasons an admin may record by hand (the API's manual reason list). */
export const MANUAL_REASONS: Record<string, string> = {
  PURCHASE: 'Stock received (purchase)',
  PRODUCTION: 'Made in the workshop',
  RETURN: 'Returned to stock',
  DAMAGE: 'Damaged or lost',
  CORRECTION: 'Stock count correction',
  INITIAL_STOCK: 'Opening stock',
  CANCELLATION: 'Cancelled order put back',
  MANUAL_ADJUSTMENT: 'Other adjustment',
};

/** Every ledger reason, including the ones orders write. */
export const REASON_LABELS: Record<string, string> = {
  ...MANUAL_REASONS,
  ORDER_RESERVED: 'Reserved by an order',
  ORDER_RELEASED: 'Order reservation released',
  ORDER_FULFILLED: 'Shipped to a customer',
};

export interface BulkLine {
  line: number;
  sku: string;
  delta: number;
}

/**
 * "SKU, change" lines (comma, tab or space separated) to bulk items. Returns the parsed lines and
 * the line numbers it could not read; nothing is sent until every line reads.
 */
export function parseBulkLines(text: string): { lines: BulkLine[]; errors: string[] } {
  const lines: BulkLine[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = /^([A-Za-z0-9][A-Za-z0-9._\-/]{1,63})[\s,;\t]+([+-]?\d{1,6})$/.exec(trimmed);
    if (!match || Number(match[2]) === 0) {
      errors.push(
        `Line ${index + 1}: “${trimmed.slice(0, 40)}” — expected “SKU, change” such as “CW-SOFA-01, +5”.`,
      );
      return;
    }
    lines.push({ line: index + 1, sku: match[1]!, delta: Number(match[2]) });
  });
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.sku)) errors.push(`Line ${line.line}: ${line.sku} appears more than once.`);
    seen.add(line.sku);
  }
  return { lines, errors };
}
