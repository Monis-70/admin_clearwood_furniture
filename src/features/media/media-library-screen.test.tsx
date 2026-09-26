import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { MediaLibraryScreen } from './media-library-screen';

const uploaded: string[] = [];

function serve() {
  server.use(
    http.get(
      `${API}/admin/media`,
      guarded(() => ok([], 200, { page: 1, limit: 48, total: 0, totalPages: 0, hasNext: false })),
    ),
    http.get(
      `${API}/admin/media/config`,
      guarded(() =>
        ok({
          maxUploadSizeMb: 15,
          maxUploadFiles: 20,
          maxImageDimension: 4000,
          minProductImageDimension: 1024,
          allowedImageMime: ['image/png'],
          allowedVideoMime: [],
          allowedDocMime: ['application/pdf'],
          renditions: [],
          avifEnabled: false,
          driver: 'local',
          presignSupported: false,
        }),
      ),
    ),
    http.get(
      `${API}/admin/media-folders`,
      guarded(() => ok([])),
    ),
    http.post(
      `${API}/admin/media/upload`,
      guarded(
        async (_account, request) => {
          const file = (await request.formData()).get('files') as File;
          uploaded.push(file.name);
          return ok(
            {
              uploaded: [{ media: { id: `med_${file.name}`, variants: [] }, deduplicated: false }],
            },
            201,
          );
        },
        { csrf: true },
      ),
    ),
  );
}

beforeEach(async () => {
  uploaded.length = 0;
  const NodeFormData = (await new Response(new URLSearchParams('a=1')).formData())
    .constructor as typeof FormData;
  vi.stubGlobal('FormData', NodeFormData);
  vi.stubGlobal('File', NodeFile);
  serve();
});
afterEach(() => vi.unstubAllGlobals());

describe('Media library uploads', () => {
  it('uploads files dropped on the page, one request each, and refreshes the library', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    const { container } = renderWithProviders(
      <AuthGate>
        <MediaLibraryScreen />
      </AuthGate>,
    );
    const zone = (await screen.findByText(/Drag files here, or/)).closest('div')!;
    const files = [
      new NodeFile([new Uint8Array(32)], 'banner.png', { type: 'image/png' }),
      new NodeFile([new Uint8Array(32)], 'care-guide.pdf', { type: 'application/pdf' }),
    ] as unknown as File[];
    const listCallsBefore = callsTo('/api/v1/admin/media', 'GET').length;

    fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'], files } });
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files } });

    const uploads = await screen.findByRole('region', { name: 'Uploads' });
    expect(await within(uploads).findByText('2 uploaded successfully')).toBeInTheDocument();
    expect(uploaded.sort()).toEqual(['banner.png', 'care-guide.pdf']);
    await waitFor(() =>
      expect(callsTo('/api/v1/admin/media', 'GET').length).toBeGreaterThan(listCallsBefore),
    );
    await expectNoA11yViolations(container);
  });

  it('gives a role without media access no upload area and sends no media request', async () => {
    signInAs(account({ role: 'ORDER_MANAGER' }));
    renderWithProviders(
      <AuthGate>
        <MediaLibraryScreen />
      </AuthGate>,
    );
    expect(await screen.findByText(/media library/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Upload files')).toBeNull();
    expect(screen.queryByText(/Drag files here/)).toBeNull();
    expect(callsTo('/api/v1/admin/media', 'GET')).toHaveLength(0);
    expect(callsTo('/api/v1/admin/media/config', 'GET')).toHaveLength(0);
  });
});
