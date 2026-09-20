export interface KitchenStation {
  id: number;
  restaurantId: number;
  stationCode: string;
  stationName: string;
  iconName?: string;
  badgeColor?: string;
  displayOrder: number;
  isActive: boolean;
  isPaused: boolean;
  remainingPauseMinutes: number;
  pausedUntilUtc?: string | null;
  pauseReason?: string | null;
  assignedPrinterMacOrIp?: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'INACTIVE' | 'DELETED';
}

export interface CreateKitchenStationRequest {
  restaurantId: number;
  stationCode: string;
  stationName: string;
  iconName?: string;
  badgeColor?: string;
  displayOrder?: number;
  assignedPrinterMacOrIp?: string;
}

export interface UpdateKitchenStationRequest {
  stationCode?: string;
  stationName?: string;
  iconName?: string;
  badgeColor?: string;
  displayOrder?: number;
  assignedPrinterMacOrIp?: string;
}

export interface ToggleKitchenStationStatusRequest {
  isActive?: boolean;
  pauseMinutes?: number; // 15, 30, 60 or 0 to clear
  pauseReason?: string;
}
