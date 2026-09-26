import { describe, expect, it } from 'vitest';

import { parseBulkLines } from './model';

describe('bulk stock lines', () => {
  it('reads SKU and signed change pairs in any common separator', () => {
    const { lines, errors } = parseBulkLines(
      '# counted on Monday\nCW-SOFA-01, +5\n\nCW-BED-02\t-2\nCW/TBL.3 7\n',
    );
    expect(errors).toEqual([]);
    expect(lines).toEqual([
      { line: 2, sku: 'CW-SOFA-01', delta: 5 },
      { line: 4, sku: 'CW-BED-02', delta: -2 },
      { line: 5, sku: 'CW/TBL.3', delta: 7 },
    ]);
  });

  it('names every unreadable, zero or repeated line so nothing is sent half-read', () => {
    const { errors } = parseBulkLines('CW-SOFA-01, +5\nCW-SOFA-01, 0\nnot a line\nCW-SOFA-01, -1');
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/^Line 2: /);
    expect(errors[1]).toMatch(/^Line 3: /);
    expect(errors[2]).toBe('Line 4: CW-SOFA-01 appears more than once.');
  });
});
