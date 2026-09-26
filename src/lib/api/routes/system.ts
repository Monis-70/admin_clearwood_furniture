import { PUBLIC, endpoint } from '../endpoint';

export const systemRoutes = {
  version: endpoint('GET', '/version', { access: PUBLIC }),
  health: endpoint('GET', '/health', { access: PUBLIC, base: 'root' }),
  ready: endpoint('GET', '/ready', { access: PUBLIC, base: 'root' }),
} as const;
