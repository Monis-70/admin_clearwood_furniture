import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { account, callsTo, signInAs } from '@/tests/msw/backend';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { CommandPalette } from './command-palette';

function renderPalette() {
  navigation.reset('/');
  return renderWithProviders(
    <AuthGate>
      <CommandPalette open onOpenChange={() => undefined} />
    </AuthGate>,
  );
}

const optionLabels = () => screen.getAllByRole('option').map((option) => option.textContent ?? '');

describe('CommandPalette', () => {
  it('offers only pages and actions the admin is allowed to use', async () => {
    signInAs(account({ role: 'CONTENT_MANAGER' }));
    const { baseElement } = renderPalette();
    const input = await screen.findByRole('combobox', { name: /Search pages/ });
    const user = userEvent.setup();
    await user.type(input, 'admin');
    await waitFor(() => expect(screen.queryByText('Add an admin')).not.toBeInTheDocument());
    expect(screen.queryByText('Admin users')).not.toBeInTheDocument();
    await expectNoA11yViolations(baseElement);
  });

  it('finds pages by name', async () => {
    signInAs(account({ role: 'CONTENT_MANAGER' }));
    renderPalette();
    const user = userEvent.setup();
    await user.type(await screen.findByRole('combobox', { name: /Search pages/ }), 'banners');
    expect(await screen.findByRole('option', { name: /Banners/ })).toBeInTheDocument();
  });

  it('offers catalog shortcuts only to roles that can use their destination', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    renderPalette();
    await screen.findByRole('combobox', { name: /Search pages/ });
    const labels = optionLabels();
    for (const label of [
      'Create a product',
      'Create a category',
      'Create a collection',
      'Open draft products',
      'Open incomplete products',
      'Open low-stock variants',
    ]) {
      expect(
        labels.some((text) => text.includes(label)),
        label,
      ).toBe(true);
    }
  });

  it('hides catalog shortcuts that need permissions the role lacks', async () => {
    signInAs(account({ role: 'CONTENT_MANAGER' }));
    renderPalette();
    await screen.findByRole('combobox', { name: /Search pages/ });
    const labels = optionLabels().join('|');
    expect(labels).toContain('Open draft products');
    expect(labels).not.toContain('Create a product');
    expect(labels).not.toContain('Create a category');
    expect(labels).not.toContain('Open low-stock variants');
  });

  it('searches records through the API and opens the one chosen with the keyboard', async () => {
    signInAs();
    renderPalette();
    const input = await screen.findByRole('combobox', { name: /Search pages/ });
    const user = userEvent.setup();
    await user.type(input, 'arna');
    expect(await screen.findByRole('option', { name: /Arna 3-Seater Sofa/ })).toBeInTheDocument();
    const calls = callsTo('/api/v1/admin/catalog/products');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    // Debounced: typing "arna" does not send one request per keystroke.
    expect(calls.length).toBeLessThanOrEqual(2);
    const options = optionLabels();
    const target = options.findIndex((label) => label.includes('Arna 3-Seater Sofa'));
    for (let i = 0; i < target; i += 1) await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(navigation.push).toHaveBeenCalledWith('/catalog/products?q=CW-SOF-ARNA');
  });

  it('never sends a record search for one character', async () => {
    signInAs();
    renderPalette();
    const user = userEvent.setup();
    await user.type(await screen.findByRole('combobox', { name: /Search pages/ }), 'a');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(callsTo('/api/v1/admin/catalog/products')).toHaveLength(0);
    expect(callsTo('/api/v1/admin/users')).toHaveLength(0);
  });
});
