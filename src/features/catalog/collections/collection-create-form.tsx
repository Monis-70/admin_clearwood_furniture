'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { EditorForm } from '../form-kit';

import { collectionKeys, collectionsApi } from './api';
import { CollectionFields, collectionDefaults, collectionSchema } from './collection-form';
import { collectionHref } from './model';

export function CollectionCreateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <EditorForm
      schema={collectionSchema}
      defaultValues={collectionDefaults(null)}
      successMessage="Collection created"
      submitLabel="Create collection"
      onSubmit={async (values) => {
        const created = await collectionsApi.create(values);
        void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
        router.push(
          collectionHref(created.id, created.type === 'AUTOMATIC' ? 'rules' : 'products'),
        );
      }}
    >
      <CollectionFields creating />
    </EditorForm>
  );
}
