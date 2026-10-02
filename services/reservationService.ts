import { apiClient } from '@shared/core/network/apiClient';

export interface CreateReservationRequestModel {
  restaurantId: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  guestCount: number;
  reservationDate?: string; // YYYY-MM-DD
  reservationTime: string; // HH:mm
  durationMinutes?: number;
  tableId?: number;
  tableNumber?: string;
  sectionName?: string;
  status?: string;
  specialNotes?: string;
  source?: string;
}

export interface ReservationResponseDTO {
  id: number;
  restaurantId: number;
  reservationCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  guestCount: number;
  reservationDate: string;
  reservationTime: string;
  durationMinutes: number;
  tableId?: number;
  tableNumber?: string;
  sectionName?: string;
  status: 'Confirmed' | 'Seated' | 'Cancelled' | 'Completed' | string;
  specialNotes?: string;
  isDepositRequired?: boolean;
  depositAmount?: number;
  seatedAt?: string;
  completedAt?: string;
  createdDate: string;
}

export class WebReservationService {
  static async getReservations(
    restaurantId: number,
    date?: string,
    status?: string
  ): Promise<ReservationResponseDTO[]> {
    if (!restaurantId || restaurantId <= 0) return [];
    try {
      const params: Record<string, any> = {};
      if (date) params.date = date;
      if (status && status !== 'ALL') params.status = status;

      const response = await apiClient.get(`/Reservation/Restaurant/${restaurantId}`, {
        params,
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });
      const data = response.data;
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      console.warn('Failed to fetch reservations:', err?.message);
      return [];
    }
  }

  static async createReservation(model: CreateReservationRequestModel): Promise<ReservationResponseDTO> {
    const response = await apiClient.post('/Reservation/Book', model, {
      headers: { 'X-Restaurant-Id': model.restaurantId.toString() },
    });
    return response.data;
  }

  static async updateStatus(
    id: number,
    status: 'Confirmed' | 'Seated' | 'Cancelled' | 'Completed',
    restaurantId?: number
  ): Promise<boolean> {
    const params: Record<string, any> = { status };
    if (restaurantId) params.restaurantId = restaurantId;

    const response = await apiClient.put(`/Reservation/${id}/Status`, {}, { params });
    return response.status === 200;
  }

  static async seatReservation(id: number, tableId?: number, tableNumber?: string): Promise<boolean> {
    const response = await apiClient.post(`/Reservation/${id}/Seat`, {
      tableId,
      tableNumber,
    });
    return response.status === 200;
  }
}
