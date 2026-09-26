'use client';

import { useState } from 'react';

import { BLOCK_REGISTRY } from '@shared/cms/blockRegistry';
import type { BlockType } from '@shared/enums';

import { FormAlert } from '@/components/patterns/form/form-alert';
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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { notifySuccess } from '@/lib/notify';

import { contentApi, type BlockTypeInfo, type CmsPage, type PageBlock } from '../api';
import { DEVICE_LABELS } from '../model';

import { ConfigEditor, labelOf } from './config-editor';
import { dateTimeLocal, fromDateTimeLocal } from './datetime';

type Obj = Record<string, unknown>;

const clone = (value: unknown): Obj =>
  value && typeof value === 'object' ? (JSON.parse(JSON.stringify(value)) as Obj) : {};

/** Add or edit one block: its settings (generated from the shared schema) and when it shows. */
export function BlockDialog({
  page,
  block,
  type,
  info,
  onClose,
  onSaved,
}: {
  page: CmsPage;
  block: PageBlock | null;
  type: BlockType;
  info?: BlockTypeInfo;
  onClose(): void;
  onSaved(page: CmsPage): void;
}) {
  const definition = BLOCK_REGISTRY[type];
  const [config, setConfig] = useState<Obj>(() =>
    clone(
      block ? (block.rawConfig ?? block.config) : (info?.defaultConfig ?? definition.defaultConfig),
    ),
  );
  const [isActive, setIsActive] = useState(block?.isActive ?? true);
  const [device, setDevice] = useState(block?.deviceVisibility ?? 'ALL');
  const [startsAt, setStartsAt] = useState(dateTimeLocal(block?.startsAt));
  const [endsAt, setEndsAt] = useState(dateTimeLocal(block?.endsAt));
  const [anchorId, setAnchorId] = useState(block?.anchorId ?? '');
  const [cssClass, setCssClass] = useState(block?.cssClass ?? '');
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setDirty(true);
    };

  const save = async () => {
    setError(null);
    setProblems([]);
    const parsed = definition.configSchema.safeParse(config);
    const local: string[] = [];
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        local.push(
          `${issue.path.length ? issue.path.map((p) => (typeof p === 'number' ? p + 1 : labelOf(String(p)))).join(' › ') : 'Settings'}: ${issue.message}`,
        );
    if (anchorId && !/^[a-zA-Z0-9_-]*$/.test(anchorId))
      local.push('Anchor: letters, digits, hyphen and underscore only');
    if (cssClass && !/^[a-zA-Z0-9 _-]*$/.test(cssClass))
      local.push('Style classes: letters, digits, spaces, hyphen and underscore only');
    const start = fromDateTimeLocal(startsAt);
    const end = fromDateTimeLocal(endsAt);
    if (start && end && end <= start) local.push('"Show until" must be after "Show from"');
    if (local.length || !parsed.success) {
      setProblems(local);
      return;
    }
    const body = {
      config: parsed.data as Obj,
      isActive,
      deviceVisibility: device,
      startsAt: start,
      endsAt: end,
      anchorId: anchorId || null,
      cssClass: cssClass || null,
    };
    setSaving(true);
    try {
      const saved = block
        ? await contentApi.updateBlock(page.id, block.id, body)
        : await contentApi.addBlock(page.id, { ...body, type });
      notifySuccess(block ? 'Block saved' : 'Block added');
      onSaved(saved);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || saving) return;
        if (dirty && !window.confirm('Discard the changes to this block?')) return;
        onClose();
      }}
    >
      <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {block ? 'Edit' : 'Add'} {definition.label.toLowerCase()}
          </DialogTitle>
          <DialogDescription>{definition.description}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-1">
          {page.status === 'PUBLISHED' && isActive ? (
            <Alert tone="warning" title="This page is live">
              Saving shows this block to customers at once. Untick &quot;Show on the page&quot; to
              prepare it first.
            </Alert>
          ) : null}
          <FormAlert error={error} messages={problems} />
          <ConfigEditor
            schema={definition.configSchema}
            value={config}
            onChange={touch(setConfig)}
          />
          <fieldset className="flex flex-col gap-4 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">When and where</legend>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={isActive}
                onChange={(e) => touch(setIsActive)(e.target.checked)}
              />
              Show on the page
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="block-device">Devices</Label>
                <NativeSelect
                  id="block-device"
                  value={device}
                  onChange={(e) => touch(setDevice)(e.target.value)}
                >
                  {Object.entries(DEVICE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="block-starts">Show from</Label>
                <Input
                  id="block-starts"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => touch(setStartsAt)(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="block-ends">Show until</Label>
                <Input
                  id="block-ends"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => touch(setEndsAt)(e.target.value)}
                />
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">Advanced</summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="block-anchor">Anchor</Label>
                  <Input
                    id="block-anchor"
                    value={anchorId}
                    maxLength={60}
                    onChange={(e) => touch(setAnchorId)(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lets a link jump here, e.g. /page#offers.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="block-css">Style classes</Label>
                  <Input
                    id="block-css"
                    value={cssClass}
                    maxLength={120}
                    onChange={(e) => touch(setCssClass)(e.target.value)}
                  />
                </div>
              </div>
            </details>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            {block ? 'Save block' : 'Add block'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
