import { endpoint, requires } from '../endpoint';

export const attributesRoutes = {
  groups: endpoint('GET', '/admin/catalog/attribute-groups', {
    access: requires('catalog.attribute.read'),
  }),
  createGroup: endpoint('POST', '/admin/catalog/attribute-groups', {
    access: requires('catalog.attribute.create'),
  }),
  updateGroup: endpoint('PATCH', '/admin/catalog/attribute-groups/{id}', {
    access: requires('catalog.attribute.update'),
  }),
  removeGroup: endpoint('DELETE', '/admin/catalog/attribute-groups/{id}', {
    access: requires('catalog.attribute.delete'),
  }),
  list: endpoint('GET', '/admin/catalog/attributes', {
    access: requires('catalog.attribute.read'),
  }),
  get: endpoint('GET', '/admin/catalog/attributes/{id}', {
    access: requires('catalog.attribute.read'),
  }),
  create: endpoint('POST', '/admin/catalog/attributes', {
    access: requires('catalog.attribute.create'),
  }),
  update: endpoint('PATCH', '/admin/catalog/attributes/{id}', {
    access: requires('catalog.attribute.update'),
  }),
  remove: endpoint('DELETE', '/admin/catalog/attributes/{id}', {
    access: requires('catalog.attribute.delete'),
  }),
  reorder: endpoint('POST', '/admin/catalog/attributes/reorder', {
    access: requires('catalog.attribute.update'),
  }),
  createValue: endpoint('POST', '/admin/catalog/attributes/{id}/values', {
    access: requires('catalog.attribute.update'),
  }),
  updateValue: endpoint('PATCH', '/admin/catalog/attribute-values/{valueId}', {
    access: requires('catalog.attribute.update'),
  }),
  removeValue: endpoint('DELETE', '/admin/catalog/attribute-values/{valueId}', {
    access: requires('catalog.attribute.delete'),
  }),
} as const;
