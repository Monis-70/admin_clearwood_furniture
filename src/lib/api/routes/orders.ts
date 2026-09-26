import { endpoint, requires, requiresAny } from '../endpoint';

export const ordersRoutes = {
  list: endpoint('GET', '/admin/orders', { access: requires('order.order.read') }),
  get: endpoint('GET', '/admin/orders/{id}', { access: requires('order.order.read') }),
  ledgerCheck: endpoint('GET', '/admin/orders/{id}/ledger-check', {
    access: requires('order.order.read'),
  }),
  setStatus: endpoint('POST', '/admin/orders/{id}/status', {
    access: requires('order.order.update'),
  }),
  cancel: endpoint('POST', '/admin/orders/{id}/cancel', { access: requires('order.order.cancel') }),
  shipments: endpoint('GET', '/admin/orders/{orderNumber}/shipments', {
    access: requires('order.order.read'),
  }),
  createShipment: endpoint('POST', '/admin/orders/{orderNumber}/shipments', {
    access: requires('order.order.fulfil'),
    idempotent: true,
  }),
  documents: endpoint('GET', '/admin/orders/{orderNumber}/documents', {
    access: requires('order.order.read'),
  }),
  issueInvoice: endpoint('POST', '/admin/orders/{orderNumber}/documents/invoice', {
    access: requires('order.order.update'),
    idempotent: true,
  }),
  downloadDocument: endpoint('GET', '/admin/documents/{documentNumber}/download', {
    access: requires('order.order.read'),
  }),
  notificationLogs: endpoint('GET', '/admin/notifications/logs', {
    access: requires('order.order.read'),
  }),
  report: endpoint('GET', '/admin/reports', {
    access: requiresAny(
      'order.order.export',
      'order.refund.read',
      'payment.split.read',
      'catalog.inventory.read',
    ),
    long: true,
  }),
} as const;
