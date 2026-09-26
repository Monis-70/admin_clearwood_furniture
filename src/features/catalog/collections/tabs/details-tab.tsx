'use client';

import { useQueryClient } from '@tanstack/react-query';

import { endpoints } from '@/lib/api/endpoints';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { catalogKeys } from '../../api';
import { EditorForm } from '../../form-kit';
import { collectionKeys, collectionsApi, type CollectionDetail } from '../api';
import { CollectionFields, collectionDefaults, collectionSchema } from '../collection-form';

export function DetailsTab({ collection }: { collection: CollectionDetail }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const canEdit = canCall(endpoints.collections.update) && !collection.deletedAt;
  return (
    <EditorForm
      key={collection.version}
      schema={collectionSchema}
      defaultValues={collectionDefaults(collection)}
      successMessage="Collection saved"
      readOnly={canEdit ? undefined : <p className="text-sm text-muted-foreground">View only.</p>}
      conflict={{
        fields: [
          { key: 'name', label: 'Name' },
          { key: 'slug', label: 'URL slug' },
          { key: 'type', label: 'How products are chosen' },
          { key: 'position', label: 'Order' },
          { key: 'isActive', label: 'Active' },
          { key: 'startsAt', label: 'Show from' },
          { key: 'endsAt', label: 'Show until' },
          { key: 'description', label: 'Description' },
        ],
        yours: (values) => values as unknown as Partial<CollectionDetail>,
        loadLatest: () => collectionsApi.get(collection.id),
        onReload: (latest) =>
          queryClient.setQueryData(collectionKeys.detail(collection.id), latest),
      }}
      onSubmit={async ({ type: _type, ...values }) => {
        const next = await collectionsApi.update(collection.id, {
          ...values,
          version: collection.version,
        });
        queryClient.setQueryData(collectionKeys.detail(collection.id), next);
        void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
        void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      }}
    >
      <CollectionFields creating={false} />
    </EditorForm>
  );
}
