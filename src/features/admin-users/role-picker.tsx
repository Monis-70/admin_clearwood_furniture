'use client';

import { ShieldAlert } from 'lucide-react';

import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { endpoints } from '@/lib/api/endpoints';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { useRoles } from '../roles/queries';

import { STANDARD_ROLES, SUPER_ADMIN } from './model';

interface RolePickerProps {
  value: readonly string[];
  onChange(codes: string[]): void;
  describedBy?: string;
  invalid?: boolean;
}

interface RoleOption {
  key: string;
  code: string;
  name: string;
  detail: string;
  custom: boolean;
  disabled: boolean;
}

/**
 * Roles come from the API (seeded and custom) when the admin may read them; otherwise the built-in
 * roles are offered and the API decides which of them this admin may grant.
 */
export function RolePicker(props: RolePickerProps) {
  const { canCall } = usePermissions();
  return canCall(endpoints.roles.list) ? (
    <CatalogueRolePicker {...props} />
  ) : (
    <StandardRolePicker {...props} />
  );
}

function CatalogueRolePicker(props: RolePickerProps) {
  const roles = useRoles();

  if (roles.isPending) return <SectionLoader label="Loading roles…" className="py-3" />;
  if (roles.error)
    return <ErrorState error={roles.error} onRetry={() => void roles.refetch()} compact />;

  const options = roles.data
    .filter((role) => role.isActive || props.value.includes(role.code))
    .map((role) => ({
      key: role.id,
      code: role.code,
      name: role.name,
      detail: role.description ?? `${role.permissionCount} permissions`,
      custom: !role.isSystem,
      disabled: !role.isActive && !props.value.includes(role.code),
    }));
  return <RoleOptions {...props} options={options} />;
}

function StandardRolePicker(props: RolePickerProps) {
  const options = STANDARD_ROLES.map((role) => ({
    key: role.code,
    code: role.code,
    name: role.name,
    detail: role.summary,
    custom: false,
    disabled: false,
  }));
  return (
    <div className="flex flex-col gap-2">
      <RoleOptions {...props} options={options} />
      <p className="text-xs text-muted-foreground">
        Showing the standard roles. Custom roles, and what each role allows, need &lsquo;View roles
        and permissions&rsquo;.
      </p>
    </div>
  );
}

function RoleOptions({
  value,
  onChange,
  describedBy,
  invalid,
  options,
}: RolePickerProps & { options: RoleOption[] }) {
  const toggle = (code: string, checked: boolean) =>
    onChange(checked ? [...value, code] : value.filter((item) => item !== code));

  return (
    <fieldset
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className="flex flex-col gap-2 rounded-md border p-3"
    >
      <legend className="sr-only">Roles</legend>
      {options.map((role) => {
        const id = `role-${role.code}`;
        return (
          <div key={role.key} className="flex items-start gap-3">
            <Checkbox
              id={id}
              checked={value.includes(role.code)}
              disabled={role.disabled}
              onCheckedChange={(next) => toggle(role.code, next === true)}
              className="mt-0.5"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <Label htmlFor={id} className="font-medium">
                {role.name}
                {role.custom ? (
                  <span className="text-xs font-normal text-muted-foreground">(custom)</span>
                ) : null}
              </Label>
              <span className="text-xs text-muted-foreground">{role.detail}</span>
              {role.code === SUPER_ADMIN ? (
                <span className="flex items-center gap-1 text-xs font-medium text-warning">
                  <ShieldAlert aria-hidden className="size-3.5" />
                  Full access to everything, including managing other admins and payments.
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
