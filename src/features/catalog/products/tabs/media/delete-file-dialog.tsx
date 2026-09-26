'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import type { ProductMediaItemDto } from '@shared/types/media';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { notifySuccess } from '@/lib/notify';
import { cachePolicy } from '@/lib/query/policies';

import { mediaApi, mediaKeys } from '@/features/media/api';
import { USAGE_LABELS } from '@/features/media/model';

/**
 * Deleting the FILE, as opposed to removing it from this product: it lists every place the file
 * is used (from the API), then offers the reversible trash or the permanent delete, which the API
 * refuses with MEDIA_IN_USE while anything still uses the file.
 */
export function DeleteFileDialog({
  item,
  productId,
  variantIds,
  onDone,
  onClose,
}: {
  item: ProductMediaItemDto;
  productId: string;
  variantIds: ReadonlySet<string>;
  onDone(): void;
  onClose(): void;
}) {
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const detail = useQuery({
    queryKey: mediaKeys.asset(item.mediaId),
    queryFn: ({ signal }) => mediaApi.get(item.mediaId, signal),
    ...cachePolicy.detail,
  });
  const trash = useMutation({
    mutationFn: () => mediaApi.remove(item.mediaId),
    onSuccess: () => {
      notifySuccess('File moved to trash', 'Restore it from here or from the media library.');
      onDone();
      onClose();
    },
  });
  const usage = detail.data?.usage ?? [];
  const elsewhere = usage.filter(
    (entry) =>
      !(entry.usageType === 'PRODUCT' && entry.entityId === productId) &&
      !(entry.usageType === 'PRODUCT_VARIANT' && variantIds.has(entry.entityId)),
  );
  const trashed = item.media.deletedAt !== null;

  return (
    <>
      <Dialog open={!confirmPermanent} onOpenChange={(open) => (open ? undefined : onClose())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete the media file?</DialogTitle>
            <DialogDescription>
              {item.media.originalName}: this affects the file itself, not only this product. To
              take it off this product alone, use “Remove from this product”.
            </DialogDescription>
          </DialogHeader>
          {detail.isPending ? (
            <SectionLoader label="Checking where the file is used…" />
          ) : detail.error ? (
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} compact />
          ) : (
            <section aria-labelledby="file-usage-heading" className="flex flex-col gap-2 text-sm">
              <h3 id="file-usage-heading" className="font-medium">
                Used in {usage.length} place{usage.length === 1 ? '' : 's'}
              </h3>
              <ul className="flex flex-col gap-1">
                {usage.map((entry) => {
                  const here =
                    (entry.usageType === 'PRODUCT' && entry.entityId === productId) ||
                    (entry.usageType === 'PRODUCT_VARIANT' && variantIds.has(entry.entityId));
                  return (
                    <li key={entry.id} className="flex items-center gap-2">
                      <Badge tone="outline">
                        {USAGE_LABELS[entry.usageType] ?? entry.usageType}
                      </Badge>
                      {here ? (
                        <span>This product</span>
                      ) : entry.usageType === 'PRODUCT' ? (
                        <Link
                          className="text-primary hover:underline"
                          href={`/catalog/products/edit?id=${encodeURIComponent(entry.entityId)}&tab=media`}
                        >
                          Another product
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">
                          {entry.entityId}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {elsewhere.length > 0 ? (
                <p className="text-muted-foreground">
                  {elsewhere.length} other place{elsewhere.length === 1 ? '' : 's'} would lose this
                  image as well.
                </p>
              ) : null}
            </section>
          )}
          <FormAlert error={trash.error} />
          <div className="flex flex-col gap-3 rounded-md border p-3 text-sm">
            {trashed ? null : (
              <div className="flex flex-col gap-2">
                <p>
                  <span className="font-medium">Move to trash</span>: hidden from customers
                  everywhere it is used; this product then cannot be published until the file is
                  restored or removed from it. Reversible.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit text-destructive"
                  loading={trash.isPending}
                  disabled={detail.isPending}
                  onClick={() => trash.mutate()}
                >
                  Move file to trash
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <p>
                <span className="font-medium">Delete permanently</span>: erases the file and all its
                sizes. The server refuses while anything still uses it
                {usage.length > 0 ? ` (now ${usage.length})` : ''}.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="w-fit"
                disabled={detail.isPending}
                onClick={() => setConfirmPermanent(true)}
              >
                Delete permanently…
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Keep the file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmPermanent ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setConfirmPermanent(false))}
          title="Delete this file permanently?"
          description="The file and all its sizes are erased from storage. This cannot be undone. The server refuses while anything still uses it."
          confirmLabel="Delete permanently"
          level="irreversible"
          confirmText="DELETE"
          onConfirm={async () => {
            await mediaApi.removePermanently(item.mediaId);
            notifySuccess('File deleted permanently');
            onDone();
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
