'use client';

import { useState } from 'react';

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
import { Label } from '@/components/ui/label';

/** Names a filter set; loaded the first time someone saves one. */
export function SaveFilterDialog({
  open,
  onOpenChange,
  max,
  onSave,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  max: number;
  onSave(name: string): void;
}) {
  const [name, setName] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save these filters</DialogTitle>
          <DialogDescription>
            Saved on this device for your account only. You can keep up to {max}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            onSave(name);
            setName('');
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="saved-filter-name">Name</Label>
            <Input
              id="saved-filter-name"
              value={name}
              maxLength={60}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. New contract enquiries"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
