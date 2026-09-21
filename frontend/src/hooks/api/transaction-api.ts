/**
 * Transaction API client.
 *
 * Wraps the existing `apiFetch` (Firebase auth aware) so the farmer
 * dashboard hooks can talk to the real MongoDB-backed endpoints.
 *
 * The backend identifies the farmer from the Firebase ID token carried
 * by `apiFetch` — there is no client-supplied farmer header any more.
 *
 * `safeFetch` re-throws on transport / non-2xx failures so callers can
 * distinguish a successful empty list (`[]`) from a hard error.
 * Callers MUST NOT silently substitute demo data on error — that
 * silently masks backend outages and was the root cause of the
 * "empty remote → fall back to DEMO_*" bug fixed in Sept 2026.
 */

import { apiFetch } from './api-fetch';
import { env } from '@/config/env';

const buildUrl = (path: string): string => {
  const base = (env.apiBaseUrl() ?? '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
};

async function safeFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  // Re-throw so callers can render an error state. `apiFetch` already
  // throws with a useful message on non-2xx / network / timeout.
  const res = await apiFetch<T>(buildUrl(path), init);
  return res ?? null;
}

export interface BuyerResponse {
  id: string;
  name: string;
  businessType?: string;
  type?: string;
  cropsInterested?: string[];
  state?: string;
  district?: string;
  [k: string]: unknown;
}

export async function fetchBuyers(): Promise<BuyerResponse[]> {
  const res = await safeFetch<{success: boolean; buyers: BuyerResponse[]}>(
    '/api/buyers',
  );
  return res?.buyers ?? [];
}

export async function fetchBuyer(id: string): Promise<BuyerResponse | null> {
  const res = await safeFetch<{success: boolean; buyer: BuyerResponse}>(
    `/api/buyers/${id}`,
  );
  return res?.buyer ?? null;
}

export async function fetchMyLots(): Promise<unknown[]> {
  const res = await safeFetch<{success: boolean; lots: unknown[]}>('/api/lots');
  return res?.lots ?? [];
}

export async function fetchLot(id: string): Promise<unknown | null> {
  const res = await safeFetch<{success: boolean; lot: unknown}>(
    `/api/lots/${id}`,
  );
  return res?.lot ?? null;
}

export async function createLotApi(payload: Record<string, unknown>): Promise<unknown | null> {
  const res = await safeFetch<{success: boolean; lot: unknown}>(
    '/api/lots',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    },
  );
  return res?.lot ?? null;
}

export async function updateLotApi(
  id: string,
  patch: Record<string, unknown>,
): Promise<unknown | null> {
  const res = await safeFetch<{success: boolean; lot: unknown}>(
    `/api/lots/${id}`,
    {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(patch),
    },
  );
  return res?.lot ?? null;
}

export async function deleteLotApi(id: string): Promise<boolean> {
  const res = await safeFetch<{success: boolean}>(
    `/api/lots/${id}`,
    {method: 'DELETE'},
  );
  return Boolean(res?.success);
}

export async function markLotSoldApi(
  id: string,
  payload: Record<string, unknown>,
): Promise<unknown | null> {
  const res = await safeFetch<{success: boolean; lot: unknown}>(
    `/api/lots/${id}/mark-sold`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    },
  );
  return res?.lot ?? null;
}

export async function fetchOffersForLot(lotId: string): Promise<unknown[]> {
  const res = await safeFetch<{success: boolean; offers: unknown[]}>(
    `/api/lots/${lotId}/offers`,
  );
  return res?.offers ?? [];
}

export async function fetchAllOffers(): Promise<unknown[]> {
  const res = await safeFetch<{success: boolean; offers: unknown[]}>(
    '/api/offers',
  );
  return res?.offers ?? [];
}

export async function updateOfferStatusApi(
  offerId: string,
  status: string,
): Promise<unknown | null> {
  const res = await safeFetch<{success: boolean; offer: unknown}>(
    `/api/offers/${offerId}`,
    {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({status}),
    },
  );
  return res?.offer ?? null;
}

export async function counterOfferApi(
  offerId: string,
  pricePerKg: number,
  message?: string,
): Promise<unknown | null> {
  const res = await safeFetch<{success: boolean; counter: unknown}>(
    `/api/offers/${offerId}/counter`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pricePerKg, message}),
    },
  );
  return res?.counter ?? null;
}

export async function fetchPayments(): Promise<unknown[]> {
  const res = await safeFetch<{success: boolean; payments: unknown[]}>(
    '/api/payments',
  );
  return res?.payments ?? [];
}

export async function fetchGrievances(): Promise<unknown[]> {
  const res = await safeFetch<{success: boolean; grievances: unknown[]}>(
    '/api/grievances',
  );
  return res?.grievances ?? [];
}

export async function createGrievanceApi(
  payload: Record<string, unknown>,
): Promise<unknown | null> {
  const res = await safeFetch<{success: boolean; grievance: unknown}>(
    '/api/grievances',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    },
  );
  return res?.grievance ?? null;
}

export async function updateGrievanceApi(
  id: string,
  patch: Record<string, unknown>,
): Promise<unknown | null> {
  const res = await safeFetch<{success: boolean; grievance: unknown}>(
    `/api/grievances/${id}`,
    {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(patch),
    },
  );
  return res?.grievance ?? null;
}

export async function fetchStorageOptions(): Promise<unknown[]> {
  const res = await safeFetch<{success: boolean; options: unknown[]}>(
    '/api/storage/options',
  );
  return res?.options ?? [];
}

export async function fetchStorageBookings(): Promise<unknown[]> {
  const res = await safeFetch<{success: boolean; bookings: unknown[]}>(
    '/api/storage/bookings',
  );
  return res?.bookings ?? [];
}

export async function reserveStorageApi(
  payload: Record<string, unknown>,
): Promise<unknown | null> {
  const res = await safeFetch<{success: boolean; booking: unknown}>(
    '/api/storage/bookings',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    },
  );
  return res?.booking ?? null;
}

export async function fetchLogisticsOptions(): Promise<unknown[]> {
  const res = await safeFetch<{success: boolean; options: unknown[]}>(
    '/api/logistics/options',
  );
  return res?.options ?? [];
}

export async function bookLogisticsApi(
  payload: Record<string, unknown>,
): Promise<unknown | null> {
  const res = await safeFetch<{success: boolean; booking: unknown}>(
    '/api/logistics/bookings',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    },
  );
  return res?.booking ?? null;
}
