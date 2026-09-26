import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AuthGate } from '@/lib/auth/guards';
import { account, signInAs } from '@/tests/msw/backend';
import { navigation } from '@/tests/navigation';
import { renderWithProviders } from '@/tests/render';

import { PaletteTrigger } from './palette-trigger';

function Screen({ dialogOpen }: { dialogOpen: boolean }) {
  return (
    <AuthGate>
      <PaletteTrigger />
      <Dialog open={dialogOpen}>
        <DialogContent>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>Name it.</DialogDescription>
        </DialogContent>
      </Dialog>
    </AuthGate>
  );
}

describe('PaletteTrigger', () => {
  it('leaves Ctrl+K alone while another dialog is open, and opens the palette otherwise', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    navigation.reset('/catalog/categories', 'new=1');
    const { rerender } = renderWithProviders(<Screen dialogOpen />);
    expect(await screen.findByRole('dialog', { name: 'New category' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.keyboard('{Control>}k{/Control}');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByRole('dialog', { name: 'Search the admin' })).not.toBeInTheDocument();

    rerender(<Screen dialogOpen={false} />);
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog', { name: 'Search the admin' })).toBeInTheDocument();
  });

  it('opens once a dialog that was just closing has gone (Escape, then Ctrl+K)', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    navigation.reset('/catalog/categories', 'new=1');
    const { rerender } = renderWithProviders(<Screen dialogOpen />);
    expect(await screen.findByRole('dialog', { name: 'New category' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.keyboard('{Control>}k{/Control}');
    rerender(<Screen dialogOpen={false} />);
    expect(await screen.findByRole('dialog', { name: 'Search the admin' })).toBeInTheDocument();
  });
});
