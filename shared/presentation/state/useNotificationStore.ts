import { create } from 'zustand';
import { OrderMaster } from '../../domain/models/Order';
import { playOrderNotificationSound } from '../../core/utils/notificationSound';
import { logger } from '../../core/logging';

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
  hasInitialized: boolean;

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
  handleServiceRequest: (data: any) => void;
  handleServiceRequestResolved: (data: any) => void;
  handleWaiterDutyChanged: (data: any) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  soundEnabled: true,
  latestIncomingOrder: null,
  knownOrderIds: new Set<number>(),
  knownOrderStatuses: new Map<number, string>(),
  activeFloorWaitersCount: 0,
  hasInitialized: false,

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
    if (!orderId || orderId <= 0) return;
    const state = get();
    const currentKnownIds = new Set(state.knownOrderIds);
    const currentKnownStatuses = new Map(state.knownOrderStatuses);
    currentKnownIds.add(orderId);
    if (status) {
      currentKnownStatuses.set(orderId, status);
    }
    set({
      knownOrderIds: currentKnownIds,
      knownOrderStatuses: currentKnownStatuses,
    });
  },

  /**
   * Instantly handles real-time SignalR push notifications when order status changes
   * or a new order is placed/settled.
   */
  handleOrderStatusChanged: (event: any) => {
    if (!event) return;

    const orderId = Number(event.orderId ?? event.id ?? 0);
    if (!orderId || orderId <= 0) return;

    const state = get();
    const currentKnownIds = new Set(state.knownOrderIds);
    const currentKnownStatuses = new Map(state.knownOrderStatuses);

    const newStatus = String(event.orderStatus || event.newStatus || event.status || 'Placed');
    const oldStatus = event.oldStatus ? String(event.oldStatus) : currentKnownStatuses.get(orderId);

    // If status hasn't changed and order was already known, skip
    if (currentKnownIds.has(orderId) && currentKnownStatuses.get(orderId) === newStatus) {
      return;
    }

    currentKnownIds.add(orderId);
    currentKnownStatuses.set(orderId, newStatus);

    // Orders created directly on the POS Terminal by Cashier / Owner (POS_ADMIN / COUNTER)
    // should NOT trigger notification cards, unread count increments, or audio chimes for cashier/owner.
    const orderSource = String(
      event.source ||
      event.orderDetails?.source ||
      event.orderData?.source ||
      ''
    ).toUpperCase();
    const isPosAdmin = orderSource === 'POS_ADMIN' || orderSource === 'COUNTER';

    if (isPosAdmin) {
      // Silently keep order tracking in sync without alerting cashier/owner
      set({
        knownOrderIds: currentKnownIds,
        knownOrderStatuses: currentKnownStatuses,
      });
      return;
    }

    // Orders taken by waiter on dining tables: internal kitchen statuses (Preparing, Ready, Served)
    // are managed directly by KDS chefs and floor waiters. Cashier / Owner at POS should NOT be
    // disturbed by kitchen status chimes/popups. Only order creation, cancellation, settlement,
    // and bill requests should alert the cashier.
    const statusUpper = newStatus.toUpperCase();
    const isKitchenPrepStatus = statusUpper === 'PREPARING' || statusUpper === 'READY' || statusUpper === 'SERVED';
    const isWaiterOrder = Boolean(
      orderSource.includes('WAITER') ||
      orderSource === 'STAFF' ||
      event.isWaiterOrder ||
      event.orderDetails?.isWaiterOrder ||
      (event.tableId && Number(event.tableId) > 0) ||
      event.tableName?.toLowerCase().includes('table')
    );
    const isKitchenUpdate = Boolean(event.isKitchenStatus || event.source === 'KDS' || isKitchenPrepStatus);

    const isBillRequest = newStatus.toUpperCase().includes('BILL');
    const isNewOrder = !oldStatus || oldStatus === newStatus;
    const eventType: 'NEW_ORDER' | 'STATUS_CHANGED' | 'SETTLED' | 'CANCELLED' | 'REQUEST_BILL' =
      isBillRequest
        ? 'REQUEST_BILL'
        : newStatus.toUpperCase() === 'SETTLED'
        ? 'SETTLED'
        : newStatus.toUpperCase() === 'CANCELLED'
        ? 'CANCELLED'
        : isNewOrder
        ? 'NEW_ORDER'
        : 'STATUS_CHANGED';

    // Orders taken by waiter on dining tables:
    // 1. Initial Order Placement (NEW_ORDER): Waiter and KDS handle this; Cashier does NOT receive audible/modal alerts.
    // 2. Kitchen Preparation Statuses (Preparing, Ready, Served): Chef and waiter manage this; Cashier is NOT disturbed.
    // ONLY Bill Requests and Order Status changes (Cancelled, Settled, or overarching status changes) should alert cashier!
    if (isWaiterOrder && !isBillRequest && (eventType === 'NEW_ORDER' || (isKitchenUpdate && isKitchenPrepStatus))) {
      // Silently keep order and table status tracking in sync without alerting cashier/owner
      set({
        knownOrderIds: currentKnownIds,
        knownOrderStatuses: currentKnownStatuses,
      });
      return;
    }

    const items = Array.isArray(event.items) ? event.items : [];
    const itemCount = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);

    const tableName =
      event.tableName ||
      (event.tableId ? `Table #${event.tableId}` : event.orderTypeName || 'Counter / Takeaway');

    const rawTableId = Number(
      event.tableId ??
      event.TableId ??
      event.orderDetails?.tableId ??
      event.orderDetails?.TableId ??
      0
    );

    const customerName = event.customerName || event.mobileNumber || 'Customer';

    const pickupToken =
      event.pickupToken ||
      event.orderDetails?.pickupToken ||
      event.orderData?.pickupToken ||
      (event.tokenNumber ? String(event.tokenNumber) : undefined);
    const tokenNumber =
      event.tokenNumber ??
      event.orderDetails?.tokenNumber ??
      event.orderData?.tokenNumber ??
      pickupToken;

    const stations = Array.from(
      new Set(
        items
          .map((it: any) => it.stationName || it.stationCode)
          .filter(Boolean)
      )
    ).join(', ');

    const totalAmount = Number(
      event.totalAmount ??
      event.TotalAmount ??
      event.orderDetails?.totalAmount ??
      event.orderDetails?.TotalAmount ??
      event.orderDetails?.grandTotal ??
      event.orderDetails?.GrandTotal ??
      event.orderData?.totalAmount ??
      event.orderData?.TotalAmount ??
      event.amount ??
      event.Amount ??
      event.grandTotal ??
      event.GrandTotal ??
      0
    );

    const itemsSummary =
      isBillRequest
        ? `🧾 Final bill requested for ${tableName}${totalAmount > 0 ? ` • ₹${totalAmount.toLocaleString('en-IN')}` : ''}`
        : items.length > 0
        ? items
            .slice(0, 3)
            .map((it: any) => `${it.quantity || 1}x ${it.itemName || it.name || 'Item'}`)
            .join(', ') + (items.length > 3 ? ` +${items.length - 3} more` : '')
        : event.orderDetails?.itemsSummary || (eventType === 'STATUS_CHANGED' ? `Status: ${newStatus}` : 'Order update');

    const notifItem: OrderNotificationItem = {
      id: `notif_${orderId}_${Date.now()}`,
      orderId,
      tableId: rawTableId > 0 ? rawTableId : undefined,
      tableName,
      customerName: isBillRequest ? `Pre-Bill: ${tableName}` : customerName,
      customerPhone: event.mobileNumber || event.orderDetails?.mobileNumber,
      totalAmount,
      itemCount: itemCount > 0 ? itemCount : 1,
      itemsSummary,
      orderStatus: isBillRequest ? 'BILL_REQUESTED' : newStatus,
      oldStatus,
      eventType,
      orderTypeId: event.orderTypeId || event.orderDetails?.orderTypeId,
      orderTypeName: event.orderTypeName || event.deliveryType || event.orderDetails?.orderTypeName,
      pickupToken: pickupToken ? String(pickupToken) : undefined,
      tokenNumber: tokenNumber !== undefined ? tokenNumber : undefined,
      stations: stations || undefined,
      createdAt: event.createdDateUtc || event.createdAt || new Date().toISOString(),
      timestamp: Date.now(),
      isRead: false,
    };

    logger.info('POS', 'SIGNALR_ALERT', `⚡ [SignalR Alert] Order #${orderId} -> ${newStatus} (${eventType})`);

    // 1. Play in-app audio chime & vibration
    playOrderNotificationSound(state.soundEnabled);

    // 2. Android Lockscreen / Heads-up alert
    try {
      const { NativeModules, Platform } = require('react-native');
      if (Platform.OS === 'android' && NativeModules?.OrderAlertModule?.showFullScreenOrderAlert) {
        NativeModules.OrderAlertModule.showFullScreenOrderAlert({
          orderId: notifItem.orderId,
          tableName: notifItem.tableName,
          customerName: notifItem.customerName,
          totalAmount: notifItem.totalAmount,
          itemsSummary: `${notifItem.orderStatus.toUpperCase()}: ${notifItem.itemsSummary}`,
        }).catch(() => {});
      }
    } catch {
      // Fail-safe
    }

    // Replace any previous notification for the same orderId with the latest notification
    const withoutSameOrder = state.notifications.filter((n) => n.orderId !== notifItem.orderId);
    const combined = [notifItem, ...withoutSameOrder].slice(0, 50);
    const unreadCount = combined.filter((n) => !n.isRead).length;

    set({
      notifications: combined,
      unreadCount,
      knownOrderIds: currentKnownIds,
      knownOrderStatuses: currentKnownStatuses,
      latestIncomingOrder: notifItem,
    });
  },

  /**
   * Instantly handles real-time guest service requests (Waiter Call, Water, Bill)
   * and adapts alert priority based on whether on-duty floor waiters exist.
   */
  handleServiceRequest: (data: any) => {
    if (!data) return;

    const reqId = data.id || data.Id || data.requestId || data.RequestId || Date.now();
    const rawTableId = Number(data.tableId || data.TableId || 0);
    const rawOrderId = Number(data.orderId || data.OrderId || 0);
    const tableName = data.tableName || data.TableName || (rawTableId > 0 ? `Table #${rawTableId}` : 'Table');
    const reqType = String(data.requestType || data.RequestType || data.type || data.Type || (data.isBillRequest || data.IsBillRequest ? 'REQUEST_BILL' : 'CALL_WAITER')).toUpperCase();
    const activeWaiters = Number(data.activeWaiterCount ?? data.ActiveWaiterCount ?? get().activeFloorWaitersCount ?? 0);
    const fallbackToCounter = Boolean(data.fallbackToCounter || data.FallbackToCounter || activeWaiters === 0);
    const isBillRequest = reqType.includes('BILL') || Boolean(data.isBillRequest || data.IsBillRequest);

    const totalAmount = Number(
      data.totalAmount ??
      data.TotalAmount ??
      data.amount ??
      data.Amount ??
      data.grandTotal ??
      data.GrandTotal ??
      data.orderTotal ??
      data.OrderTotal ??
      data.orderDetails?.totalAmount ??
      data.orderDetails?.TotalAmount ??
      data.orderDetails?.grandTotal ??
      data.orderDetails?.GrandTotal ??
      0
    );

    const typeLabel =
      reqType.includes('WATER')
        ? 'Water Refill'
        : isBillRequest
        ? 'Pre-Bill Request'
        : 'Waiter Call';

    const itemsSummary = isBillRequest
      ? `🧾 Final bill requested for ${tableName}${totalAmount > 0 ? ` • ₹${totalAmount.toLocaleString('en-IN')}` : ''}`
      : fallbackToCounter
      ? `🚨 Table needs assistance! (0 active waiters on floor - Please assist from counter)`
      : `🛎️ Guest called waiter (${activeWaiters} staff active on floor)`;

    const eventType: 'CALL_WAITER' | 'REQUEST_WATER' | 'REQUEST_BILL' =
      reqType.includes('WATER')
        ? 'REQUEST_WATER'
        : isBillRequest
        ? 'REQUEST_BILL'
        : 'CALL_WAITER';

    const notifItem: OrderNotificationItem = {
      id: `service_${reqId}_${Date.now()}`,
      orderId: rawOrderId,
      tableId: rawTableId > 0 ? rawTableId : undefined,
      tableName,
      customerName: isBillRequest
        ? `Pre-Bill: ${tableName}`
        : (data.message || data.Message || (fallbackToCounter ? 'Counter Action Required' : 'Table Assistance')),
      customerPhone: data.customerPhone || data.CustomerPhone || data.mobileNumber || data.MobileNumber || '',
      totalAmount,
      itemCount: 1,
      itemsSummary,
      orderStatus: isBillRequest ? 'BILL_REQUESTED' : (fallbackToCounter ? 'ATTEND_COUNTER' : 'WAITER_CALLED'),
      eventType,
      createdAt: data.createdDateUtc || data.CreatedDateUtc || new Date().toISOString(),
      timestamp: Date.now(),
      isRead: false,
    };

    const state = get();
    // Replace any previous notification for the exact same service request or exact same orderId or same table bill request
    const filtered = state.notifications.filter((n) => {
      if (reqId && n.id.startsWith(`service_${reqId}_`)) return false;
      if (notifItem.orderId > 0 && n.orderId === notifItem.orderId) return false;
      if (isBillRequest && notifItem.tableId && n.tableId === notifItem.tableId && n.eventType === 'REQUEST_BILL') return false;
      return true;
    });

    logger.info('POS', 'SERVICE_CALL_ALERT', `⚡ [Table Call] ${tableName} -> ${typeLabel} (Fallback=${fallbackToCounter})`);

    // Play in-app audio chime
    playOrderNotificationSound(get().soundEnabled);

    const combined = [notifItem, ...filtered].slice(0, 50);
    const unreadCount = combined.filter((n) => !n.isRead).length;

    set({
      notifications: combined,
      unreadCount,
      latestIncomingOrder: notifItem,
    });
  },

  handleServiceRequestResolved: (data: any) => {
    if (!data) return;
    const reqId = data.requestId ?? data.id;
    if (!reqId) return;

    const state = get();
    const updated = state.notifications.filter((n) => !n.id.startsWith(`service_${reqId}_`));
    const unreadCount = updated.filter((n) => !n.isRead).length;

    set({
      notifications: updated,
      unreadCount,
    });
    logger.info('POS', 'SERVICE_CALL_RESOLVED', `⚡ [Table Call] Request #${reqId} resolved and dismissed.`);
  },

  handleWaiterDutyChanged: (data: any) => {
    if (!data) return;
    const count = Number(data.activeWaiterCount ?? data.activeWaiters?.length ?? 0);
    set({ activeFloorWaitersCount: count });
    logger.info('POS', 'WAITER_DUTY', `Floor active waiter count updated to ${count}`);
  },

  /**
   * Evaluates active & today's orders during polling cycle. Detects new orders
   * and status transitions, updating the notification queue and triggering chimes.
   */
  processIncomingOrders: (orders: OrderMaster[]) => {
    if (!Array.isArray(orders) || orders.length === 0) return;

    const state = get();
    const currentKnownIds = new Set(state.knownOrderIds);
    const currentKnownStatuses = new Map(state.knownOrderStatuses);
    const newNotifications: OrderNotificationItem[] = [];
    let newestOrder: OrderNotificationItem | null = null;

    // Seed known orders on initial startup
    if (!state.hasInitialized) {
      orders.forEach((o) => {
        const oId = Number(o.id || 0);
        if (oId > 0) {
          currentKnownIds.add(oId);
          currentKnownStatuses.set(oId, String(o.status || 'Placed'));
        }
      });
      set({
        knownOrderIds: currentKnownIds,
        knownOrderStatuses: currentKnownStatuses,
        hasInitialized: true,
      });
      return;
    }

    // Process orders
    orders.forEach((order) => {
      const oId = Number(order.id || 0);
      if (!oId) return;

      const currentStatus = String(order.status || 'Placed');
      const prevStatus = currentKnownStatuses.get(oId);

      // Check if it's a new order or a status transition
      const isNew = !currentKnownIds.has(oId);
      const isStatusChanged = !isNew && prevStatus !== undefined && prevStatus !== currentStatus;

      if (!isNew && !isStatusChanged) {
        return;
      }

      currentKnownIds.add(oId);
      currentKnownStatuses.set(oId, currentStatus);

      // Orders placed via POS Terminal by Cashier / Owner (POS_ADMIN / COUNTER)
      // should NOT trigger notification cards, unread count increments, or audio chimes for cashier/owner.
      const orderSource = String(order.source || '').toUpperCase();
      const isPosAdmin = orderSource === 'POS_ADMIN' || orderSource === 'COUNTER';

      if (isPosAdmin) {
        return;
      }

      // Orders placed by Waiters at dining tables:
      // Initial order placement and internal kitchen preparation statuses should NOT alert cashier.
      // Only significant overarching status transitions (Cancelled, Settled, etc.) alert cashier.
      const isWaiterOrder = Boolean(
        orderSource.includes('WAITER') ||
        orderSource === 'STAFF' ||
        (order.tableId && Number(order.tableId) > 0) ||
        order.tableName?.toLowerCase().includes('table')
      );

      const statusUpper = currentStatus.toUpperCase();
      const isKitchenPrepStatus = statusUpper === 'PREPARING' || statusUpper === 'READY' || statusUpper === 'SERVED';

      if (isWaiterOrder && (isNew || isKitchenPrepStatus)) {
        return;
      }

      const items = Array.isArray(order.items) ? order.items : [];
      const itemCount = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
      const itemsSummary =
        items.length > 0
          ? items
              .slice(0, 3)
              .map((it) => `${it.quantity || 1}x ${it.itemName}`)
              .join(', ') + (items.length > 3 ? ` +${items.length - 3} more` : '')
          : (isStatusChanged ? `Status changed to ${currentStatus}` : 'Items ordered');

      const tableName =
        order.tableName ||
        (order.tableId ? `Table #${order.tableId}` : order.orderTypeName || 'Dine-In');

      const customerName =
        order.customerName ||
        order.mobileNumber ||
        'Guest Customer';

      const pickupToken =
        order.pickupToken ||
        (order.tokenNumber ? String(order.tokenNumber) : undefined);
      const tokenNumber = order.tokenNumber ?? pickupToken;

      const stations = Array.from(
        new Set(
          items
            .map((it: any) => it.stationName || it.stationCode)
            .filter(Boolean)
        )
      ).join(', ');

      const notifItem: OrderNotificationItem = {
        id: `notif_${oId}_${Date.now()}`,
        orderId: oId,
        tableName,
        customerName,
        customerPhone: order.mobileNumber,
        totalAmount: Number(order.totalAmount || 0),
        itemCount,
        itemsSummary,
        orderStatus: currentStatus,
        oldStatus: prevStatus,
        eventType: isNew ? 'NEW_ORDER' : 'STATUS_CHANGED',
        orderTypeId: order.orderTypeId,
        orderTypeName: order.orderTypeName,
        pickupToken: pickupToken ? String(pickupToken) : undefined,
        tokenNumber: tokenNumber !== undefined ? tokenNumber : undefined,
        stations: stations || undefined,
        createdAt: order.createdAt || new Date().toISOString(),
        timestamp: Date.now(),
        isRead: false,
        orderData: order,
      };

      newNotifications.unshift(notifItem);
      newestOrder = notifItem;
    });

    if (newNotifications.length > 0) {
      logger.info('POS', 'ORDER_UPDATES', `🔔 Received ${newNotifications.length} order update(s)`, {
        orderIds: newNotifications.map((n) => n.orderId),
      });

      // 1. Play in-app audio chime & vibration
      playOrderNotificationSound(state.soundEnabled);

      // 2. Trigger Android Native Full-Screen Intent
      try {
        const { NativeModules, Platform } = require('react-native');
        if (Platform.OS === 'android' && NativeModules?.OrderAlertModule?.showFullScreenOrderAlert) {
          newNotifications.forEach((n) => {
            NativeModules.OrderAlertModule.showFullScreenOrderAlert({
              orderId: n.orderId,
              tableName: n.tableName,
              customerName: n.customerName,
              totalAmount: n.totalAmount,
              itemsSummary: n.itemsSummary,
            }).catch(() => {});
          });
        }
      } catch {
        // Native module fail-safe
      }

      // Deduplicate newNotifications against existing notifications so only the latest notification per orderId is retained
      const newOrderIds = new Set(newNotifications.map((n) => n.orderId));
      const withoutSameOrders = state.notifications.filter((n) => !newOrderIds.has(n.orderId));
      const combined = [...newNotifications, ...withoutSameOrders].slice(0, 50);
      const unreadCount = combined.filter((n) => !n.isRead).length;

      set({
        notifications: combined,
        unreadCount,
        knownOrderIds: currentKnownIds,
        knownOrderStatuses: currentKnownStatuses,
        latestIncomingOrder: newestOrder,
      });
    }
  },
}));
