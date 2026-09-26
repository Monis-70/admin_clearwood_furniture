'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { BrandMark } from '@/components/patterns/app-shell/brand';
import { FormAlert, FormField, PasswordInput } from '@/components/patterns/form/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/surface';
import { isApiError } from '@/lib/api/errors';
import { PasswordChangeGate } from '@/lib/auth/guards';
import { loginHref } from '@/lib/auth/redirects';
import { useCurrentAdmin, useSession } from '@/lib/auth/session';
import { notifyError, notifySuccess } from '@/lib/notify';
import { applyServerErrors } from '@/lib/validation/server-errors';

import {
  PASSWORD_GUIDANCE as GUIDANCE,
  changePasswordFormSchema as formSchema,
} from './password-form';

function ChangePasswordForm() {
  const me = useCurrentAdmin();
  const { changePassword, signOut } = useSession();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [formMessages, setFormMessages] = useState<string[]>([]);
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    setSubmitError(null);
    setFormMessages([]);
    try {
      await changePassword({ currentPassword, newPassword });
      notifySuccess('Password changed', 'Other devices were signed out. This one stays signed in.');
    } catch (error) {
      if (isApiError(error) && error.code === 'INVALID_CREDENTIALS') {
        form.setError(
          'currentPassword',
          { type: 'server', message: error.message },
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

  const leave = async () => {
    try {
      await signOut();
      router.replace(loginHref({ reason: 'signed-out' }));
    } catch (error) {
      notifyError(error, 'Could not sign out');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <BrandMark />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            {me.user.name}, your account uses a temporary password. Choose your own to continue.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="py-6">
          <FormProvider {...form}>
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
              <FormAlert error={submitError} messages={formMessages} />
              <FormField name="currentPassword" label="Current (temporary) password" required>
                {(control) => (
                  <PasswordInput
                    {...control}
                    {...form.register('currentPassword')}
                    autoComplete="current-password"
                    autoFocus
                  />
                )}
              </FormField>
              <FormField
                name="newPassword"
                label="New password"
                required
                description={
                  <span className="flex flex-col gap-0.5">
                    {GUIDANCE.map((line) => (
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
              <Button type="submit" className="mt-1 w-full" loading={form.formState.isSubmitting}>
                Save new password
              </Button>
            </form>
          </FormProvider>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Other devices signed in to your account will be signed out.{' '}
        <Button variant="link" className="text-xs" onClick={() => void leave()}>
          Sign out instead
        </Button>
      </p>
    </div>
  );
}

export function ChangePasswordScreen() {
  return (
    <PasswordChangeGate>
      <ChangePasswordForm />
    </PasswordChangeGate>
  );
}
