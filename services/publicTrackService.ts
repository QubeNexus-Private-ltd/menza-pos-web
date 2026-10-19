import axios from 'axios';
import { APP_CONSTANTS } from '@/shared/core/constants/appConstants';
import { PublicOrderTrackingDTO } from '@/types/orderTrack';

/**
 * Public Order Tracking Service.
 * Fetches real-time status and line items for guest diners and takeaway customers.
 * Endpoint: GET /api/public/store/order/track/{orderId}
 */
export async function fetchOrderTracking(
  orderId: number | string,
  phone?: string
): Promise<PublicOrderTrackingDTO> {
  const cleanId = String(orderId).trim();
  if (!cleanId || isNaN(Number(cleanId)) || Number(cleanId) <= 0) {
    throw new Error('Valid Order ID is required.');
  }

  const baseUrl = (APP_CONSTANTS.API_BASE_URL || '').replace(/\/+$/, '');
  const url = `${baseUrl}/public/store/order/track/${cleanId}`;

  const response = await axios.get<PublicOrderTrackingDTO>(url, {
    params: phone ? { phone } : undefined,
    timeout: 15000,
    headers: {
      Accept: 'application/json',
    },
  });

  return response.data;
}
