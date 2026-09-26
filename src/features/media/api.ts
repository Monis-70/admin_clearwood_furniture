import type { DeviceTarget, MediaRole } from '@shared/enums';
import type { MediaUpdateInput, ProductMediaUpdateInput } from '@shared/schemas/media';
import type {
  MediaAssetDto,
  MediaConfigDto,
  MediaDetailDto,
  MediaFolderDto,
  MediaUploadResultDto,
  ProductGalleryDto,
  ProductMediaItemDto,
} from '@shared/types/media';

import { apiPage, apiRequest, type Page, type UploadProgress } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

export interface MediaListQuery {
  page: number;
  limit: number;
  search?: string;
  folderId?: string;
  kind?: string;
  includeDeleted?: boolean;
  unusedOnly?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const mediaKeys = {
  all: ['media'] as const,
  list: (query: MediaListQuery) => [...mediaKeys.all, 'list', query] as const,
  asset: (id: string) => [...mediaKeys.all, id] as const,
  config: () => [...mediaKeys.all, 'config'] as const,
  folders: () => [...mediaKeys.all, 'folders'] as const,
  product: (productId: string) => [...mediaKeys.all, 'product', productId] as const,
  /** What the storefront serves for a live product (the API's own gallery resolver). */
  publicGallery: (slug: string, query: GalleryQuery) =>
    [...mediaKeys.all, 'public-gallery', slug, query] as const,
};

export interface GalleryQuery {
  variantId?: string;
  attributeValueId?: string;
  device?: DeviceTarget;
}

/** One image to attach to a product (`POST /products/{productId}/media`). */
export interface AttachItem {
  mediaId: string;
  role?: MediaRole;
  position?: number;
  altText?: string;
  deviceTarget?: DeviceTarget;
  attributeValueId?: string | null;
  variantId?: string | null;
}

/** The smallest rendition that is at least `width` wide, else the original. */
export function renditionUrl(asset: Pick<MediaAssetDto, 'url' | 'variants'>, width = 320): string {
  const webp = (asset.variants ?? [])
    .filter(
      (variant) => variant.format === 'WEBP' && variant.deviceTarget === 'ALL' && variant.width,
    )
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return webp.find((variant) => (variant.width ?? 0) >= width)?.url ?? asset.url;
}

export const mediaApi = {
  list(query: MediaListQuery, signal?: AbortSignal): Promise<Page<MediaAssetDto>> {
    return apiPage(endpoints.media.list, { query: { ...query }, signal }) as Promise<
      Page<MediaAssetDto>
    >;
  },
  async get(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.media.get, { params: { id }, signal }))
      .data as MediaDetailDto;
  },
  async config(signal?: AbortSignal) {
    return (await apiRequest(endpoints.media.config, { signal })).data as MediaConfigDto;
  },
  /**
   * One file per request: the API validates a multipart batch as a whole, so a single bad file
   * would fail its neighbours. Progress is the real byte count the browser has sent.
   */
  async uploadOne(
    file: File,
    options: {
      folderId?: string;
      signal?: AbortSignal;
      onProgress?: (progress: UploadProgress) => void;
    } = {},
  ): Promise<MediaUploadResultDto> {
    const form = new FormData();
    if (options.folderId) form.append('folderId', options.folderId);
    form.append('files', file);
    const result = await apiRequest(endpoints.media.upload, {
      form,
      signal: options.signal,
      onUploadProgress: options.onProgress ?? (() => undefined),
    });
    const first = (result.data as { uploaded: MediaUploadResultDto[] }).uploaded[0];
    if (!first) throw new Error('The server accepted the upload but returned no file.');
    return first;
  },
  async replace(id: string, file: File) {
    const form = new FormData();
    form.append('files', file);
    return (await apiRequest(endpoints.media.replace, { params: { id }, form }))
      .data as MediaAssetDto;
  },
  async reprocess(id: string) {
    return (await apiRequest(endpoints.media.reprocess, { params: { id } })).data as MediaAssetDto;
  },
  async update(id: string, input: MediaUpdateInput) {
    return (await apiRequest(endpoints.media.update, { params: { id }, body: input }))
      .data as MediaAssetDto;
  },
  async remove(id: string) {
    await apiRequest(endpoints.media.remove, { params: { id } });
  },
  async restore(id: string) {
    return (await apiRequest(endpoints.media.restore, { params: { id } })).data as MediaAssetDto;
  },
  async removePermanently(id: string) {
    await apiRequest(endpoints.media.removePermanently, { params: { id } });
  },
  async bulkRemove(ids: string[]) {
    return (await apiRequest(endpoints.media.bulkRemove, { body: { ids } })).data as {
      deleted?: number;
    };
  },
  async folders(signal?: AbortSignal) {
    return (await apiRequest(endpoints.media.folders, { signal })).data as MediaFolderDto[];
  },
  async createFolder(input: { name: string; parentId?: string | null }) {
    return (await apiRequest(endpoints.media.createFolder, { body: input })).data as MediaFolderDto;
  },
  async updateFolder(id: string, input: { name?: string; parentId?: string | null }) {
    return (await apiRequest(endpoints.media.updateFolder, { params: { id }, body: input }))
      .data as MediaFolderDto;
  },
  async removeFolder(id: string) {
    await apiRequest(endpoints.media.removeFolder, { params: { id } });
  },
  async productMedia(productId: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.media.productMedia, { params: { productId }, signal }))
      .data as ProductMediaItemDto[];
  },
  async attach(productId: string, items: AttachItem[]) {
    return (
      await apiRequest(endpoints.media.attachProductMedia, {
        params: { productId },
        body: { items },
      })
    ).data as ProductMediaItemDto[];
  },
  async updateItem(productId: string, id: string, input: ProductMediaUpdateInput) {
    return (
      await apiRequest(endpoints.media.updateProductMedia, {
        params: { productId, id },
        body: input,
      })
    ).data as ProductMediaItemDto;
  },
  async reorder(productId: string, items: { id: string; position: number }[]) {
    await apiRequest(endpoints.media.reorderProductMedia, {
      params: { productId },
      body: { items },
    });
  },
  async detach(productId: string, id: string) {
    await apiRequest(endpoints.media.removeProductMedia, { params: { productId, id } });
  },
  /** The storefront's gallery for a live product; drafts answer 404 by design. */
  async publicGallery(slug: string, query: GalleryQuery, signal?: AbortSignal) {
    return (
      await apiRequest(endpoints.media.publicGallery, {
        params: { slug },
        query: { ...query },
        signal,
      })
    ).data as ProductGalleryDto;
  },
};
