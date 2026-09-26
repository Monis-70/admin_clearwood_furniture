import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { InventoryScreen } from '@/features/catalog/inventory/inventory-screen';

export const metadata: Metadata = { title: 'Inventory' };

export default function InventoryPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <InventoryScreen />
    </Suspense>
  );
}
