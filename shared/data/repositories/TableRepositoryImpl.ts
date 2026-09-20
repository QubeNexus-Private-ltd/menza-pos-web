import { ITableRepository } from '../../domain/repositories/ITableRepository';
import { TableRemoteDataSource } from '../datasources/TableRemoteDataSource';
import { TableMaster, TableReservation, RestaurantReservationConfig, FloorSection } from '../../domain/models/Table';

export class TableRepositoryImpl implements ITableRepository {
  constructor(private remoteDataSource: TableRemoteDataSource) {}

  async getSections(restaurantId?: number): Promise<FloorSection[]> {
    return await this.remoteDataSource.getSections(restaurantId);
  }

  async createSection(restaurantId: number, sectionName: string): Promise<FloorSection | null> {
    return await this.remoteDataSource.createSection(restaurantId, sectionName);
  }

  async getTables(restaurantId?: number): Promise<TableMaster[]> {
    return await this.remoteDataSource.getTables(restaurantId);
  }

  async updateTableStatus(tableId: number, status: string): Promise<boolean> {
    return await this.remoteDataSource.updateTableStatus(tableId, status);
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
    return await this.remoteDataSource.freeTable(tableId, options);
  }

  async createTable(
    tableOrNumber: string | Partial<TableMaster>,
    seatingCapacity?: number,
    sectionName?: string
  ): Promise<boolean> {
    return await this.remoteDataSource.createTable(tableOrNumber, seatingCapacity, sectionName);
  }

  async updateTable(tableId: number, updates: Partial<TableMaster>): Promise<boolean> {
    return await this.remoteDataSource.updateTable(tableId, updates);
  }

  async deleteTable(tableId: number): Promise<boolean> {
    return await this.remoteDataSource.deleteTable(tableId);
  }

  async getReservations(restaurantId?: number, date?: string, status?: string): Promise<TableReservation[]> {
    return await this.remoteDataSource.getReservations(restaurantId, date, status);
  }

  async createReservation(reservation: Partial<TableReservation>): Promise<TableReservation | null> {
    return await this.remoteDataSource.createReservation(reservation);
  }

  async updateReservationStatus(reservationId: number, status: string): Promise<boolean> {
    return await this.remoteDataSource.updateReservationStatus(reservationId, status);
  }

  async assignTableToReservation(reservationId: number, tableId: number, tableNumber?: string): Promise<boolean> {
    return await this.remoteDataSource.assignTableToReservation(reservationId, tableId, tableNumber);
  }

  async getReservationConfig(restaurantId?: number): Promise<RestaurantReservationConfig> {
    return await this.remoteDataSource.getReservationConfig(restaurantId);
  }

  async updateReservationConfig(
    restaurantId: number,
    config: Partial<RestaurantReservationConfig>
  ): Promise<boolean> {
    return await this.remoteDataSource.updateReservationConfig(restaurantId, config);
  }

  async toggleDateBlock(restaurantId: number, date: string, isBlocked: boolean): Promise<boolean> {
    return await this.remoteDataSource.toggleDateBlock(restaurantId, date, isBlocked);
  }

  async toggleTableAdvanceBooking(tableId: number, isOnlineBookable: boolean): Promise<boolean> {
    return await this.remoteDataSource.toggleTableAdvanceBooking(tableId, isOnlineBookable);
  }
}
