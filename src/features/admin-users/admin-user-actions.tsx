'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { AdminUserStatus } from '@shared/enums';
import { PASSWORD_MIN_LENGTH } from '@shared/schemas/auth';
import type { AdminUserDto } from '@shared/types/auth';

import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { CopyButton } from '@/components/patterns/copy-button';
import { FormAlert, type FieldControlProps } from '@/components/patterns/form/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { notifySuccess } from '@/lib/notify';

import { roleKeys } from '../roles/api';

import { adminUserKeys, adminUsersApi } from './api';
import { RolePicker } from './role-picker';
import { TemporaryPasswordInput } from './temporary-password-input';

export const RESET_PASSWORD_WARNING =
  "Resetting this password will terminate the user's active sessions and require a password change at next sign-in.";

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
}

export function ChangeRolesDialog({
  user,
  onOpenChange,
}: {
  user: AdminUserDto | null;
  onOpenChange(open: boolean): void;
}) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {user ? (
          <ChangeRolesForm key={user.id} user={user} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ChangeRolesForm({ user, onDone }: { user: AdminUserDto; onDone(): void }) {
  const invalidate = useInvalidateUsers();
  const queryClient = useQueryClient();
  const initial = user.roles.map((role) => role.code);
  const [codes, setCodes] = useState<string[]>(initial);
  const [error, setError] = useState<unknown>(null);
  const changed = codes.length !== initial.length || codes.some((code) => !initial.includes(code));

  const mutation = useMutation({
    mutationFn: () => adminUsersApi.setRoles(user.id, { roleCodes: codes }),
    onSuccess: (updated) => {
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: roleKeys.list() });
      notifySuccess('Roles updated', `${updated.name}'s access changes on their next click.`);
      onDone();
    },
    onError: setError,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change roles for {user.name}</DialogTitle>
        <DialogDescription>
          Their access changes on their next click; they stay signed in. You can only give roles
          whose permissions you hold yourself.
        </DialogDescription>
      </DialogHeader>
      <FormAlert error={error} />
      <RolePicker value={codes} onChange={setCodes} />
      {codes.length === 0 ? (
        <p className="text-xs font-medium text-destructive">Choose at least one role.</p>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            setError(null);
            mutation.mutate();
          }}
          loading={mutation.isPending}
          disabled={!changed || codes.length === 0}
        >
          Save roles
        </Button>
      </DialogFooter>
    </>
  );
}

export function ResetPasswordDialog({
  user,
  onOpenChange,
}: {
  user: AdminUserDto | null;
  onOpenChange(open: boolean): void;
}) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {user ? (
          <ResetPasswordFlow key={user.id} user={user} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordFlow({ user, onDone }: { user: AdminUserDto; onDone(): void }) {
  const invalidate = useInvalidateUsers();
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const tooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const control: FieldControlProps = {
    id: 'reset-password',
    'aria-invalid': tooShort || undefined,
    'aria-describedby': 'reset-password-help',
    'aria-required': true,
  };

  if (done) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Password reset for {user.name}</DialogTitle>
          <DialogDescription>
            Their sessions have ended. Share the temporary password securely; they must choose a new
            one when they next sign in.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">Temporary password:</span>
          <code className="font-mono font-semibold break-all">{password}</code>
          <CopyButton value={password} label="temporary password" />
        </div>
        <DialogFooter>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reset password for {user.name}</DialogTitle>
        <DialogDescription>{RESET_PASSWORD_WARNING}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-password">
          Temporary password
          <span aria-hidden className="text-destructive">
            *
          </span>
        </Label>
        <TemporaryPasswordInput control={control} value={password} onChange={setPassword} />
        <p id="reset-password-help" className="text-xs text-muted-foreground">
          At least {PASSWORD_MIN_LENGTH} characters. Use Generate for a strong one.
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={password.length < PASSWORD_MIN_LENGTH}
          onClick={() => setConfirming(true)}
        >
          Continue
        </Button>
      </DialogFooter>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Reset ${user.name}'s password?`}
        description={
          <>
            <p>{RESET_PASSWORD_WARNING}</p>
            <p>This cannot be undone.</p>
          </>
        }
        confirmLabel="Reset password"
        level="destructive"
        onConfirm={async () => {
          await adminUsersApi.setPassword(user.id, { newPassword: password });
          void invalidate();
          notifySuccess('Password reset', `${user.name} must choose a new password at sign-in.`);
          setDone(true);
        }}
      />
    </>
  );
}

const STATUS_COPY: Record<
  'SUSPENDED' | 'DISABLED' | 'ACTIVE',
  {
    title: (name: string) => string;
    body: string;
    label: string;
    done: string;
    level: 'standard' | 'destructive';
  }
> = {
  SUSPENDED: {
    title: (name) => `Suspend ${name}?`,
    body: 'They are signed out everywhere immediately and cannot sign in until an admin reactivates the account.',
    label: 'Suspend',
    done: 'suspended',
    level: 'destructive',
  },
  DISABLED: {
    title: (name) => `Disable ${name}?`,
    body: 'They are signed out everywhere immediately. Use this when someone leaves; the account and its history are kept.',
    label: 'Disable',
    done: 'disabled',
    level: 'destructive',
  },
  ACTIVE: {
    title: (name) => `Reactivate ${name}?`,
    body: 'They can sign in again with their current password.',
    label: 'Reactivate',
    done: 'reactivated',
    level: 'standard',
  },
};

export function StatusChangeDialog({
  target,
  onOpenChange,
}: {
  target: { user: AdminUserDto; status: 'SUSPENDED' | 'DISABLED' | 'ACTIVE' } | null;
  onOpenChange(open: boolean): void;
}) {
  const invalidate = useInvalidateUsers();
  const copy = target ? STATUS_COPY[target.status] : null;
  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={onOpenChange}
      title={copy && target ? copy.title(target.user.name) : ''}
      description={<p>{copy?.body}</p>}
      confirmLabel={copy?.label ?? 'Confirm'}
      level={copy?.level ?? 'standard'}
      onConfirm={async () => {
        if (!target) return;
        await adminUsersApi.update(target.user.id, { status: target.status as AdminUserStatus });
        void invalidate();
        notifySuccess(`${target.user.name} was ${copy?.done ?? 'updated'}`);
      }}
    />
  );
}

export function DeleteAdminDialog({
  user,
  onOpenChange,
}: {
  user: AdminUserDto | null;
  onOpenChange(open: boolean): void;
}) {
  const invalidate = useInvalidateUsers();
  return (
    <ConfirmDialog
      open={Boolean(user)}
      onOpenChange={onOpenChange}
      title={user ? `Delete ${user.name}?` : ''}
      description={
        <>
          <p>
            The account is removed and cannot sign in again. There is no restore. To keep the
            account for later, disable it instead.
          </p>
          <p>Their actions stay in the audit log.</p>
        </>
      }
      confirmLabel="Delete admin"
      level="irreversible"
      confirmText={user?.email}
      onConfirm={async () => {
        if (!user) return;
        await adminUsersApi.remove(user.id);
        void invalidate();
        notifySuccess('Admin deleted', user.email);
      }}
    />
  );
}
