'use client';

import { Check, Minus, TriangleAlert } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { PermissionRegistry } from './api';
import { groupPermissions, matchesSearch, type PermissionEntry } from './permission-model';

type Props =
  | { mode: 'view'; registry: PermissionRegistry; granted: ReadonlySet<string> }
  | {
      mode: 'edit';
      registry: PermissionRegistry;
      value: ReadonlySet<string>;
      onChange(next: Set<string>): void;
      /** Permissions the current admin holds: only these can be granted. */
      grantable: ReadonlySet<string>;
      disabled?: boolean;
    };

function DangerNote({ entry }: { entry: PermissionEntry }) {
  if (!entry.danger) return null;
  return (
    <span className="flex items-start gap-1 text-xs text-warning">
      <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {entry.danger}
    </span>
  );
}

/**
 * Permissions grouped by business area and resource, with plain-language names and warnings on the
 * dangerous ones. The codes stay visible in small print for support conversations.
 */
export function PermissionMatrix(props: Props) {
  const searchId = useId();
  const [term, setTerm] = useState('');
  const [onlyGranted, setOnlyGranted] = useState(props.mode === 'view');
  const domains = useMemo(() => groupPermissions(props.registry), [props.registry]);
  const selected = props.mode === 'view' ? props.granted : props.value;

  const toggle = (codes: string[], checked: boolean) => {
    if (props.mode !== 'edit') return;
    const next = new Set(props.value);
    for (const code of codes) {
      if (!props.grantable.has(code) && checked) continue;
      if (checked) next.add(code);
      else next.delete(code);
    }
    props.onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1 sm:w-80">
          <Label htmlFor={searchId} className="sr-only">
            Search permissions
          </Label>
          <Input
            id={searchId}
            type="search"
            placeholder="Search permissions (e.g. export, products)"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={onlyGranted} onCheckedChange={(v) => setOnlyGranted(v === true)} />
          {props.mode === 'view' ? 'Only what is allowed' : 'Only selected'}
        </label>
      </div>

      {domains.map((domain) => {
        const sections = domain.sections
          .map((section) => ({
            ...section,
            entries: section.entries.filter(
              (entry) =>
                matchesSearch(entry, section, term.trim()) &&
                (!onlyGranted || selected.has(entry.code)),
            ),
          }))
          .filter((section) => section.entries.length > 0);
        if (sections.length === 0) return null;
        const held = domain.sections
          .flatMap((section) => section.entries)
          .filter((entry) => selected.has(entry.code)).length;

        return (
          <section
            key={domain.group}
            aria-labelledby={`${searchId}-${domain.group}`}
            className="rounded-md border"
          >
            <header className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
              <h3 id={`${searchId}-${domain.group}`} className="text-sm font-semibold">
                {domain.label}
              </h3>
              <Badge tone={held === domain.total ? 'success' : held > 0 ? 'info' : 'neutral'}>
                {held === domain.total ? 'All' : `${held} of ${domain.total}`}
              </Badge>
            </header>
            <div className="divide-y">
              {sections.map((section) => {
                const codes = section.entries.map((entry) => entry.code);
                const allOn = codes.every((code) => selected.has(code));
                const someOn = codes.some((code) => selected.has(code));
                return (
                  <div key={section.resource} className="flex flex-col gap-2 px-3 py-3">
                    <div className="flex items-center gap-2">
                      {props.mode === 'edit' ? (
                        <Checkbox
                          aria-label={`All permissions for ${section.label}`}
                          checked={allOn ? true : someOn ? 'indeterminate' : false}
                          disabled={props.disabled}
                          onCheckedChange={(v) => toggle(codes, v === true)}
                        />
                      ) : null}
                      <h4 className="text-sm font-medium">{section.label}</h4>
                    </div>
                    <ul
                      className={cn('grid gap-2 sm:grid-cols-2', props.mode === 'edit' && 'pl-6')}
                    >
                      {section.entries.map((entry) => {
                        const on = selected.has(entry.code);
                        if (props.mode === 'view') {
                          return (
                            <li key={entry.code} className="flex items-start gap-2 text-sm">
                              {on ? (
                                <Check
                                  aria-hidden
                                  className="mt-0.5 size-4 shrink-0 text-success"
                                />
                              ) : (
                                <Minus
                                  aria-hidden
                                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                />
                              )}
                              <span className="flex flex-col gap-0.5">
                                <span className={cn(!on && 'text-muted-foreground')}>
                                  {entry.label}
                                  <span className="sr-only">
                                    {on ? ': allowed' : ': not allowed'}
                                  </span>
                                </span>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {entry.code}
                                </span>
                                {on ? <DangerNote entry={entry} /> : null}
                              </span>
                            </li>
                          );
                        }
                        const id = `${searchId}-${entry.code}`;
                        const canGrant = props.grantable.has(entry.code);
                        const locked = props.disabled || (!canGrant && !on);
                        return (
                          <li key={entry.code} className="flex items-start gap-2 text-sm">
                            <Checkbox
                              id={id}
                              checked={on}
                              disabled={locked}
                              onCheckedChange={(v) => toggle([entry.code], v === true)}
                              className="mt-0.5"
                              aria-describedby={!canGrant ? `${id}-why` : undefined}
                            />
                            <span className="flex flex-col gap-0.5">
                              <Label
                                htmlFor={id}
                                className={cn('font-normal', locked && 'text-muted-foreground')}
                              >
                                {entry.label}
                              </Label>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {entry.code}
                              </span>
                              {!canGrant ? (
                                <span id={`${id}-why`} className="text-xs text-muted-foreground">
                                  You don&apos;t hold this permission, so you can&apos;t grant it.
                                </span>
                              ) : null}
                              <DangerNote entry={entry} />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
