'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { notifySuccess } from '@/lib/notify';

import { catalogKeys } from '../api';

import { productsApi, productKeys } from './api';
import { productHref } from './model';

/** Copies a product as a new draft; what is copied is chosen here and done by the API. */
export function DuplicateDialog({
  product,
  onClose,
}: {
  product: Pick<AdminProductDetailDto, 'id' | 'name' | 'sku'>;
  onClose(): void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const keyFor = useIdempotencyKey();
  const [name, setName] = useState(`${product.name} (copy)`);
  const [sku, setSku] = useState(`${product.sku}-COPY`);
  const [include, setInclude] = useState({
    includeVariants: true,
    includeMedia: true,
    includePriceAdjustments: true,
    includeRelations: true,
  });

  const duplicate = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), sku: sku.trim(), ...include };
      return productsApi.duplicate(product.id, body, keyFor(body));
    },
    onSuccess: (copy) => {
      queryClient.setQueryData(productKeys.detail(copy.id), copy);
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      notifySuccess('Product duplicated', `${copy.name} was created as a draft.`);
      onClose();
      router.push(productHref(copy.id));
    },
  });

  const valid = name.trim().length >= 2 && sku.trim().length >= 2;

  return (
    <Dialog open onOpenChange={(open) => (open || duplicate.isPending ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate {product.name}</DialogTitle>
          <DialogDescription>The copy starts as an unpublished draft.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) duplicate.mutate();
          }}
        >
          <FormAlert error={duplicate.error} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dup-name">Name</Label>
            <Input
              id="dup-name"
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dup-sku">SKU</Label>
            <Input
              id="dup-sku"
              value={sku}
              maxLength={64}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Also copy</legend>
            {(
              [
                ['includeVariants', 'Variants'],
                ['includeMedia', 'Images'],
                ['includePriceAdjustments', 'Price rules'],
                ['includeRelations', 'Related products'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={include[key]}
                  onChange={(event) =>
                    setInclude((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={duplicate.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!valid} loading={duplicate.isPending}>
              Duplicate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
