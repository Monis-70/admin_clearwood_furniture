import type { AuditAction, AuditSeverity } from '@shared/enums';

import type { StatusRegistry } from '@/components/patterns/status-badge';

export const AUDIT_ACTION_LABELS: Readonly<Record<AuditAction, string>> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  RESTORE: 'Restored',
  LOGIN: 'Signed in',
  LOGIN_FAILED: 'Sign-in failed',
  LOGOUT: 'Signed out',
  PASSWORD_CHANGE: 'Changed password',
  PASSWORD_RESET: 'Password reset',
  ROLE_ASSIGNED: 'Role assigned',
  ROLE_REVOKED: 'Role removed',
  PERMISSION_DENIED: 'Access refused',
  SESSION_REVOKED: 'Session ended',
  TOKEN_REUSE_DETECTED: 'Session reuse detected',
  SETTING_CHANGED: 'Setting changed',
  EXPORT: 'Exported',
  IMPORT: 'Imported',
  PUBLISH: 'Published',
  UNPUBLISH: 'Unpublished',
};

export const AUDIT_SEVERITY: StatusRegistry<AuditSeverity> = {
  INFO: { label: 'Info', tone: 'neutral', description: 'Routine activity.' },
  NOTICE: { label: 'Notice', tone: 'info', description: 'Worth knowing about.' },
  WARNING: { label: 'Warning', tone: 'warning', description: 'Something was refused or failed.' },
  CRITICAL: {
    label: 'Critical',
    tone: 'danger',
    description: 'Security-relevant: access, passwords, roles or deletions.',
  },
};

/** Entities with a readable name; the rest show the model name as the API reports it. */
export const AUDIT_ENTITY_LABELS: Readonly<Record<string, string>> = {
  AdminUser: 'Admin user',
  Role: 'Role',
  Product: 'Product',
  ProductVariant: 'Variant',
  Category: 'Category',
  Collection: 'Collection',
  Attribute: 'Attribute',
  Brand: 'Brand',
  Media: 'Media',
  Page: 'Page',
  Banner: 'Banner',
  Enquiry: 'Enquiry',
  Setting: 'Setting',
  Order: 'Order',
  Coupon: 'Coupon',
};

export const entityLabel = (entity: string): string => AUDIT_ENTITY_LABELS[entity] ?? entity;
