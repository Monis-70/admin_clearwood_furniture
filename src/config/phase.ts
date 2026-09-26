/**
 * The build phase the admin is implemented through (docs/ADMIN_ARCHITECTURE.md §14).
 * Navigation shows entries up to this phase; `npm run coverage:check` requires every route
 * planned for this phase or earlier to be wired in the endpoint registry.
 */
export const IMPLEMENTED_THROUGH_PHASE = 2;
