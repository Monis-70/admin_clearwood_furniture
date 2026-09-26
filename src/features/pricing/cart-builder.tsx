'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

import { CHANNEL_LABELS, useCustomerGroupOptions } from './lookups';
import { ProductPicker, type PickedProduct } from './product-picker';

export interface SampleLine extends PickedProduct {
  qty: number;
}

export interface SampleCart {
  lines: SampleLine[];
  pincode: string;
  channel: string;
  customerGroupId: string;
  couponCode?: string;
  shippingMethod?: string;
  now?: string;
}

export const emptyCart = (lines: SampleLine[] = []): SampleCart => ({
  lines,
  pincode: '',
  channel: 'WEB',
  customerGroupId: '',
  couponCode: '',
  shippingMethod: '',
  now: '',
});

/** Problems the form can see before asking the API; the API validates everything again. */
export function cartProblems(cart: SampleCart): string[] {
  const problems: string[] = [];
  if (cart.lines.length === 0) problems.push('Add at least one product.');
  if (cart.lines.some((line) => !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 999)) {
    problems.push('Quantities must be whole numbers from 1 to 999.');
  }
  if (cart.pincode && !/^[1-9][0-9]{5}$/.test(cart.pincode)) {
    problems.push('A pincode is six digits and does not start with 0.');
  }
  if (cart.couponCode && cart.couponCode.trim().length < 2)
    problems.push('Enter the whole coupon code.');
  return problems;
}

/** The request body the simulate and evaluate endpoints expect. */
export function cartInput(cart: SampleCart) {
  return {
    items: cart.lines.map((line) => ({ productId: line.id, qty: line.qty })),
    channel: cart.channel as 'WEB',
    ...(cart.pincode ? { pincode: cart.pincode } : {}),
    ...(cart.customerGroupId ? { customerGroupId: cart.customerGroupId } : {}),
    ...(cart.couponCode?.trim() ? { couponCode: cart.couponCode.trim() } : {}),
    ...(cart.shippingMethod ? { shippingMethod: cart.shippingMethod as 'STANDARD' } : {}),
    ...(cart.now ? { now: new Date(cart.now).toISOString() } : {}),
    includeTrace: true,
  };
}

/** Products, quantities and the shopper's situation for a what-if price. */
export function CartBuilder({
  cart,
  onChange,
  withCoupon = true,
  shippingMethods,
}: {
  cart: SampleCart;
  onChange(next: SampleCart): void;
  withCoupon?: boolean;
  shippingMethods?: Readonly<Record<string, string>>;
}) {
  const groups = useCustomerGroupOptions();
  const set = (patch: Partial<SampleCart>) => onChange({ ...cart, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <ProductPicker
          actionLabel="Add"
          exclude={cart.lines.map((line) => line.id)}
          onPick={(product) => set({ lines: [...cart.lines, { ...product, qty: 1 }] })}
        />
        {cart.lines.length > 0 ? (
          <ul
            className="flex flex-col divide-y rounded-md border"
            aria-label="Products in the sample cart"
          >
            {cart.lines.map((line) => (
              <li key={line.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{line.name}</span>{' '}
                  <span className="font-mono text-xs text-muted-foreground">{line.sku}</span>
                </span>
                <Label htmlFor={`qty-${line.id}`} className="sr-only">
                  Quantity of {line.name}
                </Label>
                <Input
                  id={`qty-${line.id}`}
                  inputMode="numeric"
                  className="w-20"
                  value={String(line.qty)}
                  onChange={(event) =>
                    set({
                      lines: cart.lines.map((l) =>
                        l.id === line.id ? { ...l, qty: Number(event.target.value) } : l,
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${line.name}`}
                  onClick={() => set({ lines: cart.lines.filter((l) => l.id !== line.id) })}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sample-pincode">Delivery pincode</Label>
          <Input
            id="sample-pincode"
            inputMode="numeric"
            maxLength={6}
            value={cart.pincode}
            onChange={(event) => set({ pincode: event.target.value.trim() })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sample-channel">Channel</Label>
          <NativeSelect
            id="sample-channel"
            value={cart.channel}
            onChange={(event) => set({ channel: event.target.value })}
          >
            {Object.entries(CHANNEL_LABELS)
              .filter(([value]) => value !== 'ALL')
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sample-group">Customer group</Label>
          <NativeSelect
            id="sample-group"
            value={cart.customerGroupId}
            disabled={!groups.data}
            onChange={(event) => set({ customerGroupId: event.target.value })}
          >
            <option value="">Default (a guest)</option>
            {(groups.data ?? []).map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        {withCoupon ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sample-coupon">Coupon code</Label>
            <Input
              id="sample-coupon"
              value={cart.couponCode ?? ''}
              onChange={(event) => set({ couponCode: event.target.value.toUpperCase() })}
            />
          </div>
        ) : null}
        {shippingMethods ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sample-method">Delivery method</Label>
            <NativeSelect
              id="sample-method"
              value={cart.shippingMethod ?? ''}
              onChange={(event) => set({ shippingMethod: event.target.value })}
            >
              <option value="">The cheapest available</option>
              {Object.entries(shippingMethods).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sample-now">Price as of</Label>
          <Input
            id="sample-now"
            type="datetime-local"
            value={cart.now ?? ''}
            onChange={(event) => set({ now: event.target.value })}
          />
          <span className="text-xs text-muted-foreground">Empty: now. Tests scheduled rules.</span>
        </div>
      </div>
    </div>
  );
}
