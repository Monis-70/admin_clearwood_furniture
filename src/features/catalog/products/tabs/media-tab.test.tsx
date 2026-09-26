import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaAssetDto, ProductMediaItemDto } from '@shared/types/media';

import { AuthGate } from '@/lib/auth/guards';
import { productDetail } from '@/tests/fixtures/catalog';
import { API, account, callsTo, errorBody, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { MediaTab } from './media-tab';

const GALLERY = '/api/v1/admin/products/prd_trikon/media';

function asset(id: string, name: string): MediaAssetDto {
  return {
    id,
    kind: 'IMAGE',
    status: 'READY',
    source: 'ADMIN_UPLOAD',
    disk: 'local',
    path: `uploads/${name}`,
    url: `http://admin.test/uploads/${name}`,
    mimeType: 'image/png',
    originalName: name,
    sizeBytes: 64,
    width: 800,
    height: 600,
    durationSec: null,
    altText: null,
    title: null,
    tags: [],
    folderId: null,
    folderPath: null,
    checksumSha256: null,
    dominantColorHex: null,
    blurhash: null,
    lqipDataUri: null,
    focalPoint: null,
    isOptimized: true,
    processingError: null,
    usageCount: 1,
    createdAt: '2026-09-20T04:30:00.000Z',
    updatedAt: '2026-09-20T04:30:00.000Z',
    deletedAt: null,
    variants: [],
  };
}

/** The product gallery as the API keeps it: positions, one primary, 409 on a repeated image. */
let rows: ProductMediaItemDto[] = [];
let uploadsInFlight = 0;
let maxUploadsInFlight = 0;
let sequence = 0;

function serveGallery() {
  server.use(
    http.get(
      `${API}/admin/media/config`,
      guarded(() =>
        ok({
          maxUploadSizeMb: 15,
          maxUploadFiles: 20,
          maxImageDimension: 4000,
          minProductImageDimension: 1024,
          allowedImageMime: ['image/jpeg', 'image/png', 'image/webp'],
          allowedVideoMime: [],
          allowedDocMime: [],
          renditions: [],
          avifEnabled: false,
          driver: 'local',
          presignSupported: false,
        }),
      ),
    ),
    http.get(
      `${API}/admin/catalog/attributes`,
      guarded(() => ok([], 200, { page: 1, limit: 100, total: 0, totalPages: 0, hasNext: false })),
    ),
    http.get(
      `${API}/admin/products/:productId/media`,
      guarded(() => ok([...rows].sort((a, b) => a.position - b.position))),
    ),
    http.post(
      `${API}/admin/media/upload`,
      guarded(
        async (_account, request) => {
          uploadsInFlight += 1;
          maxUploadsInFlight = Math.max(maxUploadsInFlight, uploadsInFlight);
          const files = (await request.formData()).getAll('files');
          await new Promise((resolve) => setTimeout(resolve, 10));
          uploadsInFlight -= 1;
          expect(files).toHaveLength(1);
          const name = (files[0] as File).name;
          if (name.startsWith('bad')) {
            return errorBody(415, 'UNSUPPORTED_FILE_TYPE', 'The file is not an allowed image');
          }
          if (name.startsWith('again')) {
            return ok(
              { uploaded: [{ media: asset('med_existing', 'existing.png'), deduplicated: true }] },
              201,
            );
          }
          return ok(
            { uploaded: [{ media: asset(`med_${name}`, name), deduplicated: false }] },
            201,
          );
        },
        { csrf: true },
      ),
    ),
    http.post(
      `${API}/admin/products/:productId/media`,
      guarded(
        async (_account, request) => {
          const { items } = (await request.json()) as {
            items: { mediaId: string; role: ProductMediaItemDto['role'] }[];
          };
          const created: ProductMediaItemDto[] = [];
          for (const item of items) {
            if (rows.some((row) => row.mediaId === item.mediaId)) {
              return errorBody(409, 'CONFLICT', 'That image is already attached to this product');
            }
            if (item.role === 'PRIMARY')
              rows = rows.map((row) => ({
                ...row,
                role: row.role === 'PRIMARY' ? 'GALLERY' : row.role,
              }));
            sequence += 1;
            const row: ProductMediaItemDto = {
              id: `pm_${sequence}`,
              mediaId: item.mediaId,
              role: item.role,
              position: Math.max(-1, ...rows.map((r) => r.position)) + 1,
              altText: null,
              deviceTarget: 'ALL',
              attributeValueId: null,
              variantId: null,
              media: asset(item.mediaId, item.mediaId.replace(/^med_/, '')),
            };
            rows.push(row);
            created.push(row);
          }
          return ok(created, 201);
        },
        { csrf: true },
      ),
    ),
    http.patch(
      `${API}/admin/products/:productId/media/reorder`,
      guarded(
        async (_account, request) => {
          const { items } = (await request.json()) as { items: { id: string; position: number }[] };
          rows = rows.map((row) => ({
            ...row,
            position: items.find((item) => item.id === row.id)?.position ?? row.position,
          }));
          return ok(rows);
        },
        { csrf: true },
      ),
    ),
    http.patch(
      `${API}/admin/products/:productId/media/:id`,
      guarded(
        async (_account, request) => {
          const id = new URL(request.url).pathname.split('/').pop();
          const patch = (await request.json()) as Partial<ProductMediaItemDto>;
          if (patch.role === 'PRIMARY')
            rows = rows.map((row) => ({
              ...row,
              role: row.role === 'PRIMARY' ? 'GALLERY' : row.role,
            }));
          rows = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
          return ok(rows.find((row) => row.id === id));
        },
        { csrf: true },
      ),
    ),
  );
}

const png = (name: string) =>
  new NodeFile([new Uint8Array(64)], name, { type: 'image/png' }) as unknown as File;

function renderTab(role: 'SUPER_ADMIN' | 'CONTENT_MANAGER' = 'SUPER_ADMIN') {
  signInAs(account({ role }));
  return renderWithProviders(
    <AuthGate>
      <MediaTab product={productDetail()} />
    </AuthGate>,
  );
}

const attachCalls = () => callsTo(GALLERY, 'POST').map((call) => call.body);
const gallery = () => screen.getByRole('list', { name: 'Product images in display order' });

beforeEach(async () => {
  rows = [];
  uploadsInFlight = 0;
  maxUploadsInFlight = 0;
  sequence = 0;
  const NodeFormData = (await new Response(new URLSearchParams('a=1')).formData())
    .constructor as typeof FormData;
  vi.stubGlobal('FormData', NodeFormData);
  vi.stubGlobal('File', NodeFile);
  serveGallery();
});
afterEach(() => vi.unstubAllGlobals());

describe('Media & Gallery', () => {
  it('uploads several files, two at a time, and adds them in the chosen order; the first becomes primary', async () => {
    const user = userEvent.setup();
    const { container } = renderTab();
    expect(await screen.findByText('No images yet')).toBeInTheDocument();

    await user.upload(screen.getByLabelText('Upload images'), [
      png('one.png'),
      png('two.png'),
      png('three.png'),
      png('four.png'),
    ]);

    const uploads = screen.getByRole('region', { name: 'Uploads' });
    expect(await within(uploads).findByText('4 uploaded successfully')).toBeInTheDocument();
    await waitFor(() => expect(within(gallery()).getAllByRole('listitem')).toHaveLength(4));
    expect(maxUploadsInFlight).toBe(2);
    expect(callsTo('/api/v1/admin/media/upload', 'POST')).toHaveLength(4);
    expect(attachCalls()).toEqual([
      { items: [{ mediaId: 'med_one.png', role: 'PRIMARY' }] },
      { items: [{ mediaId: 'med_two.png', role: 'GALLERY' }] },
      { items: [{ mediaId: 'med_three.png', role: 'GALLERY' }] },
      { items: [{ mediaId: 'med_four.png', role: 'GALLERY' }] },
    ]);
    const cards = within(gallery()).getAllByRole('listitem');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'Image 1: one.png',
      'Image 2: two.png',
      'Image 3: three.png',
      'Image 4: four.png',
    ]);
    expect(within(cards[0]!).getByText('Primary')).toBeInTheDocument();
    expect(within(uploads).getAllByText('Added to the gallery')).toHaveLength(4);
    await expectNoA11yViolations(container);
  });

  it('keeps the successes when one file is refused, with the reason and a way to remove it', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('No images yet');
    await user.upload(screen.getByLabelText('Upload images'), [
      png('good-1.png'),
      png('bad.png'),
      png('good-2.png'),
    ]);
    const uploads = screen.getByRole('region', { name: 'Uploads' });
    expect(
      await within(uploads).findByText('2 uploaded successfully / 1 failed'),
    ).toBeInTheDocument();
    expect(within(uploads).getByText(/^Unsupported file:/)).toBeInTheDocument();
    // A refusal that would only happen again offers Remove, not Retry.
    expect(within(uploads).queryByRole('button', { name: /^Retry bad\.png/ })).toBeNull();
    await waitFor(() => expect(within(gallery()).getAllByRole('listitem')).toHaveLength(2));
    expect(attachCalls()).toEqual([
      { items: [{ mediaId: 'med_good-1.png', role: 'PRIMARY' }] },
      { items: [{ mediaId: 'med_good-2.png', role: 'GALLERY' }] },
    ]);
    await user.click(within(uploads).getByRole('button', { name: 'Remove bad.png from the list' }));
    expect(within(uploads).queryByText('bad.png')).toBeNull();
  });

  it('offers the existing library image for a duplicate instead of attaching it silently', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('No images yet');
    await user.upload(screen.getByLabelText('Upload images'), [png('again.png')]);
    const uploads = screen.getByRole('region', { name: 'Uploads' });
    expect(
      await within(uploads).findByText('This image is already in your media library.'),
    ).toBeInTheDocument();
    expect(attachCalls()).toEqual([]);
    await user.click(
      within(uploads).getByRole('button', { name: 'Use existing image for again.png' }),
    );
    expect(await within(uploads).findByText('Added to the gallery')).toBeInTheDocument();
    expect(attachCalls()).toEqual([{ items: [{ mediaId: 'med_existing', role: 'PRIMARY' }] }]);
  });

  it('keeps order, primary and alt text as unsaved changes until Save gallery, then sends only what changed', async () => {
    rows = ['a', 'b', 'c'].map((key, position) => ({
      id: `pm_${key}`,
      mediaId: `med_${key}`,
      role: position === 0 ? 'PRIMARY' : 'GALLERY',
      position,
      altText: null,
      deviceTarget: 'ALL',
      attributeValueId: null,
      variantId: null,
      media: asset(`med_${key}`, `${key}.png`),
    }));
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(within(gallery()).getAllByRole('listitem')).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: 'Move image 3 earlier' }));
    await user.click(screen.getByRole('button', { name: 'Make primary (image 2)' }));
    await user.type(screen.getByRole('textbox', { name: 'Alt text for image 1' }), 'Front view');
    expect(screen.getByText('3 unsaved gallery changes')).toBeInTheDocument();
    expect(callsTo(`${GALLERY}/reorder`, 'PATCH')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Save gallery' }));
    await waitFor(() => expect(screen.queryByText(/unsaved gallery change/)).toBeNull());
    expect(callsTo(`${GALLERY}/pm_a`, 'PATCH').map((call) => call.body)).toEqual([
      { role: 'GALLERY', altText: 'Front view' },
    ]);
    expect(callsTo(`${GALLERY}/pm_c`, 'PATCH').map((call) => call.body)).toEqual([
      { role: 'PRIMARY' },
    ]);
    expect(callsTo(`${GALLERY}/reorder`, 'PATCH').map((call) => call.body)).toEqual([
      {
        items: [
          { id: 'pm_a', position: 0 },
          { id: 'pm_c', position: 1 },
          { id: 'pm_b', position: 2 },
        ],
      },
    ]);
    const cards = within(gallery()).getAllByRole('listitem');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'Image 1: a.png',
      'Image 2: c.png',
      'Image 3: b.png',
    ]);
    expect(within(cards[1]!).getByText('Primary')).toBeInTheDocument();
  });

  it('discards unsaved changes on request without calling the API', async () => {
    rows = ['a', 'b'].map((key, position) => ({
      id: `pm_${key}`,
      mediaId: `med_${key}`,
      role: position === 0 ? 'PRIMARY' : 'GALLERY',
      position,
      altText: null,
      deviceTarget: 'ALL',
      attributeValueId: null,
      variantId: null,
      media: asset(`med_${key}`, `${key}.png`),
    }));
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(within(gallery()).getAllByRole('listitem')).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Move image 2 earlier' }));
    expect(screen.getByText('1 unsaved gallery change')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByText(/unsaved gallery change/)).toBeNull();
    expect(
      within(gallery())
        .getAllByRole('listitem')
        .map((card) => card.getAttribute('aria-label')),
    ).toEqual(['Image 1: a.png', 'Image 2: b.png']);
    expect(callsTo(`${GALLERY}/reorder`, 'PATCH')).toHaveLength(0);
  });

  it('shows a read-only gallery to a role that cannot change products', async () => {
    renderTab('CONTENT_MANAGER');
    expect(
      await screen.findByText('Your role can view the gallery but not change it.'),
    ).toBeVisible();
    expect(screen.queryByLabelText('Upload images')).toBeNull();
    expect(callsTo(GALLERY, 'GET')).toHaveLength(0);
  });

  it('refuses an image below the API minimum before sending it, and uploads the rest', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async (file: File) =>
        file.name.startsWith('small')
          ? { width: 800, height: 600, close: () => undefined }
          : { width: 1600, height: 1200, close: () => undefined },
      ),
    );
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('No images yet');
    expect(
      screen.getByText(/at least 1024 px on the shortest side/, { selector: 'p' }),
    ).toBeInTheDocument();
    await user.upload(screen.getByLabelText('Upload images'), [png('small.png'), png('large.png')]);

    const uploads = screen.getByRole('region', { name: 'Uploads' });
    expect(
      await within(uploads).findByText('1 uploaded successfully / 1 failed'),
    ).toBeInTheDocument();
    expect(
      within(uploads).getByText(
        'Not uploaded: 800 × 600 px is too small for a product image: it needs at least 1024 px on the shortest side.',
      ),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/media/upload', 'POST')).toHaveLength(1);
    expect(attachCalls()).toEqual([{ items: [{ mediaId: 'med_large.png', role: 'PRIMARY' }] }]);
  });

  it('shows library images below the minimum as not selectable', async () => {
    const wide = { ...asset('med_wide', 'wide.png'), width: 1600, height: 1200 };
    const short = { ...asset('med_short', 'short.png'), width: 1200, height: 900 };
    server.use(
      http.get(
        `${API}/admin/media`,
        guarded(() =>
          ok([wide, short], 200, { page: 1, limit: 24, total: 2, totalPages: 1, hasNext: false }),
        ),
      ),
    );
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('No images yet');
    await user.click(screen.getByRole('button', { name: 'Select from media library' }));
    const picker = await screen.findByRole('dialog', { name: /^Select images for / });
    const images = await within(picker).findByRole('list', { name: 'Images' });
    const buttons = await within(images).findAllByRole('button');
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeDisabled();
    expect(buttons[1]).toHaveTextContent('Too small (1200 × 900)');
  });
});
