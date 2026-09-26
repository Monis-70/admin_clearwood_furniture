import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva('relative flex w-full gap-3 rounded-md border px-4 py-3 text-sm', {
  variants: {
    tone: {
      info: 'border-info/25 bg-info-bg text-info',
      success: 'border-success/25 bg-success-bg text-success',
      warning: 'border-warning/25 bg-warning-bg text-warning',
      danger: 'border-danger/25 bg-danger-bg text-danger',
      neutral: 'border-border bg-card text-foreground',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ICONS = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  neutral: Info,
};

type AlertProps = React.ComponentProps<'div'> &
  VariantProps<typeof alertVariants> & {
    title?: React.ReactNode;
    /** `alert` interrupts screen readers; use it only for errors that need attention now. */
    live?: 'polite' | 'assertive' | 'off';
    icon?: boolean;
  };

function Alert({
  className,
  tone = 'info',
  title,
  live = 'polite',
  icon = true,
  children,
  ...props
}: AlertProps) {
  const Icon = ICONS[tone ?? 'info'];
  return (
    <div
      data-slot="alert"
      role={live === 'assertive' ? 'alert' : live === 'polite' ? 'status' : undefined}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      {icon ? <Icon aria-hidden className="mt-0.5 size-4 shrink-0" /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="leading-snug font-semibold">{title}</p> : null}
        {children ? (
          <div className="leading-relaxed text-foreground/90 [&_a]:underline">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

export { Alert, alertVariants };
