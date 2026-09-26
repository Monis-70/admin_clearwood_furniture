import { act } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { signInAs } from '@/tests/msw/backend';
import { renderWithProviders } from '@/tests/render';

import { AuthGate } from './auth/guards';
import { isSafeHref, useRecentItems, useSavedFilters } from './local-history';
import { generateTemporaryPassword } from './password';

const holder: {
  recent: ReturnType<typeof useRecentItems> | null;
  saved: ReturnType<typeof useSavedFilters> | null;
} = { recent: null, saved: null };

function Probe() {
  const recent = useRecentItems();
  const saved = useSavedFilters('enquiries');
  useEffect(() => {
    holder.recent = recent;
    holder.saved = saved;
  });
  return null;
}

async function mount() {
  holder.recent = null;
  holder.saved = null;
  signInAs();
  renderWithProviders(
    <AuthGate>
      <Probe />
    </AuthGate>,
  );
  await vi.waitFor(() => expect(holder.recent).not.toBeNull());
}

describe('local history', () => {
  it('only follows same-origin relative paths', () => {
    expect(isSafeHref('/system/users?id=1')).toBe(true);
    expect(isSafeHref('//evil.example')).toBe(false);
    expect(isSafeHref('https://evil.example')).toBe(false);
    expect(isSafeHref('/\\evil')).toBe(false);
  });

  it('keeps recent items per admin, newest first, without duplicates or unsafe links', async () => {
    await mount();
    act(() =>
      holder.recent!.record({ key: 'a', kind: 'Role', label: 'A', href: '/system/roles?id=a' }),
    );
    act(() =>
      holder.recent!.record({ key: 'b', kind: 'Role', label: 'B', href: '/system/roles?id=b' }),
    );
    act(() =>
      holder.recent!.record({ key: 'a', kind: 'Role', label: 'A', href: '/system/roles?id=a' }),
    );
    act(() => holder.recent!.record({ key: 'x', kind: 'Bad', label: 'X', href: '//evil.example' }));
    expect(holder.recent!.items.map((item) => item.key)).toEqual(['a', 'b']);
    expect(Object.keys(window.localStorage).some((key) => key.includes('recent:adm_1'))).toBe(true);
  });

  it('saves, replaces by name and deletes filters for one list', async () => {
    await mount();
    act(() => holder.saved!.save('New only', 'status=NEW'));
    act(() => holder.saved!.save('new ONLY', 'q=sofa&status=NEW'));
    expect(holder.saved!.filters).toHaveLength(1);
    expect(holder.saved!.filters[0]).toMatchObject({
      name: 'new ONLY',
      query: 'q=sofa&status=NEW',
    });
    act(() => holder.saved!.remove(holder.saved!.filters[0]!.id));
    expect(holder.saved!.filters).toEqual([]);
  });
});

describe('temporary passwords', () => {
  it('meets the policy and differs every time', () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();
    expect(a).toHaveLength(16);
    expect(a).not.toBe(b);
    expect(/[a-z]/.test(a) && /[A-Z]/.test(a) && /[0-9]/.test(a)).toBe(true);
    expect(new Set(a).size).toBeGreaterThan(1);
  });
});
