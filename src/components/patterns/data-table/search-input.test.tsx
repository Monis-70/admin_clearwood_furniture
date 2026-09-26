import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchInput } from './search-input';

describe('SearchInput', () => {
  afterEach(() => vi.useRealTimers());

  it('follows the URL when the search is cleared elsewhere (Clear filters, saved filter)', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const { rerender } = render(<SearchInput value="sofa" onSearch={onSearch} label="Search" />);
    rerender(<SearchInput value="" onSearch={onSearch} label="Search" />);
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
    expect(onSearch).not.toHaveBeenCalled();

    rerender(<SearchInput value="teak" onSearch={onSearch} label="Search" />);
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('teak');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('keeps what was typed after its own search reached the URL', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const { rerender } = render(<SearchInput value="" onSearch={onSearch} label="Search" />);
    const box = screen.getByRole('searchbox', { name: 'Search' });
    fireEvent.change(box, { target: { value: 'sof' } });
    act(() => vi.advanceTimersByTime(400));
    expect(onSearch).toHaveBeenLastCalledWith('sof');
    fireEvent.change(box, { target: { value: 'sofa' } });
    rerender(<SearchInput value="sof" onSearch={onSearch} label="Search" />);
    expect(box).toHaveValue('sofa');
    act(() => vi.advanceTimersByTime(400));
    expect(onSearch).toHaveBeenLastCalledWith('sofa');
  });
});
