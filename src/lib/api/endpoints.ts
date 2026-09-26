import { authRoutes } from './routes/auth';
import { usersRoutes } from './routes/users';
import { rolesRoutes } from './routes/roles';
import { auditRoutes } from './routes/audit';
import { catalogRoutes } from './routes/catalog';
import { productsRoutes } from './routes/products';
import { variantsRoutes } from './routes/variants';
import { inventoryRoutes } from './routes/inventory';
import { categoriesRoutes } from './routes/categories';
import { attributesRoutes } from './routes/attributes';
import { brandsRoutes } from './routes/brands';
import { taxClassesRoutes } from './routes/taxClasses';
import { collectionsRoutes } from './routes/collections';
import { priceAdjustmentsRoutes } from './routes/priceAdjustments';
import { pricingRoutes } from './routes/pricing';
import { searchRoutes } from './routes/search';
import { maintenanceRoutes } from './routes/maintenance';
import { importExportRoutes } from './routes/importExport';
import { mediaRoutes } from './routes/media';
import { contentRoutes } from './routes/content';
import { enquiriesRoutes } from './routes/enquiries';
import { cartsRoutes } from './routes/carts';
import { systemRoutes } from './routes/system';

/**
 * The single registry of API operations the admin calls. Paths are written once, here; feature
 * API modules reference these definitions and never spell a path themselves.
 * `npm run coverage:check` verifies every entry against the pinned backend route inventory
 * (method, path, auth, permissions, CSRF, idempotency) and src/config/api-coverage.ts.
 *
 * App code imports the per-domain modules in ./routes (so a page ships only what it uses);
 * this aggregate is for scripts and tests.
 */
export const endpoints = {
  auth: authRoutes,
  users: usersRoutes,
  roles: rolesRoutes,
  audit: auditRoutes,
  catalog: catalogRoutes,
  products: productsRoutes,
  variants: variantsRoutes,
  inventory: inventoryRoutes,
  categories: categoriesRoutes,
  attributes: attributesRoutes,
  brands: brandsRoutes,
  taxClasses: taxClassesRoutes,
  collections: collectionsRoutes,
  priceAdjustments: priceAdjustmentsRoutes,
  pricing: pricingRoutes,
  search: searchRoutes,
  maintenance: maintenanceRoutes,
  importExport: importExportRoutes,
  media: mediaRoutes,
  content: contentRoutes,
  enquiries: enquiriesRoutes,
  carts: cartsRoutes,
  system: systemRoutes,
} as const;
