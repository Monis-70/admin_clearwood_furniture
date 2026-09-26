/**
 * In-memory imitation of the admin data endpoints Phase 1 uses (users, roles, audit, read-only
 * catalog/content/enquiry lists, own sessions). Guards mirror the backend: session first, then the
 * route's permissions (403 FORBIDDEN), then CSRF on mutations. Shapes follow @clearwood/shared.
 */
import { http, type HttpResponseResolver } from 'msw';

import type { Permission } from '@shared/enums';
import type {
  AdminUserDto,
  AuditLogDto,
  PermissionDto,
  RoleDto,
  SessionDto,
} from '@shared/types/auth';

import { PERMISSION_LABELS } from '@/lib/permissions/labels';

import { ROLE_PERMISSIONS, type SeededRole } from '../fixtures/roles';

import { API, CSRF_COOKIE, backend, errorBody, meFor, ok } from './backend';

const ROLE_NAMES: Record<SeededRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  CATALOG_MANAGER: 'Catalog Manager',
  ORDER_MANAGER: 'Order Manager',
  CONTENT_MANAGER: 'Content Manager',
};

export interface AdminData {
  extraUsers: AdminUserDto[];
  customRoles: RoleDto[];
  audit: AuditLogDto[];
  sessions: SessionDto[];
}

export const adminData: AdminData = { extraUsers: [], customRoles: [], audit: [], sessions: [] };

const dangerous = (code: string) =>
  code.startsWith('system.role.') ||
  code === 'system.user.delete' ||
  code.startsWith('payment.') ||
  code.endsWith('.export') ||
  code === 'order.refund.approve';

export function seededRoles(): RoleDto[] {
  return (Object.keys(ROLE_PERMISSIONS) as SeededRole[]).map((code, index) => ({
    id: `role_${code}`,
    code,
    name: ROLE_NAMES[code],
    description: null,
    isSystem: true,
    position: index,
    isActive: true,
    permissionCount: ROLE_PERMISSIONS[code].length,
  }));
}

function allRoles(): RoleDto[] {
  return [...seededRoles(), ...adminData.customRoles];
}

function roleWithPermissions(role: RoleDto): RoleDto {
  const seeded = ROLE_PERMISSIONS[role.code as SeededRole];
  return { ...role, permissions: seeded ? [...seeded] : (role.permissions ?? []) };
}

export function registry(): Record<string, PermissionDto[]> {
  const groups: Record<string, PermissionDto[]> = {};
  for (const code of Object.keys(PERMISSION_LABELS)) {
    const group = code.split('.')[0]!;
    (groups[group] ??= []).push({
      id: `perm_${code}`,
      code,
      name: code,
      group,
      description: null,
      isDangerous: dangerous(code),
    });
  }
  return groups;
}

export function allUsers(): AdminUserDto[] {
  return [...backend.accounts.map((a) => meFor(a).user), ...adminData.extraUsers];
}

export function resetAdminData(): void {
  adminData.extraUsers = [];
  adminData.customRoles = [];
  adminData.sessions = [
    {
      id: 'sess_current',
      familyId: 'fam_1',
      deviceLabel: null,
      ip: '10.0.0.4',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36 Edg/140.0',
      createdAt: '2026-09-25T04:30:00.000Z',
      expiresAt: '2026-10-02T04:30:00.000Z',
      lastUsedAt: '2026-09-25T05:30:00.000Z',
      isCurrent: true,
    },
    {
      id: 'sess_phone',
      familyId: 'fam_2',
      deviceLabel: null,
      ip: '10.0.0.9',
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140.0 Mobile Safari/537.36',
      createdAt: '2026-09-20T04:30:00.000Z',
      expiresAt: '2026-09-27T04:30:00.000Z',
      lastUsedAt: null,
      isCurrent: false,
    },
  ];
  adminData.audit = [
    {
      id: 'aud_1',
      actorType: 'ADMIN_USER',
      actorId: 'adm_1',
      actorName: 'Priya Sharma',
      actorEmail: 'priya@clearwood.test',
      realm: 'ADMIN',
      action: 'UPDATE',
      entity: 'AdminUser',
      entityId: 'adm_2',
      severity: 'NOTICE',
      requestId: 'req_1',
      ip: '10.0.0.4',
      userAgent: 'test',
      meta: { fields: ['name'] },
      changes: { name: { from: 'Ravi', to: 'Ravi Kumar' } },
      createdAt: '2026-09-25T05:00:00.000Z',
    },
  ];
}
resetAdminData();

function readCookie(name: string): string | null {
  const pair = document.cookie
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

type Resolver = (
  request: Request,
  params: Record<string, string>,
) => ReturnType<HttpResponseResolver>;

/** authenticate -> requirePermission -> csrfProtection, as the admin routes chain them. */
function route(permissions: Permission[], resolver: Resolver, csrf = false): HttpResponseResolver {
  return async ({ request, params }) => {
    const url = new URL(request.url);
    backend.calls.push({
      method: request.method,
      path: url.pathname,
      csrf: request.headers.get('x-csrf-token'),
      requestId: request.headers.get('x-request-id'),
      body:
        request.method === 'GET'
          ? null
          : await request
              .clone()
              .json()
              .catch(() => null),
    });
    const session = backend.session;
    const a = session ? backend.accounts.find((x) => x.id === session.accountId) : undefined;
    if (!session || !a) return errorBody(401, 'NOT_AUTHENTICATED', 'Authentication required');
    if (!session.accessValid) return errorBody(401, 'TOKEN_EXPIRED', 'Your session has expired');
    if (a.mustChangePassword) {
      return errorBody(
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'You must change your password before continuing',
      );
    }
    const held = new Set<string>(ROLE_PERMISSIONS[a.role]);
    if (!permissions.every((code) => held.has(code))) {
      return errorBody(403, 'FORBIDDEN', 'You do not have permission to perform this action');
    }
    if (csrf) {
      const header = request.headers.get('x-csrf-token');
      if (!header || header !== readCookie(CSRF_COOKIE)) {
        return errorBody(403, 'CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token');
      }
    }
    return resolver(request, params as Record<string, string>);
  };
}

function paged<T>(request: Request, rows: T[]) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? 1);
  const limit = Number(url.searchParams.get('limit') ?? 25);
  const items = rows.slice((page - 1) * limit, page * limit);
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  return ok(items, 200, {
    page,
    limit,
    total: rows.length,
    totalPages,
    hasNext: page < totalPages,
  });
}

const PRODUCTS = [
  {
    id: 'prd_1',
    sku: 'CW-SOF-ARNA',
    slug: 'arna-sofa',
    name: 'Arna 3-Seater Sofa',
    status: 'ACTIVE',
    productType: 'SIMPLE',
    visibility: 'CATALOG_SEARCH',
    brandId: null,
    taxClassId: null,
    basePricePaise: 6_499_900,
    completenessScore: 92,
    variantCount: 2,
    mediaCount: 4,
    totalStock: 7,
    primaryCategoryId: null,
    publishedAt: '2026-09-01T00:00:00.000Z',
    lastPublishedAt: '2026-09-01T00:00:00.000Z',
    publication: 'LIVE',
    isFeatured: false,
    isNewArrival: false,
    allowCustomization: false,
    thumbnailUrl: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    version: 1,
    updatedAt: '2026-09-24T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'prd_2',
    sku: 'CW-TAB-DRAFT',
    slug: 'draft-table',
    name: 'Kavya Coffee Table',
    status: 'DRAFT',
    productType: 'SIMPLE',
    visibility: 'CATALOG_SEARCH',
    brandId: null,
    taxClassId: null,
    basePricePaise: 1_299_900,
    completenessScore: 35,
    variantCount: 1,
    mediaCount: 0,
    totalStock: 0,
    primaryCategoryId: null,
    publishedAt: null,
    lastPublishedAt: null,
    publication: 'DRAFT',
    isFeatured: false,
    isNewArrival: false,
    allowCustomization: false,
    thumbnailUrl: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    version: 0,
    updatedAt: '2026-09-25T00:00:00.000Z',
    deletedAt: null,
  },
];

const ENQUIRIES = [
  {
    id: 'enq_1',
    formKey: 'contract-work',
    status: 'NEW',
    name: 'Meera Iyer',
    email: 'meera@example.test',
    phone: null,
    city: 'Bengaluru',
    categoryId: null,
    categoryName: null,
    productId: null,
    assignedToId: null,
    createdAt: '2026-09-25T04:00:00.000Z',
  },
];

export const adminDataHandlers = [
  http.get(
    `${API}/admin/users`,
    route(['system.user.read'], (request) => {
      const url = new URL(request.url);
      const search = url.searchParams.get('search')?.toLowerCase();
      const status = url.searchParams.get('status');
      const rows = allUsers().filter(
        (u) =>
          (!search || u.name.toLowerCase().includes(search) || u.email.includes(search)) &&
          (!status || u.status === status),
      );
      return paged(request, rows);
    }),
  ),
  http.post(
    `${API}/admin/users`,
    route(
      ['system.user.create'],
      async (request) => {
        const body = (await request.clone().json()) as {
          email: string;
          name: string;
          phone?: string;
          password: string;
          roleCodes: string[];
        };
        if (allUsers().some((u) => u.email === body.email)) {
          return errorBody(409, 'CONFLICT', 'An admin with this email already exists');
        }
        const roles = allRoles().filter((r) => body.roleCodes.includes(r.code));
        const user: AdminUserDto = {
          id: `adm_new_${adminData.extraUsers.length + 1}`,
          email: body.email,
          name: body.name,
          phone: body.phone ?? null,
          status: 'ACTIVE',
          avatarMediaId: null,
          mustChangePassword: true,
          lastLoginAt: null,
          createdAt: '2026-09-25T06:00:00.000Z',
          roles: roles.map((r) => ({ id: r.id, code: r.code, name: r.name })),
        };
        adminData.extraUsers.push(user);
        return ok(user, 201);
      },
      true,
    ),
  ),
  http.patch(
    `${API}/admin/users/:id`,
    route(
      ['system.user.update'],
      async (request, params) => {
        const user = adminData.extraUsers.find((u) => u.id === params.id);
        if (!user)
          return errorBody(403, 'ADMIN_USER_NOT_MANAGEABLE', 'You cannot manage this admin');
        Object.assign(user, await request.clone().json());
        return ok(user);
      },
      true,
    ),
  ),
  http.delete(
    `${API}/admin/users/:id`,
    route(
      ['system.user.delete'],
      (_request, params) => {
        adminData.extraUsers = adminData.extraUsers.filter((u) => u.id !== params.id);
        return ok({ deleted: true });
      },
      true,
    ),
  ),
  http.post(
    `${API}/admin/users/:id/roles`,
    route(
      ['system.user.update', 'system.role.read'],
      async (request, params) => {
        const user = adminData.extraUsers.find((u) => u.id === params.id);
        if (!user)
          return errorBody(403, 'ADMIN_USER_NOT_MANAGEABLE', 'You cannot manage this admin');
        const body = (await request.clone().json()) as { roleCodes: string[] };
        user.roles = allRoles()
          .filter((r) => body.roleCodes.includes(r.code))
          .map((r) => ({ id: r.id, code: r.code, name: r.name }));
        return ok(user);
      },
      true,
    ),
  ),
  http.post(
    `${API}/admin/users/:id/password`,
    route(
      ['system.user.update'],
      (_request, params) => {
        const user = adminData.extraUsers.find((u) => u.id === params.id);
        if (!user)
          return errorBody(403, 'ADMIN_USER_NOT_MANAGEABLE', 'You cannot manage this admin');
        user.mustChangePassword = true;
        return ok({ reset: true });
      },
      true,
    ),
  ),

  http.get(
    `${API}/admin/roles`,
    route(['system.role.read'], () => ok(allRoles())),
  ),
  http.get(
    `${API}/admin/roles/:id`,
    route(['system.role.read'], (_request, params) => {
      const role = allRoles().find((r) => r.id === params.id);
      return role ? ok(roleWithPermissions(role)) : errorBody(404, 'NOT_FOUND', 'Role not found');
    }),
  ),
  http.post(
    `${API}/admin/roles`,
    route(
      ['system.role.create'],
      async (request) => {
        const body = (await request.clone().json()) as {
          code: string;
          name: string;
          description?: string;
          permissions: string[];
        };
        const role: RoleDto = {
          id: `role_custom_${adminData.customRoles.length + 1}`,
          code: body.code,
          name: body.name,
          description: body.description ?? null,
          isSystem: false,
          position: 10,
          isActive: true,
          permissionCount: body.permissions.length,
          permissions: body.permissions,
        };
        adminData.customRoles.push(role);
        return ok(role, 201);
      },
      true,
    ),
  ),
  http.patch(
    `${API}/admin/roles/:id`,
    route(
      ['system.role.update'],
      async (request, params) => {
        const role = adminData.customRoles.find((r) => r.id === params.id);
        if (!role) return errorBody(403, 'ROLE_NOT_MANAGEABLE', 'You cannot change this role');
        Object.assign(role, await request.clone().json());
        role.permissionCount = role.permissions?.length ?? 0;
        return ok(role);
      },
      true,
    ),
  ),
  http.delete(
    `${API}/admin/roles/:id`,
    route(
      ['system.role.delete'],
      (_request, params) => {
        adminData.customRoles = adminData.customRoles.filter((r) => r.id !== params.id);
        return ok({ deleted: true });
      },
      true,
    ),
  ),
  http.get(
    `${API}/admin/permissions`,
    route(['system.role.read'], () => ok(registry())),
  ),

  http.get(
    `${API}/admin/audit-logs`,
    route(['system.audit.read'], (request) => {
      const url = new URL(request.url);
      const entityId = url.searchParams.get('entityId');
      return paged(
        request,
        adminData.audit.filter((row) => !entityId || row.entityId === entityId),
      );
    }),
  ),

  http.get(
    `${API}/admin/auth/sessions`,
    route([], () => ok(adminData.sessions)),
  ),
  http.delete(
    `${API}/admin/auth/sessions/:id`,
    route(
      [],
      (_request, params) => {
        adminData.sessions = adminData.sessions.filter((s) => s.id !== params.id);
        return ok({ revoked: true });
      },
      true,
    ),
  ),
  http.post(
    `${API}/admin/auth/logout-all`,
    route(
      [],
      () => {
        adminData.sessions = [];
        backend.session = null;
        return ok({ revoked: 2 });
      },
      true,
    ),
  ),

  http.get(
    `${API}/admin/catalog/products`,
    route(['catalog.product.read'], (request) => {
      const url = new URL(request.url);
      const q = url.searchParams.get('q')?.toLowerCase();
      const status = url.searchParams.get('status');
      const hasMedia = url.searchParams.get('hasMedia');
      const max = url.searchParams.get('completenessMax');
      return paged(
        request,
        PRODUCTS.filter(
          (p) =>
            (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
            (!status || p.status === status) &&
            (hasMedia === null || (hasMedia === 'true') === p.mediaCount > 0) &&
            (max === null || p.completenessScore <= Number(max)),
        ),
      );
    }),
  ),
  http.get(
    `${API}/admin/catalog/inventory/low-stock`,
    route(['catalog.inventory.read'], (request) =>
      paged(request, [
        {
          variantId: 'var_1',
          sku: 'CW-TAB-DRAFT-OAK',
          stockQty: 0,
          reservedQty: 0,
          availableQty: 0,
          stockStatus: 'OUT_OF_STOCK',
          lowStockThreshold: 2,
          allowBackorder: false,
          productId: 'prd_2',
          productName: 'Kavya Coffee Table',
          variantName: 'Oak',
        },
      ]),
    ),
  ),
  http.get(
    `${API}/admin/catalog/categories/tree`,
    route(['catalog.category.read'], () =>
      ok([
        {
          id: 'cat_1',
          name: 'Sofas',
          slug: 'sofas',
          parentId: null,
          path: 'sofas',
          depth: 0,
          position: 1,
          kind: 'STANDARD',
          isActive: true,
          showInMenu: true,
          childCount: 1,
        },
        {
          id: 'cat_2',
          name: 'Recliners',
          slug: 'recliners',
          parentId: 'cat_1',
          path: 'sofas/recliners',
          depth: 1,
          position: 1,
          kind: 'STANDARD',
          isActive: false,
          showInMenu: true,
          childCount: 0,
        },
      ]),
    ),
  ),
  http.get(
    `${API}/admin/enquiries`,
    route(['lead.enquiry.read'], (request) => {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const q = url.searchParams.get('q')?.toLowerCase();
      return paged(
        request,
        ENQUIRIES.filter(
          (e) => (!status || e.status === status) && (!q || e.name.toLowerCase().includes(q)),
        ),
      );
    }),
  ),
];
