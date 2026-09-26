'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { Permission } from '@shared/enums';
import { displayNameSchema, roleCodeSchema, type RoleUpdateInput } from '@shared/schemas/auth';
import type { RoleDto } from '@shared/types/auth';

import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { FormAlert, FormField } from '@/components/patterns/form/form-field';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/lib/auth/session';
import { notifySuccess } from '@/lib/notify';
import { applyServerErrors } from '@/lib/validation/server-errors';

import { roleKeys, rolesApi, type PermissionRegistry } from './api';
import { PermissionMatrix } from './permission-matrix';
import { dangerReason } from './permission-model';
import { usePermissionRegistry } from './queries';

const schema = z.object({
  code: roleCodeSchema,
  name: displayNameSchema,
  description: z.string().trim().max(400),
  isActive: z.boolean(),
});
type Values = z.input<typeof schema>;

interface RoleEditorProps {
  /** Omitted: create a new custom role. */
  role?: RoleDto;
  open: boolean;
  onOpenChange(open: boolean): void;
  onSaved?(role: RoleDto): void;
}

export function RoleEditorDialog({ role, open, onOpenChange, onSaved }: RoleEditorProps) {
  const registry = usePermissionRegistry();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{role ? `Edit ${role.name}` : 'New role'}</DialogTitle>
          <DialogDescription>
            {role
              ? 'Changes apply to every admin with this role on their next click.'
              : 'A role is a named set of permissions you can give to admins.'}
          </DialogDescription>
        </DialogHeader>
        {registry.isPending ? (
          <SectionLoader label="Loading permissions…" />
        ) : registry.error ? (
          <ErrorState error={registry.error} onRetry={() => void registry.refetch()} compact />
        ) : open ? (
          <RoleForm
            key={role?.id ?? 'new'}
            role={role}
            registry={registry.data}
            onDone={(saved) => {
              onOpenChange(false);
              if (saved) onSaved?.(saved);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RoleForm({
  role,
  registry,
  onDone,
}: {
  role?: RoleDto;
  registry: PermissionRegistry;
  onDone(saved?: RoleDto): void;
}) {
  const queryClient = useQueryClient();
  const { permissions: held } = useSession();
  const initial = useMemo(() => new Set(role?.permissions ?? []), [role]);
  const [granted, setGranted] = useState<Set<string>>(() => new Set(initial));
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [formMessages, setFormMessages] = useState<string[]>([]);
  const [confirmDanger, setConfirmDanger] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: role?.code ?? '',
      name: role?.name ?? '',
      description: role?.description ?? '',
      isActive: role?.isActive ?? true,
    },
  });

  const permissionsChanged =
    granted.size !== initial.size || [...granted].some((code) => !initial.has(code));
  useUnsavedChangesGuard(form.formState.isDirty || permissionsChanged);

  const dangerous = [...granted].filter((code) => dangerReason(code) && !initial.has(code));

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const permissions = [...granted] as Permission[];
      if (!role) {
        return rolesApi.create({
          code: values.code,
          name: values.name,
          description: values.description || undefined,
          permissions,
        });
      }
      const input: RoleUpdateInput = {};
      if (values.name !== role.name) input.name = values.name;
      if ((values.description || null) !== role.description) {
        input.description = values.description || null;
      }
      if (!role.isSystem && values.isActive !== role.isActive) input.isActive = values.isActive;
      if (permissionsChanged) input.permissions = permissions;
      if (Object.keys(input).length === 0) return role;
      return rolesApi.update(role.id, input);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: roleKeys.all });
      notifySuccess(role ? 'Role saved' : 'Role created', saved.name);
      onDone(saved);
    },
  });

  const submit = async (values: Values) => {
    setSubmitError(null);
    setFormMessages([]);
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      const mapped = applyServerErrors(error, form.setError, {
        fields: ['code', 'name', 'description', 'isActive'],
      });
      if (mapped) setFormMessages(mapped.form);
      else setSubmitError(error);
      throw error;
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (dangerous.length > 0) {
      setConfirmDanger(true);
      return;
    }
    await submit(values).catch(() => undefined);
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert error={submitError} messages={formMessages} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField<Values>
            name="name"
            label="Name"
            required
            description="What admins see, e.g. Store Manager."
          >
            {(control) => <Input {...control} {...form.register('name')} autoComplete="off" />}
          </FormField>
          <FormField<Values>
            name="code"
            label="Code"
            required
            description={
              role ? 'A role code never changes.' : 'Capitals and underscores, e.g. STORE_MANAGER.'
            }
          >
            {(control) => (
              <Input
                {...control}
                {...form.register('code')}
                readOnly={Boolean(role)}
                className="font-mono uppercase"
                autoComplete="off"
              />
            )}
          </FormField>
        </div>
        <FormField<Values>
          name="description"
          label="Description"
          description="Optional. Who is this role for?"
        >
          {(control) => <Textarea {...control} {...form.register('description')} rows={2} />}
        </FormField>
        {role && !role.isSystem ? (
          <div className="flex items-start gap-3">
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Checkbox
                  id="role-active"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  className="mt-0.5"
                />
              )}
            />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="role-active">Active</Label>
              <span className="text-xs text-muted-foreground">
                An inactive role cannot be given to anyone new.
              </span>
            </div>
          </div>
        ) : null}
        {role?.isSystem ? (
          <Alert tone="info" title="Built-in role">
            Built-in roles cannot be deactivated or deleted. You can still adjust their permissions
            if you hold them all.
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Permissions ({granted.size})</h3>
          <PermissionMatrix
            mode="edit"
            registry={registry}
            value={granted}
            onChange={setGranted}
            grantable={held}
          />
        </div>

        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-card px-6 py-3">
          <Button type="button" variant="outline" onClick={() => onDone()}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {role ? 'Save role' : 'Create role'}
          </Button>
        </DialogFooter>
      </form>

      <ConfirmDialog
        open={confirmDanger}
        onOpenChange={setConfirmDanger}
        title="Give these sensitive permissions?"
        description={
          <p>
            Everyone with this role will be able to do the following. Only continue if they need it.
          </p>
        }
        impact={
          <ul className="flex flex-col gap-1.5">
            {dangerous.map((code) => (
              <li key={code} className="flex items-start gap-2">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  <span className="font-mono text-xs">{code}</span> — {dangerReason(code)}
                </span>
              </li>
            ))}
          </ul>
        }
        confirmLabel={role ? 'Save role' : 'Create role'}
        level="destructive"
        onConfirm={() => submit(form.getValues())}
      />
    </FormProvider>
  );
}
