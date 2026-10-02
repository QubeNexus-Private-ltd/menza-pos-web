export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'BILLED' | 'RESERVED' | 'OUT_OF_SERVICE';

export interface TableSection {
  sectionId: number;
  restaurantId: number;
  sectionName: string;
  displayOrder?: number;
}

export interface TableMaster {
  tableId: number;
  id?: number;
  restaurantId: number;
  tableName: string;
  name?: string;
  tableNumber?: string | number;
  seatingCapacity: number;
  capacity?: number;
  sectionId?: number | null;
  sectionName?: string | null;
  tableStatus: string;
  status?: string;
  isActive?: boolean;
  qrCodeUrl?: string;
  currentOrderId?: number | null;
  activeOrderId?: number | null;
  currentOrderAmount?: number | null;
  occupiedSince?: string | null;
}
