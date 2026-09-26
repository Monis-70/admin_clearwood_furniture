import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import { expectNoA11yViolations } from '@/tests/render';

import { ConfirmDialog, type ConfirmLevel } from './confirm-dialog';

function Harness({
  onConfirm,
  level = 'destructive',
  confirmText,
}: {
  onConfirm: () => Promise<void> | void;
  level?: ConfirmLevel;
  confirmText?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p>{open ? 'open' : 'closed'}</p>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete “Kabir Sofa”?"
        description="The product disappears from the storefront. This cannot be undone."
        impact={<p>2 variants, 5 images</p>}
        confirmLabel="Delete product"
        level={level}
        confirmText={confirmText}
        onConfirm={onConfirm}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('states the consequence and is accessible', async () => {
    render(<Harness onConfirm={vi.fn()} />);
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete “Kabir Sofa”?' });
    expect(dialog).toHaveTextContent('This cannot be undone.');
    expect(dialog).toHaveTextContent('2 variants, 5 images');
    await expectNoA11yViolations(document.body);
  });

  it('requires the exact confirmation text for irreversible actions', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} level="irreversible" confirmText="Kabir Sofa" />);
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Delete product' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/Type Kabir Sofa to confirm/), 'Kabir Sof');
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/Type Kabir Sofa to confirm/), 'a');
    await user.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open with the error when the action fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'CATEGORY_HAS_PRODUCTS',
        message: 'Move its 12 products first.',
        requestId: 'req-12345678',
        method: 'DELETE',
        path: '/admin/catalog/categories/{id}',
      }),
    );
    render(<Harness onConfirm={onConfirm} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete product' }));
    expect(await screen.findByText('Move its 12 products first.')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
  });

  it('closes after success and cannot be confirmed twice', async () => {
    let resolve: () => void = () => undefined;
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<Harness onConfirm={onConfirm} />);
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Delete product' });
    await user.click(button);
    await user.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() => expect(screen.getByText('closed')).toBeInTheDocument());
  });
});
