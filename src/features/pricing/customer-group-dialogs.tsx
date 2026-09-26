'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { EmptyState, ErrorState, SectionLoader } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { formatDateTime } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { cachePolicy } from '@/lib/query/policies';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  NumberField,
  TextAreaField,
  TextField,
  intInput,
  optionalText,
  requiredInt,
  requiredText,
  textInput,
} from '../catalog/form-kit';
import { RecordDialog } from '../catalog/record-dialog';

import { optionalPercentBp } from './fields';
import { bpInput } from './lookups';
import { customerGroupsApi, promotionsKeys, type CustomerGroupRow } from './promotions-api';

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,31}$/, 'Use UPPER_SNAKE_CASE, e.g. TRADE'),
  name: requiredText(2, 120, 'Name'),
  description: optionalText(500),
  isDefault: z.boolean(),
  priority: requiredInt(0, 10_000, 'Priority'),
  discountBp: optionalPercentBp('Group discount'),
  isActive: z.boolean(),
});
type Values = z.input<typeof schema>;
export function GroupDialog({
  group,
  onClose,
  onSaved,
}: {
  group: CustomerGroupRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  const keyFor = useIdempotencyKey();
  return (
    <RecordDialog title={group ? `Edit ${group.name}` : 'New customer group'} onClose={onClose}>
      <EditorForm
        schema={schema}
        defaultValues={{
          code: textInput(group?.code),
          name: textInput(group?.name),
          description: textInput(group?.description),
          isDefault: group?.isDefault ?? false,
          priority: intInput(group?.priority ?? 100),
          discountBp: bpInput(group?.discountBp),
          isActive: group?.isActive ?? true,
        }}
        successMessage={group ? 'Group saved' : 'Group created'}
        submitLabel={group ? 'Save changes' : 'Create group'}
        onSubmit={async ({ code, ...values }) => {
          if (group)
            await customerGroupsApi.update(group.id, { ...values, version: group.version });
          else {
            const input = { ...values, code };
            await customerGroupsApi.create(input, keyFor(input));
          }
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<Values> name="name" label="Name" required />
          {group ? null : <TextField<Values> name="code" label="Code" required />}
        </FieldGrid>
        <TextAreaField<Values> name="description" label="Description" rows={2} />
        <FieldGrid>
          <TextField<Values>
            name="discountBp"
            label="Group discount"
            prefix="%"
            inputMode="decimal"
            description="Applied by the pricing engine; empty for none."
          />
          <NumberField<Values>
            name="priority"
            label="Priority"
            required
            description="A customer in several groups gets the highest."
          />
        </FieldGrid>
        <FieldGrid>
          <CheckField<Values>
            name="isDefault"
            label="Default group"
            description="Guests and ungrouped customers. Only one group can be the default."
          />
          <CheckField<Values> name="isActive" label="Active" />
        </FieldGrid>
      </EditorForm>
    </RecordDialog>
  );
}

const ID = /^[a-z0-9]{20,40}$/i;

export function Members({ id, canManage }: { id: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: promotionsKeys.members(id),
    queryFn: ({ signal }) => customerGroupsApi.members(id, signal),
    ...cachePolicy.list,
  });
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const ids = [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  const invalid = ids.filter((v) => !ID.test(v));
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: promotionsKeys.members(id) });
  const add = useMutation({
    mutationFn: () => customerGroupsApi.addMembers(id, ids),
    onSuccess: ({ added }) => {
      setText('');
      refresh();
      notifySuccess(`${added} customer${added === 1 ? '' : 's'} added`);
    },
  });

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Alert tone="info" title="Customers are added by their ID">
        The admin has no customer directory yet, so members are added by customer ID (shown on
        orders and carts).
      </Alert>
      {canManage ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="member-ids">Add customers</Label>
          <Textarea
            id="member-ids"
            rows={3}
            value={text}
            placeholder="One customer ID per line"
            aria-invalid={invalid.length > 0}
            onChange={(e) => setText(e.target.value)}
          />
          {invalid.length > 0 ? (
            <p className="text-sm text-destructive">
              Not a customer ID: {invalid.slice(0, 3).join(', ')}
            </p>
          ) : null}
          <FormAlert error={add.error} />
          <Button
            className="w-fit"
            size="sm"
            disabled={ids.length === 0 || invalid.length > 0 || ids.length > 500}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Add {ids.length || ''} customer{ids.length === 1 ? '' : 's'}
          </Button>
        </div>
      ) : null}
      {members.isPending ? (
        <SectionLoader label="Loading members…" />
      ) : members.error ? (
        <ErrorState error={members.error} onRetry={() => void members.refetch()} compact />
      ) : members.data.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Add customer ids above. Members get this group's price list and discounts."
          compact
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y rounded-md border text-sm" aria-label="Members">
            {members.data.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                {canManage ? (
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={`Select customer ${m.customerId}`}
                    checked={selected.has(m.customerId)}
                    onChange={(e) =>
                      setSelected((all) => {
                        const next = new Set(all);
                        if (e.target.checked) next.add(m.customerId);
                        else next.delete(m.customerId);
                        return next;
                      })
                    }
                  />
                ) : null}
                <span className="font-mono">{m.customerId}</span>
                <span className="ml-auto text-muted-foreground">
                  {formatDateTime(m.assignedAt)}
                </span>
              </li>
            ))}
          </ul>
          {members.data.length >= 500 ? (
            <p className="text-xs text-muted-foreground">
              Showing the 500 most recently added members.
            </p>
          ) : null}
          {canManage ? (
            <Button
              variant="outline"
              className="w-fit"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => setConfirming(true)}
            >
              Remove {selected.size || ''} selected
            </Button>
          ) : null}
        </>
      )}
      {confirming ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setConfirming(false))}
          title={`Remove ${selected.size} customer${selected.size === 1 ? '' : 's'} from the group?`}
          description="They are priced as the default group (or their other groups) from now on."
          confirmLabel="Remove from group"
          level="destructive"
          onConfirm={async () => {
            const { removed } = await customerGroupsApi.removeMembers(id, [...selected]);
            setSelected(new Set());
            refresh();
            notifySuccess(`${removed} removed`);
          }}
        />
      ) : null}
    </div>
  );
}
