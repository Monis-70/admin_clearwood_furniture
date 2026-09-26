'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { endpoints } from '@/lib/api/endpoints';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { RecordDialog } from '../catalog/record-dialog';

import { mediaApi, mediaKeys } from './api';
import type { FlatFolder } from './model';

export function FoldersDialog({ folders, onClose }: { folders: FlatFolder[]; onClose(): void }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [removing, setRemoving] = useState<FlatFolder | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: mediaKeys.all });
  const create = useMutation({
    mutationFn: () => mediaApi.createFolder({ name: name.trim(), parentId: parentId || null }),
    onSuccess: () => {
      notifySuccess('Folder created');
      setName('');
      refresh();
    },
  });
  const rename = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      mediaApi.updateFolder(id, { name: value }),
    onSuccess: () => {
      notifySuccess('Folder renamed');
      refresh();
    },
    onError: (error) => notifyError(error, 'Could not rename the folder'),
  });

  return (
    <RecordDialog
      title="Media folders"
      description="Folders only organise the library; moving files between folders never changes where they are used."
      onClose={onClose}
    >
      <ul className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-md border">
        {folders.map((folder) => (
          <li
            key={folder.id}
            className="flex items-center gap-2 px-3 py-2"
            style={{ paddingLeft: `${0.75 + folder.depth}rem` }}
          >
            {canCall(endpoints.media.updateFolder) && !folder.isSystem ? (
              <Input
                aria-label={`Name of ${folder.name}`}
                defaultValue={folder.name}
                className="h-8"
                maxLength={80}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value && value !== folder.name) rename.mutate({ id: folder.id, value });
                }}
              />
            ) : (
              <span className="flex-1 text-sm font-medium">{folder.name}</span>
            )}
            {folder.isSystem ? <Badge tone="neutral">System</Badge> : null}
            <span className="tabular text-xs text-muted-foreground">{folder.mediaCount ?? 0}</span>
            {canCall(endpoints.media.removeFolder) && !folder.isSystem ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${folder.name}`}
                onClick={() => setRemoving(folder)}
              >
                <Trash2 aria-hidden />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canCall(endpoints.media.createFolder) ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="folder-name">New folder</Label>
              <Input
                id="folder-name"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="folder-parent">Inside</Label>
              <NativeSelect
                id="folder-parent"
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">Top level</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {'\u00a0\u00a0'.repeat(folder.depth)}
                    {folder.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <Button
            type="submit"
            className="w-fit"
            disabled={!name.trim()}
            loading={create.isPending}
          >
            Add folder
          </Button>
          <FormAlert error={create.error} />
        </form>
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setRemoving(null))}
          title={`Delete the ${removing.name} folder?`}
          description="Only an empty folder can be deleted: move its files and subfolders out first."
          confirmLabel="Delete folder"
          level="destructive"
          onConfirm={async () => {
            await mediaApi.removeFolder(removing.id);
            refresh();
            notifySuccess('Folder deleted');
          }}
        />
      ) : null}
    </RecordDialog>
  );
}
