'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, MoreHorizontal, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { pricingRoutes } from '@/lib/api/routes/pricing';
import { formatDate, formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys } from '../catalog/api';
import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormProblem,
  NumberField,
  SelectField,
  TextField,
  dateTimeInput,
  intInput,
  optionalDateTime,
  optionalInt,
  requiredInt,
  requiredText,
  textInput,
} from '../catalog/form-kit';
import { flattenTree, useBrandOptions, useCategoryOptions } from '../catalog/lookups';
import { formatRupees } from '../catalog/model';
import { RecordDialog } from '../catalog/record-dialog';

import { TraceView } from './breakdown-view';
import { CartBuilder, cartInput, cartProblems, emptyCart, type SampleCart } from './cart-builder';
import {
  CONDITION_FIELDS,
  OPERATOR_LABELS,
  WEEKDAYS,
  describeAction,
  fromActions,
  fromConditions,
  isList,
  operatorsFor,
  toActions,
  toConditions,
  type ActionDraft,
  type ConditionDraft,
} from './discount-model';
import { CHANNEL_LABELS, useCustomerGroupOptions } from './lookups';
import { ProductPicker } from './product-picker';
import { parseActions, rulesApi, rulesKeys, type DiscountRuleRow } from './rules-api';

export function DiscountRulesScreen() {
  const { canCall } = usePermissions();
  if (!canCall(pricingRoutes.discountRules)) {
    return <PermissionNotice area="automatic discounts" all={['pricing.adjustment.read']} />;
  }
  return <DiscountRules />;
}

function DiscountRules() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<never>({
    filters: [],
    defaultSort: 'priority',
    defaultOrder: 'asc',
  });
  const [editing, setEditing] = useState<DiscountRuleRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<DiscountRuleRow | null>(null);
  const [testing, setTesting] = useState(false);
  const query = { page: params.page, limit: params.limit };
  const rules = useQuery({
    queryKey: rulesKeys.discountRules(query),
    queryFn: ({ signal }) => rulesApi.discountRules(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: rulesKeys.all });

  const columns: DataTableColumn<DiscountRuleRow>[] = [
    {
      id: 'name',
      meta: { label: 'Rule', pinned: true, mobile: 'title' },
      header: 'Rule',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
        </span>
      ),
    },
    {
      id: 'gives',
      meta: { label: 'Gives', mobile: 'detail' },
      header: 'Gives',
      cell: ({ row }) => parseActions(row.original).map(describeAction).join(' + '),
    },
    {
      id: 'scope',
      meta: { label: 'Applies to', mobile: 'detail' },
      header: 'Applies to',
      cell: ({ row }) => (row.original.scope === 'CART' ? 'The cart' : 'Each matching line'),
    },
    {
      id: 'window',
      meta: { label: 'When', mobile: 'detail' },
      header: 'When',
      cell: ({ row }) =>
        row.original.startsAt || row.original.endsAt
          ? `${row.original.startsAt ? formatDate(row.original.startsAt) : 'Now'} – ${row.original.endsAt ? formatDate(row.original.endsAt) : 'no end'}`
          : 'Always',
    },
    {
      id: 'usage',
      meta: { label: 'Used', align: 'right', mobile: 'detail' },
      header: 'Used',
      cell: ({ row }) => (
        <span className="tabular">
          {formatNumber(row.original.usedCount)}
          {row.original.usageLimit ? ` / ${formatNumber(row.original.usageLimit)}` : ''}
        </span>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          <Badge tone={row.original.isActive ? 'success' : 'neutral'}>
            {row.original.isActive ? 'Active' : 'Off'}
          </Badge>
          {row.original.stopFurtherRules ? <Badge tone="info">Stops later rules</Badge> : null}
        </span>
      ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        canCall(pricingRoutes.updateDiscountRule) || canCall(pricingRoutes.removeDiscountRule) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${row.original.name}`}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canCall(pricingRoutes.updateDiscountRule) ? (
                <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
              ) : null}
              {canCall(pricingRoutes.removeDiscountRule) ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setRemoving(row.original)}
                  >
                    Delete…
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Automatic discounts"
        description="Discounts checkout applies without a code when a cart meets the conditions. Rules run in priority order (lowest first)."
        actions={
          <>
            {canCall(pricingRoutes.evaluateDiscountRules) ? (
              <Button variant="outline" onClick={() => setTesting(true)}>
                <FlaskConical aria-hidden />
                Test rules
              </Button>
            ) : null}
            {canCall(pricingRoutes.createDiscountRule) ? (
              <Button onClick={() => setEditing('new')}>
                <Plus aria-hidden />
                New rule
              </Button>
            ) : null}
          </>
        }
      />
      <DataTable
        label="Automatic discounts"
        columns={columns}
        query={rules}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="discount-rules"
        empty={
          <EmptyState
            icon={Sparkles}
            title="No automatic discounts"
            description="Create a rule such as 5% off carts above ₹50,000."
          />
        }
      />
      {editing ? (
        <DiscountRuleDialog
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      ) : null}
      {testing ? <TestRulesDialog onClose={() => setTesting(false)} /> : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Delete ${removing.name}?`}
          description="Checkout stops applying it immediately. Orders already placed keep their discount."
          confirmLabel="Delete rule"
          level="destructive"
          onConfirm={async () => {
            await rulesApi.removeDiscountRule(removing.id);
            refresh();
            notifySuccess('Rule deleted');
          }}
        />
      ) : null}
    </>
  );
}

const ruleSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9_]*$/, 'Use UPPER_SNAKE_CASE, e.g. BIG_CART_5')
      .min(2)
      .max(40),
    name: requiredText(2, 160, 'Name'),
    scope: z.enum(['LINE', 'CART']),
    priority: requiredInt(0, 10_000, 'Priority'),
    stopFurtherRules: z.boolean(),
    match: z.enum(['ALL', 'ANY']),
    startsAt: optionalDateTime(),
    endsAt: optionalDateTime(),
    isActive: z.boolean(),
    usageLimit: optionalInt(1, 1_000_000, 'Usage limit'),
    rows: z.string(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, {
    path: ['endsAt'],
    message: 'The end must be after the start',
  });
type RuleValues = z.input<typeof ruleSchema>;

function DiscountRuleDialog({
  rule,
  onClose,
  onSaved,
}: {
  rule: DiscountRuleRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  const stored = rule
    ? (JSON.parse(rule.conditionsJson) as { match: 'ALL' | 'ANY'; conditions: [] })
    : null;
  const [conditions, setConditions] = useState<ConditionDraft[]>(
    stored
      ? fromConditions(stored.conditions)
      : [{ field: 'cartSubtotalPaise', operator: 'GREATER_OR_EQUAL', value: '' }],
  );
  const [actions, setActions] = useState<ActionDraft[]>(
    rule ? fromActions(parseActions(rule)) : [{ type: 'PERCENT', value: '', max: '' }],
  );

  return (
    <RecordDialog
      title={rule ? `Edit ${rule.name}` : 'New automatic discount'}
      onClose={onClose}
      wide
    >
      <EditorForm
        schema={ruleSchema}
        defaultValues={{
          code: textInput(rule?.code),
          name: textInput(rule?.name),
          scope: (rule?.scope as 'LINE' | 'CART') ?? 'CART',
          priority: intInput(rule?.priority ?? 100),
          stopFurtherRules: rule?.stopFurtherRules ?? false,
          match: stored?.match ?? 'ALL',
          startsAt: dateTimeInput(rule?.startsAt),
          endsAt: dateTimeInput(rule?.endsAt),
          isActive: rule?.isActive ?? true,
          usageLimit: intInput(rule?.usageLimit),
          rows: '',
        }}
        successMessage={rule ? 'Rule saved' : 'Rule created'}
        submitLabel={rule ? 'Save changes' : 'Create rule'}
        onSubmit={async ({ match, rows: _rows, ...values }) => {
          const parsedConditions = toConditions(conditions);
          const parsedActions = toActions(actions);
          if (conditions.length === 0) throw new FormProblem(['Add at least one condition.']);
          if (actions.length === 0) throw new FormProblem(['Add at least one discount.']);
          if (typeof parsedConditions === 'string') throw new FormProblem([parsedConditions]);
          if (typeof parsedActions === 'string') throw new FormProblem([parsedActions]);
          const input = {
            ...values,
            conditions: { match, conditions: parsedConditions as never },
            actions: parsedActions,
          };
          if (rule) await rulesApi.updateDiscountRule(rule.id, { ...input, version: rule.version });
          else await rulesApi.createDiscountRule(input);
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<RuleValues> name="name" label="Name" required />
          <TextField<RuleValues> name="code" label="Code" required />
        </FieldGrid>
        <FieldGrid>
          <SelectField<RuleValues>
            name="scope"
            label="Discount applies to"
            options={[
              { value: 'CART', label: 'The whole cart' },
              { value: 'LINE', label: 'Each matching line' },
            ]}
          />
          <SelectField<RuleValues>
            name="match"
            label="Conditions"
            options={[
              { value: 'ALL', label: 'All conditions must hold' },
              { value: 'ANY', label: 'Any one condition is enough' },
            ]}
          />
        </FieldGrid>
        <ConditionRows rows={conditions} onChange={setConditions} />
        <ActionRows rows={actions} onChange={setActions} />
        <DirtyWhenChanged value={JSON.stringify({ conditions, actions })} />
        <FieldGrid>
          <TextField<RuleValues> name="startsAt" label="Starts" type="datetime-local" />
          <TextField<RuleValues> name="endsAt" label="Ends" type="datetime-local" />
        </FieldGrid>
        <FieldGrid>
          <NumberField<RuleValues>
            name="priority"
            label="Priority"
            required
            description="Lower runs first."
          />
          <NumberField<RuleValues>
            name="usageLimit"
            label="Usage limit"
            description="Empty: unlimited."
          />
        </FieldGrid>
        <FieldGrid>
          <CheckField<RuleValues>
            name="stopFurtherRules"
            label="Stop later rules"
            description="When this rule applies, rules with a higher number are skipped."
          />
          <CheckField<RuleValues> name="isActive" label="Active" />
        </FieldGrid>
      </EditorForm>
    </RecordDialog>
  );
}

/** Rows kept outside react-hook-form still count as unsaved changes. */
function DirtyWhenChanged({ value }: { value: string }) {
  const { setValue } = useFormContext<RuleValues>();
  const [initial] = useState(value);
  useEffect(() => {
    setValue('rows', value === initial ? '' : value, { shouldDirty: value !== initial });
  }, [value, initial, setValue]);
  return null;
}

function ConditionRows({
  rows,
  onChange,
}: {
  rows: ConditionDraft[];
  onChange(rows: ConditionDraft[]): void;
}) {
  const set = (index: number, patch: Partial<ConditionDraft>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">When</legend>
      {rows.map((row, index) => {
        const kind = CONDITION_FIELDS[row.field]?.kind ?? 'text';
        const operators = operatorsFor(kind);
        return (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-md bg-muted/30 p-2 sm:flex-row sm:items-end"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor={`cond-field-${index}`} className="text-xs">
                Condition {index + 1}
              </Label>
              <NativeSelect
                id={`cond-field-${index}`}
                value={row.field}
                onChange={(e) => {
                  const nextKind = CONDITION_FIELDS[e.target.value]?.kind ?? 'text';
                  set(index, {
                    field: e.target.value,
                    operator: operatorsFor(nextKind)[0]!,
                    value: '',
                  });
                }}
              >
                {Object.entries(CONDITION_FIELDS).map(([value, f]) => (
                  <option key={value} value={value}>
                    {f.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`cond-op-${index}`} className="text-xs">
                Test
              </Label>
              <NativeSelect
                id={`cond-op-${index}`}
                value={row.operator}
                onChange={(e) => set(index, { operator: e.target.value, value: '' })}
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label htmlFor={`cond-value-${index}`} className="text-xs">
                Value
              </Label>
              <ConditionValue
                id={`cond-value-${index}`}
                row={row}
                onChange={(value) => set(index, { value })}
              />
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove condition ${index + 1}`}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        );
      })}
      {rows.length < 20 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            onChange([...rows, { field: 'qty', operator: 'GREATER_OR_EQUAL', value: '' }])
          }
        >
          <Plus aria-hidden />
          Add condition
        </Button>
      ) : null}
    </fieldset>
  );
}

function ConditionValue({
  id,
  row,
  onChange,
}: {
  id: string;
  row: ConditionDraft;
  onChange(value: string): void;
}) {
  const kind = CONDITION_FIELDS[row.field]?.kind ?? 'text';
  const multiple = isList(row.operator);
  const categories = useCategoryOptions(kind === 'category');
  const brands = useBrandOptions(kind === 'brand');
  const groups = useCustomerGroupOptions(kind === 'group');
  const collections = useQuery({
    queryKey: catalogKeys.collections({ page: 1, limit: 100, order: 'asc' }),
    queryFn: ({ signal }) => catalogApi.collections({ page: 1, limit: 100, order: 'asc' }, signal),
    enabled: kind === 'collection',
    ...cachePolicy.reference,
  });
  const choices: { value: string; label: string }[] | null =
    kind === 'category'
      ? flattenTree(categories.data ?? []).map((c) => ({
          value: c.id,
          label: `${'\u00a0\u00a0'.repeat(c.depth)}${c.name}`,
        }))
      : kind === 'brand'
        ? (brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))
        : kind === 'collection'
          ? (collections.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
          : kind === 'group'
            ? (groups.data ?? []).map((g) => ({ value: g.code, label: g.name }))
            : kind === 'channel'
              ? Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }))
              : kind === 'weekday'
                ? WEEKDAYS.map((label, value) => ({ value: String(value), label }))
                : kind === 'boolean'
                  ? [
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' },
                    ]
                  : null;

  if (kind === 'product') {
    const ids = row.value ? row.value.split(',') : [];
    return (
      <div className="flex flex-col gap-1">
        {ids.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {ids.length} product{ids.length === 1 ? '' : 's'} chosen.{' '}
            <button type="button" className="underline" onClick={() => onChange('')}>
              Clear
            </button>
          </p>
        ) : null}
        <ProductPicker
          label="Find a product"
          actionLabel={multiple ? 'Add' : 'Choose'}
          exclude={ids}
          onPick={(p) => onChange(multiple ? [...ids, p.id].join(',') : p.id)}
        />
      </div>
    );
  }
  if (choices) {
    const selected = row.value ? row.value.split(',') : [];
    return multiple ? (
      <select
        id={id}
        multiple
        size={Math.min(6, Math.max(3, choices.length))}
        className="rounded-md border bg-background p-1 text-sm"
        value={selected}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => o.value).join(','))}
      >
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    ) : (
      <NativeSelect id={id} value={row.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </NativeSelect>
    );
  }
  return (
    <Input
      id={id}
      value={row.value}
      inputMode={kind === 'money' ? 'decimal' : kind === 'count' ? 'numeric' : undefined}
      placeholder={
        kind === 'money' ? 'Rupees' : multiple ? 'Separate values with commas' : undefined
      }
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ActionRows({
  rows,
  onChange,
}: {
  rows: ActionDraft[];
  onChange(rows: ActionDraft[]): void;
}) {
  const set = (index: number, patch: Partial<ActionDraft>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">Then give</legend>
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-md bg-muted/30 p-2 sm:flex-row sm:items-end"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={`act-type-${index}`} className="text-xs">
              Discount {index + 1}
            </Label>
            <NativeSelect
              id={`act-type-${index}`}
              value={row.type}
              onChange={(e) => set(index, { type: e.target.value, value: '' })}
            >
              <option value="PERCENT">A percentage off</option>
              <option value="FIXED">An amount off</option>
              <option value="FREE_SHIPPING">Free delivery</option>
            </NativeSelect>
          </div>
          {row.type === 'FREE_SHIPPING' ? null : (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`act-value-${index}`} className="text-xs">
                  {row.type === 'PERCENT' ? 'Percent' : 'Rupees'}
                </Label>
                <Input
                  id={`act-value-${index}`}
                  className="w-28"
                  inputMode="decimal"
                  value={row.value}
                  onChange={(e) => set(index, { value: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`act-max-${index}`} className="text-xs">
                  At most (₹, optional)
                </Label>
                <Input
                  id={`act-max-${index}`}
                  className="w-32"
                  inputMode="decimal"
                  value={row.max}
                  onChange={(e) => set(index, { max: e.target.value })}
                />
              </div>
            </>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove discount ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      {rows.length < 5 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => onChange([...rows, { type: 'PERCENT', value: '', max: '' }])}
        >
          <Plus aria-hidden />
          Add discount
        </Button>
      ) : null}
    </fieldset>
  );
}

function TestRulesDialog({ onClose }: { onClose(): void }) {
  const [cart, setCart] = useState<SampleCart>(emptyCart());
  const [problems, setProblems] = useState<string[]>([]);
  const run = useMutation({ mutationFn: () => rulesApi.evaluateDiscountRules(cartInput(cart)) });
  return (
    <RecordDialog
      title="Test automatic discounts"
      description="Prices a sample cart with the live rules and shows which ones fired. Nothing is saved."
      onClose={onClose}
      wide
    >
      <div className="flex flex-col gap-4">
        <CartBuilder cart={cart} onChange={setCart} withCoupon={false} />
        <FormAlert error={run.error} messages={problems} />
        <Button
          className="w-fit"
          loading={run.isPending}
          onClick={() => {
            const found = cartProblems(cart);
            setProblems(found);
            if (found.length === 0) run.mutate();
          }}
        >
          Test
        </Button>
        {run.data ? (
          <div aria-live="polite" className="flex flex-col gap-3">
            <p className="text-sm">
              {run.data.appliedRuleIds.length === 0
                ? 'No automatic discount applies to this cart.'
                : `${run.data.appliedRuleIds.length} rule${run.data.appliedRuleIds.length === 1 ? '' : 's'} applied, ${formatRupees(run.data.discountPaise)} off in total.`}
            </p>
            <TraceView trace={run.data.trace} />
          </div>
        ) : null}
      </div>
    </RecordDialog>
  );
}
