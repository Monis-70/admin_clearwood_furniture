'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { adminLoginSchema } from '@shared/schemas/auth';

import { BrandMark } from '@/components/patterns/app-shell/brand';
import { FormAlert, FormField, PasswordInput } from '@/components/patterns/form/form-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/surface';
import type { SessionEndReason } from '@/lib/api/session-events';
import { GuestGate } from '@/lib/auth/guards';
import { useSession } from '@/lib/auth/session';
import { applyServerErrors } from '@/lib/validation/server-errors';

import { deviceLabel } from './device-label';

const REASONS: Record<
  SessionEndReason,
  { tone: 'info' | 'warning' | 'danger'; title: string; body?: string }
> = {
  expired: {
    tone: 'info',
    title: 'Your session has ended',
    body: 'Sign in again to continue where you left off.',
  },
  'signed-out': { tone: 'info', title: 'You have signed out' },
  'signed-out-elsewhere': { tone: 'info', title: 'You were signed out in another tab' },
  reuse: {
    tone: 'warning',
    title: 'Signed out for your security',
    body: 'Your session was used from two places at once, so every device was signed out.',
  },
  disabled: {
    tone: 'danger',
    title: 'Your account is not active',
    body: 'Contact a Super Admin to reactivate it.',
  },
  locked: {
    tone: 'warning',
    title: 'Your account is temporarily locked',
    body: 'Try again later.',
  },
};

function isReason(value: string | null): value is SessionEndReason {
  return value !== null && value in REASONS;
}

function SignInForm() {
  const { signIn } = useSession();
  const reason = useSearchParams().get('reason');
  const [submitError, setSubmitError] = useState<unknown>(null);
  const form = useForm({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signIn({ ...values, deviceLabel: deviceLabel() });
    } catch (error) {
      const mapped = applyServerErrors(error, form.setError, { fields: ['email', 'password'] });
      if (!mapped || mapped.form.length > 0 || Object.keys(mapped.fields).length === 0)
        setSubmitError(error);
      form.resetField('password');
      form.setFocus('password');
    }
  });

  const notice = isReason(reason) ? REASONS[reason] : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <BrandMark />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Use the email and password of your ClearWood admin account.
          </p>
        </div>
      </div>

      {notice && !submitError ? (
        <Alert tone={notice.tone} title={notice.title}>
          {notice.body}
        </Alert>
      ) : null}

      <Card>
        <CardContent className="py-6">
          <FormProvider {...form}>
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
              <FormAlert error={submitError} />
              <FormField name="email" label="Email" required>
                {(control) => (
                  <Input
                    {...control}
                    {...form.register('email')}
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                  />
                )}
              </FormField>
              <FormField name="password" label="Password" required>
                {(control) => (
                  <PasswordInput
                    {...control}
                    {...form.register('password')}
                    autoComplete="current-password"
                  />
                )}
              </FormField>
              <Button type="submit" className="mt-1 w-full" loading={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </FormProvider>
        </CardContent>
      </Card>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Forgot your password? Ask a Super Admin to set a temporary one for you. Password-reset
        emails are not enabled yet.
      </p>
    </div>
  );
}

export function SignInScreen() {
  return (
    <GuestGate>
      <SignInForm />
    </GuestGate>
  );
}
