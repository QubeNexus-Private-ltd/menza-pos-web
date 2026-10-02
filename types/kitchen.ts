export type KitchenProgressStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED';

export interface KitchenStation {
  stationId: number;
  id?: number;
  restaurantId: number;
  stationName: string;
  name?: string;
  description?: string;
  isActive: boolean;
  itemCount?: number;
}

export interface KitchenTicketItem {
  orderDetailId: number;
  itemId: number;
  itemName: string;
  quantity: number;
  cookingInstruction?: string;
  stationId?: number;
  stationName?: string;
  kitchenStatus: string;
}

export interface KitchenOrder {
  kitchenOrderId?: number;
  orderId: number;
  orderNumber?: string;
  roundNumber?: number;
  ticketVersion?: number;
  tableNumber?: string | null;
  tableName?: string | null;
  orderType: string;
  kitchenStatus: string;
  status?: string;
  createdAt: string;
  items: KitchenTicketItem[];
}
