'use client';

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

import { BrandMark } from './brand';
import { SidebarNav } from './sidebar-nav';

/** The navigation drawer below 1024 px; loaded the first time it is opened. */
export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="gap-0 overflow-y-auto p-0 lg:hidden">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Areas of the admin you can open.</SheetDescription>
        <div className="flex h-14 items-center border-b px-4">
          <BrandMark />
        </div>
        <SidebarNav onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
