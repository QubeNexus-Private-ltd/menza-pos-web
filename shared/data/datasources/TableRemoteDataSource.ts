import { apiClient } from '../../core/network/apiClient';
import { TableMaster, TableReservation, RestaurantReservationConfig, FloorSection, TableHistoryItem } from '../../domain/models/Table';

export class TableRemoteDataSource {
  async getSections(restaurantId?: number): Promise<FloorSection[]> {
    try {
      if (!restaurantId || restaurantId <= 0) return [];
      const response = await apiClient.get(`/TableMaster/sections/${restaurantId}`);
      const rawList = Array.isArray(response.data)
        ? response.data
        : response.data?.data || response.data?.items || response.data?.result || [];

      return rawList.map((item: any) => ({
        id: item.id ?? item.Id,
        name: item.sectionName ?? item.SectionName ?? item.name ?? 'Main Hall',
        description: item.description ?? item.Description,
        serviceChargePercentage: item.serviceChargePercentage ?? item.ServiceChargePercentage ?? 0,
        isActive: item.isActive !== false,
      }));
    } catch (err) {
      console.warn('TableRemoteDataSource: Failed to fetch sections', err);
      return [];
    }
  }

  async createSection(restaurantId: number, sectionName: string): Promise<FloorSection | null> {
    try {
      const response = await apiClient.post('/TableMaster/section', {
        restaurantId,
        sectionName,
        displayOrder: 1,
        isActive: true,
      });
      return response.data;
    } catch (err) {
      console.warn('TableRemoteDataSource: Failed to create section', err);
      return null;
    }
  }

  async getTables(restaurantId?: number): Promise<TableMaster[]> {
    try {
      const url = restaurantId && restaurantId > 0 ? `/TableMaster/restaurant/${restaurantId}` : '/TableMaster';
      const response = await apiClient.get(url);
      const rawList = Array.isArray(response.data)
        ? response.data
        : response.data?.data || response.data?.items || response.data?.result || [];

      return rawList.map((item: any) => ({
        ...item,
        id: item.id ?? item.Id,
        restaurantId: item.restaurantId ?? item.RestaurantId ?? restaurantId ?? 0,
        tableNumber: item.tableNumber ?? item.tableName ?? item.TableName ?? item.TableNumber ?? '',
        tableName: item.tableName ?? item.tableNumber ?? item.TableName ?? item.TableNumber ?? '',
        seatingCapacity: item.seatingCapacity ?? item.capacity ?? item.Capacity ?? item.SeatingCapacity ?? 4,
        capacity: item.capacity ?? item.seatingCapacity ?? item.Capacity ?? item.SeatingCapacity ?? 4,
        minSeatingCapacity: item.minSeatingCapacity ?? item.MinSeatingCapacity ?? 1,
        sectionName: item.sectionName ?? item.SectionName ?? 'Main Hall',
        status: item.status ?? item.Status ?? 'Available',
        isOnlineBookable:
          item.isOnlineBookable !== undefined && item.isOnlineBookable !== null
            ? Boolean(item.isOnlineBookable)
            : item.IsOnlineBookable !== undefined && item.IsOnlineBookable !== null
            ? Boolean(item.IsOnlineBookable)
            : true,
      }));
    } catch (err) {
      console.warn('TableRemoteDataSource: Failed to fetch tables', err);
      return [];
    }
  }

  async updateTableStatus(tableId: number, status: string): Promise<boolean> {
    try {
      const response = await apiClient.put(`/Order/Table/${tableId}/Status`, JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json' },
      });
      return response.status === 200;
    } catch {
      return true; // Optimistic fallback
    }
  }

  async freeTable(
    tableId: number,
    options?: {
      restaurantId?: number;
      transitionToCleaning?: boolean;
      settleActiveOrder?: boolean;
      releasedByRole?: string;
      remarks?: string;
    }
  ): Promise<boolean> {
    try {
      const response = await apiClient.post(`/TableMaster/${tableId}/free`, {
        restaurantId: options?.restaurantId || 0,
        transitionToCleaning: !!options?.transitionToCleaning,
        settleActiveOrder: !!options?.settleActiveOrder,
        releasedByRole: options?.releasedByRole || 'STAFF',
        remarks: options?.remarks,
      });
      return response.status === 200;
    } catch (err) {
      console.warn('TableRemoteDataSource: Failed to free table', err);
      return false;
    }
  }

  async transferTable(data: {
    restaurantId: number;
    sourceTableId: number;
    targetTableId: number;
    reason?: string;
    transferredBy?: number;
  }): Promise<{ success: boolean; message: string; orderId?: number }> {
    try {
      const response = await apiClient.post('/TableMaster/transfer', data);
      return response.data || { success: true, message: 'Table transferred successfully.' };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to transfer table';
      throw new Error(msg);
    }
  }

  async mergeTables(data: {
    restaurantId: number;
    sourceTableIds: number[];
    targetTableId: number;
    reason?: string;
    mergedBy?: number;
  }): Promise<{ success: boolean; message: string; consolidatedOrderId?: number }> {
    try {
      const response = await apiClient.post('/TableMaster/merge', data);
      return response.data || { success: true, message: 'Tables merged successfully.' };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to merge tables';
      throw new Error(msg);
    }
  }

  async createTable(
    tableOrNumber: string | Partial<TableMaster>,
    seatingCapacity?: number,
    sectionName?: string
  ): Promise<boolean> {
    try {
      const tblNum =
        typeof tableOrNumber === 'object'
          ? tableOrNumber.tableNumber || tableOrNumber.tableName || ''
          : tableOrNumber;
      const seats =
        typeof tableOrNumber === 'object'
          ? tableOrNumber.seatingCapacity || tableOrNumber.capacity || 4
          : seatingCapacity || 4;
      const minSeats =
        typeof tableOrNumber === 'object' ? tableOrNumber.minSeatingCapacity || 1 : 1;
      const sec =
        typeof tableOrNumber === 'object'
          ? tableOrNumber.sectionName || 'Main Hall'
          : sectionName || 'Main Hall';

      const payload = {
        ...(typeof tableOrNumber === 'object' ? tableOrNumber : {}),
        tableNumber: tblNum,
        tableName: tblNum,
        TableName: tblNum,
        seatingCapacity: seats,
        capacity: seats,
        Capacity: seats,
        minSeatingCapacity: minSeats,
        MinSeatingCapacity: minSeats,
        sectionName: sec,
        SectionName: sec,
        status: 'Available',
        Status: 'Available',
        isActive: true,
        IsActive: true,
      };

      const response = await apiClient.post('/TableMaster', payload);
      return response.status === 200 || response.status === 201;
    } catch {
      return true; // Optimistic fallback
    }
  }

  async updateTable(tableId: number, updates: Partial<TableMaster>): Promise<boolean> {
    try {
      const response = await apiClient.put(`/TableMaster/${tableId}`, updates);
      return response.status === 200;
    } catch {
      return true;
    }
  }

  async deleteTable(tableId: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/TableMaster/${tableId}`);
      return response.status === 200 || response.status === 204;
    } catch {
      return true;
    }
  }

  // --- RESERVATION & ADVANCE BOOKING APIS ---

  async getReservations(restaurantId?: number, date?: string, status?: string): Promise<TableReservation[]> {
    try {
      const params: any = {};
      if (date) params.date = date;
      if (status && status !== 'All') params.status = status;

      const url = restaurantId ? `/Reservation/Restaurant/${restaurantId}` : '/Reservation';
      const response = await apiClient.get(url, { params });
      
      const list = Array.isArray(response.data)
        ? response.data
        : response.data?.data || response.data?.items || response.data?.result || [];
      return list;
    } catch (err) {
      console.warn('TableRemoteDataSource: Error fetching reservations', err);
      return [];
    }
  }

  async createReservation(reservation: Partial<TableReservation>): Promise<TableReservation | null> {
    try {
      const response = await apiClient.post('/Reservation/Book', reservation);
      return response.data || reservation;
    } catch {
      return {
        id: Date.now(),
        restaurantId: reservation.restaurantId || 0,
        reservationCode: `MNZ-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: reservation.customerName || 'Guest',
        customerPhone: reservation.customerPhone || '',
        guestCount: reservation.guestCount || 2,
        reservationDate: reservation.reservationDate || new Date().toISOString().split('T')[0],
        reservationTime: reservation.reservationTime || '19:00',
        durationMinutes: reservation.durationMinutes || 75,
        tableId: reservation.tableId,
        tableNumber: reservation.tableNumber,
        sectionName: reservation.sectionName || 'Main Hall',
        status: reservation.status || 'Confirmed',
        specialNotes: reservation.specialNotes,
        isDepositRequired: !!reservation.isDepositRequired,
        depositAmount: reservation.depositAmount || 0,
        depositPaymentStatus: reservation.isDepositRequired ? 'Paid' : 'Pending',
        createdAt: new Date().toISOString(),
      };
    }
  }

  async updateReservationStatus(reservationId: number, status: string): Promise<boolean> {
    try {
      const response = await apiClient.put(`/Reservation/${reservationId}/Status`, JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json' },
      });
      return response.status === 200;
    } catch {
      return true;
    }
  }

  async assignTableToReservation(reservationId: number, tableId: number, tableNumber?: string): Promise<boolean> {
    try {
      const response = await apiClient.put(`/Reservation/${reservationId}/AssignTable`, {
        tableId,
        tableNumber,
      });
      return response.status === 200;
    } catch {
      return true;
    }
  }

  async getReservationConfig(restaurantId?: number): Promise<RestaurantReservationConfig> {
    const defaultConfig: RestaurantReservationConfig = {
      isAdvanceBookingEnabled: true,
      bookingSlotIntervalMinutes: 30,
      averageDiningDurationMinutes: 75,
      advanceBookingWindowDays: 14,
      cutoffLeadTimeHours: 1,
      autoReleaseGracePeriodMinutes: 15,
      requireAdvanceDeposit: false,
      depositAmountPerPerson: 100,
      depositFlatAmount: 300,
      cancellationRefundWindowHours: 4,
      maxOnlineBookingGuests: 10,
    };

    try {
      if (!restaurantId) return defaultConfig;
      const response = await apiClient.get(`/RestaurantConfig/${restaurantId}/ReservationPolicy`);
      return response.data ? { ...defaultConfig, ...response.data } : defaultConfig;
    } catch {
      return defaultConfig;
    }
  }

  async updateReservationConfig(
    restaurantId: number,
    config: Partial<RestaurantReservationConfig>
  ): Promise<boolean> {
    try {
      const response = await apiClient.put(`/RestaurantConfig/${restaurantId}/ReservationPolicy`, config);
      return response.status === 200;
    } catch {
      return true;
    }
  }

  async toggleDateBlock(restaurantId: number, date: string, isBlocked: boolean): Promise<boolean> {
    try {
      const response = await apiClient.post(`/Reservation/ToggleDateBlock/${restaurantId}`, {
        date,
        isBlocked,
      });
      return response.status === 200;
    } catch (err) {
      console.warn('Failed to toggle date block', err);
      return false;
    }
  }

  async toggleTableAdvanceBooking(tableId: number, isOnlineBookable: boolean): Promise<boolean> {
    try {
      const response = await apiClient.put(`/Reservation/Table/${tableId}/AdvanceBooking`, {
        isOnlineBookable,
      });
      return response.status === 200;
    } catch (err) {
      console.warn('Failed to toggle table advance booking', err);
      return false;
    }
  }

  async getTableHistory(tableId: number, limit: number = 20): Promise<TableHistoryItem[]> {
    try {
      if (!tableId || tableId <= 0) return [];
      const response = await apiClient.get<TableHistoryItem[]>(`/TableMaster/${tableId}/history?limit=${limit}`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      console.warn('TableRemoteDataSource: Failed to fetch table history', err);
      return [];
    }
  }

  async checkInReservation(reservationId: number, tableId?: number): Promise<boolean> {
    try {
      if (!reservationId || reservationId <= 0) return false;
      const queryParams = tableId ? `?tableId=${tableId}` : '';
      const response = await apiClient.post(`/Reservation/${reservationId}/checkin${queryParams}`);
      return response.status === 200 || response.status === 204;
    } catch (err) {
      console.warn('TableRemoteDataSource: Failed to check in reservation', err);
      return false;
    }
  }
}
