'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { endpoints } from '@/lib/api/endpoints';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { useAttributeGroups } from '../lookups';
import { RecordDialog } from '../record-dialog';
import { attributesApi, taxonomyKeys, type AttributeGroupRow } from '../taxonomy/api';

import { codeFrom } from './model';

const CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

export function GroupsDialog({ onClose }: { onClose(): void }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const groups = useAttributeGroups();
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState<AttributeGroupRow | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: taxonomyKeys.groups() });
  const code = codeFrom(name);
  const create = useMutation({
    mutationFn: () =>
      attributesApi.createGroup({
        name: name.trim(),
        code,
        position: groups.data?.length ?? 0,
        isActive: true,
      }),
    onSuccess: () => {
      notifySuccess('Group created');
      setName('');
      refresh();
    },
  });
  const rename = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      attributesApi.updateGroup(id, { name: value }),
    onSuccess: () => {
      notifySuccess('Group renamed');
      refresh();
    },
    onError: (error) => notifyError(error, 'Could not rename the group'),
  });

  return (
    <RecordDialog
      title="Attribute groups"
      description="Groups arrange the specification table on product pages."
      onClose={onClose}
    >
      {groups.isPending ? (
        <SectionLoader label="Loading groups…" />
      ) : groups.error ? (
        <ErrorState error={groups.error} onRetry={() => void groups.refetch()} compact />
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {groups.data.map((group) => (
            <li key={group.id} className="flex items-center gap-2 px-3 py-2">
              {canCall(endpoints.attributes.updateGroup) ? (
                <Input
                  aria-label={`Name of ${group.name}`}
                  defaultValue={group.name}
                  className="h-8"
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value.length >= 2 && value !== group.name)
                      rename.mutate({ id: group.id, value });
                  }}
                />
              ) : (
                <span className="flex-1 text-sm font-medium">{group.name}</span>
              )}
              <span className="font-mono text-xs text-muted-foreground">{group.code}</span>
              {canCall(endpoints.attributes.removeGroup) ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete ${group.name}`}
                  onClick={() => setRemoving(group)}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canCall(endpoints.attributes.createGroup) ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2 && CODE.test(code)) create.mutate();
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="group-name">New group</Label>
            <Input
              id="group-name"
              value={name}
              maxLength={160}
              onChange={(event) => setName(event.target.value)}
            />
            {name ? <span className="text-xs text-muted-foreground">Code: {code}</span> : null}
          </div>
          <Button
            type="submit"
            disabled={name.trim().length < 2 || !CODE.test(code)}
            loading={create.isPending}
          >
            Add group
          </Button>
        </form>
      ) : null}
      <FormAlert error={create.error} />
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setRemoving(null))}
          title={`Delete ${removing.name}?`}
          description="Refused while attributes still belong to it."
          confirmLabel="Delete group"
          level="destructive"
          onConfirm={async () => {
            await attributesApi.removeGroup(removing.id);
            refresh();
            notifySuccess('Group deleted');
          }}
        />
      ) : null}
    </RecordDialog>
  );
}
