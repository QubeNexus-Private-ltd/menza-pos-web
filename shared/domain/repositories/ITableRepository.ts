import { TableMaster, TableReservation, RestaurantReservationConfig, FloorSection } from '../models/Table';

export interface ITableRepository {
  getSections(restaurantId?: number): Promise<FloorSection[]>;
  createSection(restaurantId: number, sectionName: string): Promise<FloorSection | null>;
  getTables(restaurantId?: number): Promise<TableMaster[]>;
  updateTableStatus(tableId: number, status: string): Promise<boolean>;
  freeTable(
    tableId: number,
    options?: {
      restaurantId?: number;
      transitionToCleaning?: boolean;
      settleActiveOrder?: boolean;
      releasedByRole?: string;
      remarks?: string;
    }
  ): Promise<boolean>;
  createTable(
    tableOrNumber: string | Partial<TableMaster>,
    seatingCapacity?: number,
    sectionName?: string
  ): Promise<boolean>;
  updateTable(tableId: number, updates: Partial<TableMaster>): Promise<boolean>;
  deleteTable(tableId: number): Promise<boolean>;

  // Reservation / Advance Bookings
  getReservations(restaurantId?: number, date?: string, status?: string): Promise<TableReservation[]>;
  createReservation(reservation: Partial<TableReservation>): Promise<TableReservation | null>;
  updateReservationStatus(reservationId: number, status: string): Promise<boolean>;
  assignTableToReservation(reservationId: number, tableId: number, tableNumber?: string): Promise<boolean>;
  getReservationConfig(restaurantId?: number): Promise<RestaurantReservationConfig>;
  updateReservationConfig(restaurantId: number, config: Partial<RestaurantReservationConfig>): Promise<boolean>;
  toggleDateBlock(restaurantId: number, date: string, isBlocked: boolean): Promise<boolean>;
  toggleTableAdvanceBooking(tableId: number, isOnlineBookable: boolean): Promise<boolean>;
}
