'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChefHat,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  MapPin,
  Phone,
  RefreshCw,
  Share2,
  ArrowLeft,
  AlertCircle,
  Receipt,
  Sparkles,
  CreditCard,
  Hash,
  Store,
  Check,
} from 'lucide-react';
import { HubConnection, HubConnectionBuilder, HttpTransportType, LogLevel } from '@microsoft/signalr';
import { fetchOrderTracking } from '@/services/publicTrackService';
import { PublicOrderTrackingDTO, PublicOrderItemTrackingDTO } from '@/types/orderTrack';
import { APP_CONSTANTS } from '@/shared/core/constants/appConstants';

// Normalizes status strings for visual stepper
function getStepperStage(orderStatus: string, kitchenStatus?: string | null): number {
  const os = (orderStatus || '').toUpperCase().trim();
  const ks = (kitchenStatus || '').toUpperCase().trim();

  if (os === 'CANCELLED' || os === 'CANCELED' || os === 'REJECTED') {
    return -1; // Cancelled state
  }

  if (os === 'SETTLED' || os === 'COMPLETED' || os === 'SERVED') {
    return 4;
  }

  if (os === 'READY' || ks === 'READY') {
    return 3;
  }

  if (
    os === 'PREPARING' ||
    os === 'IN_KITCHEN' ||
    ks === 'PREPARING' ||
    ks === 'IN-PREPARATION' ||
    ks === 'IN_PREPARATION' ||
    ks === 'RECEIVED'
  ) {
    return 2;
  }

  if (os === 'CONFIRMED') {
    return 1;
  }

  return 0; // PLACED
}

const STEPS = [
  { id: 0, label: 'Order Placed', desc: 'Received by outlet' },
  { id: 1, label: 'Confirmed', desc: 'Accepted by kitchen' },
  { id: 2, label: 'In Kitchen', desc: 'Preparing fresh' },
  { id: 3, label: 'Ready', desc: 'Ready for table/pickup' },
  { id: 4, label: 'Served', desc: 'Enjoy your meal' },
];

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId ? String(params.orderId) : '';

  const [order, setOrder] = useState<PublicOrderTrackingDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [signalRConnected, setSignalRConnected] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const hubConnectionRef = useRef<HubConnection | null>(null);

  // Load Order Tracking Data
  const loadOrder = useCallback(
    async (isManualRefresh = false) => {
      if (!orderId) return;
      if (isManualRefresh) setRefreshing(true);
      try {
        const data = await fetchOrderTracking(orderId);
        setOrder(data);
        setError(null);
      } catch (err: any) {
        if (!order) {
          setError(
            err?.response?.data?.message ||
              'Order not found or unable to fetch live tracking details. Please verify your order number.'
          );
        }
      } finally {
        setLoading(false);
        if (isManualRefresh) setRefreshing(false);
      }
    },
    [orderId, order]
  );

  // Initial Data Fetch
  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Establish dedicated SignalR connection for Live Tracking
  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    const baseUrl = APP_CONSTANTS.API_BASE_URL.replace(/\/api\/?$/, '');
    const hubUrl = `${baseUrl}/hubs/order`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: () => 3000,
      })
      .configureLogging(LogLevel.None)
      .build();

    hubConnectionRef.current = connection;

    // Listen to real-time status updates
    connection.on('OnOrderStatusChanged', (payload: any) => {
      const targetOrderId = payload?.orderId || payload?.id;
      if (String(targetOrderId) === String(orderId)) {
        setOrder((prev) => {
          if (!prev) return prev;
          const updatedStatus = payload?.newStatus || payload?.orderStatus || payload?.status || prev.orderStatus;
          const updatedKitchen = payload?.kitchenStatus || prev.kitchenStatus;
          return {
            ...prev,
            orderStatus: updatedStatus,
            kitchenStatus: updatedKitchen,
            totalAmount: typeof payload?.totalAmount === 'number' ? payload.totalAmount : prev.totalAmount,
          };
        });
        loadOrder();
      }
    });

    connection.on('OnKitchenStatusChanged', (payload: any) => {
      const targetOrderId = payload?.orderId || payload?.id;
      if (String(targetOrderId) === String(orderId)) {
        setOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            kitchenStatus: payload?.kitchenStatus || payload?.status || prev.kitchenStatus,
          };
        });
        loadOrder();
      }
    });

    connection.on('OnOrderSettled', (payload: any) => {
      const targetOrderId = payload?.orderId || payload?.id;
      if (String(targetOrderId) === String(orderId)) {
        setOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            isSettled: true,
            orderStatus: 'SETTLED',
            paymentStatus: 'PAID',
          };
        });
        loadOrder();
      }
    });

    connection.on('OnPaymentVerified', (payload: any) => {
      const targetOrderId = payload?.orderId || payload?.id;
      if (String(targetOrderId) === String(orderId)) {
        setOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            paymentStatus: 'PAID',
            isSettled: true,
          };
        });
        loadOrder();
      }
    });

    connection.onreconnected(async () => {
      if (isMounted) {
        setSignalRConnected(true);
        try {
          await connection.invoke('JoinOrderGroup', String(orderId));
        } catch {}
      }
    });

    connection.onreconnecting(() => {
      if (isMounted) setSignalRConnected(false);
    });

    connection.onclose(() => {
      if (isMounted) setSignalRConnected(false);
    });

    async function startConnection() {
      try {
        await connection.start();
        if (isMounted) {
          setSignalRConnected(true);
          await connection.invoke('JoinOrderGroup', String(orderId));
        }
      } catch {
        if (isMounted) setSignalRConnected(false);
      }
    }

    startConnection();

    return () => {
      isMounted = false;
      if (connection) {
        connection
          .invoke('LeaveOrderGroup', String(orderId))
          .catch(() => {})
          .finally(() => {
            connection.stop().catch(() => {});
          });
      }
    };
  }, [orderId, loadOrder]);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Order #${orderId} - ${order?.restaurantName || 'Menza'}`,
          text: `Track live order and kitchen status for Order #${orderId}`,
          url,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const currentStage = getStepperStage(order?.orderStatus || '', order?.kitchenStatus);
  const isCancelled = currentStage === -1;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#111418] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-[#DE8626] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-[#5C4E3D] dark:text-[#A89F91]">
          Loading live order tracker...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#111418] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#1A1F26] rounded-2xl shadow-xl border border-[#E7E1DA] dark:border-[#2A313C] p-6 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/40 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Order Not Found</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {error || 'Unable to find tracking information for Order #' + orderId}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => loadOrder(true)}
              className="w-full py-3 bg-[#DE8626] hover:bg-[#B84D00] text-white font-medium rounded-xl transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <button
              onClick={() => router.push('/track')}
              className="w-full py-3 bg-gray-100 dark:bg-[#252C37] text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 transition"
            >
              Track Another Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#111418] text-[#1F2937] dark:text-[#F3F4F6] pb-16">
      {/* Top App Bar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#1A1F26]/90 backdrop-blur border-b border-[#E7E1DA] dark:border-[#2A313C] px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/track')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252C37] text-gray-600 dark:text-gray-300 transition"
              title="Track Another"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base md:text-lg text-[#1F2937] dark:text-white">
                  Order #{order.orderId}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-[#FFF0DE] text-[#B84D00] dark:bg-[#342416] dark:text-[#F3A556]">
                  {order.deliveryType || 'Dine-In'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Store className="w-3 h-3 text-[#DE8626]" />
                {order.restaurantName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live SignalR Pulse Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                signalRConnected
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  signalRConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="hidden sm:inline">{signalRConnected ? 'Live' : 'Syncing'}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => loadOrder(true)}
              disabled={refreshing}
              className="p-2 rounded-lg border border-[#E7E1DA] dark:border-[#2A313C] hover:bg-gray-50 dark:hover:bg-[#252C37] text-gray-600 dark:text-gray-300 transition"
              title="Refresh Status"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#DE8626]' : ''}`} />
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="p-2 rounded-lg border border-[#E7E1DA] dark:border-[#2A313C] hover:bg-gray-50 dark:hover:bg-[#252C37] text-gray-600 dark:text-gray-300 transition"
              title="Share Tracking Link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Cancelled Banner */}
        {isCancelled && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-4 flex items-center gap-3 text-red-700 dark:text-red-400">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-sm">Order Cancelled</h3>
              <p className="text-xs text-red-600 dark:text-red-300">
                This order was cancelled. Please speak with the restaurant staff or cashier for assistance.
              </p>
            </div>
          </div>
        )}

        {/* Live Status Highlight Card */}
        <div className="bg-gradient-to-br from-[#FFF0DE] to-[#FFF9F2] dark:from-[#251D14] dark:to-[#1A1F26] border border-[#DE8626]/30 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#DE8626] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Live Kitchen & Order Status
              </span>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white capitalize">
                {order.orderStatus?.replace(/_/g, ' ') || 'Order Placed'}
              </h1>
              {order.kitchenStatus && (
                <p className="text-sm font-medium text-[#5C4E3D] dark:text-[#D1C7BA]">
                  Kitchen status: <span className="text-[#DE8626] font-bold">{order.kitchenStatus}</span>
                </p>
              )}
            </div>

            {/* Table or Token Badge */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto bg-white/80 dark:bg-[#111418]/80 backdrop-blur rounded-xl p-3 border border-[#E7E1DA] dark:border-[#2A313C]">
              {order.tableName ? (
                <>
                  <UtensilsCrossed className="w-5 h-5 text-[#DE8626]" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500">Table</span>
                    <p className="text-base font-extrabold text-gray-900 dark:text-white leading-none">
                      {order.tableName}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Hash className="w-5 h-5 text-[#DE8626]" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500">Token</span>
                    <p className="text-base font-extrabold text-gray-900 dark:text-white leading-none">
                      {order.pickupToken || order.tokenNumber || `#${order.orderId}`}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Stepper Timeline (Only shown if active) */}
          {!isCancelled && (
            <div className="mt-8 pt-6 border-t border-[#DE8626]/20">
              <div className="grid grid-cols-5 gap-1 relative">
                {/* Connecting track line */}
                <div className="absolute top-4 left-6 right-6 h-1 bg-gray-200 dark:bg-gray-700 -z-0" />
                <div
                  className="absolute top-4 left-6 h-1 bg-[#DE8626] transition-all duration-700 -z-0"
                  style={{
                    width: `${Math.min(100, Math.max(0, (currentStage / (STEPS.length - 1)) * 100))}%`,
                  }}
                />

                {STEPS.map((step) => {
                  const isDone = currentStage > step.id;
                  const isCurrent = currentStage === step.id;

                  return (
                    <div key={step.id} className="flex flex-col items-center text-center relative z-10">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-transform duration-300 ${
                          isDone
                            ? 'bg-[#DE8626] text-white shadow-md'
                            : isCurrent
                            ? 'bg-[#DE8626] text-white ring-4 ring-[#DE8626]/30 scale-110 shadow-lg'
                            : 'bg-white dark:bg-[#1A1F26] text-gray-400 border-2 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {isDone ? <Check className="w-4 h-4" /> : step.id + 1}
                      </div>
                      <span
                        className={`text-xs mt-2 font-bold leading-tight ${
                          isCurrent
                            ? 'text-[#DE8626]'
                            : isDone
                            ? 'text-gray-800 dark:text-gray-200'
                            : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="hidden sm:inline text-[10px] text-gray-500 mt-0.5">
                        {step.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Order Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Items Breakdown (2 cols) */}
          <div className="md:col-span-2 bg-white dark:bg-[#1A1F26] rounded-2xl border border-[#E7E1DA] dark:border-[#2A313C] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E1DA] dark:border-[#2A313C]">
              <h2 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#DE8626]" />
                Order Items ({order.items?.length || 0})
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(order.createdDateUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {order.items?.map((item: PublicOrderItemTrackingDTO, idx: number) => (
                <div key={idx} className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">
                        {item.itemName}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        x{item.quantity}
                      </span>
                    </div>
                    {item.cookingInstruction && (
                      <p className="text-xs text-[#B84D00] dark:text-[#F3A556] italic">
                        Note: {item.cookingInstruction}
                      </p>
                    )}
                    <span className="text-xs text-gray-500">
                      ₹{item.unitPrice.toFixed(2)} each
                    </span>
                  </div>

                  <span className="font-bold text-sm text-gray-900 dark:text-white">
                    ₹{item.totalAmount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Bill Summary */}
            <div className="pt-4 border-t border-[#E7E1DA] dark:border-[#2A313C] space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Item Subtotal</span>
                <span className="font-semibold text-gray-900 dark:text-white">₹{order.itemTotal.toFixed(2)}</span>
              </div>
              {order.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Taxes (CGST + SGST)</span>
                  <span className="font-semibold text-gray-900 dark:text-white">₹{order.taxAmount.toFixed(2)}</span>
                </div>
              )}
              {typeof order.discountAmount === 'number' && order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount</span>
                  <span>-₹{order.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-dashed border-[#E7E1DA] dark:border-[#2A313C] text-base font-extrabold text-gray-900 dark:text-white">
                <span>Grand Total</span>
                <span className="text-[#DE8626]">₹{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Payment & Restaurant Info (1 col) */}
          <div className="space-y-6">
            {/* Payment Status Card */}
            <div className="bg-white dark:bg-[#1A1F26] rounded-2xl border border-[#E7E1DA] dark:border-[#2A313C] p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                <CreditCard className="w-4 h-4 text-[#DE8626]" />
                Payment Summary
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Status</span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      order.isSettled || order.paymentStatus?.toUpperCase() === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
                    }`}
                  >
                    {order.isSettled || order.paymentStatus?.toUpperCase() === 'PAID' ? 'PAID' : 'PENDING'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Mode</span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {order.paymentMode || 'Counter / Cash'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total Billed</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    ₹{order.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Restaurant Info Card */}
            <div className="bg-white dark:bg-[#1A1F26] rounded-2xl border border-[#E7E1DA] dark:border-[#2A313C] p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                <Store className="w-4 h-4 text-[#DE8626]" />
                {order.restaurantName}
              </div>

              {(order.address || order.city) && (
                <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{[order.address, order.city, order.state].filter(Boolean).join(', ')}</span>
                </div>
              )}

              {order.contactPhone && (
                <a
                  href={`tel:${order.contactPhone}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#DE8626] text-[#DE8626] hover:bg-[#FFF0DE] dark:hover:bg-[#342416] transition text-xs font-bold"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Restaurant
                </a>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
