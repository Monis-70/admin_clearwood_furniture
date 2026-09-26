import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement, ReactNode } from 'react';
import { expect } from 'vitest';

import { SessionProvider } from '@/lib/auth/session';
import { createQueryClient } from '@/lib/query/query-client';

export function testQueryClient(): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  });
  return client;
}

/** The real providers (query cache + session), as the root layout mounts them. */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { queryClient?: QueryClient } = {},
) {
  const queryClient = options.queryClient ?? testQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/** WCAG 2.x A/AA rules; colour contrast is verified in the browser suite (jsdom has no layout). */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  const summary = result.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`,
  );
  expect(summary, summary.join('\n')).toEqual([]);
}
