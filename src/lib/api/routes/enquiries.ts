import { endpoint, requires } from '../endpoint';

export const enquiriesRoutes = {
  list: endpoint('GET', '/admin/enquiries', { access: requires('lead.enquiry.read') }),
  get: endpoint('GET', '/admin/enquiries/{id}', { access: requires('lead.enquiry.read') }),
  update: endpoint('PATCH', '/admin/enquiries/{id}', { access: requires('lead.enquiry.update') }),
  assignees: endpoint('GET', '/admin/enquiries/assignees', {
    access: requires('lead.enquiry.assign'),
  }),
} as const;
