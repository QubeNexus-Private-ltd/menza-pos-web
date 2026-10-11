import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Search,
  Receipt,
  TrendingUp,
  Clock,
  User,
  Phone,
  Table as TableIcon,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Calendar,
  Layers,
  Utensils,
  IndianRupee,
  Plus,
  Printer,
  Truck,
  RotateCw,
  Flame,
  Check,
  Smartphone,
  Wallet,
  Tag,
  ChefHat,
} from 'lucide-react-native';
import { formatToIstTime, formatToIstDateTime } from '../../../core/utils/formatters';
import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { OrderMaster, RestaurantTodayRevenue, OrderStatusOption, SettleOrderResponse } from '../../../domain/models/Order';
import { OrderRemoteDataSource } from '../../../data/datasources/OrderRemoteDataSource';
import { RestaurantConfigRemoteDataSource } from '../../../data/datasources/RestaurantConfigRemoteDataSource';
import { usePrinterStore } from '../../state/usePrinterStore';
import { BluetoothPrinterService } from '../../../data/datasources/BluetoothPrinterService';
import { BluetoothPrinterScreen } from '../printer/BluetoothPrinterScreen';
import { useAuthStore } from '../../state/useAuthStore';
import { useNotificationStore } from '../../state/useNotificationStore';
import { ReceiptData } from '../../../core/printer/EscPosBuilder';
import { CashierSettlementModal } from '../../components/CashierSettlementModal';
import { OrderAlertBanner } from '../../components/OrderAlertBanner';
import { onPosOrderStatusChanged } from '../../../core/network/signalrService';
import { logger } from '../../../core/logging';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const orderDataSource = new OrderRemoteDataSource();
const configDataSource = new RestaurantConfigRemoteDataSource();

interface TodayOrdersModalProps {
  visible: boolean;
  onClose: () => void;
  restaurantId: number;
  restaurantName?: string;
  todayRevenue?: number;
  revenueData?: RestaurantTodayRevenue | null;
  onOpenPos?: () => void;
}

export const TodayOrdersModal: React.FC<TodayOrdersModalProps> = ({
  visible,
  onClose,
  restaurantId,
  restaurantName = 'Active Restaurant',
  todayRevenue = 0,
  revenueData,
  onOpenPos,
}) => {
  const { activeRestaurant } = useAuthStore();
  const [orders, setOrders] = useState<OrderMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusTabs, setStatusTabs] = useState<OrderStatusOption[]>([
    { key: 'ALL', label: 'All', category: 'ALL', displayOrder: 0 },
    { key: 'Placed', label: 'Placed', category: 'ACTIVE', displayOrder: 1 },
    { key: 'Confirmed', label: 'Confirmed', category: 'ACTIVE', displayOrder: 2 },
    { key: 'Preparing', label: 'Preparing', category: 'ACTIVE', displayOrder: 3 },
    { key: 'Ready', label: 'Ready', category: 'ACTIVE', displayOrder: 4 },
    { key: 'Served', label: 'Served', category: 'ACTIVE', displayOrder: 5 },
    { key: 'Delivered', label: 'Delivered', category: 'ACTIVE', displayOrder: 6 },
    { key: 'Completed', label: 'Completed', category: 'TERMINAL', displayOrder: 7 },
    { key: 'Cancelled', label: 'Cancelled', category: 'TERMINAL', displayOrder: 8 },
    { key: 'Settled', label: 'Settled', category: 'TERMINAL', displayOrder: 9 },
  ]);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderMaster | null>(null);
  const [settleOrderTarget, setSettleOrderTarget] = useState<OrderMaster | null>(null);
  const [returnToDetailOnClose, setReturnToDetailOnClose] = useState<OrderMaster | null>(null);
  const [storeGstNumber, setStoreGstNumber] = useState<string | null>(null);
  const [storeCgstRate, setStoreCgstRate] = useState<number>(2.5);
  const [storeSgstRate, setStoreSgstRate] = useState<number>(2.5);
  const [printingOrderId, setPrintingOrderId] = useState<string | number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [printerModalVisible, setPrinterModalVisible] = useState<boolean>(false);

  const { connectedDevice, printReceipt, printKot, isPrinting } = usePrinterStore();

  useEffect(() => {
    if (visible) {
      usePrinterStore.getState().init().catch(() => {});
      usePrinterStore.getState().checkStatus().catch(() => {});

      orderDataSource
        .getOrderStatuses()
        .then((statuses) => {
          if (statuses && statuses.length > 0) {
            setStatusTabs(statuses);
          }
        })
        .catch((err) => {
          logger.api('API_ERROR', 'Failed to fetch order statuses from API', { error: err?.message });
        });

      if (restaurantId > 0) {
        configDataSource
          .getConfig(restaurantId)
          .then((cfg) => {
            if (cfg?.gstNumber && cfg.gstNumber.trim().length > 0) {
              setStoreGstNumber(cfg.gstNumber.trim());
            } else {
              setStoreGstNumber(null);
            }
            if (cfg?.cgstPercentage !== undefined && Number(cfg.cgstPercentage) >= 0) {
              setStoreCgstRate(Number(cfg.cgstPercentage));
            }
            if (cfg?.sgstPercentage !== undefined && Number(cfg.sgstPercentage) >= 0) {
              setStoreSgstRate(Number(cfg.sgstPercentage));
            }
          })
          .catch(() => {
            setStoreGstNumber(null);
          });
      }
    }
  }, [visible, restaurantId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const formatTokenNumber = (order?: Partial<OrderMaster> | null): string => {
    if (!order) return '';
    const token = order.pickupToken || (order as any)?.tokenNumber || (order as any)?.TokenNumber;
    if (token) {
      const str = String(token).trim();
      if (str) {
        if (/^TK-/i.test(str)) return str.toUpperCase();
        const num = parseInt(str, 10);
        if (!isNaN(num) && num > 0) return `TK-${String(num).padStart(3, '0')}`;
        return str;
      }
    }
    if (order.id && order.id > 0) {
      return `TK-${String(order.id).slice(-3).padStart(3, '0')}`;
    }
    return '';
  };

  const handlePrintOrderDetail = async (order: OrderMaster) => {
    // 1. Verify or re-establish printer connection
    const printerService = BluetoothPrinterService.getInstance();
    let isConn = await printerService.isConnected();
    if (!isConn) {
      const store = usePrinterStore.getState();
      const reconnected = await store.ensureConnection();
      if (!reconnected) {
        Alert.alert(
          'Printer Not Connected 🖨️',
          'Please connect your mobile thermal printer in Bluetooth Printer Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Connect Printer', onPress: () => setPrinterModalVisible(true) },
          ]
        );
        return;
      }
    }

    try {
      setPrintingOrderId(order.id);
      const targetRestId = order.restaurantId || restaurantId;
      const [fetchedOrderRes, configRes] = await Promise.allSettled([
        orderDataSource.getOrder(order.id),
        targetRestId && targetRestId > 0 ? configDataSource.getConfig(targetRestId) : Promise.reject(),
      ]);

      const fetchedOrder: OrderMaster = fetchedOrderRes.status === 'fulfilled' ? fetchedOrderRes.value : order;
      const storeConfig = configRes.status === 'fulfilled' ? configRes.value : null;

      const effectiveToken = formatTokenNumber(fetchedOrder) || formatTokenNumber(order) || order.pickupToken || String(order.id);

      const rawOrderTotal = (fetchedOrder.totalAmount && fetchedOrder.totalAmount > 0)
        ? fetchedOrder.totalAmount
        : (order.totalAmount && order.totalAmount > 0)
        ? order.totalAmount
        : (fetchedOrder.subtotal && fetchedOrder.subtotal > 0)
        ? fetchedOrder.subtotal
        : (order.subtotal && order.subtotal > 0)
        ? order.subtotal
        : 0;

      const itemsList = (fetchedOrder.items && fetchedOrder.items.length > 0)
        ? fetchedOrder.items
        : (order.items && order.items.length > 0)
        ? order.items
        : [{ itemId: 0, itemName: 'Settled Order Total', quantity: 1, unitPrice: rawOrderTotal, totalPrice: rawOrderTotal }];

      const computedSubtotal = itemsList.reduce((acc, it) => acc + (it.totalPrice ?? (it.quantity * it.unitPrice)), 0);
      const effectiveOrderTotal = rawOrderTotal > 0 ? rawOrderTotal : computedSubtotal;
      const effectiveSubtotal = fetchedOrder.subtotal && fetchedOrder.subtotal > 0 ? fetchedOrder.subtotal : (computedSubtotal > 0 ? computedSubtotal : effectiveOrderTotal);

      const hasGst = Boolean(
        (storeConfig?.gstNumber && storeConfig.gstNumber.trim().length > 0) ||
        (fetchedOrder.gstNumber && fetchedOrder.gstNumber.trim().length > 0) ||
        (fetchedOrder.cgst && fetchedOrder.cgst > 0) ||
        (fetchedOrder.sgst && fetchedOrder.sgst > 0) ||
        (order.cgst && order.cgst > 0) ||
        (order.sgst && order.sgst > 0)
      );

      const effectiveGstNumber = hasGst
        ? (storeConfig?.gstNumber?.trim() || fetchedOrder.gstNumber?.trim())
        : undefined;

      const cgstRate = storeConfig?.cgstPercentage ?? 2.5;
      const sgstRate = storeConfig?.sgstPercentage ?? 2.5;
      const totalGstRate = cgstRate + sgstRate;

      const cgstAmt = hasGst
        ? (fetchedOrder.cgst && fetchedOrder.cgst > 0 ? fetchedOrder.cgst : Number(((effectiveSubtotal * cgstRate) / 100).toFixed(2)))
        : 0;
      const sgstAmt = hasGst
        ? (fetchedOrder.sgst && fetchedOrder.sgst > 0 ? fetchedOrder.sgst : Number(((effectiveSubtotal * sgstRate) / 100).toFixed(2)))
        : 0;
      const totalTaxAmt = cgstAmt + sgstAmt;

      const effectiveAddress = (() => {
        const addr = fetchedOrder.address?.trim() || storeConfig?.address?.trim() || (activeRestaurant as any)?.address?.trim() || '';
        const city = fetchedOrder.city?.trim() || storeConfig?.city?.trim() || (activeRestaurant as any)?.city?.trim() || '';
        const state = fetchedOrder.state?.trim() || storeConfig?.state?.trim() || (activeRestaurant as any)?.state?.trim() || '';

        const parts = [addr, city, state].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : undefined;
      })();

      const receiptData: ReceiptData = {
        orderId: fetchedOrder.id || order.id,
        orderNumber: String(fetchedOrder.orderNumber || fetchedOrder.id || order.id),
        pickupToken: effectiveToken,
        restaurantName: storeConfig?.restaurantName || restaurantName || fetchedOrder.restaurantName || '',
        address: effectiveAddress || undefined,
        contactPhone: storeConfig?.contactNumber || fetchedOrder.contactNumber || fetchedOrder.contactPhone || undefined,
        logoUrl: fetchedOrder.logoUrl || storeConfig?.logoUrl || (activeRestaurant as any)?.logoUrl || undefined,
        gstNumber: effectiveGstNumber,
        customerName: fetchedOrder.customerName || 'Walk-in Customer',
        customerPhone: fetchedOrder.mobileNumber || undefined,
        source: fetchedOrder.source || fetchedOrder.tableName || undefined,
        tableName: fetchedOrder.source || fetchedOrder.tableName || undefined,
        orderType: fetchedOrder.orderTypeName || (fetchedOrder.orderTypeId === 3 ? 'Delivery' : fetchedOrder.orderTypeId === 2 ? 'Takeaway' : 'Dine-In'),
        items: itemsList.map((it) => ({
          itemName: it.itemName || (it as any).name || (it as any).dishName || (it as any).ItemName || 'Item',
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || (it as any).amount || (it as any).price || 0),
          totalPrice: Number(it.totalPrice || (Number(it.quantity || 1) * Number(it.unitPrice || (it as any).amount || (it as any).price || 0))),
          cookingInstruction: it.cookingInstruction,
        })),
        subtotal: effectiveSubtotal,
        cgstAmount: hasGst ? cgstAmt : undefined,
        sgstAmount: hasGst ? sgstAmt : undefined,
        cgstPercentage: hasGst ? cgstRate : undefined,
        sgstPercentage: hasGst ? sgstRate : undefined,
        taxAmount: hasGst ? totalTaxAmt : 0,
        taxPercentage: hasGst ? totalGstRate : 0,
        grandTotal: effectiveOrderTotal,
        date: fetchedOrder.createdAt ? new Date(fetchedOrder.createdAt) : new Date(),
      };

      // 1. Print Customer Bill ONLY (do not print KOT)
      await printReceipt(receiptData);

      Alert.alert(
        'Bill Printed! 🖨️',
        `Tax bill for Token #${effectiveToken || order.orderNumber || order.id} successfully sent to printer.`
      );
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Failed to print bill.');
    } finally {
      setPrintingOrderId(null);
    }
  };

  const handlePrintKot = async (order: OrderMaster) => {
    // 1. Verify or re-establish printer connection
    const printerService = BluetoothPrinterService.getInstance();
    let isConn = await printerService.isConnected();
    if (!isConn) {
      const store = usePrinterStore.getState();
      const reconnected = await store.ensureConnection();
      if (!reconnected) {
        Alert.alert(
          'Printer Not Connected 🖨️',
          'Please connect your mobile thermal printer in Bluetooth Printer Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Connect Printer', onPress: () => setPrinterModalVisible(true) },
          ]
        );
        return;
      }
    }

    try {
      setPrintingOrderId(order.id);
      const targetRestId = order.restaurantId || restaurantId;
      const [fetchedOrderRes, configRes] = await Promise.allSettled([
        orderDataSource.getOrder(order.id),
        targetRestId && targetRestId > 0 ? configDataSource.getConfig(targetRestId) : Promise.reject(),
      ]);

      const fetchedOrder: OrderMaster = fetchedOrderRes.status === 'fulfilled' ? fetchedOrderRes.value : order;
      const storeConfig = configRes.status === 'fulfilled' ? configRes.value : null;

      const effectiveToken =
        formatTokenNumber(fetchedOrder) ||
        formatTokenNumber(order) ||
        order.pickupToken ||
        (order as any).tokenNumber ||
        String(fetchedOrder.id || order.id);

      const rawOrderTotal = (fetchedOrder.totalAmount && fetchedOrder.totalAmount > 0)
        ? fetchedOrder.totalAmount
        : (order.totalAmount && order.totalAmount > 0)
        ? order.totalAmount
        : (fetchedOrder.subtotal && fetchedOrder.subtotal > 0)
        ? fetchedOrder.subtotal
        : (order.subtotal && order.subtotal > 0)
        ? order.subtotal
        : 0;

      const itemsList = (fetchedOrder.items && fetchedOrder.items.length > 0)
        ? fetchedOrder.items
        : (order.items && order.items.length > 0)
        ? order.items
        : [{ itemId: 0, itemName: 'Settled Order Total', quantity: 1, unitPrice: rawOrderTotal, totalPrice: rawOrderTotal }];

      const computedKotSubtotal = itemsList.reduce((acc, it) => acc + (it.totalPrice ?? (it.quantity * it.unitPrice)), 0);
      const effectiveKotTotal = rawOrderTotal > 0 ? rawOrderTotal : computedKotSubtotal;

      const receiptData: ReceiptData = {
        orderId: fetchedOrder.id || order.id,
        orderNumber: String(fetchedOrder.orderNumber || fetchedOrder.id || order.id),
        pickupToken: effectiveToken,
        restaurantName: storeConfig?.restaurantName || restaurantName || fetchedOrder.restaurantName || '',
        customerName: fetchedOrder.customerName || '',
        customerPhone: fetchedOrder.mobileNumber || undefined,
        source: fetchedOrder.source || fetchedOrder.tableName || undefined,
        tableName: fetchedOrder.source || fetchedOrder.tableName || undefined,
        orderType: fetchedOrder.orderTypeName || (fetchedOrder.orderTypeId === 3 ? 'Delivery' : fetchedOrder.orderTypeId === 2 ? 'Takeaway' : 'Dine-In'),
        items: itemsList.map((it) => ({
          itemName: it.itemName || (it as any).name || (it as any).dishName || (it as any).ItemName || 'Item',
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || (it as any).amount || (it as any).price || 0),
          totalPrice: Number(it.totalPrice || (Number(it.quantity || 1) * Number(it.unitPrice || (it as any).amount || (it as any).price || 0))),
          cookingInstruction: it.cookingInstruction,
        })),
        grandTotal: effectiveKotTotal,
        date: fetchedOrder.createdAt ? new Date(fetchedOrder.createdAt) : new Date(),
        isKot: true,
      };

      await printKot(receiptData);
      Alert.alert('KOT Ticket Printed! 🖨️', `Kitchen Order Ticket for Token #${effectiveToken || order.orderNumber || order.id} sent to printer.`);
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Failed to print KOT ticket.');
    } finally {
      setPrintingOrderId(null);
    }
  };

  const handleOrderStatusUpdate = useCallback(
    (orderId: number, newStatus: string, fullOrderData?: Partial<OrderMaster>) => {
      if (!orderId || !newStatus) return;

      const activeFilterUpper = activeFilter.toUpperCase();
      const newStatusUpper = newStatus.toUpperCase();

      const matchesActiveFilter =
        activeFilterUpper === 'ALL' ||
        activeFilterUpper === newStatusUpper ||
        (activeFilterUpper === 'SETTLED' && ['SETTLED', 'COMPLETED', 'PAID'].includes(newStatusUpper)) ||
        (activeFilterUpper === 'COMPLETED' && ['SETTLED', 'COMPLETED'].includes(newStatusUpper));

      setOrders((prev) => {
        const existingIdx = prev.findIndex((o) => o.id === orderId);

        if (existingIdx >= 0) {
          if (matchesActiveFilter) {
            // Status still matches current tab -> update in place
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              ...fullOrderData,
              status: newStatus,
              paymentStatus: ['SETTLED', 'COMPLETED', 'PAID'].includes(newStatusUpper)
                ? 'PAID'
                : (fullOrderData?.paymentStatus || updated[existingIdx].paymentStatus),
            };
            return updated;
          } else {
            // Status changed to another status -> REMOVE from current active tab section!
            setTotalCount((c) => Math.max(0, c - 1));
            return prev.filter((o) => o.id !== orderId);
          }
        } else {
          // If not in current list but matches current filter tab -> prepend to list
          if (matchesActiveFilter && fullOrderData) {
            setTotalCount((c) => c + 1);
            return [
              {
                id: orderId,
                restaurantId,
                customerName: fullOrderData.customerName || 'Walk-in Guest',
                totalAmount: fullOrderData.totalAmount || 0,
                status: newStatus,
                items: fullOrderData.items || [],
                createdAt: fullOrderData.createdAt || new Date().toISOString(),
                ...fullOrderData,
              } as OrderMaster,
              ...prev,
            ];
          }
          return prev;
        }
      });

      // Also update selected detail modal in real time if open
      setSelectedOrderDetail((prev) => {
        if (!prev || prev.id !== orderId) return prev;
        return {
          ...prev,
          ...fullOrderData,
          status: newStatus,
          paymentStatus: ['SETTLED', 'COMPLETED', 'PAID'].includes(newStatusUpper)
            ? 'PAID'
            : (fullOrderData?.paymentStatus || prev.paymentStatus),
        };
      });
    },
    [activeFilter, restaurantId]
  );

  const handleSettlementSuccess = (result: SettleOrderResponse) => {
    useNotificationStore.getState().markOrderAsRead(result.orderId);
    handleOrderStatusUpdate(result.orderId, 'Settled', {
      paymentStatus: 'PAID',
      paymentMode: (result.paymentMode || 'CASH') as any,
      totalAmount: result.totalAmount,
      subtotal: result.orderAmount,
      cgst: result.cgst,
      sgst: result.sgst,
    });
    setSettleOrderTarget(null);
    setReturnToDetailOnClose(null);
    setSelectedOrderDetail(null);
  };

  const handleManualStatusChange = async (orderId: number, nextStatus: string) => {
    if (!orderId || !nextStatus || updatingStatusId === orderId) return;

    try {
      setUpdatingStatusId(orderId);
      const success = await orderDataSource.updateOrderStatus(orderId, nextStatus);
      if (success) {
        handleOrderStatusUpdate(orderId, nextStatus);
      } else {
        Alert.alert('Update Failed', `Could not update Order #${orderId} to ${nextStatus}.`);
      }
    } catch (err: any) {
      Alert.alert('Update Error', err?.message || 'Failed to update order status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleSelectOrder = async (item: OrderMaster) => {
    setSelectedOrderDetail(item);
    try {
      const fetchedOrder = await orderDataSource.getOrder(item.id);
      if (fetchedOrder) {
        setSelectedOrderDetail((prev) => {
          if (!prev || prev.id !== item.id) return prev;
          const freshItems = (fetchedOrder.items && fetchedOrder.items.length > 0)
            ? fetchedOrder.items
            : prev.items;
          return {
            ...prev,
            ...fetchedOrder,
            items: freshItems,
            totalAmount: fetchedOrder.totalAmount || prev.totalAmount,
            subtotal: fetchedOrder.subtotal || prev.subtotal,
            cgst: fetchedOrder.cgst ?? prev.cgst,
            sgst: fetchedOrder.sgst ?? prev.sgst,
            pickupToken: fetchedOrder.pickupToken || prev.pickupToken,
            tokenNumber: fetchedOrder.tokenNumber ?? prev.tokenNumber,
            gstNumber: fetchedOrder.gstNumber || prev.gstNumber,
          };
        });
      }
    } catch {
      // Keep optimistic item if detail fetch fails
    }
  };

  const fetchOrders = useCallback(
    async (page: number = 1, append: boolean = false) => {
      if (!restaurantId || restaurantId <= 0) {
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }
      try {
        if (page === 1 && !append) {
          setLoading(true);
        } else if (append) {
          setLoadingMore(true);
        }

        logger.action(
          'POS',
          'FETCH_TODAY_ORDERS_LIST',
          `Fetching today orders list: rest=#${restaurantId}, filter=${activeFilter}, search="${debouncedSearch}", page=${page}`
        );

        const statusParam = activeFilter === 'ALL' ? undefined : activeFilter;
        const result = await orderDataSource.getTodayOrders(
          restaurantId,
          statusParam,
          page,
          20,
          debouncedSearch
        );

        if (append) {
          setOrders((prev) => {
            const existingIds = new Set(prev.map((o) => o.id));
            const newUniqueItems = result.items.filter((o) => !existingIds.has(o.id));
            return [...prev, ...newUniqueItems];
          });
        } else {
          setOrders(result.items);
        }

        setPageNumber(result.pageNumber);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
        setHasNextPage(result.hasNextPage);
      } catch (err: any) {
        logger.api('API_ERROR', 'Failed to fetch today orders list', { error: err?.message });
        if (!append) {
          setOrders([]);
          setTotalCount(0);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [restaurantId, activeFilter, debouncedSearch]
  );

  useEffect(() => {
    if (visible && restaurantId > 0) {
      setPageNumber(1);
      fetchOrders(1, false);
    }
  }, [visible, restaurantId, activeFilter, debouncedSearch, fetchOrders]);

  // Real-time synchronization of order updates and settlement via SignalR
  useEffect(() => {
    if (!visible) return;

    const unsubscribe = onPosOrderStatusChanged((event: any) => {
      const eventOrderId = Number(event?.orderId ?? event?.id ?? event?.OrderId ?? 0);
      const newStatus = String(
        event?.orderStatus ?? event?.status ?? event?.OrderStatus ?? event?.Status ?? (event?.isSettled ? 'Settled' : '')
      ).trim();

      if (eventOrderId > 0 && newStatus) {
        handleOrderStatusUpdate(eventOrderId, newStatus, {
          customerName: event?.customerName ?? event?.CustomerName,
          totalAmount: Number(event?.totalAmount ?? event?.TotalAmount ?? event?.amount ?? 0),
          tableName: event?.tableName ?? event?.TableName,
          orderTypeName: event?.orderTypeName ?? event?.OrderTypeName,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [visible, handleOrderStatusUpdate]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders(1, false);
  }, [fetchOrders]);

  const handleLoadMore = useCallback(() => {
    if (!loading && !loadingMore && hasNextPage) {
      const nextPage = pageNumber + 1;
      fetchOrders(nextPage, true);
    }
  }, [loading, loadingMore, hasNextPage, pageNumber, fetchOrders]);

  const handleBannerPress = useCallback(async () => {
    fetchOrders(1, false);
    const targetId = useNotificationStore.getState().latestIncomingOrder?.orderId;
    if (targetId && targetId > 0) {
      try {
        const fetched = await orderDataSource.getOrder(targetId);
        if (fetched) {
          handleSelectOrder(fetched);
        }
      } catch {
        // Fail-safe
      }
    }
  }, [fetchOrders, handleSelectOrder]);

  const handleBannerSettle = useCallback((orderData: any) => {
    if (selectedOrderDetail) {
      setSelectedOrderDetail(null);
    }
    setSettleOrderTarget(orderData as OrderMaster);
  }, [selectedOrderDetail]);

  const getStatusColor = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'PAID' || s === 'SERVED' || s === 'SETTLED' || s === 'DELIVERED') return '#17845A';
    if (s === 'PREPARING') return '#2563EB'; 
    if (s === 'READY') return '#0D9488';
    if (s === 'PLACED' || s === 'CONFIRMED') return '#DE8626';
    if (s === 'CANCELLED' || s === 'VOID' || s === 'REJECTED') return '#DC2626';
    return '#DE8626';
  };

  const getStatusBg = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'PAID' || s === 'SERVED' || s === 'SETTLED' || s === 'DELIVERED') return '#E4F5EC';
    if (s === 'PREPARING') return '#EFF6FF';
    if (s === 'READY') return '#ECFDF5';
    if (s === 'PLACED' || s === 'CONFIRMED') return '#FFF0DE';
    if (s === 'CANCELLED' || s === 'VOID' || s === 'REJECTED') return '#FEE2E2';
    return '#FFF0DE';
  };

  const getStatusLabel = (status: string) => {
    if (!status || status.trim() === '') return 'Placed';
    const found = statusTabs.find((t) => t.key.toLowerCase() === status.toLowerCase());
    if (found && found.key !== 'ALL') return found.label;
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'PAID' || s === 'SETTLED') return 'Settled';
    if (s === 'SERVED') return 'Served';
    if (s === 'PREPARING') return 'Preparing';
    if (s === 'READY') return 'Ready';
    if (s === 'PLACED') return 'Placed';
    if (s === 'CONFIRMED') return 'Confirmed';
    if (s === 'DELIVERED') return 'Delivered';
    if (s === 'CANCELLED' || s === 'VOID') return 'Cancelled';
    return status;
  };

  const formattedDate = useMemo(() => {
    if (revenueData?.date) {
      try {
        const d = new Date(revenueData.date);
        return d.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      } catch {
        return revenueData.date;
      }
    }
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [revenueData]);

  const settledCount = Number(revenueData?.completedOrdersCount ?? orders.filter((o) => (o.status || '').toUpperCase() === 'COMPLETED' || (o.status || '').toUpperCase() === 'SETTLED').length);
  const unsettledCount = Number(revenueData?.activeOrdersCount ?? orders.filter((o) => !['COMPLETED', 'SETTLED', 'CANCELLED'].includes((o.status || '').toUpperCase())).length);

  const getFulfillmentInfo = (orderItem: OrderMaster) => {
    const rawType = (orderItem.orderTypeName || '').toLowerCase();
    const isDelivery = orderItem.orderTypeId === 3 || rawType.includes('delivery');
    const isTakeaway = orderItem.orderTypeId === 2 || rawType.includes('takeaway') || rawType.includes('pickup');

    if (isDelivery) {
      return {
        type: 'Delivery',
        label: 'Home Delivery',
        shortLabel: 'Delivery',
        icon: 'delivery' as const,
        subLabel: orderItem.mobileNumber ? `Phone: ${orderItem.mobileNumber}` : 'Doorstep Order',
        badgeBg: '#F3E8FF',
        badgeColor: '#7E22CE',
      };
    }
    if (isTakeaway) {
      return {
        type: 'Takeaway',
        label: 'Takeaway / Pickup',
        shortLabel: orderItem.pickupToken ? `Token #${orderItem.pickupToken}` : 'Takeaway',
        icon: 'takeaway' as const,
        subLabel: orderItem.pickupToken ? `Token #${orderItem.pickupToken}` : 'Self Pickup',
        badgeBg: '#FFF0DE',
        badgeColor: '#D96B14',
      };
    }
    return {
      type: 'Dine-in',
      label: orderItem.tableName ? `Table ${orderItem.tableName}` : 'Dine-in / Counter',
      shortLabel: orderItem.tableName ? `Table ${orderItem.tableName}` : 'Dine-In',
      icon: 'dinein' as const,
      subLabel: orderItem.tableName ? `Table #${orderItem.tableName}` : 'On Premises',
      badgeBg: '#E0F2FE',
      badgeColor: '#0369A1',
    };
  };

  const renderOrderItem = ({ item }: { item: OrderMaster }) => {
    const statusColor = getStatusColor(item.status);
    const statusBg = getStatusBg(item.status);
    const statusLabel = getStatusLabel(item.status);
    const orderTime = item.createdAt
      ? formatToIstTime(item.createdAt)
      : 'Today';
    const fulfill = getFulfillmentInfo(item);
    const tokenDisplay = formatTokenNumber(item);
    const isThisPrinting = printingOrderId === item.id;

    const cardStations = (() => {
      const map = new Map<string, { name: string; color: string }>();
      (item.items || []).forEach((it) => {
        if (it.stationName || it.stationCode) {
          const code = (it.stationCode || 'MAIN').toUpperCase();
          const name = it.stationName || code;
          const color = it.stationBadgeColor || '#DE8626';
          if (!map.has(code)) map.set(code, { name, color });
        }
      });
      return Array.from(map.values());
    })();

    const isUnsettled = !['COMPLETED', 'SETTLED', 'CANCELLED'].includes((item.status || '').toUpperCase());

    const cardTotal = (item.totalAmount && Number(item.totalAmount) > 0)
      ? Number(item.totalAmount)
      : (item.subtotal && Number(item.subtotal) > 0)
      ? Number(item.subtotal)
      : (item.items || []).reduce((acc, it) => acc + (Number(it.totalPrice) || ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0))), 0);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.88}
        onPress={() => handleSelectOrder(item)}
      >
        {/* ROW 1: PRIMARY HEADER - Order #, Token (Left) & Time, Status Pill (Right) */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.orderBadgePill}>
              <Receipt size={12} color="#DE8626" />
              <Text style={styles.orderBadgePillText} numberOfLines={1}>
                #{item.orderNumber || item.id}
              </Text>
            </View>

            {tokenDisplay ? (
              <View style={styles.tokenBadgePill}>
                <Tag size={11} color="#4338CA" />
                <Text style={styles.tokenBadgePillText} numberOfLines={1}>{tokenDisplay}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cardHeaderRight}>
            <View style={styles.timeTag}>
              <Clock size={11} color="#8C7A6B" />
              <Text style={styles.timeTagText} numberOfLines={1}>{orderTime}</Text>
            </View>
            <View style={[styles.statusBadgePill, { backgroundColor: statusBg, borderColor: `${statusColor}40` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusBadgeText, { color: statusColor }]} numberOfLines={1}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {/* ROW 2: FULFILLMENT & STATIONS ROW (Responsive Wrap Row - never collides with header) */}
        <View style={styles.cardTagsRow}>
          <View style={[styles.fulfillmentBadge, { backgroundColor: fulfill.badgeBg }]}>
            {fulfill.icon === 'delivery' ? (
              <Truck size={11} color={fulfill.badgeColor} />
            ) : fulfill.icon === 'takeaway' ? (
              <ShoppingBag size={11} color={fulfill.badgeColor} />
            ) : (
              <Utensils size={11} color={fulfill.badgeColor} />
            )}
            <Text style={[styles.fulfillmentBadgeText, { color: fulfill.badgeColor }]} numberOfLines={1}>
              {fulfill.shortLabel}
            </Text>
          </View>

          {cardStations.map((st, sIdx) => (
            <View
              key={`st-${sIdx}`}
              style={[
                styles.cardStationBadge,
                { backgroundColor: `${st.color}18`, borderColor: `${st.color}40` },
              ]}
            >
              <Text style={[styles.cardStationBadgeText, { color: st.color }]} numberOfLines={1}>
                {st.name}
              </Text>
            </View>
          ))}
        </View>

        {/* ROW 3: CUSTOMER & CONTACT META */}
        <View style={styles.customerMetaRow}>
          <View style={styles.customerBox}>
            <User size={12} color="#8C7A6B" />
            <Text style={styles.customerNameText} numberOfLines={1}>
              {item.customerName || 'Walk-in Guest'}
            </Text>
          </View>
          {item.mobileNumber ? (
            <View style={styles.phoneBox}>
              <Phone size={11} color="#8C7A6B" />
              <Text style={styles.phoneText} numberOfLines={1}>{item.mobileNumber}</Text>
            </View>
          ) : null}
        </View>

        {/* ROW 4: ORDERED ITEMS PREVIEW */}
        {item.items && item.items.length > 0 ? (
          <View style={styles.itemsPillsContainer}>
            {item.items.slice(0, 3).map((it, idx) => (
              <View key={`chip-${item.id}-${idx}`} style={styles.itemChip}>
                <Text style={styles.itemChipQty}>{it.quantity}×</Text>
                <Text style={styles.itemChipName} numberOfLines={1}>
                  {it.itemName}
                </Text>
              </View>
            ))}
            {item.items.length > 3 && (
              <View style={styles.moreItemsChip}>
                <Text style={styles.moreItemsText}>+{item.items.length - 3} more</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* CARD DIVIDER */}
        <View style={styles.cardDivider} />

        {/* ROW 5: BOTTOM BAR - PAYMENT, SETTLE & PRINT ACTIONS & TOTAL */}
        <View style={styles.cardFooterRow}>
          <View style={styles.cardFooterLeft}>
            <View style={styles.paymentTag}>
              <IndianRupee size={10} color="#17845A" strokeWidth={2.5} />
              <Text style={styles.paymentTagText} numberOfLines={1}>
                {item.paymentMode || 'CASH'}
              </Text>
            </View>

            {isUnsettled && (
              <TouchableOpacity
                style={styles.cardSettleBtn}
                onPress={() => {
                  setReturnToDetailOnClose(null);
                  setSettleOrderTarget(item);
                }}
                activeOpacity={0.8}
              >
                <IndianRupee size={11} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.cardSettleBtnText}>Settle</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.cardFooterRight}>
            <TouchableOpacity
              style={styles.quickPrintIconBtn}
              onPress={() => handlePrintOrderDetail(item)}
              disabled={isPrinting}
              activeOpacity={0.75}
            >
              {isThisPrinting ? (
                <ActivityIndicator size="small" color="#DE8626" />
              ) : (
                <Printer size={13} color="#DE8626" />
              )}
            </TouchableOpacity>

            <View style={styles.totalAmountBox}>
              <View style={styles.totalAmountTextCol}>
                <Text style={styles.totalAmountLabel}>
                  {['COMPLETED', 'SETTLED'].includes((item.status || '').toUpperCase()) ? 'Settled' : 'Payable'}
                </Text>
                <Text style={styles.totalAmountValue} numberOfLines={1}>
                  ₹{cardTotal.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <ChevronRight size={14} color="#8C7A6B" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

        <View style={styles.container}>
          {/* 1. UNIFIED LUXURY TOP HEADER */}
          <View style={styles.topHeader}>
            <View style={styles.headerLeftContainer}>
              <Image
                source={
                  activeRestaurant?.logoUrl && activeRestaurant.logoUrl.trim().length > 0
                    ? { uri: activeRestaurant.logoUrl.trim() }
                    : (activeRestaurant as any)?.logo && (activeRestaurant as any).logo.trim().length > 0
                    ? { uri: (activeRestaurant as any).logo.trim() }
                    : require('../../../../assets/menza-logo.png')
                }
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  Today's Revenue Orders
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {restaurantName} • {formattedDate}
                </Text>
              </View>
            </View>

            <View style={styles.headerRightRow}>
              {onOpenPos && (
                <TouchableOpacity
                  style={styles.headerPosBtn}
                  onPress={() => {
                    onClose();
                    onOpenPos();
                  }}
                  activeOpacity={0.85}
                >
                  <Plus size={13} color="#FFFFFF" strokeWidth={3} />
                  <Text style={styles.headerPosBtnText}>POS Bill</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.headerPrinterBtn, connectedDevice ? styles.headerPrinterBtnConnected : null]}
                onPress={() => setPrinterModalVisible(true)}
                activeOpacity={0.75}
                accessibilityLabel={connectedDevice ? 'Printer Connected' : 'Connect Printer'}
              >
                <Printer size={15} color={connectedDevice ? '#10B981' : '#F59E0B'} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={styles.headerCloseBtn}
                activeOpacity={0.75}
              >
                <X size={18} color="#8C7A6B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. GRAND BENTO REVENUE TELEMETRY BANNER */}
          <View style={styles.revenueBentoContainer}>
            <View style={styles.revenueMainCard}>
              <LinearGradient
                colors={['#2D2319', '#3D2F20', '#1F1811']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.revenueMainGradient}
              >
                <View style={styles.revenueMainTopRow}>
                  <View style={styles.salesBeaconBadge}>
                    <View style={styles.salesBeaconDot} />
                    <Text style={styles.salesBeaconText} numberOfLines={1}>LIVE SETTLED REVENUE</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.refreshIconBtn}
                    onPress={() => fetchOrders(1, false)}
                    activeOpacity={0.75}
                  >
                    <RotateCw size={13} color="#FEA619" />
                  </TouchableOpacity>
                </View>

                <View style={styles.revenueAmountRow}>
                  <Text style={styles.revenueCurrency}>₹</Text>
                  <Text
                    style={styles.revenueGrandAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {todayRevenue.toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={styles.revenueTelemetryRow}>
                  {/* Settled Orders */}
                  <View style={styles.telemetryItem}>
                    <Text style={styles.telemetryLabel} numberOfLines={1}>SETTLED ORDERS</Text>
                    <Text style={[styles.telemetryValue, { color: '#34D399' }]} numberOfLines={1}>{settledCount}</Text>
                  </View>

                  <View style={styles.telemetryDivider} />

                  {/* Unsettled Orders */}
                  <View style={styles.telemetryItem}>
                    <Text style={styles.telemetryLabel} numberOfLines={1}>UNSETTLED ORDERS</Text>
                    <Text style={[styles.telemetryValue, { color: '#FBBF24' }]} numberOfLines={1}>{unsettledCount}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* 3. SEARCH INPUT BAR */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchInnerBox}>
              <Search size={16} color="#DE8626" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by order #, table, customer, dish..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                  <X size={14} color="#8C7A6B" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 4. DYNAMIC FILTER STATUS TABS */}
          <View style={styles.filterTabsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterTabsScrollContent}
              style={styles.filterTabsScrollView}
            >
              {statusTabs.map((tab) => {
                const isActive = activeFilter.toLowerCase() === tab.key.toLowerCase();
                const tabCountLabel = isActive && totalCount > 0 ? ` (${totalCount})` : '';

                return (
                  <TouchableOpacity
                    key={`filter-tab-${tab.key}`}
                    style={[styles.filterTabPill, isActive && styles.filterTabPillActive]}
                    onPress={() => setActiveFilter(tab.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                      {tab.label}{tabCountLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 5. ORDER CARDS LIST / SKELETON / EMPTY STATE */}
          {loading && !refreshing && orders.length === 0 ? (
            <View style={styles.skeletonListContainer}>
              {[1, 2, 3, 4].map((idx) => (
                <View key={`skel-order-${idx}`} style={styles.orderCardSkeleton}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                    <SkeletonLoader width={90} height={18} borderRadius={6} />
                    <SkeletonLoader width={70} height={18} borderRadius={10} />
                  </View>
                  <SkeletonLoader width="50%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
                  <SkeletonLoader width="85%" height={12} borderRadius={4} style={{ marginBottom: 12 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <SkeletonLoader width={60} height={18} borderRadius={6} />
                    <SkeletonLoader width={90} height={20} borderRadius={6} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderOrderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#DE8626"
                  colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                />
              }
              ListHeaderComponent={
                totalCount > 0 ? (
                  <View style={styles.listHeaderRow}>
                    <Text style={styles.listHeaderText}>
                      Showing {orders.length} of {totalCount} orders • Page {pageNumber} of {totalPages || 1}
                    </Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoaderBox}>
                    <ActivityIndicator size="small" color="#DE8626" />
                    <Text style={styles.footerLoaderText}>Loading more orders...</Text>
                  </View>
                ) : orders.length > 0 && !hasNextPage ? (
                  <View style={styles.footerEndBox}>
                    <Text style={styles.footerEndText}>✓ All {totalCount} orders loaded for today</Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>
                    {searchQuery.length > 0
                      ? 'No Matching Orders'
                      : activeFilter.toUpperCase() === 'ALL'
                      ? 'No Orders Found Today'
                      : `No ${getStatusLabel(activeFilter)} Orders Found`}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery.length > 0
                      ? 'Try searching with another order number, table, customer name, or dish.'
                      : activeFilter.toUpperCase() === 'ALL'
                      ? `Today's revenue is ₹${todayRevenue.toLocaleString('en-IN')}. New orders placed via POS or QR Code will appear in real-time.`
                      : `There are currently no orders with "${getStatusLabel(activeFilter)}" status today. Orders will automatically appear here when their status updates.`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      style={styles.emptyRefreshBtn}
                      onPress={() => fetchOrders(1, false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.emptyRefreshBtnText}>Refresh Feed</Text>
                    </TouchableOpacity>
                    {onOpenPos ? (
                      <TouchableOpacity
                        style={styles.emptyPosBtn}
                        onPress={() => {
                          onClose();
                          onOpenPos();
                        }}
                        activeOpacity={0.85}
                      >
                        <Plus size={14} color="#FFFFFF" strokeWidth={3} />
                        <Text style={styles.emptyPosBtnText}>Punch POS Order</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              }
            />
          )}
        </View>

        {/* 6. ORDER RECEIPT DETAIL SUB-MODAL */}
        {selectedOrderDetail && (
          <Modal
            visible={Boolean(selectedOrderDetail)}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setSelectedOrderDetail(null)}
          >
            <View style={styles.detailModalOverlay}>
              <View style={styles.detailModalCard}>
                {/* Header */}
                <View style={styles.detailHeader}>
                  <View style={styles.detailHeaderLeft}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.detailOrderNumber} numberOfLines={1}>
                          Order #{selectedOrderDetail.orderNumber || selectedOrderDetail.id}
                        </Text>
                        {formatTokenNumber(selectedOrderDetail) ? (
                          <View style={styles.detailTokenBadge}>
                            <Tag size={12} color="#4338CA" />
                            <Text style={styles.detailTokenBadgeText} numberOfLines={1}>
                              {formatTokenNumber(selectedOrderDetail)}
                            </Text>
                          </View>
                        ) : null}
                        <View
                          style={[
                            styles.statusBadgePill,
                            {
                              borderColor: `${getStatusColor(selectedOrderDetail.status)}40`,
                              backgroundColor: getStatusBg(selectedOrderDetail.status),
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              { backgroundColor: getStatusColor(selectedOrderDetail.status) },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: getStatusColor(selectedOrderDetail.status) },
                            ]}
                            numberOfLines={1}
                          >
                            {getStatusLabel(selectedOrderDetail.status)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.detailDateRow}>
                        <Clock size={11} color="#8C7A6B" />
                        <Text style={styles.detailOrderDate} numberOfLines={1}>
                          {selectedOrderDetail.createdAt
                            ? formatToIstDateTime(selectedOrderDetail.createdAt)
                            : 'Today'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedOrderDetail(null)}
                    style={styles.detailCloseBtn}
                    activeOpacity={0.75}
                  >
                    <X size={18} color="#8C7A6B" />
                  </TouchableOpacity>
                </View>

                {/* Scrollable Order Detail Body */}
                <ScrollView
                  style={styles.detailBodyScroll}
                  contentContainerStyle={styles.detailBodyScrollContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >

                {/* Metadata Bento Grid (Customer, Fulfillment, Payment, Token) */}
                <View style={styles.detailMetaGrid}>
                  <View style={styles.detailMetaCard}>
                    <View style={styles.detailMetaIconBox}>
                      <User size={13} color="#DE8626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailMetaCardLabel}>Customer</Text>
                      <Text style={styles.detailMetaCardValue} numberOfLines={1}>
                        {selectedOrderDetail.customerName || 'Walk-in Guest'}
                      </Text>
                      {selectedOrderDetail.mobileNumber ? (
                        <Text style={styles.detailMetaCardSubValue} numberOfLines={1}>
                          {selectedOrderDetail.mobileNumber}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {(() => {
                    const fulfill = getFulfillmentInfo(selectedOrderDetail);
                    return (
                      <View style={styles.detailMetaCard}>
                        <View style={styles.detailMetaIconBox}>
                          {fulfill.icon === 'delivery' ? (
                            <Truck size={13} color="#DE8626" />
                          ) : fulfill.icon === 'takeaway' ? (
                            <ShoppingBag size={13} color="#DE8626" />
                          ) : (
                            <TableIcon size={13} color="#DE8626" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailMetaCardLabel}>Channel</Text>
                          <Text style={styles.detailMetaCardValue} numberOfLines={1}>
                            {fulfill.label}
                          </Text>
                          <Text style={styles.detailMetaCardSubValue} numberOfLines={1}>
                            {fulfill.subLabel}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  <View style={styles.detailMetaCard}>
                    <View style={styles.detailMetaIconBox}>
                      <IndianRupee size={13} color="#17845A" strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailMetaCardLabel}>Payment</Text>
                      <Text style={styles.detailMetaCardValue}>
                        {selectedOrderDetail.paymentMode || 'CASH'}
                      </Text>
                      <Text
                        style={[
                          styles.detailMetaCardSubValue,
                          {
                            color:
                              (selectedOrderDetail.paymentStatus || '').toUpperCase() === 'PAID'
                                ? '#17845A'
                                : '#DE8626',
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {(selectedOrderDetail.paymentStatus || 'PAID').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {formatTokenNumber(selectedOrderDetail) ? (
                    <View style={styles.detailMetaCard}>
                      <View style={[styles.detailMetaIconBox, { backgroundColor: '#EEF2FF' }]}>
                        <Tag size={13} color="#4338CA" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailMetaCardLabel}>Daily Token</Text>
                        <Text style={[styles.detailMetaCardValue, { color: '#4338CA', fontWeight: '800' }]} numberOfLines={1}>
                          {formatTokenNumber(selectedOrderDetail)}
                        </Text>
                        <Text style={styles.detailMetaCardSubValue} numberOfLines={1}>
                          Queue Sequence
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {(() => {
                    const detailStations = Array.from(
                      new Set(
                        (selectedOrderDetail.items || [])
                          .map((i) => i.stationName || i.stationCode)
                          .filter(Boolean)
                      )
                    );
                    if (detailStations.length === 0) return null;
                    return (
                      <View style={styles.detailMetaCard}>
                        <View style={[styles.detailMetaIconBox, { backgroundColor: '#FFF0DE' }]}>
                          <ChefHat size={13} color="#DE8626" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailMetaCardLabel}>Kitchen Station</Text>
                          <Text style={[styles.detailMetaCardValue, { color: '#DE8626', fontWeight: '700' }]} numberOfLines={1}>
                            {detailStations.join(', ')}
                          </Text>
                          <Text style={styles.detailMetaCardSubValue} numberOfLines={1}>
                            Preparation Route
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>

                {/* ORDERED ITEMS - CLEAR RECEIPT STYLE */}
                <View style={styles.detailSectionHeader}>
                  <View style={styles.detailSectionHeaderLeft}>
                    <View style={styles.detailSectionIcon}>
                      <Utensils size={14} color="#DE8626" />
                    </View>
                    <View>
                      <Text style={styles.detailSectionTitle}>Ordered Items</Text>
                      <Text style={styles.detailSectionSubtitle}>Itemized order summary</Text>
                    </View>
                  </View>
                  <View style={styles.detailItemCountBadge}>
                    <Text style={styles.detailItemCountBadgeText}>
                      {(selectedOrderDetail.items || []).reduce((acc, i) => acc + (i.quantity || 1), 0)} items
                    </Text>
                  </View>
                </View>

                <View style={styles.detailItemsCard}>
                  <View style={styles.detailItemsColumnHeader}>
                    <Text style={[styles.detailItemsColumnText, styles.detailItemNameColumn]}>ITEM</Text>
                    <Text style={[styles.detailItemsColumnText, styles.detailItemQtyColumn]}>QTY</Text>
                    <Text style={[styles.detailItemsColumnText, styles.detailItemPriceColumn]}>PRICE</Text>
                    <Text style={[styles.detailItemsColumnText, styles.detailItemTotalColumn]}>TOTAL</Text>
                  </View>

                  <ScrollView
                    style={styles.detailItemsScroll}
                    contentContainerStyle={styles.detailItemsScrollContent}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled
                  >
                    {selectedOrderDetail.items && selectedOrderDetail.items.length > 0 ? (
                      selectedOrderDetail.items.map((it, idx) => {
                        const itemUnitPrice = Number(it.unitPrice) ||
                          (Number(it.totalPrice) && Number(it.quantity)
                            ? Number(it.totalPrice) / Number(it.quantity) : 0);
                        const itemTotalPrice = Number(it.totalPrice) ||
                          ((Number(it.quantity) || 1) * itemUnitPrice);
                        const hasOrderLevelGst = Boolean(
                          (selectedOrderDetail.cgst && Number(selectedOrderDetail.cgst) > 0) ||
                          (selectedOrderDetail.sgst && Number(selectedOrderDetail.sgst) > 0) ||
                          (selectedOrderDetail.gstNumber && selectedOrderDetail.gstNumber.trim().length > 0) ||
                          (storeGstNumber && storeGstNumber.trim().length > 0) ||
                          (storeCgstRate > 0 || storeSgstRate > 0)
                        );
                        const hasItemGst = Boolean(
                          (it.gstRate && it.gstRate > 0) ||
                          (it.gstAmount && it.gstAmount > 0) || hasOrderLevelGst
                        );

                        return (
                          <View key={`detail-item-${idx}`} style={[
                            styles.detailItemRow,
                            idx % 2 === 1 && styles.detailItemRowAlt,
                          ]}>
                            <View style={styles.detailItemMain}>
                              <View style={styles.detailItemInfo}>
                                <Text style={styles.detailItemName} numberOfLines={2}>
                                  {it.itemName || 'Item'}
                                </Text>
                                <View style={styles.detailItemMetaRow}>
                                  <Text style={styles.detailItemUnitPrice}>
                                    ₹{itemUnitPrice.toFixed(2)} each
                                  </Text>
                                  {hasItemGst ? (
                                    <View style={styles.itemGstBadge}>
                                      <Text style={styles.itemGstBadgeText}>
                                        {it.gstRate ? `${it.gstRate}% GST` : 'Incl. GST'}
                                      </Text>
                                    </View>
                                  ) : null}
                                  {(it.stationName || it.stationCode) ? (
                                    <View style={[
                                      styles.itemStationTag,
                                      {
                                        backgroundColor: `${it.stationBadgeColor || '#DE8626'}18`,
                                        borderColor: it.stationBadgeColor || '#DE8626',
                                      },
                                    ]}>
                                      <Text style={[
                                        styles.itemStationTagText,
                                        { color: it.stationBadgeColor || '#DE8626' },
                                      ]} numberOfLines={1}>
                                        {it.stationName || it.stationCode}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                                {it.cookingInstruction ? (
                                  <View style={styles.detailCookingNoteBox}>
                                    <Text style={styles.detailCookingNote}>
                                      Note: {it.cookingInstruction}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>

                            <View style={styles.detailItemQtyColumn}>
                              <View style={styles.itemQtyCircle}>
                                <Text style={styles.itemQtyText}>{it.quantity || 1}</Text>
                              </View>
                            </View>

                            <View style={styles.detailItemPriceColumn}>
                              <Text style={styles.detailItemPriceValue} numberOfLines={1}
                                adjustsFontSizeToFit minimumFontScale={0.8}>
                                ₹{itemUnitPrice.toFixed(2)}
                              </Text>
                            </View>

                            <View style={styles.detailItemTotalColumn}>
                              <Text style={styles.detailItemTotal} numberOfLines={1}
                                adjustsFontSizeToFit minimumFontScale={0.75}>
                                ₹{itemTotalPrice.toFixed(2)}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <View style={styles.noItemsContainer}>
                        <Utensils size={18} color="#B8AA9B" />
                        <Text style={styles.noItemsText}>
                          Order items recorded via POS billing ticket
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>

                {/* GST & Tax Calculation Card & Grand Total */}
                {(() => {
                  const effectiveGstNumber = (selectedOrderDetail.gstNumber || storeGstNumber || '').trim();
                  const rawCgst = Number(selectedOrderDetail.cgst ?? 0);
                  const rawSgst = Number(selectedOrderDetail.sgst ?? 0);
                  const rawSubtotal = Number(selectedOrderDetail.subtotal ?? 0);

                  const itemsCalculatedTotal = (selectedOrderDetail.items || []).reduce(
                    (acc, it) => acc + (Number(it.totalPrice) || ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0))),
                    0
                  );

                  const rawTotal = (selectedOrderDetail.totalAmount && Number(selectedOrderDetail.totalAmount) > 0)
                    ? Number(selectedOrderDetail.totalAmount)
                    : (selectedOrderDetail.subtotal && Number(selectedOrderDetail.subtotal) > 0)
                    ? Number(selectedOrderDetail.subtotal)
                    : itemsCalculatedTotal;

                  const hasExplicitGst = rawCgst > 0 || rawSgst > 0;
                  const hasTaxDelta = rawSubtotal > 0 && rawTotal > rawSubtotal && (rawTotal - rawSubtotal) > 0.05;
                  const hasGstin = effectiveGstNumber.length > 0;
                  const hasConfiguredGst = (storeCgstRate > 0 || storeSgstRate > 0);

                  // GST is available if order has CGST/SGST, or bill delta has tax, or GSTIN exists, or store has GST configured
                  const hasGst = hasExplicitGst || hasTaxDelta || hasGstin || (hasConfiguredGst && rawTotal > 0);

                  let effectiveCgstRate = storeCgstRate > 0 ? storeCgstRate : 2.5;
                  let effectiveSgstRate = storeSgstRate > 0 ? storeSgstRate : 2.5;
                  let totalGstRate = Number((effectiveCgstRate + effectiveSgstRate).toFixed(1));

                  let calcSubtotal = rawSubtotal > 0 ? rawSubtotal : (itemsCalculatedTotal > 0 ? itemsCalculatedTotal : rawTotal);
                  let calcCgst = rawCgst;
                  let calcSgst = rawSgst;

                  if (hasGst) {
                    if (calcCgst > 0 || calcSgst > 0) {
                      if (calcSubtotal === 0 || calcSubtotal === rawTotal) {
                        calcSubtotal = Number(Math.max(0, rawTotal - (calcCgst + calcSgst)).toFixed(2));
                      }
                      if (calcSubtotal > 0) {
                        effectiveCgstRate = Number(((calcCgst / calcSubtotal) * 100).toFixed(1));
                        effectiveSgstRate = Number(((calcSgst / calcSubtotal) * 100).toFixed(1));
                        totalGstRate = Number((effectiveCgstRate + effectiveSgstRate).toFixed(1));
                      }
                    } else if (hasTaxDelta) {
                      const taxDelta = rawTotal - rawSubtotal;
                      calcCgst = Number((taxDelta / 2).toFixed(2));
                      calcSgst = Number((taxDelta - calcCgst).toFixed(2));
                      calcSubtotal = rawSubtotal;
                      if (calcSubtotal > 0) {
                        effectiveCgstRate = Number(((calcCgst / calcSubtotal) * 100).toFixed(1));
                        effectiveSgstRate = Number(((calcSgst / calcSubtotal) * 100).toFixed(1));
                        totalGstRate = Number((effectiveCgstRate + effectiveSgstRate).toFixed(1));
                      }
                    } else if (rawTotal > 0) {
                      // Inclusive GST breakdown (e.g. 5% GST included)
                      calcSubtotal = Number((rawTotal / (1 + totalGstRate / 100)).toFixed(2));
                      const totalTax = Number(Math.max(0, rawTotal - calcSubtotal).toFixed(2));
                      calcCgst = Number((totalTax / 2).toFixed(2));
                      calcSgst = Number((totalTax - calcCgst).toFixed(2));
                    }
                  }

                  const displayGrandTotal = rawTotal > 0
                    ? rawTotal
                    : (hasGst ? calcSubtotal + calcCgst + calcSgst : calcSubtotal);

                  return (
                    <>
                      <View style={styles.detailTaxContainer}>
                        {hasGst ? (
                          <>
                            <View style={styles.detailGstHeaderRow}>
                              <View style={styles.detailGstBadge}>
                                <Text style={styles.detailGstBadgeText}>
                                  {effectiveGstNumber ? `GSTIN: ${effectiveGstNumber}` : 'GST INVOICE'}
                                </Text>
                              </View>
                              <Text style={styles.detailGstRateText}>
                                {totalGstRate}% GST ({effectiveCgstRate}% CGST + {effectiveSgstRate}% SGST)
                              </Text>
                            </View>

                            <View style={styles.detailBreakdownRow}>
                              <Text style={styles.detailBreakdownLabel} numberOfLines={1}>Subtotal (Taxable Amount)</Text>
                              <Text style={styles.detailBreakdownValue}>₹{calcSubtotal.toFixed(2)}</Text>
                            </View>

                            <View style={styles.detailBreakdownRow}>
                              <Text style={styles.detailBreakdownLabel} numberOfLines={1}>Central GST (CGST @ {effectiveCgstRate}%)</Text>
                              <Text style={styles.detailBreakdownValue}>₹{calcCgst.toFixed(2)}</Text>
                            </View>

                            <View style={styles.detailBreakdownRow}>
                              <Text style={styles.detailBreakdownLabel} numberOfLines={1}>State GST (SGST @ {effectiveSgstRate}%)</Text>
                              <Text style={styles.detailBreakdownValue}>₹{calcSgst.toFixed(2)}</Text>
                            </View>

                            <View
                              style={[
                                styles.detailBreakdownRow,
                                {
                                  marginTop: 4,
                                  paddingTop: 6,
                                  borderTopWidth: 1,
                                  borderTopColor: '#E7E1DA',
                                },
                              ]}
                            >
                              <Text style={[styles.detailBreakdownLabel, { fontWeight: '700', color: '#1F2937' }]} numberOfLines={1}>
                                Total GST Taxes ({totalGstRate}%)
                              </Text>
                              <Text style={[styles.detailBreakdownValue, { fontWeight: '700', color: '#DE8626' }]}>
                                ₹{(calcCgst + calcSgst).toFixed(2)}
                              </Text>
                            </View>
                          </>
                        ) : (
                          <View style={styles.detailNoGstRow}>
                            <View style={styles.detailBreakdownRow}>
                              <Text style={styles.detailBreakdownLabel} numberOfLines={1}>Total Item Amount</Text>
                              <Text style={styles.detailBreakdownValue}>₹{rawTotal.toFixed(2)}</Text>
                            </View>
                            <Text style={styles.detailInclTaxesNote}>• Price is inclusive of all applicable taxes</Text>
                          </View>
                        )}
                      </View>

                      {/* Grand Total Bar */}
                      <View style={styles.detailGrandTotalBar}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.detailGrandTotalLabel} numberOfLines={1}>GRAND TOTAL</Text>
                          {hasGst ? (
                            <Text style={styles.detailGrandTotalSubLabel} numberOfLines={1}>
                              Tax Invoice Total (Incl. {totalGstRate}% GST)
                            </Text>
                          ) : (
                            <Text style={styles.detailGrandTotalSubLabel} numberOfLines={1}>Inclusive of all taxes</Text>
                          )}
                        </View>
                        <Text
                          style={styles.detailGrandTotalAmount}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          ₹{displayGrandTotal.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Text>
                      </View>
                    </>
                  );
                })()}

                {/* Quick Status Workflow Changer */}
                {!['SETTLED', 'COMPLETED'].includes((selectedOrderDetail.status || '').toUpperCase()) && (
                  <View style={styles.detailWorkflowContainer}>
                    <Text style={styles.detailWorkflowTitle}>Change Order / Kitchen Status:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailWorkflowScroll}>
                      {['Confirmed', 'Preparing', 'Ready', 'Served', 'Cancelled'].map((st) => {
                        const isCurrent = (selectedOrderDetail.status || '').toLowerCase() === st.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={`workflow-btn-${st}`}
                            style={[
                              styles.detailWorkflowBtn,
                              isCurrent && styles.detailWorkflowBtnCurrent,
                              updatingStatusId === selectedOrderDetail.id && { opacity: 0.6 }
                            ]}
                            disabled={isCurrent || updatingStatusId === selectedOrderDetail.id}
                            onPress={() => handleManualStatusChange(selectedOrderDetail.id, st)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.detailWorkflowBtnText, isCurrent && styles.detailWorkflowBtnTextCurrent]}>
                              {isCurrent ? `✓ ${st}` : st}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                </ScrollView>

                {/* Action Buttons: Settle Order, Print Receipt, Print KOT & Close */}
                {(() => {
                  const detailTotal = (selectedOrderDetail.totalAmount && Number(selectedOrderDetail.totalAmount) > 0)
                    ? Number(selectedOrderDetail.totalAmount)
                    : (selectedOrderDetail.subtotal && Number(selectedOrderDetail.subtotal) > 0)
                    ? Number(selectedOrderDetail.subtotal)
                    : (selectedOrderDetail.items || []).reduce(
                        (acc, it) => acc + (Number(it.totalPrice) || ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0))),
                        0
                      );
                  const isUnsettled = !['COMPLETED', 'SETTLED', 'CANCELLED'].includes((selectedOrderDetail.status || '').toUpperCase());

                  return (
                    <View style={styles.detailActionsContainer}>
                      {isUnsettled && (
                        <TouchableOpacity
                          style={styles.detailSettlePrimaryBtn}
                          onPress={() => {
                            const target = selectedOrderDetail;
                            setReturnToDetailOnClose(target);
                            setSelectedOrderDetail(null);
                            setSettleOrderTarget(target);
                          }}
                          activeOpacity={0.85}
                        >
                          <IndianRupee size={15} color="#FFFFFF" strokeWidth={2.5} />
                          <Text style={styles.detailSettlePrimaryBtnText} numberOfLines={1}>
                            Settle Order • ₹{detailTotal.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.detailSecondaryActionsRow}>
                        <TouchableOpacity
                          style={styles.detailPrintBtn}
                          onPress={() => handlePrintOrderDetail(selectedOrderDetail)}
                          disabled={isPrinting}
                          activeOpacity={0.85}
                        >
                          {isPrinting ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Printer size={14} color="#FFFFFF" strokeWidth={2.2} />
                              <Text style={styles.detailPrintBtnText} numberOfLines={1}>Print Bill</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.detailKotBtn}
                          onPress={() => handlePrintKot(selectedOrderDetail)}
                          disabled={isPrinting}
                          activeOpacity={0.85}
                        >
                          {isPrinting ? (
                            <ActivityIndicator size="small" color="#DE8626" />
                          ) : (
                            <>
                              <Printer size={14} color="#DE8626" strokeWidth={2.2} />
                              <Text style={styles.detailKotBtnText} numberOfLines={1}>Print KOT</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.detailDoneBtn}
                          onPress={() => setSelectedOrderDetail(null)}
                          activeOpacity={0.88}
                        >
                          <Text style={styles.detailDoneBtnText} numberOfLines={1}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })()}
              </View>
            </View>

            {/* Real-time Alert Banner visible while inspecting order details */}
            <OrderAlertBanner
              onPress={handleBannerPress}
              onSettleOrder={handleBannerSettle}
            />
          </Modal>
        )}

        {/* 7. CASHIER SETTLEMENT MODAL */}
        <CashierSettlementModal
          visible={Boolean(settleOrderTarget)}
          order={settleOrderTarget}
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          onClose={() => {
            const prev = returnToDetailOnClose;
            setReturnToDetailOnClose(null);
            setSettleOrderTarget(null);
            if (prev) {
              setSelectedOrderDetail(prev);
            }
          }}
          onSettlementSuccess={handleSettlementSuccess}
        />

        {/* 8. BLUETOOTH PRINTER MODAL */}
        <Modal visible={printerModalVisible} animationType="slide">
          <BluetoothPrinterScreen
            onClose={() => {
              setPrinterModalVisible(false);
              usePrinterStore.getState().checkStatus();
            }}
          />
        </Modal>

        {/* 9. REAL-TIME FLOATING ORDER ALERT BANNER */}
        <OrderAlertBanner
          onPress={handleBannerPress}
          onSettleOrder={handleBannerSettle}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },

  /* 1. TOP HEADER */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: '#FAF7F2',
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(224, 135, 38, 0.3)',
  },
  headerTitle: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: '#8C7A6B',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  headerPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DE8626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  headerPosBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerPrinterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPrinterBtnConnected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 2. REVENUE BENTO BANNER */
  revenueBentoContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 6,
  },
  revenueMainCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
  },
  revenueMainGradient: {
    padding: 14,
    borderRadius: 16,
  },
  revenueMainTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  salesBeaconBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  salesBeaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  salesBeaconText: {
    color: '#E5E7EB',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  refreshIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(254, 166, 25, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 10,
  },
  revenueCurrency: {
    color: '#FEA619',
    fontSize: 22,
    fontWeight: '800',
  },
  revenueGrandAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  revenueTelemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryLabel: {
    color: '#D1D5DB',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  telemetryValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  telemetryDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  /* 3. SEARCH BAR */
  searchBarContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  searchInnerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#1F2937',
    fontSize: 12.5,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },

  /* 4. FILTER TABS */
  filterTabsWrapper: {
    marginVertical: 4,
  },
  filterTabsScrollView: {
    flexGrow: 0,
  },
  filterTabsScrollContent: {
    paddingHorizontal: Spacing.md,
    gap: 6,
    paddingBottom: 4,
  },
  filterTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  filterTabPillActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#5C4E3D',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* 5. ORDER CARDS LIST */
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 10,
  },
  listHeaderRow: {
    paddingVertical: 4,
    marginBottom: 2,
  },
  listHeaderText: {
    color: '#8C7A6B',
    fontSize: 11,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexShrink: 1,
    marginRight: 6,
  },
  orderBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 1,
  },
  orderBadgePillText: {
    color: '#D96B14',
    fontSize: 11.5,
    fontWeight: '800',
  },
  tokenBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    flexShrink: 0,
  },
  tokenBadgePillText: {
    color: '#4338CA',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeTagText: {
    color: '#8C7A6B',
    fontSize: 10.5,
    fontWeight: '500',
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  /* Card Tags (Fulfillment + Station Badges) */
  cardTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 6,
  },
  fulfillmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  fulfillmentBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  cardStationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  cardStationBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },

  /* Customer Meta */
  customerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  customerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    flexShrink: 1,
  },
  customerNameText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  phoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  phoneText: {
    color: '#8C7A6B',
    fontSize: 10.5,
  },

  /* Item Chips Preview */
  itemsPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    maxWidth: '48%',
    flexShrink: 1,
  },
  itemChipQty: {
    color: '#DE8626',
    fontSize: 10,
    fontWeight: '800',
  },
  itemChipName: {
    color: '#4B5563',
    fontSize: 10.5,
    fontWeight: '500',
    flexShrink: 1,
  },
  moreItemsChip: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  moreItemsText: {
    color: '#D96B14',
    fontSize: 10,
    fontWeight: '700',
  },

  /* Divider */
  cardDivider: {
    height: 1,
    backgroundColor: '#F0EBE4',
    marginVertical: 4,
  },

  /* Footer */
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 2,
  },
  cardFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  paymentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 1,
  },
  paymentTagText: {
    color: '#17845A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  quickPrintIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalAmountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalAmountTextCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  totalAmountLabel: {
    color: '#8C7A6B',
    fontSize: 8.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  totalAmountValue: {
    color: '#17845A',
    fontSize: 13.5,
    fontWeight: '800',
  },

  /* Skeletons */
  skeletonListContainer: {
    paddingHorizontal: Spacing.md,
    gap: 10,
    paddingTop: 8,
  },
  orderCardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(224, 135, 38, 0.3)',
  },
  emptyTitle: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#7C6F62',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyRefreshBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  emptyRefreshBtnText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DE8626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyPosBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Footer Loader */
  footerLoaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  footerLoaderText: {
    color: '#8C7A6B',
    fontSize: 11,
    fontWeight: '600',
  },
  footerEndBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerEndText: {
    color: '#8C7A6B',
    fontSize: 11,
    fontWeight: '600',
  },

  /* 6. DETAIL RECEIPT MODAL */
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  detailModalCard: {
    width: '100%',
    maxWidth: 440,
    height: '92%',
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE4',
    marginBottom: 10,
  },
  detailBodyScroll: {
    flex: 1,
    minHeight: 0,
  },
  detailBodyScrollContent: {
    paddingBottom: 4,
  },
  detailHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  detailReceiptIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  detailOrderNumber: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '800',
  },
  detailTokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  detailTokenBadgeText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  detailDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  detailOrderDate: {
    color: '#8C7A6B',
    fontSize: 10.5,
    fontWeight: '500',
  },
  detailCloseBtn: {
    width: 30,
    flexShrink: 0,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  detailMetaCard: {
    width: '49%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: '#FAF7F2',
    borderRadius: 8,
    padding: 7,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  detailMetaIconBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMetaCardLabel: {
    color: '#8C7A6B',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailMetaCardValue: {
    color: '#1F2937',
    minWidth: 0,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  detailMetaCardSubValue: {
    color: '#7C6F62',
    fontSize: 9.5,
  },

  detailSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  detailSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  detailSectionIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#FFF0DE',
    borderWidth: 1, borderColor: '#F2D4B2',
    alignItems: 'center', justifyContent: 'center',
  },
  detailSectionTitle: {
    color: '#1F2937', fontSize: 12.5, fontWeight: '800',
  },
  detailSectionSubtitle: {
    color: '#9A8D80', fontSize: 9, marginTop: 1,
  },
  detailItemCountBadge: {
    backgroundColor: '#FFF0DE', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#F2D4B2',
  },
  detailItemCountBadgeText: {
    color: '#D96B14', fontSize: 9.5, fontWeight: '800',
  },

  detailItemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5DED5',
    overflow: 'hidden',
    marginBottom: 9,
  },
  detailItemsColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 31,
    paddingHorizontal: 9,
    backgroundColor: '#F8F4EF',
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
  },
  detailItemsColumnText: {
    color: '#8A7D70', fontSize: 8, fontWeight: '800', letterSpacing: 0.5,
  },
  detailItemNameColumn: { flex: 1, paddingRight: 7 },
  detailItemQtyColumn: {
    width: 42, alignItems: 'center', justifyContent: 'center',
  },
  detailItemPriceColumn: {
    width: 62, alignItems: 'flex-end', justifyContent: 'center',
  },
  detailItemTotalColumn: {
    width: 70, alignItems: 'flex-end', justifyContent: 'center',
  },
  detailItemsScroll: {
    maxHeight: 225,
    backgroundColor: '#FFFFFF',
  },
  detailItemsScrollContent: { paddingBottom: 1 },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 58,
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE9E3',
  },
  detailItemRowAlt: { backgroundColor: '#FCFAF7' },
  detailItemMain: { flex: 1, minWidth: 0, paddingRight: 7 },
  detailItemInfo: { flex: 1, minWidth: 0 },
  itemQtyCircle: {
    minWidth: 28, height: 28, paddingHorizontal: 6,
    borderRadius: 8, backgroundColor: '#FFF0DE',
    borderWidth: 1, borderColor: '#F2D4B2',
    alignItems: 'center', justifyContent: 'center',
  },
  itemQtyText: { color: '#D96B14', fontSize: 11, fontWeight: '900' },
  detailItemName: {
    color: '#1F2937', fontSize: 11.5, lineHeight: 15, fontWeight: '800',
  },
  detailItemMetaRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: 5, marginTop: 4,
  },
  detailItemUnitPrice: {
    color: '#8C7A6B', fontSize: 8.8, fontWeight: '500',
  },
  detailItemPriceValue: {
    color: '#5C4E3D', fontSize: 10, fontWeight: '700',
  },
  itemGstBadge: {
    backgroundColor: '#E0F2FE', paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 4, borderWidth: 1, borderColor: '#BAE6FD',
  },
  itemGstBadgeText: { color: '#0369A1', fontSize: 7.8, fontWeight: '800' },
  itemStationTag: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    borderWidth: 1, maxWidth: 90,
  },
  itemStationTagText: { fontSize: 7.8, fontWeight: '800' },
  detailCookingNoteBox: {
    marginTop: 5, paddingHorizontal: 7, paddingVertical: 4,
    borderRadius: 5, backgroundColor: '#FFF8EE',
    borderWidth: 1, borderColor: '#F3DFC4',
  },
  detailCookingNote: {
    color: '#B7651B', fontSize: 8.5, lineHeight: 12, fontStyle: 'italic',
  },
  detailItemTotal: { color: '#1F2937', fontSize: 11.5, fontWeight: '900' },
  noItemsContainer: {
    minHeight: 72, padding: 12, alignItems: 'center',
    justifyContent: 'center', gap: 5,
  },
  noItemsText: {
    color: '#8C7A6B', fontSize: 10, fontStyle: 'italic', textAlign: 'center',
  },

  /* Tax */
  detailTaxContainer: {
    backgroundColor: '#FAF7F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    padding: 8,
    marginBottom: 8,
  },
  detailGstHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE8E1',
  },
  detailGstBadge: {
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  detailGstBadgeText: {
    color: '#17845A',
    fontSize: 9,
    fontWeight: '800',
  },
  detailGstRateText: {
    color: '#7C6F62',
    fontSize: 9.5,
    fontWeight: '600',
  },
  detailBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 1.5,
  },
  detailBreakdownLabel: {
    color: '#5C4E3D',
    fontSize: 10.5,
  },
  detailBreakdownValue: {
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '600',
  },
  detailNoGstRow: {
    gap: 2,
  },
  detailInclTaxesNote: {
    color: '#8C7A6B',
    fontSize: 9.5,
    fontStyle: 'italic',
    marginTop: 2,
  },

  /* Grand Total */
  detailGrandTotalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  detailGrandTotalLabel: {
    color: '#8C7A6B',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailGrandTotalSubLabel: {
    color: '#D96B14',
    fontSize: 9.5,
    fontWeight: '600',
  },
  detailGrandTotalAmount: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '900',
  },

  /* Detail Actions */
  detailActionsContainer: {
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE4',
    flexShrink: 0,
  },
  detailSettlePrimaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#17845A',
    paddingVertical: 10,
    borderRadius: 9,
    shadowColor: '#17845A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  detailSettlePrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  detailSecondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    width: '100%',
  },
  detailPrintBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#DE8626',
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  detailPrintBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  detailKotBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#DE8626',
    paddingVertical: 9,
    borderRadius: 8,
  },
  detailKotBtnText: {
    color: '#D96B14',
    fontSize: 11,
    fontWeight: '700',
  },
  detailDoneBtn: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingVertical: 9,
    borderRadius: 8,
  },
  detailDoneBtnText: {
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '700',
  },
  cardSettleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#17845A',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 6,
    shadowColor: '#17845A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
    flexShrink: 0,
  },
  cardSettleBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Workflow Status Changer */
  detailWorkflowContainer: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  detailWorkflowTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8C7A6B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailWorkflowScroll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  detailWorkflowBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  detailWorkflowBtnCurrent: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  detailWorkflowBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C4E3D',
  },
  detailWorkflowBtnTextCurrent: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
