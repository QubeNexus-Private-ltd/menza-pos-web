import * as signalR from '@microsoft/signalr';

let connection: signalR.HubConnection | null = null;
let currentConnectedRestId: number | null = null;

// Event listener sets
const orderCreatedListeners = new Set<(order: any) => void>();
const orderStatusListeners = new Set<(event: any) => void>();
const orderSettledListeners = new Set<(order: any) => void>();
const storeStatusListeners = new Set<(status: any) => void>();
const kitchenStatusListeners = new Set<(status: any) => void>();
const kitchenStationListeners = new Set<(stationData: any) => void>();
const walletBalanceListeners = new Set<(balance: any) => void>();
const tableStatusListeners = new Set<(tableData: any) => void>();
const serviceRequestListeners = new Set<(request: any) => void>();
const serviceRequestResolvedListeners = new Set<(request: any) => void>();
const paymentVerifiedListeners = new Set<(payment: any) => void>();
const reconnectedListeners = new Set<() => void>();

// Browser tab visibility auto-reconnect
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentConnectedRestId) {
      if (!connection || connection.state === signalR.HubConnectionState.Disconnected) {
        console.log('[SignalR] Tab visible again. Re-verifying connection...');
        startPosSignalRConnection(currentConnectedRestId).catch(() => {});
      }
    }
  });
}

function getHubUrl(restaurantId: number): string {
  const customHubUrl = process.env.NEXT_PUBLIC_SIGNALR_HUB_URL;
  if (customHubUrl) {
    return `${customHubUrl}?restaurantId=${restaurantId}`;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    const errorMsg =
      '[SignalR Config Error] Missing NEXT_PUBLIC_SIGNALR_HUB_URL and NEXT_PUBLIC_API_BASE_URL. ' +
      'Please configure your environment variables in .env.local or Vercel Settings.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Strip trailing /api or /api/
  const hostBase = apiBase.replace(/\/api\/?$/, '');
  return `${hostBase}/hubs/order?restaurantId=${restaurantId}`;
}

export async function startPosSignalRConnection(restaurantId: number): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!restaurantId || restaurantId <= 0) return;

  // If already connected to the same restaurant, return
  if (
    connection &&
    connection.state === signalR.HubConnectionState.Connected &&
    currentConnectedRestId === restaurantId
  ) {
    return;
  }

  // If connected to a different restaurant, disconnect first
  if (connection) {
    try {
      await connection.stop();
    } catch {
      // Ignore stop errors
    }
    connection = null;
  }

  const hubUrl = getHubUrl(restaurantId);

  connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      skipNegotiation: false,
      transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  // Register Hub Client Events
  connection.on('OnOrderCreated', (data) => {
    orderCreatedListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in OnOrderCreated listener:', err);
      }
    });
  });

  connection.on('OnOrderStatusChanged', (data) => {
    orderStatusListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in OnOrderStatusChanged listener:', err);
      }
    });
  });

  connection.on('OnOrderSettled', (data) => {
    orderSettledListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in OnOrderSettled listener:', err);
      }
    });
  });

  connection.on('OnStoreOperatingStatusChanged', (data) => {
    storeStatusListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in OnStoreOperatingStatusChanged listener:', err);
      }
    });
  });

  connection.on('OnKitchenStatusChanged', (data) => {
    kitchenStatusListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in OnKitchenStatusChanged listener:', err);
      }
    });
  });

  const handleStationUpdate = (data: any) => {
    kitchenStationListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in OnKitchenStationStatusChanged listener:', err);
      }
    });
  };
  connection.on('OnKitchenStationStatusChanged', handleStationUpdate);
  connection.on('KitchenStationStatusChanged', handleStationUpdate);

  connection.on('OnWalletBalanceChanged', (data) => {
    walletBalanceListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in OnWalletBalanceChanged listener:', err);
      }
    });
  });

  const handleTableStatus = (data: any) => {
    tableStatusListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in OnTableStatusChanged listener:', err);
      }
    });
  };
  connection.on('OnTableStatusChanged', handleTableStatus);
  connection.on('TableStatusChanged', handleTableStatus);

  const handleServiceRequest = (data: any) => {
    serviceRequestListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in ServiceRequest listener:', err);
      }
    });
  };
  connection.on('ServiceRequestCreated', handleServiceRequest);
  connection.on('OnServiceRequestCreated', handleServiceRequest);
  connection.on('WaiterCalled', handleServiceRequest);
  connection.on('BillRequested', handleServiceRequest);
  connection.on('OnBillRequested', handleServiceRequest);

  const handleServiceResolved = (data: any) => {
    serviceRequestResolvedListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in ServiceRequestResolved listener:', err);
      }
    });
  };
  connection.on('ServiceRequestResolved', handleServiceResolved);
  connection.on('OnServiceRequestResolved', handleServiceResolved);

  connection.on('OnPaymentVerified', (data) => {
    paymentVerifiedListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('[SignalR] Error in OnPaymentVerified listener:', err);
      }
    });
  });

  connection.onreconnected(async () => {
    console.log(`[SignalR] Reconnected to restaurant #${restaurantId}`);
    try {
      if (connection) {
        await connection.invoke('JoinRestaurantGroup', restaurantId.toString());
        await connection.invoke('JoinStaffGroup', restaurantId.toString());
      }
    } catch {
      // Re-join best-effort
    }
    reconnectedListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.warn('[SignalR] Error in reconnected listener:', err);
      }
    });
  });

  try {
    await connection.start();
    currentConnectedRestId = restaurantId;
    console.log(`[SignalR] Connected successfully to restaurant #${restaurantId}`);

    // Explicitly join restaurant & staff groups
    await connection.invoke('JoinRestaurantGroup', restaurantId.toString());
    await connection.invoke('JoinStaffGroup', restaurantId.toString());
  } catch (err) {
    console.warn(`[SignalR] Connection start failed for restaurant #${restaurantId}:`, err);
  }
}

export async function stopPosSignalRConnection(): Promise<void> {
  if (connection) {
    try {
      await connection.stop();
    } catch {
      // Ignore
    }
    connection = null;
    currentConnectedRestId = null;
  }
}

// Subscriptions
export function onPosOrderCreated(callback: (order: any) => void): () => void {
  orderCreatedListeners.add(callback);
  return () => orderCreatedListeners.delete(callback);
}

export function onPosOrderStatusChanged(callback: (event: any) => void): () => void {
  orderStatusListeners.add(callback);
  return () => orderStatusListeners.delete(callback);
}

export function onPosOrderSettled(callback: (order: any) => void): () => void {
  orderSettledListeners.add(callback);
  return () => orderSettledListeners.delete(callback);
}

export function onStoreOperatingStatusChanged(callback: (status: any) => void): () => void {
  storeStatusListeners.add(callback);
  return () => storeStatusListeners.delete(callback);
}

export function onKitchenStatusChanged(callback: (status: any) => void): () => void {
  kitchenStatusListeners.add(callback);
  return () => kitchenStatusListeners.delete(callback);
}

export function onKitchenStationStatusChanged(callback: (stationData: any) => void): () => void {
  kitchenStationListeners.add(callback);
  return () => kitchenStationListeners.delete(callback);
}

export function onWalletBalanceChanged(callback: (balance: any) => void): () => void {
  walletBalanceListeners.add(callback);
  return () => walletBalanceListeners.delete(callback);
}

export function onPosTableStatusChanged(callback: (tableData: any) => void): () => void {
  tableStatusListeners.add(callback);
  return () => tableStatusListeners.delete(callback);
}

export function onServiceRequestCreated(callback: (request: any) => void): () => void {
  serviceRequestListeners.add(callback);
  return () => serviceRequestListeners.delete(callback);
}

export function onServiceRequestResolved(callback: (request: any) => void): () => void {
  serviceRequestResolvedListeners.add(callback);
  return () => serviceRequestResolvedListeners.delete(callback);
}

export function onPaymentVerified(callback: (payment: any) => void): () => void {
  paymentVerifiedListeners.add(callback);
  return () => paymentVerifiedListeners.delete(callback);
}

export function onSignalRReconnected(callback: () => void): () => void {
  reconnectedListeners.add(callback);
  return () => reconnectedListeners.delete(callback);
}
