import { endpoint, requires } from '../endpoint';

export const enquiriesRoutes = {
  list: endpoint('GET', '/admin/enquiries', { access: requires('lead.enquiry.read') }),
  get: endpoint('GET', '/admin/enquiries/{id}', { access: requires('lead.enquiry.read') }),
} as const;
