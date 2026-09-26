import type {
  NdrRecordDto,
  NotificationLogDto,
  OrderDocumentDto,
  ShipmentDto,
} from '@shared/types/fulfilment';
import type { AdminOrderDetailDto, AdminOrderRowDto, LedgerCheckDto } from '@shared/types/order';

import { apiDownload, apiPage, apiRequest, type Page } from '@/lib/api/client';
import { ordersRoutes } from '@/lib/api/routes/orders';
import { shipmentsRoutes } from '@/lib/api/routes/shipments';

export interface OrderListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  q?: string;
  status?: string;
  paymentStatus?: string;
  from?: string;
  to?: string;
}

export interface ShipmentListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  q?: string;
  status?: string;
  orderNumber?: string;
}

export interface SimpleQuery {
  page: number;
  limit: number;
  [key: string]: string | number | undefined;
}

export interface OrderShipments {
  shipments: ShipmentDto[];
  remaining?: Record<string, number> | { orderItemId: string; qty: number }[];
}

export interface InvoiceIssued {
  type: string;
  documentNumber: string;
  totalPaise?: number;
  taxPaise?: number;
  issuedAt: string;
}

export interface ReportTotals {
  kind: string;
  rowCount: number;
  totals: Record<string, number>;
}

type Body = Record<string, unknown>;

export const orderKeys = {
  all: ['orders'] as const,
  list: (query: OrderListQuery) => [...orderKeys.all, 'list', query] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
  ledger: (id: string) => [...orderKeys.all, 'ledger', id] as const,
  shipmentsFor: (orderNumber: string) => [...orderKeys.all, 'shipments', orderNumber] as const,
  documents: (orderNumber: string) => [...orderKeys.all, 'documents', orderNumber] as const,
  shipments: (query: ShipmentListQuery) => [...orderKeys.all, 'shipment-list', query] as const,
  shipment: (n: string) => [...orderKeys.all, 'shipment', n] as const,
  ndr: (query: SimpleQuery) => [...orderKeys.all, 'ndr', query] as const,
  notifications: (query: SimpleQuery) => [...orderKeys.all, 'notifications', query] as const,
};

export const ordersApi = {
  list(query: OrderListQuery, signal?: AbortSignal): Promise<Page<AdminOrderRowDto>> {
    return apiPage<AdminOrderRowDto>(ordersRoutes.list, { query: { ...query }, signal });
  },
  async get(id: string, signal?: AbortSignal) {
    return (await apiRequest(ordersRoutes.get, { params: { id }, signal }))
      .data as AdminOrderDetailDto;
  },
  async ledgerCheck(id: string, signal?: AbortSignal) {
    return (await apiRequest(ordersRoutes.ledgerCheck, { params: { id }, signal }))
      .data as LedgerCheckDto;
  },
  async setStatus(id: string, body: { status: string; note?: string; isCustomerVisible: boolean }) {
    return (await apiRequest(ordersRoutes.setStatus, { params: { id }, body })).data as unknown;
  },
  async cancel(id: string, body: { reason: string; note?: string }) {
    return (await apiRequest(ordersRoutes.cancel, { params: { id }, body })).data as unknown;
  },
  async shipmentsFor(orderNumber: string, signal?: AbortSignal) {
    return (await apiRequest(ordersRoutes.shipments, { params: { orderNumber }, signal }))
      .data as OrderShipments;
  },
  async createShipment(orderNumber: string, body: Body, idempotencyKey: string) {
    return (
      await apiRequest(ordersRoutes.createShipment, {
        params: { orderNumber },
        body,
        idempotencyKey,
      })
    ).data as ShipmentDto;
  },
  async documents(orderNumber: string, signal?: AbortSignal) {
    return (await apiRequest(ordersRoutes.documents, { params: { orderNumber }, signal }))
      .data as OrderDocumentDto[];
  },
  async issueInvoice(orderNumber: string, idempotencyKey: string) {
    return (
      await apiRequest(ordersRoutes.issueInvoice, { params: { orderNumber }, idempotencyKey })
    ).data as InvoiceIssued;
  },
  download(documentNumber: string) {
    return apiDownload(ordersRoutes.downloadDocument, { params: { documentNumber } });
  },
  notificationLogs(query: SimpleQuery, signal?: AbortSignal): Promise<Page<NotificationLogDto>> {
    return apiPage<NotificationLogDto>(ordersRoutes.notificationLogs, {
      query: { ...query },
      signal,
    });
  },
  reportCsv(query: { kind: string; from: string; to: string }) {
    return apiDownload(ordersRoutes.report, { query: { ...query, format: 'csv' } });
  },
  async reportTotals(query: { kind: string; from: string; to: string }) {
    return (await apiRequest(ordersRoutes.report, { query: { ...query, format: 'json' } }))
      .data as ReportTotals;
  },
};

export const shipmentsApi = {
  list(query: ShipmentListQuery, signal?: AbortSignal): Promise<Page<ShipmentDto>> {
    return apiPage<ShipmentDto>(shipmentsRoutes.list, { query: { ...query }, signal });
  },
  async get(shipmentNumber: string, signal?: AbortSignal) {
    return (await apiRequest(shipmentsRoutes.get, { params: { shipmentNumber }, signal }))
      .data as ShipmentDto;
  },
  async assignAwb(shipmentNumber: string, body: Body, idempotencyKey: string) {
    return (
      await apiRequest(shipmentsRoutes.assignAwb, {
        params: { shipmentNumber },
        body,
        idempotencyKey,
      })
    ).data as ShipmentDto;
  },
  async cancel(shipmentNumber: string, body: { reason: string; force: boolean }) {
    return (await apiRequest(shipmentsRoutes.cancel, { params: { shipmentNumber }, body }))
      .data as ShipmentDto;
  },
  async setStatus(shipmentNumber: string, body: Body) {
    return (await apiRequest(shipmentsRoutes.setStatus, { params: { shipmentNumber }, body }))
      .data as ShipmentDto;
  },
  ndr(query: SimpleQuery, signal?: AbortSignal): Promise<Page<NdrRecordDto>> {
    return apiPage<NdrRecordDto>(shipmentsRoutes.ndr, { query: { ...query }, signal });
  },
  async ndrAction(id: string, body: Body) {
    return (await apiRequest(shipmentsRoutes.ndrAction, { params: { id }, body })).data as unknown;
  },
};

/** Saves a downloaded file under its server name. */
export async function saveDownload(
  download: Promise<{ blob: Blob; fileName: string | null }>,
  fallback: string,
) {
  const { blob, fileName } = await download;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName ?? fallback;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
