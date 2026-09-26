'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  displayNameSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
  roleCodeSchema,
} from '@shared/schemas/auth';
import type { AdminUserDto } from '@shared/types/auth';

import { CopyButton } from '@/components/patterns/copy-button';
import { FormAlert, FormField } from '@/components/patterns/form/form-field';
import { Alert } from '@/components/ui/alert';
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
import { notifySuccess } from '@/lib/notify';
import { applyServerErrors } from '@/lib/validation/server-errors';

import { adminUserKeys, adminUsersApi } from './api';
import { RolePicker } from './role-picker';
import { TemporaryPasswordInput } from './temporary-password-input';

const optionalPhone = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .pipe(phoneSchema.optional());

const createSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  phone: optionalPhone,
  password: passwordSchema,
  roleCodes: z.array(roleCodeSchema).min(1, 'Choose at least one role'),
});

const editSchema = z.object({ name: displayNameSchema, phone: optionalPhone });

type CreateValues = z.input<typeof createSchema>;
type EditValues = z.input<typeof editSchema>;

interface CreateAdminDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function CreateAdminDialog({ open, onOpenChange }: CreateAdminDialogProps) {
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<{ user: AdminUserDto; password: string } | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [formMessages, setFormMessages] = useState<string[]>([]);
  const form = useForm<CreateValues, unknown, z.output<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', roleCodes: [] },
  });

  const mutation = useMutation({
    mutationFn: adminUsersApi.create,
    onSuccess: (user, input) => {
      void queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
      setCreated({ user, password: input.password ?? '' });
      notifySuccess('Admin added', `${user.name} can now sign in.`);
    },
  });

  const close = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) {
      form.reset();
      setCreated(null);
      setSubmitError(null);
      setFormMessages([]);
    }
    onOpenChange(next);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setFormMessages([]);
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      const mapped = applyServerErrors(error, form.setError, {
        fields: ['name', 'email', 'phone', 'password', 'roleCodes'],
      });
      if (mapped) setFormMessages(mapped.form);
      else setSubmitError(error);
    }
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{created.user.name} was added</DialogTitle>
              <DialogDescription>
                Share the temporary password securely, for example in person or by phone. They must
                choose their own password the first time they sign in.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-medium">{created.user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Temporary password: </span>
                <code className="font-mono font-semibold break-all">{created.password}</code>
                <CopyButton value={created.password} label="temporary password" />
              </div>
            </div>
            <Alert tone="warning" title="This password is shown only once">
              It is not stored by the admin. If it is lost, reset the password from the list.
            </Alert>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add an admin</DialogTitle>
              <DialogDescription>
                They sign in with this email and a temporary password you set now, and must choose
                their own password the first time they sign in.
              </DialogDescription>
            </DialogHeader>
            <FormProvider {...form}>
              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
                <FormAlert error={submitError} messages={formMessages} />
                <FormField<CreateValues> name="name" label="Full name" required>
                  {(control) => (
                    <Input {...control} {...form.register('name')} autoComplete="off" />
                  )}
                </FormField>
                <FormField<CreateValues> name="email" label="Email" required>
                  {(control) => (
                    <Input
                      {...control}
                      {...form.register('email')}
                      type="email"
                      autoComplete="off"
                    />
                  )}
                </FormField>
                <FormField<CreateValues>
                  name="phone"
                  label="Mobile number"
                  description="Optional. Indian mobile number, e.g. +91 98450 12345."
                >
                  {(control) => (
                    <Input {...control} {...form.register('phone')} type="tel" autoComplete="off" />
                  )}
                </FormField>
                <FormField<CreateValues>
                  name="password"
                  label="Temporary password"
                  required
                  description="Use Generate for a strong one. It is replaced at their first sign-in."
                >
                  {(control) => (
                    <Controller
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <TemporaryPasswordInput
                          control={control}
                          name={field.name}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  )}
                </FormField>
                <FormField<CreateValues>
                  name="roleCodes"
                  label="Roles"
                  required
                  description="What they can do. You can only give roles whose permissions you hold yourself."
                >
                  {(control) => (
                    <Controller
                      control={form.control}
                      name="roleCodes"
                      render={({ field }) => (
                        <RolePicker
                          value={field.value}
                          onChange={field.onChange}
                          describedBy={control['aria-describedby']}
                          invalid={control['aria-invalid']}
                        />
                      )}
                    />
                  )}
                </FormField>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => close(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={mutation.isPending}>
                    Add admin
                  </Button>
                </DialogFooter>
              </form>
            </FormProvider>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditAdminDialogProps {
  user: AdminUserDto | null;
  onOpenChange(open: boolean): void;
}

export function EditAdminDialog({ user, onOpenChange }: EditAdminDialogProps) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {user ? (
          <EditAdminForm key={user.id} user={user} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditAdminForm({ user, onDone }: { user: AdminUserDto; onDone(): void }) {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [formMessages, setFormMessages] = useState<string[]>([]);
  const form = useForm<EditValues, unknown, z.output<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: user.name, phone: user.phone ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof adminUsersApi.update>[1]) =>
      adminUsersApi.update(user.id, input),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
      notifySuccess('Details saved', updated.name);
      onDone();
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setFormMessages([]);
    const input: { name?: string; phone?: string | null } = {};
    if (values.name !== user.name) input.name = values.name;
    const phone = values.phone ?? null;
    if (phone !== user.phone) input.phone = phone;
    if (Object.keys(input).length === 0) {
      onDone();
      return;
    }
    try {
      await mutation.mutateAsync(input);
    } catch (error) {
      const mapped = applyServerErrors(error, form.setError, { fields: ['name', 'phone'] });
      if (mapped) setFormMessages(mapped.form);
      else setSubmitError(error);
    }
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit {user.name}</DialogTitle>
        <DialogDescription>
          Their email address is their sign-in and cannot be changed here.
        </DialogDescription>
      </DialogHeader>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormAlert error={submitError} messages={formMessages} />
          <FormField<EditValues> name="name" label="Full name" required>
            {(control) => <Input {...control} {...form.register('name')} autoComplete="off" />}
          </FormField>
          <FormField<EditValues>
            name="phone"
            label="Mobile number"
            description="Optional. Leave empty to remove it."
          >
            {(control) => (
              <Input {...control} {...form.register('phone')} type="tel" autoComplete="off" />
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} disabled={!form.formState.isDirty}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </FormProvider>
    </>
  );
}
