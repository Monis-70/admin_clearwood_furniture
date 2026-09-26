import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError } from '@/lib/api/errors';
import { renderWithProviders } from '@/tests/render';

import { EditorForm, MoneyField, SelectField, paiseInput, rupees } from './form-kit';

const schema = z.object({
  brandId: z.string().transform((value) => value || null),
  price: rupees('Price'),
});
type Values = z.input<typeof schema>;

/** Options that arrive after the form, like reference data from the API. */
function LateOptions({ onSubmit }: { onSubmit(values: z.output<typeof schema>): void }) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setOptions([
          { value: 'brand_a', label: 'Aranya' },
          { value: 'brand_b', label: 'Banyan' },
        ]),
      20,
    );
    return () => clearTimeout(timer);
  }, []);
  return (
    <EditorForm
      schema={schema}
      defaultValues={{ brandId: 'brand_b', price: paiseInput(1_299_950) }}
      successMessage="Saved"
      onSubmit={async (values) => onSubmit(values)}
    >
      <SelectField<Values> name="brandId" label="Brand" placeholder="No brand" options={options} />
      <MoneyField<Values> name="price" label="Price" />
    </EditorForm>
  );
}

describe('form kit', () => {
  it('shows and keeps a stored choice whose option loads after the form', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<LateOptions onSubmit={onSubmit} />);
    const select = screen.getByLabelText('Brand');
    await waitFor(() => expect(select).toHaveDisplayValue('Banyan'));

    const user = userEvent.setup();
    const price = screen.getByLabelText('Price');
    await user.clear(price);
    await user.type(price, '13499');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toEqual({ brandId: 'brand_b', price: 1_349_900 });
  });

  it('compares a stale save using the parsed values, in the record shape', async () => {
    const yours = vi.fn((values: object) => values);
    renderWithProviders(
      <EditorForm
        schema={schema}
        defaultValues={{ brandId: '', price: paiseInput(1_299_950) }}
        successMessage="Saved"
        conflict={{
          fields: [{ key: 'price', label: 'Price' }],
          yours,
          loadLatest: () => new Promise(() => undefined),
          onReload: vi.fn(),
        }}
        onSubmit={() =>
          Promise.reject(
            new ApiError({
              status: 409,
              code: 'STALE_RESOURCE',
              message: 'Stale',
              requestId: 'req-1',
              method: 'PATCH',
              path: '/admin/catalog/products/{id}',
            }),
          )
        }
      >
        <MoneyField<Values> name="price" label="Price" />
      </EditorForm>,
    );
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Price'));
    await user.type(screen.getByLabelText('Price'), '13499');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByRole('dialog', { name: 'Someone else changed this record' }),
    ).toBeInTheDocument();
    expect(yours).toHaveBeenCalledWith({ brandId: null, price: 1_349_900 });
  });

  it('turns typed rupees into paise and explains a malformed amount', async () => {
    expect(rupees().parse('12499.50')).toBe(1_249_950);
    expect(paiseInput(1_249_950)).toBe('12499.5');
    expect(rupees('Price').safeParse('12,499').success).toBe(false);
  });
});
