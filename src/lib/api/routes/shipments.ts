import { endpoint, requires } from '../endpoint';

export const shipmentsRoutes = {
  list: endpoint('GET', '/admin/shipments', { access: requires('order.order.read') }),
  get: endpoint('GET', '/admin/shipments/{shipmentNumber}', {
    access: requires('order.order.read'),
  }),
  assignAwb: endpoint('POST', '/admin/shipments/{shipmentNumber}/awb', {
    access: requires('order.order.fulfil'),
    idempotent: true,
  }),
  cancel: endpoint('POST', '/admin/shipments/{shipmentNumber}/cancel', {
    access: requires('order.order.fulfil'),
  }),
  setStatus: endpoint('POST', '/admin/shipments/{shipmentNumber}/status', {
    access: requires('order.order.fulfil'),
  }),
  ndr: endpoint('GET', '/admin/ndr', { access: requires('order.order.read') }),
  ndrAction: endpoint('POST', '/admin/ndr/{id}/action', { access: requires('order.order.fulfil') }),
} as const;
