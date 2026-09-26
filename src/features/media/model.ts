export const formatBytes = (bytes: number) =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Where a file is used (`MediaUsage.usageType`), in words. */
export const USAGE_LABELS: Readonly<Record<string, string>> = {
  PRODUCT: 'Product image',
  PRODUCT_VARIANT: 'Variant image',
  CATEGORY_ICON: 'Category icon',
  CATEGORY_BANNER: 'Category banner',
  CATEGORY_MOBILE_BANNER: 'Category mobile banner',
  COLLECTION_BANNER: 'Collection banner',
  COLLECTION_IMAGE: 'Collection image',
  BRAND_LOGO: 'Brand logo',
  ATTRIBUTE_SWATCH: 'Option swatch',
  CMS_BANNER: 'Banner',
};

export interface FlatFolder {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  isSystem: boolean;
  mediaCount?: number;
}

interface FolderNode extends FlatFolder {
  children?: FolderNode[];
}

/** The folder tree as the API returns it, flattened depth-first for selects and lists. */
export function flattenFolders(folders: readonly FolderNode[]): FlatFolder[] {
  return folders.flatMap(({ children, ...folder }) => [
    {
      id: folder.id,
      name: folder.name,
      depth: folder.depth,
      parentId: folder.parentId,
      isSystem: folder.isSystem,
      mediaCount: folder.mediaCount,
    },
    ...flattenFolders(children ?? []),
  ]);
}
