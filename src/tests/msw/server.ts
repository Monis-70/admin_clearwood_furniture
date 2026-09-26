import { setupServer } from 'msw/node';

import { adminDataHandlers } from './admin-data';
import { handlers } from './backend';

export const server = setupServer(...handlers, ...adminDataHandlers);
