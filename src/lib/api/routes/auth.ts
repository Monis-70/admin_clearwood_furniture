import { PUBLIC, SESSION, endpoint } from '../endpoint';

export const authRoutes = {
  login: endpoint('POST', '/admin/auth/login', { access: PUBLIC }),
  refresh: endpoint('POST', '/admin/auth/refresh', { access: PUBLIC }),
  logout: endpoint('POST', '/admin/auth/logout', { access: SESSION, renewSession: false }),
  logoutAll: endpoint('POST', '/admin/auth/logout-all', { access: SESSION }),
  me: endpoint('GET', '/admin/auth/me', { access: SESSION }),
  changePassword: endpoint('POST', '/admin/auth/change-password', { access: SESSION }),
  sessions: endpoint('GET', '/admin/auth/sessions', { access: SESSION }),
  endSession: endpoint('DELETE', '/admin/auth/sessions/{id}', { access: SESSION }),
} as const;
