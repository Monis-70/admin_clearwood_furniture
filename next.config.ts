import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

/**
 * Production is a static export served by nginx, which also proxies /api to the Express API
 * (docs/ADMIN_DEPLOYMENT_PLAN.md, option A). `next dev` imitates that same-origin topology with a
 * rewrite so cookies, CSRF and readable headers behave exactly as they will in production.
 */
export default function nextConfig(phase: string): NextConfig {
  const base: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    images: { unoptimized: true },
    devIndicators: false,
    agentRules: false,
  };

  if (phase !== PHASE_DEVELOPMENT_SERVER) {
    return { ...base, output: 'export' };
  }

  const apiOrigin = process.env.CLEARWOOD_API_ORIGIN ?? 'http://localhost:7180';
  return {
    ...base,
    async rewrites() {
      return [
        { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
        { source: '/health', destination: `${apiOrigin}/health` },
        { source: '/ready', destination: `${apiOrigin}/ready` },
      ];
    },
  };
}
