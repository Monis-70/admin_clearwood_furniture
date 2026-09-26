import { ChevronDown } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

import { fieldBase } from './input';

type NativeSelectProps = Omit<React.ComponentProps<'select'>, 'size'> & {
  size?: 'sm' | 'default';
};

/**
 * The browser's own select, styled like the other fields. Used for simple choices (filters, page
 * size): no extra JavaScript, full keyboard and screen-reader support, and the native picker on
 * phones.
 */
function NativeSelect({ className, size = 'default', children, ...props }: NativeSelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        data-slot="native-select"
        className={cn(fieldBase, 'appearance-none pr-8', size === 'sm' ? 'h-8 text-sm' : 'h-9')}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
