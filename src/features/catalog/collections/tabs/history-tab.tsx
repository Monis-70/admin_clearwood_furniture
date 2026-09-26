'use client';

import { EntityHistory } from '@/features/audit/entity-history';

import type { CollectionDetail } from '../api';

export function HistoryTab({ collection }: { collection: CollectionDetail }) {
  return <EntityHistory entity="Collection" entityId={collection.id} />;
}
