import { endpoint, requires } from '../endpoint';

export const cartsRoutes = {
  list: endpoint('GET', '/admin/carts', { access: requires('order.customer.read') }),
  stats: endpoint('GET', '/admin/carts/stats', { access: requires('order.customer.read') }),
  get: endpoint('GET', '/admin/carts/{id}', { access: requires('order.customer.read') }),
  cleanup: endpoint('POST', '/admin/carts/cleanup', { access: requires('order.customer.update') }),
  customerCart: endpoint('GET', '/admin/customers/{id}/cart', {
    access: requires('order.customer.read'),
  }),
  wishlistStats: endpoint('GET', '/admin/wishlists/stats', {
    access: requires('order.customer.read'),
  }),
} as const;
