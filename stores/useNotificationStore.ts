import { create } from 'zustand';
import { OrderMaster } from '@/types/order';
import { playOrderNotificationSound } from '@/lib/sound/notificationSound';

export interface OrderNotificationItem {
  id: string;
  orderId: number;
  tableId?: number;
  tableName: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  itemCount: number;
  itemsSummary: string;
  orderStatus: string;
  oldStatus?: string;
  eventType?: 'NEW_ORDER' | 'STATUS_CHANGED' | 'SETTLED' | 'CANCELLED' | 'CALL_WAITER' | 'REQUEST_WATER' | 'REQUEST_BILL';
  orderTypeId?: number;
  orderTypeName?: string;
  pickupToken?: string;
  tokenNumber?: string | number;
  stations?: string;
  createdAt: string;
  timestamp: number;
  isRead: boolean;
  orderData?: OrderMaster;
}

interface NotificationState {
  notifications: OrderNotificationItem[];
  unreadCount: number;
  soundEnabled: boolean;
  latestIncomingOrder: OrderNotificationItem | null;
  knownOrderIds: Set<number>;
  knownOrderStatuses: Map<number, string>;
  activeFloorWaitersCount: number;

  setSoundEnabled: (enabled: boolean) => void;
  markAsRead: (notificationIdOrOrderId: string | number) => void;
  markOrderAsRead: (orderId: number) => void;
  markAllAsRead: () => void;
  clearNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  dismissBanner: () => void;
  markOrderAsKnown: (orderId: number, status?: string) => void;
  processIncomingOrders: (orders: OrderMaster[]) => void;
  handleOrderStatusChanged: (event: any) => void;
  handleServiceRequest?: (data: any) => void;
  handleWaiterDutyChanged?: (data: any) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  soundEnabled: true,
  latestIncomingOrder: null,
  knownOrderIds: new Set<number>(),
  knownOrderStatuses: new Map<number, string>(),
  activeFloorWaitersCount: 0,

  setSoundEnabled: (enabled: boolean) => {
    set({ soundEnabled: enabled });
  },

  markAsRead: (notificationIdOrOrderId: string | number) => {
    const { notifications } = get();
    const targetStr = String(notificationIdOrOrderId);
    const targetNum =
      typeof notificationIdOrOrderId === 'number'
        ? notificationIdOrOrderId
        : parseInt(targetStr.replace(/^notif_(\d+)_.*$/, '$1'), 10);

    const updated = notifications.map((item) => {
      if (item.id === targetStr || item.orderId === targetNum || (targetNum > 0 && item.orderId === targetNum)) {
        return { ...item, isRead: true };
      }
      return item;
    });
    const unreadCount = updated.filter((n) => !n.isRead).length;
    set({ notifications: updated, unreadCount });
  },

  markOrderAsRead: (orderId: number) => {
    if (!orderId || orderId <= 0) return;
    const { notifications } = get();
    const updated = notifications.map((item) =>
      item.orderId === orderId ? { ...item, isRead: true } : item
    );
    const unreadCount = updated.filter((n) => !n.isRead).length;
    set({ notifications: updated, unreadCount });
  },

  markAllAsRead: () => {
    const { notifications } = get();
    const updated = notifications.map((item) => ({ ...item, isRead: true }));
    set({ notifications: updated, unreadCount: 0 });
  },

  clearNotification: (notificationId: string) => {
    const { notifications } = get();
    const updated = notifications.filter((n) => n.id !== notificationId);
    const unreadCount = updated.filter((n) => !n.isRead).length;
    set({ notifications: updated, unreadCount });
  },

  clearAllNotifications: () => {
    set({ notifications: [], unreadCount: 0, latestIncomingOrder: null });
  },

  dismissBanner: () => {
    set({ latestIncomingOrder: null });
  },

  markOrderAsKnown: (orderId: number, status?: string) => {
    const { knownOrderIds, knownOrderStatuses } = get();
    knownOrderIds.add(orderId);
    if (status) {
      knownOrderStatuses.set(orderId, status);
    }
  },

  processIncomingOrders: (orders: OrderMaster[]) => {
    if (!orders || orders.length === 0) return;
    const { knownOrderIds, soundEnabled } = get();

    let hasNewOrder = false;
    orders.forEach((order) => {
      const orderId = order.orderId || order.id || 0;
      if (orderId > 0 && !knownOrderIds.has(orderId)) {
        knownOrderIds.add(orderId);
        hasNewOrder = true;
      }
    });

    if (hasNewOrder && soundEnabled) {
      playOrderNotificationSound();
    }
  },

  handleOrderStatusChanged: (event: any) => {
    if (!event) return;
    const orderId = Number(event.orderId || event.id || 0);
    if (!orderId) return;

    const { notifications, unreadCount, soundEnabled, knownOrderStatuses } = get();
    const oldStatus = knownOrderStatuses.get(orderId) || event.oldStatus;
    const newStatus = event.newStatus || event.orderStatus || event.status || 'CONFIRMED';

    knownOrderStatuses.set(orderId, newStatus);

    const itemsSummary = Array.isArray(event.orderDetails)
      ? event.orderDetails.map((i: any) => `${i.quantity}x ${i.itemName}`).join(', ')
      : `${event.totalAmount ? '₹' + event.totalAmount : 'Order Updated'}`;

    const newNotif: OrderNotificationItem = {
      id: `notif_${orderId}_${Date.now()}`,
      orderId,
      tableName: event.tableName || (event.tableId ? `Table ${event.tableId}` : 'POS Counter'),
      customerName: event.customerName || 'Valued Guest',
      totalAmount: Number(event.totalAmount || event.grandTotal || 0),
      itemCount: Array.isArray(event.orderDetails) ? event.orderDetails.length : 1,
      itemsSummary,
      orderStatus: newStatus,
      oldStatus,
      eventType: newStatus === 'SETTLED' ? 'SETTLED' : 'STATUS_CHANGED',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      isRead: false,
    };

    if (soundEnabled) {
      playOrderNotificationSound();
    }

    set({
      notifications: [newNotif, ...notifications.slice(0, 49)],
      unreadCount: unreadCount + 1,
      latestIncomingOrder: newNotif,
    });
  },
}));
