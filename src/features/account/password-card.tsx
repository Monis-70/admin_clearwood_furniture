'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { FormAlert, FormField, PasswordInput } from '@/components/patterns/form/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/surface';
import { isApiError } from '@/lib/api/errors';
import { useSession } from '@/lib/auth/session';
import { notifySuccess } from '@/lib/notify';
import { applyServerErrors } from '@/lib/validation/server-errors';

import { PASSWORD_GUIDANCE, changePasswordFormSchema } from '../auth/password-form';

import { accountKeys } from './api';

/** The voluntary password change (the forced one lives on /change-password). */
export function PasswordCard() {
  const { changePassword } = useSession();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [formMessages, setFormMessages] = useState<string[]>([]);
  const form = useForm({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    setSubmitError(null);
    setFormMessages([]);
    try {
      await changePassword({ currentPassword, newPassword });
      form.reset();
      void queryClient.invalidateQueries({ queryKey: accountKeys.sessions() });
      notifySuccess(
        'Password changed',
        'Your other devices were signed out. This one stays signed in.',
      );
    } catch (error) {
      if (isApiError(error) && error.code === 'INVALID_CREDENTIALS') {
        form.setError(
          'currentPassword',
          { type: 'server', message: 'Your current password is not correct.' },
          { shouldFocus: true },
        );
        return;
      }
      const mapped = applyServerErrors(error, form.setError, {
        aliases: { password: 'newPassword' },
        fields: ['currentPassword', 'newPassword', 'confirmPassword'],
      });
      if (mapped) setFormMessages(mapped.form);
      else setSubmitError(error);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change your password</CardTitle>
        <CardDescription>
          Your other devices are signed out when you change it; this one stays signed in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-4">
            <FormAlert error={submitError} messages={formMessages} />
            <FormField name="currentPassword" label="Current password" required>
              {(control) => (
                <PasswordInput
                  {...control}
                  {...form.register('currentPassword')}
                  autoComplete="current-password"
                />
              )}
            </FormField>
            <FormField
              name="newPassword"
              label="New password"
              required
              description={
                <span className="flex flex-col gap-0.5">
                  {PASSWORD_GUIDANCE.map((line) => (
                    <span key={line}>• {line}</span>
                  ))}
                </span>
              }
            >
              {(control) => (
                <PasswordInput
                  {...control}
                  {...form.register('newPassword')}
                  autoComplete="new-password"
                />
              )}
            </FormField>
            <FormField name="confirmPassword" label="Repeat new password" required>
              {(control) => (
                <PasswordInput
                  {...control}
                  {...form.register('confirmPassword')}
                  autoComplete="new-password"
                />
              )}
            </FormField>
            <div>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Change password
              </Button>
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
