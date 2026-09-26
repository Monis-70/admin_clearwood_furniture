import { cn } from '@/lib/utils';

/** Wordmark: restrained brand colour, no decorative effects. */
export function BrandMark({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-bold tracking-tight text-primary-foreground"
      >
        CW
      </span>
      {collapsed ? (
        <span className="sr-only">ClearWood Admin</span>
      ) : (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold text-foreground">ClearWood</span>
          <span className="mt-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Admin
          </span>
        </span>
      )}
    </span>
  );
}
