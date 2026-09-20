export interface StateMaster {
  id?: number;
  stateCode: string;
  stateDesc: string;
  stateName?: string;
}

export interface UnitMaster {
  id: number;
  unitName: string;
  shortName?: string;
}

export interface OrderTypeMaster {
  id: number;
  typeName: string;
  description?: string;
  isActive?: boolean;
}

export interface OrderConfigDetailItem {
  id?: number;
  masterId: number;
  restaurantId?: number;
  configKey: string;
  configValue: string;
  dataType?: string;
  category?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  isLockedBySubscription?: boolean;
}

export interface OrderConfigMasterItem {
  id: number;
  configCode: string;
  configName: string;
  description?: string;
  isActive?: boolean;
  details: OrderConfigDetailItem[];
}
