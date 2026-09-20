import { HubConnection, HubConnectionBuilder, LogLevel, HttpTransportType } from '@microsoft/signalr';
import { APP_CONSTANTS } from '../constants/appConstants';
import { useNotificationStore } from '../../presentation/state/useNotificationStore';
import { useKitchenStationStore } from '../../presentation/state/useKitchenStationStore';
import { WalletEvents } from '../utils/walletEvents';
import { logger } from '../logging';

let hubConnection: HubConnection | null = null;
let activeRestaurantId: number | null = null;
const statusListeners = new Set<(data: any) => void>();
const orderCreatedListeners = new Set<(data: any) => void>();
const orderSettledListeners = new Set<(data: any) => void>();
const operatingStatusListeners = new Set<(data: any) => void>();
const paymentVerifiedListeners = new Set<(data: any) => void>();
const reconnectListeners = new Set<() => void>();
const serviceRequestListeners = new Set<(data: any) => void>();
const serviceRequestResolvedListeners = new Set<(data: any) => void>();
const dutyStatusListeners = new Set<(data: any) => void>();
const tableStatusListeners = new Set<(data: any) => void>();
const kitchenStationListeners = new Set<(data: any) => void>();
const menuItemAvailabilityListeners = new Set<(data: any) => void>();

/**
 * Initializes and starts the SignalR Order Hub connection for POS / Admin
 */
export async function startPosSignalRConnection(restaurantId?: number | null): Promise<HubConnection | null> {
  const targetRestId = restaurantId && restaurantId > 0 ? restaurantId : activeRestaurantId;
  const baseUrl = APP_CONSTANTS.API_BASE_URL.replace(/\/api\/?$/, '');
  const hubUrl = `${baseUrl}/hubs/order`;

  if (hubConnection && hubConnection.state === 'Connected') {
    if (targetRestId && targetRestId !== activeRestaurantId) {
      await joinRestaurantGroup(targetRestId);
    }
    return hubConnection;
  }

  try {
    hubConnection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    // 1. Listen for Order Status Changes
    hubConnection.on('OnOrderStatusChanged', (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `⚡ [SignalR] Real-time OrderStatusChanged received for Order #${data?.orderId || data?.id}`, data);
      
      // Instantly dispatch to Notification Store without waiting for polling
      useNotificationStore.getState().handleOrderStatusChanged(data);

      statusListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    });

    // 2. Listen for New Orders
    hubConnection.on('OnOrderCreated', (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `⚡ [SignalR] Real-time OrderCreated received for Order #${data?.orderId || data?.id}`, data);
      
      useNotificationStore.getState().handleOrderStatusChanged(data);

      orderCreatedListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });

      statusListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });

      // Synchronize live wallet balance & ledger when orders arrive
      try { WalletEvents.emit(); } catch (e) { console.warn(e); }
    });

    // 3. Listen for Order Settlement
    hubConnection.on('OnOrderSettled', (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `⚡ [SignalR] Real-time OrderSettled received for Order #${data?.orderId || data?.id}`, data);
      
      useNotificationStore.getState().handleOrderStatusChanged(data);

      orderSettledListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });

      statusListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });

      // Synchronize live wallet balance & ledger when orders settle
      try { WalletEvents.emit(); } catch (e) { console.warn(e); }
    });

    // 4. Listen for Kitchen KDS status updates
    hubConnection.on('OnKitchenStatusChanged', (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `⚡ [SignalR] Real-time KitchenStatusChanged received for Order #${data?.orderId || data?.id}`, data);
      
      useNotificationStore.getState().handleOrderStatusChanged(data);

      statusListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    });

    // 5. Listen for Store Operating Status (Open / Paused / Closed)
    hubConnection.on('OnStoreOperatingStatusChanged', (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `⚡ [SignalR] Real-time StoreOperatingStatusChanged received for Restaurant #${data?.restaurantId}`, data);
      
      operatingStatusListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    });

    // 6. Listen for Real-Time Payment Settlement / Verification
    hubConnection.on('OnPaymentVerified', (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `⚡ [SignalR] Real-time PaymentVerified received for Order #${data?.orderId}`, data);
      
      paymentVerifiedListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    });

    // 7. Listen for Live Wallet Balance & Ledger Commission Deductions
    hubConnection.on('OnWalletBalanceChanged', (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `⚡ [SignalR] Real-time WalletBalanceChanged received for Restaurant #${data?.restaurantId}: NewBalance=${data?.newBalance}`, data);
      try { WalletEvents.emit(); } catch (e) { console.warn(e); }
    });

    // 8. Listen for Guest Table Service Calls (Call Waiter, Water, Bill)
    const handleServiceCall = (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `🛎️ [SignalR] Real-time Table Service Request received for Table #${data?.tableName || data?.tableId}`, data);
      useNotificationStore.getState().handleServiceRequest(data);
      serviceRequestListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    };

    hubConnection.on('ServiceRequestCreated', handleServiceCall);
    hubConnection.on('WaiterCalled', handleServiceCall);

    // 9. Listen for Waiter Duty / Floor Shift Status Changes
    hubConnection.on('OnWaiterDutyStatusChanged', (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `👥 [SignalR] Waiter duty status changed: active=${data?.activeWaiterCount}`, data);
      useNotificationStore.getState().handleWaiterDutyChanged(data);
      dutyStatusListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    });

    // 10. Listen for Guest Table Status Changes (Occupied, Billed, Vacated)
    const handleTableStatus = (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `🪑 [SignalR] Real-time TableStatusChanged received for Table #${data?.tableId || data?.id}`, data);
      tableStatusListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    };
    hubConnection.on('OnTableStatusChanged', handleTableStatus);
    hubConnection.on('TableStatusChanged', handleTableStatus);

    // 11. Listen for Kitchen Station Status Changes (Active, Paused, Offline)
    const handleStationStatus = (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `🍳 [SignalR] Real-time KitchenStationStatusChanged received`, data);
      try {
        useKitchenStationStore.getState().handleSignalRStationUpdate(data);
      } catch (e) {
        console.warn('Failed to update kitchen station store:', e);
      }
      kitchenStationListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    };
    hubConnection.on('OnKitchenStationStatusChanged', handleStationStatus);
    hubConnection.on('KitchenStationStatusChanged', handleStationStatus);

    // 12. Listen for Guest Service Request Resolved (Waiter acknowledged/cleared)
    const handleServiceRequestResolved = (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `✅ [SignalR] Real-time ServiceRequestResolved received for Request #${data?.requestId || data?.id}`, data);
      try {
        useNotificationStore.getState().handleServiceRequestResolved(data);
      } catch (e) {
        console.warn('Failed to resolve service request in store:', e);
      }
      serviceRequestResolvedListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    };
    hubConnection.on('ServiceRequestResolved', handleServiceRequestResolved);
    hubConnection.on('OnServiceRequestResolved', handleServiceRequestResolved);

    // 13. Listen for Menu Item Availability Changes (In-Stock / 86'd Out-of-Stock)
    const handleMenuItemAvailability = (data: any) => {
      logger.info('POS', 'SIGNALR_EVENT', `🍔 [SignalR] Real-time MenuItemAvailabilityChanged received for Item #${data?.itemId || data?.id}`, data);
      menuItemAvailabilityListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    };
    hubConnection.on('OnMenuItemAvailabilityChanged', handleMenuItemAvailability);
    hubConnection.on('MenuItemAvailabilityChanged', handleMenuItemAvailability);

    await hubConnection.start();
    logger.info('POS', 'SIGNALR_CONNECT', `⚡ [SignalR] Connected to OrderNotificationHub at ${hubUrl}`);

    if (targetRestId && targetRestId > 0) {
      await joinRestaurantGroup(targetRestId);
    }

    hubConnection.onreconnected(async () => {
      logger.info('POS', 'SIGNALR_RECONNECT', '⚡ [SignalR] Reconnected. Rejoining restaurant group & triggering sync...');
      if (activeRestaurantId) {
        await joinRestaurantGroup(activeRestaurantId);
      }
      reconnectListeners.forEach((cb) => {
        try { cb(); } catch (e) { console.error(e); }
      });
    });

    return hubConnection;
  } catch (err: any) {
    logger.warn('POS', 'SIGNALR_WARN', `⚡ [SignalR] Connection note: ${err?.message || err}`);
    return null;
  }
}

/**
 * Joins a restaurant channel to receive all real-time order updates for that outlet
 */
export async function joinRestaurantGroup(restaurantId: number): Promise<void> {
  if (!restaurantId || restaurantId <= 0) return;
  activeRestaurantId = restaurantId;

  if (hubConnection && hubConnection.state === 'Connected') {
    try {
      await hubConnection.invoke('JoinRestaurantGroup', String(restaurantId));
      logger.info('POS', 'SIGNALR_GROUP', `⚡ [SignalR] Joined Restaurant_${restaurantId} group`);
      try {
        await hubConnection.invoke('JoinStaffGroup', String(restaurantId));
        logger.info('POS', 'SIGNALR_GROUP', `⚡ [SignalR] Joined Restaurant_${restaurantId}_Staff group`);
      } catch (staffErr: any) {
        logger.warn('POS', 'SIGNALR_STAFF_GROUP_WARN', `Could not join staff group: ${staffErr?.message || staffErr}`);
      }
    } catch (err: any) {
      logger.warn('POS', 'SIGNALR_GROUP_ERR', `Failed to join restaurant group ${restaurantId}: ${err?.message || err}`);
    }
  }
}

/**
 * Subscribe to real-time order status events
 */
export function onPosOrderStatusChanged(callback: (data: any) => void): () => void {
  statusListeners.add(callback);
  return () => {
    statusListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time new order created events
 */
export function onPosOrderCreated(callback: (data: any) => void): () => void {
  orderCreatedListeners.add(callback);
  return () => {
    orderCreatedListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time order settled events
 */
export function onPosOrderSettled(callback: (data: any) => void): () => void {
  orderSettledListeners.add(callback);
  return () => {
    orderSettledListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time store operating status events
 */
export function onStoreOperatingStatusChanged(callback: (data: any) => void): () => void {
  operatingStatusListeners.add(callback);
  return () => {
    operatingStatusListeners.delete(callback);
  };
}

/**
 * Subscribe to SignalR reconnect events for on-demand catch-up sync
 */
export function onSignalRReconnected(callback: () => void): () => void {
  reconnectListeners.add(callback);
  return () => {
    reconnectListeners.delete(callback);
  };
}

/**
 * Joins a specific order channel to receive instant real-time settlement notifications
 */
export async function joinOrderGroup(orderId: string | number): Promise<void> {
  if (!orderId) return;
  if (hubConnection && hubConnection.state === 'Connected') {
    try {
      await hubConnection.invoke('JoinOrderGroup', String(orderId));
      logger.info('POS', 'SIGNALR_GROUP', `⚡ [SignalR] Joined Order_${orderId} group`);
    } catch (err: any) {
      logger.warn('POS', 'SIGNALR_GROUP_ERR', `Failed to join order group ${orderId}: ${err?.message || err}`);
    }
  }
}

/**
 * Subscribe to real-time payment verified events from CashFree / Azure Function
 */
export function onPaymentVerified(callback: (data: any) => void): () => void {
  paymentVerifiedListeners.add(callback);
  return () => {
    paymentVerifiedListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time table assistance calls (Call Waiter, Water, Bill)
 */
export function onPosServiceRequestCreated(callback: (data: any) => void): () => void {
  serviceRequestListeners.add(callback);
  return () => {
    serviceRequestListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time waiter duty headcount updates
 */
export function onPosWaiterDutyStatusChanged(callback: (data: any) => void): () => void {
  dutyStatusListeners.add(callback);
  return () => {
    dutyStatusListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time table status updates (Occupied, Billed, Vacated)
 */
export function onPosTableStatusChanged(callback: (data: any) => void): () => void {
  tableStatusListeners.add(callback);
  return () => {
    tableStatusListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time kitchen station status updates
 */
export function onKitchenStationStatusChanged(callback: (data: any) => void): () => void {
  kitchenStationListeners.add(callback);
  return () => {
    kitchenStationListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time guest service request resolved events
 */
export function onPosServiceRequestResolved(callback: (data: any) => void): () => void {
  serviceRequestResolvedListeners.add(callback);
  return () => {
    serviceRequestResolvedListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time menu item availability updates (In-Stock / 86'd Out-of-Stock)
 */
export function onPosMenuItemAvailabilityChanged(callback: (data: any) => void): () => void {
  menuItemAvailabilityListeners.add(callback);
  return () => {
    menuItemAvailabilityListeners.delete(callback);
  };
}


