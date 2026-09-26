import { describe, expect, it } from 'vitest';

import {
  formatCount,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelative,
  greetingFor,
} from './datetime';

describe('date formatting (IST)', () => {
  it('shows UTC instants in India time', () => {
    expect(formatDateTime('2026-09-25T09:37:00.000Z')).toMatch(/^25 Sept? 2026, 15:07 IST$/);
    expect(formatDate('2026-09-24T20:00:00.000Z')).toMatch(/^25 Sep/);
  });

  it('shows a dash for missing or invalid values', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('not a date')).toBe('—');
    expect(formatDate(undefined, 'Never')).toBe('Never');
  });

  it('gives relative hints', () => {
    const now = Date.parse('2026-09-25T10:00:00.000Z');
    expect(formatRelative('2026-09-25T09:59:40.000Z', now)).toBe('just now');
    expect(formatRelative('2026-09-25T09:55:00.000Z', now)).toBe('5 minutes ago');
    expect(formatRelative('2026-09-24T10:00:00.000Z', now)).toBe('yesterday');
  });

  it('formats durations and numbers', () => {
    expect(formatDuration(93_784)).toBe('1 d 2 h');
    expect(formatDuration(3_900)).toBe('1 h 5 min');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatNumber(1240000)).toBe('12,40,000');
  });

  it('counts with the noun in the right number', () => {
    expect(formatCount(1, 'row')).toBe('1 row');
    expect(formatCount(0, 'row')).toBe('0 rows');
    expect(formatCount(2480, 'category', 'categories')).toBe('2,480 categories');
    expect(formatCount(null, 'product')).toBe('— products');
  });

  it('greets by the time of day in IST', () => {
    expect(greetingFor(new Date('2026-09-25T03:00:00.000Z'))).toBe('Good morning');
    expect(greetingFor(new Date('2026-09-25T09:00:00.000Z'))).toBe('Good afternoon');
    expect(greetingFor(new Date('2026-09-25T13:00:00.000Z'))).toBe('Good evening');
  });
});
