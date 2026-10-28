import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { File as NodeFile } from 'node:buffer';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { ImageField } from './image-field';

type Values = { bannerMediaId: string };

function Stored() {
  return <output aria-label="Stored id">{useWatch<Values>({ name: 'bannerMediaId' })}</output>;
}

function Harness({ initial = '' }: { initial?: string }) {
  const form = useForm<Values>({ defaultValues: { bannerMediaId: initial } });
  return (
    <FormProvider {...form}>
      <ImageField<Values> name="bannerMediaId" label="Banner" description="A wide image." />
      <Stored />
    </FormProvider>
  );
}

const asset = (id: string, name: string) => ({
  id,
  url: `http://localhost/media/${name}`,
  variants: [],
  originalName: name,
  title: null,
  altText: null,
  width: 1600,
  height: 600,
  mimeType: 'image/jpeg',
  usage: [],
});

beforeEach(async () => {
  const NodeFormData = (await new Response(new URLSearchParams('a=1')).formData())
    .constructor as typeof FormData;
  vi.stubGlobal('FormData', NodeFormData);
  vi.stubGlobal('File', NodeFile);
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
      `${API}/admin/media/:id`,
      guarded((_account, request) => {
        const id = new URL(request.url).pathname.split('/').pop()!;
        return ok(asset(id, id === 'med_old' ? 'old.jpg' : 'sofa.jpg'));
      }),
    ),
    http.post(
      `${API}/admin/media/upload`,
      guarded(
        async (_account, request) => {
          const file = (await request.formData()).get('files') as File;
          return ok(
            { uploaded: [{ media: asset('med_new', file.name), deduplicated: false }] },
            201,
          );
        },
        { csrf: true },
      ),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

const render = (role: 'CATALOG_MANAGER' | 'ORDER_MANAGER', initial?: string) => {
  signInAs(account({ role }));
  return renderWithProviders(
    <AuthGate>
      <Harness initial={initial} />
    </AuthGate>,
  );
};

describe('ImageField', () => {
  it('uploads a JPEG, shows it, and stores only its media id', async () => {
    const { container } = render('CATALOG_MANAGER');
    expect(await screen.findByText('No image')).toBeInTheDocument();
    await screen.findByText(/JPEG, PNG, WebP, up to 15 MB/);

    const file = new NodeFile([new Uint8Array(64)], 'sofa.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Upload banner'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByLabelText('Stored id')).toHaveTextContent('med_new'));
    expect(callsTo('/api/v1/admin/media/upload', 'POST')).toHaveLength(1);
    expect(await screen.findByText(/sofa\.jpg · 1600 × 600/)).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'http://localhost/media/sofa.jpg',
    );
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Remove banner' }));
    expect(screen.getByLabelText('Stored id')).toHaveTextContent('');
    expect(screen.getByText('No image')).toBeInTheDocument();
  });

  it('refuses a file type the API does not accept without sending it', async () => {
    render('CATALOG_MANAGER');
    await screen.findByText(/JPEG, PNG, WebP, up to 15 MB/);
    const file = new NodeFile([new Uint8Array(8)], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Upload banner'), { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/Not an accepted type/);
    expect(callsTo('/api/v1/admin/media/upload', 'POST')).toHaveLength(0);
    expect(screen.getByLabelText('Stored id')).toHaveTextContent('');
  });

  it('shows the saved image and explains the missing permission instead of offering changes', async () => {
    render('ORDER_MANAGER', 'med_old');
    const upload = await screen.findByRole('button', { name: /Upload a new image/ });
    expect(upload).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /Choose from library/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('Image chosen')).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/media/med_old', 'GET')).toHaveLength(0);
    expect(callsTo('/api/v1/admin/media/config', 'GET')).toHaveLength(0);
  });
});
