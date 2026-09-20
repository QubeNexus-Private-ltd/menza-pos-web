export type TableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Billed' | 'Maintenance';

export interface FloorSection {
  id: string | number;
  name: string;
  description?: string;
  isSmokingAllowed?: boolean;
  isOutdoor?: boolean;
  serviceChargePercentage?: number;
  isActive?: boolean;
}

export interface TableMaster {
  id: number;
  restaurantId?: number;
  tableNumber: string;
  tableName?: string; // Backend DB column alias
  seatingCapacity: number;
  capacity?: number; // Backend DB column alias
  minSeatingCapacity?: number;
  status: TableStatus | string;
  sectionId?: number | string;
  sectionName?: string;
  isAvailable?: boolean;
  isOnlineBookable?: boolean;
  qrCodeUrl?: string;
  activeOrderId?: number | null;
  activeOrderAmount?: number;
  activeGuestCount?: number;
  occupiedSince?: string;
  currentReservationId?: number | null;
  currentReservationGuestName?: string;
  currentReservationTime?: string;
  notes?: string;
}

export type ReservationStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Seated'
  | 'Completed'
  | 'Cancelled'
  | 'NoShow';

export interface TableReservation {
  id: number;
  restaurantId: number;
  reservationCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  guestCount: number;
  reservationDate: string; // YYYY-MM-DD
  reservationTime: string; // HH:mm
  durationMinutes: number; // e.g. 75 or 90
  tableId?: number | null;
  tableNumber?: string;
  sectionName?: string;
  status: ReservationStatus;
  specialNotes?: string;
  isDepositRequired?: boolean;
  depositAmount?: number;
  depositPaymentStatus?: 'Pending' | 'Paid' | 'Refunded' | 'Deducted';
  depositPaymentId?: string;
  source?: 'ONLINE_QR' | 'WALK_IN' | 'PHONE' | 'STAFF_APP';
  seatedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReservationSlot {
  time: string; // "18:00", "18:30"
  displayTime: string; // "06:00 PM"
  isAvailable: boolean;
  availableTablesCount: number;
  maxPartySizeAvailable: number;
  matchingTables?: TableMaster[];
}

export interface RestaurantReservationConfig {
  isAdvanceBookingEnabled: boolean;
  bookingSlotIntervalMinutes: number; // e.g. 15, 30, 60
  averageDiningDurationMinutes: number; // e.g. 60, 75, 90, 120
  advanceBookingWindowDays: number; // e.g. 14 or 30 days
  cutoffLeadTimeHours: number; // e.g. 2 hours lead time
  autoReleaseGracePeriodMinutes: number; // e.g. 15 mins
  requireAdvanceDeposit: boolean;
  depositAmountPerPerson?: number;
  depositFlatAmount?: number;
  cancellationRefundWindowHours?: number; // e.g. 4 hours
  maxOnlineBookingGuests?: number; // e.g. 10
  blockedDates?: string[]; // Array of YYYY-MM-DD blocked dates
}

export interface TableHistoryItem {
  id: number;
  restaurantId: number;
  tableId: number;
  tableNumber?: string;
  orderId?: number;
  reservationId?: number;
  fromStatus: string;
  toStatus: string;
  action: string;
  performedByRole?: string;
  performedByUserId?: string;
  guestCount?: number;
  customerName?: string;
  customerPhone?: string;
  durationMinutes?: number;
  remarks?: string;
  createdDateUTC: string;
}
