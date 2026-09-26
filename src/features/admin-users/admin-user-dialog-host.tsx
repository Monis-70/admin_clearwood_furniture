'use client';

import type { AdminUserDto } from '@shared/types/auth';

import {
  ChangeRolesDialog,
  DeleteAdminDialog,
  ResetPasswordDialog,
  StatusChangeDialog,
} from './admin-user-actions';
import { CreateAdminDialog, EditAdminDialog } from './admin-user-dialogs';

export type AdminUserDialog =
  | { kind: 'edit'; user: AdminUserDto }
  | { kind: 'roles'; user: AdminUserDto }
  | { kind: 'password'; user: AdminUserDto }
  | { kind: 'status'; user: AdminUserDto; status: 'SUSPENDED' | 'DISABLED' | 'ACTIVE' }
  | { kind: 'delete'; user: AdminUserDto };

/** Every form and confirmation of the admin-users screen; loaded the first time one is opened. */
export function AdminUserDialogHost({
  creating,
  setCreating,
  dialog,
  close,
}: {
  creating: boolean;
  setCreating(open: boolean): void;
  dialog: AdminUserDialog | null;
  close(): void;
}) {
  const onOpenChange = (open: boolean) => (open ? undefined : close());
  return (
    <>
      <CreateAdminDialog open={creating} onOpenChange={setCreating} />
      <EditAdminDialog
        user={dialog?.kind === 'edit' ? dialog.user : null}
        onOpenChange={onOpenChange}
      />
      <ChangeRolesDialog
        user={dialog?.kind === 'roles' ? dialog.user : null}
        onOpenChange={onOpenChange}
      />
      <ResetPasswordDialog
        user={dialog?.kind === 'password' ? dialog.user : null}
        onOpenChange={onOpenChange}
      />
      <StatusChangeDialog
        target={dialog?.kind === 'status' ? { user: dialog.user, status: dialog.status } : null}
        onOpenChange={onOpenChange}
      />
      <DeleteAdminDialog
        user={dialog?.kind === 'delete' ? dialog.user : null}
        onOpenChange={onOpenChange}
      />
    </>
  );
}
