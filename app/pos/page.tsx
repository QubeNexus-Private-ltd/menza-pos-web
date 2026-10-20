'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Clock,
  Printer,
  X,
  Check,
  CreditCard,
  IndianRupee,
  Utensils,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  QrCode,
  ArrowRight,
  ReceiptIndianRupee as Receipt,
  User,
  Phone,
  Sparkles,
  MessageCircle,
  Store,
  Layers,
  ShieldAlert,
  PauseCircle,
  Play,
  Calculator,
  SlidersHorizontal,
  Keyboard,
  Lock,
  Truck,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { DishImage } from '@/components/common/DishImage';
import dynamic from 'next/dynamic';
import type { CustomizationResult } from '@/components/pos/DishCustomizationModal';
import type { ParkedCart } from '@/components/pos/ParkedCartsModal';

const StoreOperatingStatusModal = dynamic(
  () => import('@/components/pos/StoreOperatingStatusModal').then((mod) => mod.StoreOperatingStatusModal),
  { ssr: false }
);
const DishCustomizationModal = dynamic(
  () => import('@/components/pos/DishCustomizationModal').then((mod) => mod.DishCustomizationModal),
  { ssr: false }
);
const QuickNumpadModal = dynamic(
  () => import('@/components/pos/QuickNumpadModal').then((mod) => mod.QuickNumpadModal),
  { ssr: false }
);
const ParkedCartsModal = dynamic(
  () => import('@/components/pos/ParkedCartsModal').then((mod) => mod.ParkedCartsModal),
  { ssr: false }
);
const TablePickerModal = dynamic(
  () => import('@/components/pos/TablePickerModal').then((mod) => mod.TablePickerModal),
  { ssr: false }
);
const OrderNotificationDrawer = dynamic(
  () => import('@/components/pos/OrderNotificationDrawer').then((mod) => mod.OrderNotificationDrawer),
  { ssr: false }
);
const OrderAlertBanner = dynamic(
  () => import('@/components/pos/OrderAlertBanner').then((mod) => mod.OrderAlertBanner),
  { ssr: false }
);
const WebPrinterModal = dynamic(
  () => import('@/components/pos/WebPrinterModal').then((mod) => mod.WebPrinterModal),
  { ssr: false }
);
const WalletRechargeModal = dynamic(
  () => import('@/components/common/WalletRechargeModal').then((mod) => mod.WalletRechargeModal),
  { ssr: false }
);
const SubscriptionGraceBanner = dynamic(
  () => import('@/components/subscription/SubscriptionGraceBanner').then((mod) => mod.SubscriptionGraceBanner),
  { ssr: false }
);
import { GildedAlertModal, GildedAlertConfig } from '@/components/common/GildedAlertModal';

import { WebPrinterService } from '@/services/webPrinterService';
import { WebWhatsAppService } from '@/services/whatsAppService';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { usePrinterStore } from '@shared/presentation/state/usePrinterStore';
import { useNotificationStore } from '@shared/presentation/state/useNotificationStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { usePosCatalogStore } from '@/stores/usePosCatalogStore';
import { useKitchenStationStore } from '@shared/presentation/state/useKitchenStationStore';
import { apiClient } from '@shared/core/network/apiClient';
import { CatalogRemoteDataSource } from '@shared/data/datasources/CatalogRemoteDataSource';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { OrderRepositoryImpl } from '@shared/data/repositories/OrderRepositoryImpl';
import { TableRemoteDataSource } from '@shared/data/datasources/TableRemoteDataSource';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { MenuItem } from '@shared/domain/models/Item';
import { Category } from '@shared/domain/models/Category';
import { TableMaster } from '@shared/domain/models/Table';
import { RestaurantConfig, StoreOperatingStatus } from '@shared/domain/models/RestaurantConfig';
import {
  BillingModes,
  PosCheckoutModes,
  PosOrderSources,
  OrderMaster,
  ActiveOrderType,
} from '@shared/domain/models/Order';
import { ReceiptData } from '@shared/core/printer/EscPosBuilder';
import { WalletEvents } from '@shared/core/utils/walletEvents';
import {
  startPosSignalRConnection,
  onStoreOperatingStatusChanged,
  onWalletBalanceChanged,
  onPosTableStatusChanged,
  onPosOrderCreated,
  onSignalRReconnected,
} from '@/lib/signalr/signalrService';

const catalogDataSource = new CatalogRemoteDataSource();
const orderRemoteDataSource = new OrderRemoteDataSource();
const orderRepository = new OrderRepositoryImpl(orderRemoteDataSource);
const tableDataSource = new TableRemoteDataSource();
const configDataSource = new RestaurantConfigRemoteDataSource();

export interface CartItem {
  cartKey: string;
  itemId: number;
  itemName: string;
  description?: string;
  price: number;
  basePrice: number;
  quantity: number;
  isVeg: boolean;
  portionLabel?: string;
  imageUrl?: string;
  variantId?: number;
  variantName?: string;
  modifiers?: Array<{ id: number; modifierName: string; extraPrice: number }>;
  notes?: string;
  stationName?: string;
  stationCode?: string;
}

export default function PosPage() {
  const router = useRouter();
  const activeRestaurant = useAuthStore((s) => s.activeRestaurant);
  const restaurants = useAuthStore((s) => s.restaurants);
  const processIncomingOrders = useNotificationStore((s) => s.processIncomingOrders);
  const markOrderAsKnown = useNotificationStore((s) => s.markOrderAsKnown);
  const paperWidth = usePrinterStore((s) => s.paperWidth);
  const customFooter = usePrinterStore((s) => s.customFooter);
  const autoPrintReceipt = usePrinterStore((s) => s.autoPrintReceipt);
  const autoPrintKot = usePrinterStore((s) => s.autoPrintKot);
  const canTakeOrders = useSubscriptionStore((s) => s.canTakeOrders);
  const hasEntitlement = useSubscriptionStore((s) => s.hasEntitlement);
  const isSubscriptionExpired = useSubscriptionStore((s) => s.isExpired);
  const subscriptionLifecycleState = useSubscriptionStore((s) => s.lifecycleState);
  const openRenewalModal = useSubscriptionStore((s) => s.openRenewalModal);
  const fetchSubscriptionStatus = useSubscriptionStore((s) => s.fetchSubscriptionStatus);
  const stations = useKitchenStationStore((s) => s.stations);
  const fetchStations = useKitchenStationStore((s) => s.fetchStations);

  const currentRestId =
    activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  // Core Data with in-memory catalog cache initialization (prevents flickering)
  const cachedCatalog = usePosCatalogStore.getState();
  const hasCachedData = Boolean(
    currentRestId &&
    cachedCatalog.restaurantId === currentRestId &&
    cachedCatalog.hasLoaded &&
    cachedCatalog.items.length > 0
  );

  const [categories, setCategories] = useState<Category[]>(() =>
    hasCachedData ? cachedCatalog.categories : []
  );
  const [items, setItems] = useState<MenuItem[]>(() =>
    hasCachedData ? cachedCatalog.items : []
  );
  const [tables, setTables] = useState<TableMaster[]>(() =>
    hasCachedData ? cachedCatalog.tables : []
  );
  const [restaurantConfig, setRestaurantConfig] = useState<RestaurantConfig | null>(() =>
    hasCachedData ? cachedCatalog.restaurantConfig : null
  );
  const [operatingStatus, setOperatingStatus] = useState<StoreOperatingStatus | null>(() =>
    hasCachedData ? cachedCatalog.operatingStatus : null
  );
  const [loading, setLoading] = useState(!hasCachedData);

  // Dynamic Active Order Types
  const [orderTypes, setOrderTypes] = useState<ActiveOrderType[]>(() =>
    hasCachedData && cachedCatalog.orderTypes.length > 0
      ? cachedCatalog.orderTypes
      : [
          { id: 4, code: 'COUNTER', typeName: 'Counter', configKey: 'IsCounterOrderingEnabled', isAllowedByPlan: true, isEnabledByStore: true, isActive: true, displayOrder: 1 },
          { id: 1, code: 'DINE_IN', typeName: 'Dine-in', configKey: 'IsTableOrderingEnabled', isAllowedByPlan: true, isEnabledByStore: true, isActive: true, displayOrder: 2 },
          { id: 2, code: 'TAKEAWAY', typeName: 'Takeaway', configKey: 'IsSelfPickupEnabled', isAllowedByPlan: true, isEnabledByStore: true, isActive: true, displayOrder: 3 },
          { id: 3, code: 'DELIVERY', typeName: 'Delivery', configKey: 'IsDeliveryEnabled', isAllowedByPlan: false, isEnabledByStore: false, isActive: false, displayOrder: 4 },
        ]
  );
  const [selectedOrderType, setSelectedOrderType] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const qTableId = new URLSearchParams(window.location.search).get('tableId');
      if (qTableId) return 1; // DINE_IN
    }
    return 4;
  });

  // Dine-in Flow & Table Selection
  const [selectedTable, setSelectedTable] = useState<TableMaster | null>(() => {
    if (typeof window !== 'undefined') {
      const qTableId = new URLSearchParams(window.location.search).get('tableId');
      if (qTableId) {
        const s = usePosCatalogStore.getState();
        if (s.tables.length > 0) {
          return s.tables.find((t) => t.id === Number(qTableId)) || null;
        }
      }
    }
    return null;
  });
  const [activeTableOrder, setActiveTableOrder] = useState<OrderMaster | null>(() => {
    if (typeof window !== 'undefined') {
      const qTableId = new URLSearchParams(window.location.search).get('tableId');
      if (qTableId) {
        const cached = usePosCatalogStore.getState().getActiveTableOrder(Number(qTableId));
        if (cached) return cached;
      }
    }
    return null;
  });
  const [loadingActiveTable, setLoadingActiveTable] = useState(false);
  const [showRunningTableDetails, setShowRunningTableDetails] = useState(false);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null); // null = all
  const [searchQuery, setSearchQuery] = useState('');
  const [vegFilter, setVegFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');

  // Cart & Customer Details
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState(() => {
    if (typeof window !== 'undefined') {
      const qTableId = new URLSearchParams(window.location.search).get('tableId');
      if (qTableId) {
        const cached = usePosCatalogStore.getState().getActiveTableOrder(Number(qTableId));
        if (cached?.customerName) return cached.customerName;
      }
    }
    return '';
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      const qTableId = new URLSearchParams(window.location.search).get('tableId');
      if (qTableId) {
        const cached = usePosCatalogStore.getState().getActiveTableOrder(Number(qTableId));
        if (cached?.mobileNumber) return cached.mobileNumber;
      }
    }
    return '';
  });
  const [isCustomerLookupVerified, setIsCustomerLookupVerified] = useState(false);
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Settlement & Payment Mode State
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('CASH');
  const [posTenderedText, setPosTenderedText] = useState<string>('');
  // Modals & Drawers State
  const [operatingModalOpen, setOperatingModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [numpadItem, setNumpadItem] = useState<{
    cartKey: string;
    itemId: number;
    itemName: string;
    currentQuantity: number;
    unitPrice: number;
    description?: string;
  } | null>(null);
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>([]);
  const [parkedModalOpen, setParkedModalOpen] = useState(false);
  const [tablePickerModalOpen, setTablePickerModalOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false); // Mobile / Tablet drawer
  const [orderSuccessData, setOrderSuccessData] = useState<any | null>(null);

  // Loading States
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isKotLoading, setIsKotLoading] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  // Gilded Alert Modal State
  const [alertConfig, setAlertConfig] = useState<GildedAlertConfig>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'danger' | 'warning' | 'info' = 'success',
    confirmText = 'OK',
    cancelText?: string,
    onConfirm?: () => void
  ) => {
    setAlertConfig({
      visible: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
    });
  };

  // 1. Initial Load of POS Data & Real-time SignalR Listeners
  const loadOperatingStatus = useCallback(async () => {
    if (!currentRestId) return;
    try {
      const status = await configDataSource.getOperatingStatus(currentRestId);
      if (status) setOperatingStatus(status);
    } catch (err) {
      console.warn('Failed to load operating status for POS:', err);
    }
  }, [currentRestId]);

  const loadRestaurantConfig = useCallback(async () => {
    if (!currentRestId) return;
    try {
      const cfg = await configDataSource.getConfig(currentRestId);
      if (cfg) setRestaurantConfig(cfg);
    } catch (err) {
      console.warn('Failed to load store config for POS:', err);
    }
  }, [currentRestId]);

  const loadOrderTypes = useCallback(async () => {
    if (!currentRestId) return;
    try {
      const types = await orderRemoteDataSource.getActiveOrderTypes(currentRestId);
      if (Array.isArray(types) && types.length > 0) {
        setOrderTypes(types);
        usePosCatalogStore.getState().setCatalogData({
          restaurantId: currentRestId,
          orderTypes: types,
        });
        const qTableId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tableId') : null;
        if (!qTableId) {
          setSelectedOrderType((prev) => {
            if (prev === 1) return prev;
            const firstActive = types.find((t) => t.isActive);
            return firstActive ? firstActive.id : prev;
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load active order types:', err);
    }
  }, [currentRestId]);

  useEffect(() => {
    if (!currentRestId) return;
    let isMounted = true;

    const loadAll = async () => {
      const s = usePosCatalogStore.getState();
      const isAlreadyCached = Boolean(
        s.hasLoaded &&
        s.restaurantId === currentRestId &&
        s.items.length > 0
      );

      try {
        if (!isAlreadyCached) {
          setLoading(true);
        }
        const [catsRes, itemsRes, tablesRes, cfgRes, opRes] = await Promise.allSettled([
          catalogDataSource.getCategories(currentRestId),
          catalogDataSource.getMenuItems(currentRestId),
          tableDataSource.getTables(currentRestId),
          configDataSource.getConfig(currentRestId),
          configDataSource.getOperatingStatus(currentRestId),
        ]);

        if (!isMounted) return;

        const resolvedCats = catsRes.status === 'fulfilled' && Array.isArray(catsRes.value) ? catsRes.value : undefined;
        const resolvedItems = itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value) ? itemsRes.value : undefined;
        const resolvedTables = tablesRes.status === 'fulfilled' && Array.isArray(tablesRes.value) ? tablesRes.value : undefined;
        const resolvedCfg = cfgRes.status === 'fulfilled' && cfgRes.value ? cfgRes.value : undefined;
        const resolvedOp = opRes.status === 'fulfilled' && opRes.value ? opRes.value : undefined;

        if (resolvedCats) setCategories(resolvedCats);
        if (resolvedItems) setItems(resolvedItems);
        if (resolvedTables) {
          setTables(resolvedTables);
          if (typeof window !== 'undefined') {
            const qTableId = new URLSearchParams(window.location.search).get('tableId');
            if (qTableId) {
              const matched = resolvedTables.find((t) => t.id === Number(qTableId));
              if (matched) {
                setSelectedOrderType(1); // DINE_IN
                setSelectedTable((prev) => (prev?.id === matched.id ? prev : matched));
              }
            }
          }
        }
        if (resolvedCfg) setRestaurantConfig(resolvedCfg);
        if (resolvedOp) setOperatingStatus(resolvedOp);

        // Update in-memory catalog cache for subsequent instant route switches
        usePosCatalogStore.getState().setCatalogData({
          restaurantId: currentRestId,
          categories: resolvedCats,
          items: resolvedItems,
          tables: resolvedTables,
          restaurantConfig: resolvedCfg,
          operatingStatus: resolvedOp,
        });

        loadOrderTypes();
        fetchStations(currentRestId);
        fetchSubscriptionStatus(currentRestId).catch(() => {});

        // Fetch initial orders for notifications
        orderRemoteDataSource
          .getTodayOrders(currentRestId, 'ALL', 1, 20)
          .then((res) => {
            if (res?.items && res.items.length > 0) {
              processIncomingOrders(res.items);
            }
          })
          .catch(() => {});
      } catch (err) {
        console.warn('POS data load failed', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAll();

    // SignalR Real-Time Listeners
    startPosSignalRConnection(currentRestId).catch(() => {});

    const unsubStatus = onStoreOperatingStatusChanged((status) => {
      if (status && isMounted) {
        setOperatingStatus(status);
        usePosCatalogStore.getState().updateOperatingStatus(status);
      }
    });

    const unsubWallet = onWalletBalanceChanged((data) => {
      if (data?.newBalance !== undefined && isMounted) {
        setRestaurantConfig((prev) => {
          const updated = prev ? { ...prev, walletBalance: Number(data.newBalance) } : prev;
          usePosCatalogStore.getState().updateRestaurantConfig(updated);
          return updated;
        });
        setOperatingStatus((prev) => {
          const updated = prev ? { ...prev, walletBalance: Number(data.newBalance) } : prev;
          usePosCatalogStore.getState().updateOperatingStatus(updated);
          return updated;
        });
      }
    });

    const unsubTable = onPosTableStatusChanged((tableData) => {
      if (isMounted && tableData && currentRestId) {
        tableDataSource.getTables(currentRestId).then((tList) => {
          if (isMounted) {
            setTables(tList);
            usePosCatalogStore.getState().updateTables(tList);
          }
        }).catch(() => {});
      }
    });

    const unsubReconnect = onSignalRReconnected(() => {
      if (isMounted) {
        loadOperatingStatus();
        loadRestaurantConfig();
      }
    });

    const unsubWalletEvents = WalletEvents.subscribe(() => {
      if (isMounted) {
        loadOperatingStatus();
        loadRestaurantConfig();
      }
    });

    return () => {
      isMounted = false;
      unsubStatus();
      unsubWallet();
      unsubTable();
      unsubReconnect();
      unsubWalletEvents();
    };
  }, [currentRestId]);

  // Track last fetched tableId to prevent duplicate fetches & render loops
  const lastFetchedTableIdRef = useRef<number | null>(null);

  // 2. Active Dining Table Order Loader
  const loadActiveTableOrder = useCallback(
    async (tableId: number, forceRefresh: boolean = false) => {
      if (!currentRestId || !tableId) {
        setActiveTableOrder(null);
        return;
      }

      // Check if active order was already fetched within last 60 seconds (e.g. from tables floor page)
      if (!forceRefresh) {
        const cachedOrder = usePosCatalogStore.getState().getActiveTableOrder(tableId);
        if (cachedOrder !== undefined) {
          setActiveTableOrder(cachedOrder);
          if (cachedOrder?.customerName) {
            setCustomerName((prev) => prev || cachedOrder.customerName || '');
          }
          if (cachedOrder?.mobileNumber) {
            setCustomerPhone((prev) => prev || cachedOrder.mobileNumber || '');
          }
          return;
        }
      }

      try {
        setLoadingActiveTable(true);
        const active = await orderRepository.getActiveOrderByTable(tableId, currentRestId);
        setActiveTableOrder(active);
        usePosCatalogStore.getState().setActiveTableOrder(tableId, active);
        if (active?.customerName) {
          setCustomerName((prev) => prev || active.customerName || '');
        }
        if (active?.mobileNumber) {
          setCustomerPhone((prev) => prev || active.mobileNumber || '');
        }
      } catch (err) {
        console.warn('Failed to load active table order:', err);
        setActiveTableOrder(null);
      } finally {
        setLoadingActiveTable(false);
      }
    },
    [currentRestId]
  );

  useEffect(() => {
    const tableId = selectedTable?.id;
    if (selectedOrderType === 1 && tableId) {
      if (lastFetchedTableIdRef.current === tableId) {
        return;
      }
      lastFetchedTableIdRef.current = tableId;
      loadActiveTableOrder(tableId);
    } else if (selectedOrderType !== 1) {
      lastFetchedTableIdRef.current = null;
      setActiveTableOrder(null);
    }
  }, [selectedOrderType, selectedTable?.id, loadActiveTableOrder]);

  // Open table picker and refresh tables
  const handleOpenTablePicker = useCallback(async () => {
    setTablePickerModalOpen(true);
    if (currentRestId) {
      try {
        const refreshed = await tableDataSource.getTables(currentRestId);
        if (refreshed && Array.isArray(refreshed)) {
          setTables(refreshed);
          usePosCatalogStore.getState().setCatalogData({ restaurantId: currentRestId, tables: refreshed });
        }
      } catch {}
    }
  }, [currentRestId]);

  // Select table from TablePickerModal
  const handleSelectTableFromModal = useCallback(
    (tbl: TableMaster) => {
      setSelectedOrderType(1); // Ensure Dine-In is active
      setSelectedTable(tbl);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('tableId', String(tbl.id));
        window.history.replaceState({}, '', url.toString());
      }
      loadActiveTableOrder(tbl.id, true);
      setTablePickerModalOpen(false);
    },
    [loadActiveTableOrder]
  );

  // 3. Customer Mobile Lookup (10 Digits)
  const handlePhoneChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 10);
    setCustomerPhone(clean);
    setIsCustomerLookupVerified(false);

    if (clean.length === 10) {
      setIsLookingUpCustomer(true);
      apiClient
        .get(`/UserMaster/by-mobile/${clean}`)
        .then((res) => {
          if (res.data?.name || res.data?.Name) {
            const foundName = String(res.data.name ?? res.data.Name);
            if (!customerName || customerName.trim() === '') {
              setCustomerName(foundName);
            }
            setIsCustomerLookupVerified(true);
          }
        })
        .catch(() => {})
        .finally(() => setIsLookingUpCustomer(false));
    }
  };

  // 4. Item Availability Check
  const isItemAvailable = (dish: any): boolean => {
    if (dish?.isAvailable !== undefined) return Boolean(dish.isAvailable);
    if (dish?.IsAvailable !== undefined) return Boolean(dish.IsAvailable);
    if (dish?.isActive !== undefined) return Boolean(dish.isActive);
    if (dish?.IsActive !== undefined) return Boolean(dish.IsActive);
    return true;
  };

  // 5. Filtered Menu Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Category Filter (matches by id or category name to handle legacy duplicates)
      if (selectedCategory !== null) {
        const selCat = categories.find((c) => c.id === selectedCategory);
        if (selCat) {
          const selName = (selCat.categoryName || '').trim().toLowerCase();
          const itemCatName = (item.categoryName || '').trim().toLowerCase();
          if (Number(item.categoryId) !== Number(selectedCategory) && itemCatName !== selName) {
            return false;
          }
        } else if (Number(item.categoryId) !== Number(selectedCategory)) {
          return false;
        }
      }
      // 2. Veg / Non-Veg Filter
      if (vegFilter === 'VEG' && !item.isVeg) return false;
      if (vegFilter === 'NON_VEG' && item.isVeg) return false;
      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (item.itemName || '').toLowerCase().includes(q);
        const descMatch = (item.description || (item as any).itemDescription || '').toLowerCase().includes(q);
        const codeMatch = Boolean((item as any).itemCode && String((item as any).itemCode).toLowerCase().includes(q));
        return nameMatch || descMatch || codeMatch;
      }
      return true;
    });
  }, [items, selectedCategory, vegFilter, searchQuery, categories]);

  // Categories that have items for this restaurant, deduplicated by name
  const visibleCategories = useMemo(() => {
    if (!items || items.length === 0) return [];
    const itemCatIds = new Set(items.map((it) => Number(it.categoryId)));
    const seen = new Set<string>();
    return categories.filter((cat) => {
      const norm = (cat.categoryName || '').trim().toLowerCase();
      if (!itemCatIds.has(Number(cat.id)) || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }, [categories, items]);

  // 6. Cart Management
  const addToCartQuick = (item: MenuItem) => {
    if (!isItemAvailable(item)) {
      showAlert('Out of Stock', `"${item.itemName || 'This item'}" is currently out of stock.`, 'warning');
      return;
    }

    const cartKey = `${item.id}_v0_`;
    setCart((prev) => {
      const existing = prev.find((ci) => ci.cartKey === cartKey);
      if (existing) {
        return prev.map((ci) =>
          ci.cartKey === cartKey ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          cartKey,
          itemId: item.id,
          itemName: item.itemName,
          description: item.description,
          price: item.price,
          basePrice: item.price,
          quantity: 1,
          isVeg: Boolean(item.isVeg),
          portionLabel: item.portionDisplay,
          imageUrl: item.imageUrl,
          stationName: item.kitchenStationName,
        },
      ];
    });
  };

  const handleCustomizationConfirm = (res: CustomizationResult) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.cartKey === res.cartKey);
      if (existing) {
        return prev.map((ci) =>
          ci.cartKey === res.cartKey ? { ...ci, quantity: ci.quantity + res.quantity } : ci
        );
      }
      const displayName = res.selectedVariant
        ? `${res.item.itemName} (${res.selectedVariant.variantName})`
        : res.item.itemName;

      return [
        ...prev,
        {
          cartKey: res.cartKey,
          itemId: res.item.id,
          itemName: displayName,
          description: res.item.description,
          price: res.effectiveUnitPrice,
          basePrice: res.item.price,
          quantity: res.quantity,
          isVeg: Boolean(res.item.isVeg),
          portionLabel: res.item.portionDisplay,
          imageUrl: res.item.imageUrl,
          variantId: res.selectedVariant?.id,
          variantName: res.selectedVariant?.variantName,
          modifiers: res.selectedModifiers.map((m) => ({
            id: m.id,
            modifierName: m.modifierName,
            extraPrice: m.extraPrice,
          })),
          notes: res.cookingInstructions,
          stationName: res.item.kitchenStationName,
        },
      ];
    });
  };

  const updateQuantity = (cartKey: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((ci) => {
          if (ci.cartKey === cartKey) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const updateExactQuantity = (cartKey: string, exactQty: number) => {
    setCart((prev) => {
      return prev
        .map((ci) => {
          if (ci.cartKey === cartKey) {
            return exactQty > 0 ? { ...ci, quantity: exactQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const clearCart = () => {
    setCart([]);
    setPosTenderedText('');
  };

  const clearFullSale = () => {
    clearCart();
    setSelectedTable(null);
    setCustomerName('');
    setCustomerPhone('');
    setIsCustomerLookupVerified(false);
    setDiscountAmount(0);
    setActiveTableOrder(null);
    setOrderSuccessData(null);
  };

  // 7. Park / Hold Cart Handlers
  const handleParkCurrentCart = () => {
    if (cart.length === 0) {
      showAlert('Cart is Empty', 'Nothing to park. Please add dishes to cart.', 'warning');
      return;
    }
    const newParked: ParkedCart = {
      id: `park_${Date.now()}`,
      parkedAt: new Date(),
      cart: [...cart],
      orderType: selectedOrderType === 1 ? 'DINE_IN' : selectedOrderType === 2 ? 'TAKEAWAY' : selectedOrderType === 3 ? 'DELIVERY' : 'COUNTER',
      table: selectedTable,
      customerName,
      customerPhone,
      discountAmount,
      subtotal: payableGrandTotal,
    };
    setParkedCarts((prev) => [newParked, ...prev]);
    clearCart();
    showAlert('Order Held ⏸️', 'Active cart saved to Held Orders. You can resume it anytime.', 'info');
  };

  const handleResumeParkedCart = (p: ParkedCart) => {
    setCart(p.cart);
    const matchedType = orderTypes.find((ot) => ot.code === p.orderType);
    if (matchedType) setSelectedOrderType(matchedType.id);
    setSelectedTable(p.table);
    setCustomerName(p.customerName);
    setCustomerPhone(p.customerPhone);
    setDiscountAmount(p.discountAmount);
    setParkedCarts((prev) => prev.filter((item) => item.id !== p.id));
    setParkedModalOpen(false);
  };

  const handleDiscardParkedCart = (id: string) => {
    setParkedCarts((prev) => prev.filter((item) => item.id !== id));
  };

  // 8. Tax & Bill Calculation Engine Matching Menza
  const hasGstNumber = Boolean(
    restaurantConfig?.gstNumber && restaurantConfig.gstNumber.trim().length > 0
  );
  const sgstRate = hasGstNumber ? Number(restaurantConfig?.sgstPercentage ?? 0) : 0;
  const cgstRate = hasGstNumber ? Number(restaurantConfig?.cgstPercentage ?? 0) : 0;
  const totalGstRate = sgstRate + cgstRate;

  const subtotal = useMemo(() => {
    return cart.reduce((acc, curr) => acc + curr.quantity * curr.price, 0);
  }, [cart]);

  const cartTotalItems = useMemo(
    () => cart.reduce((acc, curr) => acc + curr.quantity, 0),
    [cart]
  );

  const sgstAmount = hasGstNumber ? Number(((subtotal * sgstRate) / 100).toFixed(2)) : 0;
  const cgstAmount = hasGstNumber ? Number(((subtotal * cgstRate) / 100).toFixed(2)) : 0;
  const totalTaxAmount = hasGstNumber ? Number((sgstAmount + cgstAmount).toFixed(2)) : 0;

  // Grand Total for currently staged items
  const grandTotal = hasGstNumber
    ? Math.max(0, Number((subtotal + totalTaxAmount - discountAmount).toFixed(2)))
    : Math.max(0, Number((subtotal - discountAmount).toFixed(2)));

  // Consolidated Dining Total
  const existingTableTotal = activeTableOrder ? Number(activeTableOrder.totalAmount || 0) : 0;
  const consolidatedGrandTotal = Math.round((existingTableTotal + grandTotal) * 100) / 100;
  const payableGrandTotal = activeTableOrder && cart.length === 0 ? existingTableTotal : (activeTableOrder ? consolidatedGrandTotal : grandTotal);

  // Cash Tendered & Change Return
  const posNumericTendered = parseFloat(posTenderedText) || 0;
  const posChangeToReturn = Math.max(0, posNumericTendered - payableGrandTotal);

  // 9. Keyboard Shortcuts Listener (F1: Search, F2: Settle, F3: KOT, F4: Clear, Esc: Close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1' || (e.altKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        const searchInput = document.getElementById('pos-menu-search-input');
        searchInput?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0 || activeTableOrder) {
          handleCheckout(PosCheckoutModes.PAY_AND_SETTLE);
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (cart.length > 0) {
          handleCheckout(PosCheckoutModes.KOT_PAY_LATER);
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          showAlert(
            'Clear Cart?',
            'Are you sure you want to discard all items in the active cart?',
            'warning',
            'Clear',
            'Cancel',
            clearCart
          );
        }
      } else if (e.key === 'Escape') {
        setCustomizingItem(null);
        setNumpadItem(null);
        setParkedModalOpen(false);
        setCartDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, activeTableOrder, payableGrandTotal]);

  // 10. Order Placement & Checkout Execution
  const handleCheckout = async (mode: (typeof PosCheckoutModes)[keyof typeof PosCheckoutModes]) => {
    if (cart.length === 0 && !activeTableOrder) {
      showAlert('Cart is Empty', 'Please add items to cart before placing an order.', 'warning');
      return;
    }

    const cleanPhone = customerPhone.replace(/[^0-9]/g, '').trim();
    if (cleanPhone.length > 0 && cleanPhone.length !== 10) {
      showAlert('Invalid Phone Number 📱', 'Phone number must be exactly 10 digits.', 'warning');
      return;
    }

    const cleanName = (customerName || '').slice(0, 50).trim();
    const effectiveCustomerName =
      cleanName || (selectedTable ? `Table ${selectedTable.tableNumber}` : 'Walk-in Customer');

    // Wallet Safeguard
    const isWalletExhausted =
      operatingStatus?.status === 'WALLET_EXHAUSTED' ||
      (restaurantConfig?.walletBalance !== undefined && restaurantConfig.walletBalance <= 0);

    if (isWalletExhausted) {
      showAlert(
        'Prepaid Wallet Exhausted 💳',
        `Your restaurant's prepaid wallet balance is ₹${(restaurantConfig?.walletBalance ?? 0).toFixed(2)}. Orders and billing cannot be processed while wallet balance is zero or negative.\n\nPlease recharge your wallet to continue.`,
        'warning',
        'Recharge Wallet',
        'Cancel',
        () => setWalletModalOpen(true)
      );
      return;
    }

    // Subscription Safeguard
    if (isSubscriptionExpired || subscriptionLifecycleState === 'EXPIRED') {
      showAlert(
        'Subscription Expired 🔒',
        'Your restaurant subscription has expired beyond the grace period. Order taking and billing are locked until your plan is renewed.\n\nPlease renew your plan to resume operations.',
        'danger',
        'Renew Subscription',
        'Cancel',
        openRenewalModal
      );
      return;
    }

    // Inactive Store / Operating Status Safeguard
    const isInactive = activeRestaurant?.isActive === false || restaurantConfig?.isActive === false;
    const isClosedOrPaused = operatingStatus && !operatingStatus.canPlaceOrder;

    if (isInactive || isClosedOrPaused) {
      const title = isInactive ? 'Store is Inactive 🔴' : 'Store is Closed / Paused ⚠️';
      const msg = isInactive
        ? 'This restaurant is currently inactive and offline in Menza Admin. You cannot take or place orders while inactive.'
        : operatingStatus?.statusMessage || 'This outlet is currently marked as closed or paused for taking orders. Please resume or reopen the store before taking orders.';

      showAlert(
        title,
        msg,
        'warning',
        isInactive ? 'OK' : 'Open Store Controls',
        undefined,
        isInactive ? undefined : () => setOperatingModalOpen(true)
      );
      return;
    }

    // Dine-In Plan Allowance Safeguard
    if (selectedOrderType === 1 && !hasEntitlement('IsTableOrderingEnabled')) {
      showAlert(
        'Feature Locked 🔒',
        'Dine-in / Table ordering is not included in your active subscription plan. Please upgrade to unlock this channel.',
        'warning',
        'Upgrade Plan',
        'Cancel',
        openRenewalModal
      );
      return;
    }

    try {
      if (mode === PosCheckoutModes.KOT_PAY_LATER) {
        setIsKotLoading(true);
      } else {
        setIsSettling(true);
      }

      // Check if settling existing table order directly with no new cart items
      if (cart.length === 0 && activeTableOrder && mode === PosCheckoutModes.PAY_AND_SETTLE) {
        const effectivePaymentMode = selectedPaymentMode;

        await orderRemoteDataSource.settleOrder(activeTableOrder.id, {
          orderId: activeTableOrder.id,
          paymentMode: effectivePaymentMode,
          discountAmount,
          tenderedAmount: selectedPaymentMode === 'CASH' && posNumericTendered > 0 ? posNumericTendered : undefined,
          changeAmount: selectedPaymentMode === 'CASH' && posChangeToReturn > 0 ? posChangeToReturn : undefined,
          billingMode: BillingModes.PRE_PAID,
          orderStatus: 'Settled',
        });
        WalletEvents.emit();

        const receiptData: ReceiptData = {
          orderId: activeTableOrder.id,
          orderNumber: String(activeTableOrder.orderNumber || activeTableOrder.id),
          pickupToken: String(activeTableOrder.pickupToken || activeTableOrder.id),
          restaurantName: restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
          logoUrl: restaurantConfig?.logoUrl || activeRestaurant?.logoUrl || undefined,
          address: restaurantConfig?.address || activeRestaurant?.address || '',
          city: restaurantConfig?.city || activeRestaurant?.city || '',
          state: restaurantConfig?.state || activeRestaurant?.state || '',
          contactPhone: restaurantConfig?.contactNumber || (activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || '',
          gstNumber: hasGstNumber ? (restaurantConfig?.gstNumber || '') : undefined,
          customerName: activeTableOrder.customerName || 'Dine-In Guest',
          customerPhone: activeTableOrder.mobileNumber || undefined,
          orderType: 'DINE_IN',
          tableName: selectedTable ? `Table ${selectedTable.tableNumber}` : activeTableOrder.tableName,
          sectionName: selectedTable?.sectionName || (activeTableOrder as any)?.sectionName,
          items: (activeTableOrder.items || []).map((c: any) => ({
            itemName: c.itemName || 'Dish',
            quantity: c.quantity || 1,
            unitPrice: c.unitPrice || c.amount || 0,
            totalPrice: c.totalPrice || c.totalAmount || (c.quantity * c.unitPrice) || 0,
          })),
          subtotal: activeTableOrder.subtotal || existingTableTotal,
          discountAmount: discountAmount || activeTableOrder.discountAmount || 0,
          cgstPercentage: hasGstNumber ? cgstRate : undefined,
          cgstAmount: hasGstNumber ? (activeTableOrder.cgst || 0) : undefined,
          sgstPercentage: hasGstNumber ? sgstRate : undefined,
          sgstAmount: hasGstNumber ? (activeTableOrder.sgst || 0) : undefined,
          taxAmount: hasGstNumber ? ((activeTableOrder.cgst || 0) + (activeTableOrder.sgst || 0)) : 0,
          grandTotal: payableGrandTotal,
          paymentMode: effectivePaymentMode,
          tenderedAmount: posNumericTendered,
          changeAmount: posChangeToReturn,
          date: new Date().toLocaleString('en-IN'),
          upiId: (restaurantConfig?.bankerUpiId || (restaurantConfig as any)?.upiId || (activeRestaurant as any)?.bankerUpiId || (activeRestaurant as any)?.upiId || '').trim(),
          upiPayeeName: restaurantConfig?.bankerAccountHolderName || restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
          showUpiQr: restaurantConfig?.printUpiQrOnReceipts !== false && (activeRestaurant as any)?.printUpiQrOnReceipts !== false,
          footerMessage: customFooter || 'Thank you! Please visit again.',
        };

        if (autoPrintReceipt) {
          WebPrinterService.printReceipt(receiptData, paperWidth).catch(() => {});
        }

        setOrderSuccessData({
          orderId: activeTableOrder.id,
          orderType: 'Dine-in',
          table: selectedTable?.tableNumber,
          customerName: activeTableOrder.customerName,
          customerPhone: activeTableOrder.mobileNumber,
          items: activeTableOrder.items || [],
          subtotal: activeTableOrder.subtotal || existingTableTotal,
          totalTax: hasGstNumber ? ((activeTableOrder.cgst || 0) + (activeTableOrder.sgst || 0)) : 0,
          grandTotal: payableGrandTotal,
          paymentMode: effectivePaymentMode,
          tendered: posNumericTendered,
          change: posChangeToReturn,
          date: new Date().toLocaleTimeString(),
          receiptData,
        });

        if (selectedTable?.id) {
          orderRemoteDataSource.settleTable(selectedTable.id).catch((err) =>
            console.warn('Settle table session warning:', err)
          );
          usePosCatalogStore.getState().freeTableInCatalog(selectedTable.id);
          setTables((prev) =>
            prev.map((t) => (t.id === selectedTable.id ? { ...t, status: 'Available', activeOrderId: undefined } : t))
          );
          setSelectedTable(null);
        }

        setActiveTableOrder(null);
        clearCart();
        setCartDrawerOpen(false);
        return;
      }

      // Normal order placement with staged cart items
      const isPostPaid = mode === PosCheckoutModes.KOT_PAY_LATER;
      const orderTendered = (!isPostPaid && selectedPaymentMode === 'CASH' && posNumericTendered > 0) ? posNumericTendered : undefined;
      const orderChange = (!isPostPaid && selectedPaymentMode === 'CASH' && posChangeToReturn > 0) ? posChangeToReturn : undefined;

      const itemsPayload = cart.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitId: 1,
        amount: item.price,
        totalAmount: item.price * item.quantity,
      }));

      const effectivePaymentMode = selectedPaymentMode;

      const orderPayload: any = {
        restaurantId: currentRestId,
        name: effectiveCustomerName,
        mobileNumber: cleanPhone || undefined,
        tableId: selectedTable?.id,
        tableNumber: selectedTable?.tableNumber,
        sectionName: selectedTable?.sectionName,
        orderTypeId: selectedTable ? 1 : selectedOrderType,
        orderStatus: 'Confirmed',
        paymentStatus: isPostPaid ? 'Pending' : 'Paid',
        billingMode: isPostPaid ? BillingModes.POST_PAID : BillingModes.PRE_PAID,
        paymentMode: isPostPaid ? undefined : effectivePaymentMode,
        tenderedAmount: orderTendered,
        changeAmount: orderChange,
        source: selectedTable ? `Table ${selectedTable.tableNumber}` : PosOrderSources.POS_ADMIN,
        cgst: cgstAmount,
        sgst: sgstAmount,
        totalAmount: grandTotal,
        items: itemsPayload,
      };

      const orderId = await orderRepository.placeOrder(orderPayload);

      let fetchedOrder: OrderMaster | null = null;
      let pickupToken: string | undefined = undefined;

      if (orderId && orderId > 0) {
        markOrderAsKnown(orderId, isPostPaid ? 'Pending' : 'Confirmed');

        try {
          fetchedOrder = await orderRepository.getOrder(orderId);
          if (fetchedOrder && fetchedOrder.pickupToken) {
            pickupToken = fetchedOrder.pickupToken;
          }
        } catch {}

        if (!isPostPaid) {
          try {
            await orderRemoteDataSource.settleOrder(orderId, {
              orderId,
              paymentMode: effectivePaymentMode,
              discountAmount,
              tenderedAmount: orderTendered,
              changeAmount: orderChange,
              billingMode: BillingModes.PRE_PAID,
              orderStatus: 'Settled',
            });
            WalletEvents.emit();
          } catch (settleErr) {
            console.warn('Instant settle call warning:', settleErr);
          }
        }

        const selectedTypeObj = orderTypes.find((t) => t.id === selectedOrderType);
        const effectiveOrderType = selectedTable
          ? 'Dine-in'
          : fetchedOrder?.orderTypeName || selectedTypeObj?.typeName || 'Counter';

        const receiptData: ReceiptData = {
          orderId,
          orderNumber: String(fetchedOrder?.orderNumber || orderId),
          pickupToken: pickupToken || String(fetchedOrder?.orderNumber || orderId),
          restaurantName: restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
          logoUrl: restaurantConfig?.logoUrl || activeRestaurant?.logoUrl || undefined,
          address: restaurantConfig?.address || activeRestaurant?.address || '',
          city: restaurantConfig?.city || activeRestaurant?.city || '',
          state: restaurantConfig?.state || activeRestaurant?.state || '',
          contactPhone: restaurantConfig?.contactNumber || (activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || '',
          gstNumber: hasGstNumber ? (restaurantConfig?.gstNumber || '') : undefined,
          customerName: effectiveCustomerName,
          customerPhone: cleanPhone || undefined,
          orderType: effectiveOrderType,
          tableName: selectedTable ? `Table ${selectedTable.tableNumber}` : undefined,
          sectionName: selectedTable?.sectionName || undefined,
          items: cart.map((c) => ({
            itemName: c.itemName,
            quantity: c.quantity,
            unitPrice: c.price,
            totalPrice: c.price * c.quantity,
            cookingInstruction: c.notes,
            stationName: c.stationName,
            stationCode: c.stationCode,
          })),
          subtotal,
          discountAmount,
          cgstPercentage: hasGstNumber ? cgstRate : undefined,
          cgstAmount: hasGstNumber ? cgstAmount : undefined,
          sgstPercentage: hasGstNumber ? sgstRate : undefined,
          sgstAmount: hasGstNumber ? sgstAmount : undefined,
          taxAmount: totalTaxAmount,
          grandTotal: fetchedOrder?.totalAmount && fetchedOrder.totalAmount > 0 ? fetchedOrder.totalAmount : grandTotal,
          paymentMode: isPostPaid ? 'KOT (Pay Later)' : effectivePaymentMode,
          tenderedAmount: orderTendered,
          changeAmount: orderChange,
          date: new Date().toLocaleString('en-IN'),
          upiId: (restaurantConfig?.bankerUpiId || (restaurantConfig as any)?.upiId || (activeRestaurant as any)?.bankerUpiId || (activeRestaurant as any)?.upiId || '').trim(),
          upiPayeeName: restaurantConfig?.bankerAccountHolderName || restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
          showUpiQr: restaurantConfig?.printUpiQrOnReceipts !== false && (activeRestaurant as any)?.printUpiQrOnReceipts !== false,
          footerMessage: customFooter || 'Thank you! Please visit again.',
        };

        // Automatic Thermal Printing
        if (!isPostPaid) {
          if (autoPrintReceipt && autoPrintKot) {
            WebPrinterService.printBifurcatedOrder(receiptData, paperWidth, true, true).catch(() => {});
          } else if (autoPrintReceipt) {
            WebPrinterService.printReceipt(receiptData, paperWidth).catch(() => {});
          } else if (autoPrintKot) {
            WebPrinterService.printStationKots(receiptData, paperWidth).catch(() => {});
          }
        } else {
          if (autoPrintKot || isPostPaid) {
            WebPrinterService.printStationKots(receiptData, paperWidth).catch(() => {});
          }
        }

        if (isPostPaid) {
          clearCart();
          if (selectedTable?.id) {
            loadActiveTableOrder(selectedTable.id, true);
          }
          showAlert(
            activeTableOrder ? 'Add-on KOT Sent to Kitchen 🍳' : 'Sent to Kitchen (Pay Later) 🍳',
            `Order #${orderId}${pickupToken ? ` (Token #${pickupToken})` : ''} placed for ${effectiveCustomerName}.\nStatus: Active Unsettled Order.${
              activeTableOrder ? '\nDishes appended to running table tab.' : ''
            }`,
            'success',
            'OK',
            undefined,
            () => {
              if (selectedTable?.id) {
                loadActiveTableOrder(selectedTable.id, true);
              }
            }
          );
        } else {
          setOrderSuccessData({
            orderId,
            orderType: effectiveOrderType,
            table: selectedTable?.tableNumber,
            customerName: effectiveCustomerName,
            customerPhone: cleanPhone,
            items: cart,
            subtotal,
            totalTax: totalTaxAmount,
            grandTotal,
            paymentMode: effectivePaymentMode,
            tendered: orderTendered,
            change: orderChange,
            date: new Date().toLocaleTimeString(),
            receiptData,
          });

          if (!isPostPaid && selectedTable?.id) {
            orderRemoteDataSource.settleTable(selectedTable.id).catch((err) =>
              console.warn('Settle table session warning:', err)
            );
            usePosCatalogStore.getState().freeTableInCatalog(selectedTable.id);
            setTables((prev) =>
              prev.map((t) => (t.id === selectedTable.id ? { ...t, status: 'Available', activeOrderId: undefined } : t))
            );
            setSelectedTable(null);
            setActiveTableOrder(null);
          }

          clearCart();
          setCartDrawerOpen(false);
        }
      }
    } catch (err: any) {
      showAlert('Checkout Error', err?.message || 'Failed to process order. Please try again.', 'danger');
    } finally {
      setIsKotLoading(false);
      setIsSettling(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!orderSuccessData?.receiptData) return;
    WebPrinterService.printReceipt(orderSuccessData.receiptData, paperWidth);
  };

  const handlePrintKot = () => {
    if (!orderSuccessData?.receiptData) return;
    WebPrinterService.printKot(orderSuccessData.receiptData, paperWidth);
  };

  const handlePrintGuestCheck = () => {
    if (!activeTableOrder || !selectedTable) return;
    const receiptData: ReceiptData = {
      orderId: activeTableOrder.id,
      orderNumber: String(activeTableOrder.orderNumber || activeTableOrder.id),
      pickupToken: String(activeTableOrder.pickupToken || activeTableOrder.id),
      restaurantName: restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
      logoUrl: restaurantConfig?.logoUrl || activeRestaurant?.logoUrl || undefined,
      address: restaurantConfig?.address || activeRestaurant?.address || '',
      city: restaurantConfig?.city || activeRestaurant?.city || '',
      state: restaurantConfig?.state || activeRestaurant?.state || '',
      contactPhone: restaurantConfig?.contactNumber || (activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || '',
      gstNumber: hasGstNumber ? (restaurantConfig?.gstNumber || '') : undefined,
      customerName: activeTableOrder.customerName || 'Dine-In Guest',
      customerPhone: activeTableOrder.mobileNumber || undefined,
      orderType: 'DINE_IN',
      tableName: `Table ${selectedTable.tableNumber}`,
      sectionName: selectedTable.sectionName || undefined,
      items: (activeTableOrder.items || []).map((c: any) => ({
        itemName: c.itemName || 'Dish',
        quantity: c.quantity || 1,
        unitPrice: c.unitPrice || c.amount || 0,
        totalPrice: c.totalPrice || c.totalAmount || (c.quantity * (c.unitPrice || 0)) || 0,
      })),
      subtotal: activeTableOrder.subtotal || existingTableTotal,
      discountAmount: discountAmount || activeTableOrder.discountAmount || 0,
      cgstPercentage: hasGstNumber ? cgstRate : undefined,
      cgstAmount: hasGstNumber ? (activeTableOrder.cgst || 0) : undefined,
      sgstPercentage: hasGstNumber ? sgstRate : undefined,
      sgstAmount: hasGstNumber ? (activeTableOrder.sgst || 0) : undefined,
      taxAmount: hasGstNumber ? ((activeTableOrder.cgst || 0) + (activeTableOrder.sgst || 0)) : 0,
      grandTotal: payableGrandTotal,
      paymentMode: 'PAY LATER (PROFORMA BILL)',
      isProforma: true,
      upiId: (restaurantConfig?.bankerUpiId || (restaurantConfig as any)?.upiId || (activeRestaurant as any)?.bankerUpiId || (activeRestaurant as any)?.upiId || '').trim(),
      upiPayeeName: restaurantConfig?.bankerAccountHolderName || restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
      showUpiQr: restaurantConfig?.printUpiQrOnReceipts !== false && (activeRestaurant as any)?.printUpiQrOnReceipts !== false,
      date: new Date().toLocaleString('en-IN'),
      footerMessage: customFooter || 'Thank you! Please visit again.',
    };
    WebPrinterService.printReceipt(receiptData, paperWidth).catch(() => {});
    showAlert('Guest Check Printed', `Proforma bill for Table T-${selectedTable.tableNumber} sent to printer.`, 'success');
  };

  const handleShareWhatsApp = async () => {
    if (!orderSuccessData) return;
    let phone = orderSuccessData.customerPhone;
    if (!phone) {
      const entered = window.prompt('Enter 10-digit customer WhatsApp number:');
      if (!entered) return;
      phone = entered.replace(/[^0-9]/g, '').slice(-10);
    }
    if (!phone || phone.length < 10) {
      showAlert('Invalid Mobile', 'Please enter a valid 10-digit mobile number', 'warning');
      return;
    }

    const url = WebWhatsAppService.getWhatsAppReceiptUrl(phone, {
      restaurantName: restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
      orderId: orderSuccessData.orderId,
      customerName: orderSuccessData.customerName,
      items: orderSuccessData.items,
      grandTotal: orderSuccessData.grandTotal,
      paymentMode: orderSuccessData.paymentMode,
    });
    window.open(url, '_blank');
  };

  const storeDisplayName =
    restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant';

  // Renders the rich payment controls for both desktop panel and mobile/tablet drawer
  const renderCheckoutControls = () => (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* 1. SINGLE UNIFIED SCROLLABLE CONTAINER */}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
        {/* Customer Details Inputs */}
        <div className="p-3 sm:p-3.5 space-y-2 bg-[#FFFFFF] dark:bg-[#1B2127]">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#DE8626]" />
              <input
                type="text"
                maxLength={50}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value.slice(0, 50))}
                placeholder="Guest Name (Max 50)"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-8 pr-2 py-1.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
              {isCustomerLookupVerified && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                  <Check className="h-3 w-3" />
                  Verified
                </span>
              )}
            </div>

            <div className="w-32 relative">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#DE8626]" />
              <input
                type="tel"
                maxLength={10}
                value={customerPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Phone (10d)"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-8 pr-2 py-1.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
              {isLookingUpCustomer && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#DE8626] animate-pulse">
                  ...
                </span>
              )}
            </div>
          </div>

          {/* Running Kitchen Tab (Items Already Sent to Kitchen) */}
          {activeTableOrder && (
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/20 text-[#DE8626] shrink-0">
                    <Utensils className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-[#1E2930] dark:text-[#F3F4F6]">
                        Table T-{selectedTable?.tableNumber} • Running Tab
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-[#DE8626]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#DE8626] animate-pulse" />
                        Kitchen Active
                      </span>
                    </div>
                    <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                      Order #{activeTableOrder.orderNumber || activeTableOrder.id} • {activeTableOrder.items?.length || 0} dishes placed
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePrintGuestCheck}
                  className="flex items-center gap-1 rounded-xl border border-[#DE8626] bg-white dark:bg-[#1B2127] px-2.5 py-1 text-[11px] font-bold text-[#DE8626] hover:bg-amber-500/10 transition-colors shadow-2xs shrink-0"
                  title="Print Proforma / Guest Check Slip"
                >
                  <Printer className="h-3 w-3" />
                  <span>Bill Slip</span>
                </button>
              </div>

              {/* Running Dishes List */}
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {(activeTableOrder.items || []).map((it: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between items-start gap-2 text-xs py-1 px-2.5 rounded-xl bg-white/70 dark:bg-[#1B2127]/70 border border-[#E7E1DA]/60 dark:border-[#2B3540]/60"
                  >
                    <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6] break-words flex-1 min-w-0">
                      {it.quantity}x {it.itemName}
                    </span>
                    <span className="font-bold text-[#DE8626] shrink-0">
                      ₹{((it.unitPrice || it.amount || 0) * (it.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center font-bold text-xs pt-1.5 border-t border-amber-500/20 text-[#DE8626]">
                <span>Running Order Total:</span>
                <span className="text-sm font-black">₹{existingTableTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="p-3 sm:p-3.5 space-y-2.5 bg-[#FAF7F2]/40 dark:bg-[#111418]/40">
          <div className="flex items-center justify-between text-xs font-bold text-[#667085] dark:text-[#94A3B8] px-0.5">
            <span>
              {activeTableOrder ? `NEW ADD-ON DISHES (${cartTotalItems})` : `ITEMS IN ORDER (${cartTotalItems})`}
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-red-500 hover:text-red-700 text-[11px] font-semibold hover:underline"
              >
                Clear Cart
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-6 px-4 text-center rounded-2xl border border-dashed transition-all ${
              activeTableOrder
                ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white/60 dark:bg-[#1B2127]/60'
            }`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626] mb-2 shadow-2xs">
                {activeTableOrder ? <Plus className="h-5 w-5 stroke-[2.5]" /> : <ShoppingBag className="h-5 w-5" />}
              </div>
              <p className="font-extrabold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                {activeTableOrder ? 'Ready for Add-on Dishes' : 'Your cart is empty'}
              </p>
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-0.5 max-w-xs">
                {activeTableOrder
                  ? `Table T-${selectedTable?.tableNumber} is running. Tap any dish on the menu catalog to add Round 2 items, then send Add-on KOT.`
                  : 'Tap on any dish from the catalog to add items'}
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartKey}
                className="group relative rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-2.5 sm:p-3 shadow-2xs hover:border-[#DE8626]/50 hover:shadow-xs transition-all space-y-2"
              >
                {/* Upper Tier: Dish Name + Diet Indicator + Portions + Line Total */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {/* Small Diet Indicator */}
                    <span
                      className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-xs border ${
                        item.isVeg ? 'border-emerald-600/40 bg-emerald-500/10' : 'border-rose-600/40 bg-rose-500/10'
                      }`}
                      title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${item.isVeg ? 'bg-[#17845A]' : 'bg-[#DC2626]'}`} />
                    </span>

                    {/* Name & Portions / Modifiers */}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-xs sm:text-[13px] text-[#1E2930] dark:text-[#F3F4F6] leading-snug break-words">
                        {item.itemName}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#667085] dark:text-[#94A3B8] mt-0.5 flex-wrap">
                        <span className="font-semibold text-[#DE8626]">₹{item.price.toFixed(2)}</span>
                        {item.portionLabel && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-[#1E2930] dark:text-[#F3F4F6]">{item.portionLabel}</span>
                          </>
                        )}
                        {item.stationName && (
                          <>
                            <span>•</span>
                            <span className="bg-black/5 dark:bg-white/5 px-1 py-0.2 rounded text-[9px]">
                              {item.stationName}
                            </span>
                          </>
                        )}
                      </div>

                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-[#DE8626]/20 text-[9px] font-bold text-[#DE8626]">
                            + {item.modifiers.map((m) => m.modifierName).join(', ')}
                          </span>
                        </div>
                      )}

                      {item.notes && (
                        <p className="text-[10px] text-[#8C7A6B] dark:text-[#94A3B8] italic mt-0.5 line-clamp-1">
                          "{item.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Line Total Price */}
                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-black text-[#1E2930] dark:text-[#F3F4F6]">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Lower Tier: Stepper Controls + Delete Trash Icon */}
                <div className="flex items-center justify-between pt-1.5 border-t border-[#E7E1DA]/50 dark:border-[#2B3540]/50">
                  {/* Stepper with Numpad Modal trigger */}
                  <div className="flex items-center rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] border border-[#E7E1DA] dark:border-[#2B3540] p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartKey, -1)}
                      className="h-6 w-6 sm:h-6.5 sm:w-6.5 flex items-center justify-center rounded-lg text-[#667085] hover:bg-[#DE8626] hover:text-white active:scale-95 transition-all"
                      title="Decrease quantity"
                    >
                      <Minus className="h-3 w-3 stroke-[3]" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setNumpadItem({
                          cartKey: item.cartKey,
                          itemId: item.itemId,
                          itemName: item.itemName,
                          currentQuantity: item.quantity,
                          unitPrice: item.price,
                          description: item.description,
                        })
                      }
                      className="min-w-[28px] sm:min-w-[32px] h-5 sm:h-5.5 px-1.5 flex items-center justify-center rounded-md bg-white dark:bg-[#1B2127] text-xs font-black text-[#1E2930] dark:text-[#F3F4F6] shadow-2xs border border-[#DE8626]/25 hover:border-[#DE8626] transition-colors"
                      title="Click to enter exact quantity via numpad"
                    >
                      {item.quantity}
                    </button>

                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartKey, 1)}
                      className="h-6 w-6 sm:h-6.5 sm:w-6.5 flex items-center justify-center rounded-lg text-[#667085] hover:bg-[#DE8626] hover:text-white active:scale-95 transition-all"
                      title="Increase quantity"
                    >
                      <Plus className="h-3 w-3 stroke-[3]" />
                    </button>
                  </div>

                  {/* Remove Item Button */}
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.cartKey, -item.quantity)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-all"
                    title="Remove item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bill Breakdown & Settlement Section */}
        <div className="p-3 sm:p-4 bg-[#FFFFFF] dark:bg-[#1B2127] space-y-3">
          {/* GSTIN badge */}
          {hasGstNumber && Boolean(restaurantConfig?.gstNumber) && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#DE8626] text-[10px] font-bold">
              <Receipt className="h-3 w-3" />
              <span>GSTIN: {restaurantConfig!.gstNumber!.trim()}</span>
            </div>
          )}

          {/* Subtotal & Taxes Summary Card */}
          <div className="space-y-1.5 text-xs bg-[#FAF7F2] dark:bg-[#151A20] p-3 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540]">
            {activeTableOrder && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                <span>Running Tab Total</span>
                <span>₹{existingTableTotal.toFixed(2)}</span>
              </div>
            )}
            {cart.length > 0 && (
              <>
                <div className="flex justify-between text-[#667085] dark:text-[#94A3B8]">
                  <span>Subtotal ({cartTotalItems} items)</span>
                  <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">₹{subtotal.toFixed(2)}</span>
                </div>
                {hasGstNumber ? (
                  <>
                    <div className="flex justify-between text-[#667085] dark:text-[#94A3B8]">
                      <span>CGST ({cgstRate.toFixed(2)}%)</span>
                      <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">+₹{cgstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[#667085] dark:text-[#94A3B8]">
                      <span>SGST ({sgstRate.toFixed(2)}%)</span>
                      <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">+₹{sgstAmount.toFixed(2)}</span>
                    </div>
                  </>
                ) : null}
              </>
            )}
            <div className="flex justify-between items-baseline text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6] pt-2 border-t border-[#E7E1DA] dark:border-[#2B3540]">
              <div>
                <span className="font-black text-xs sm:text-sm">Payable Amount</span>
                {!hasGstNumber && (
                  <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] font-normal block">(incl. of taxes)</span>
                )}
              </div>
              <span className="text-base sm:text-lg font-black text-[#DE8626]">₹{payableGrandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2.5 pt-1 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
            {/* Payment Mode Selector with Icons */}
            <div>
              <span className="text-[10px] font-extrabold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                Payment Method
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'CASH', label: 'Cash', icon: IndianRupee },
                  { key: 'UPI', label: 'UPI / QR', icon: QrCode },
                  { key: 'CARD', label: 'Card', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = selectedPaymentMode === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedPaymentMode(m.key)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-xl border transition-all ${
                        isSelected
                          ? 'border-[#DE8626] bg-[#DE8626] text-white shadow-sm shadow-[#DE8626]/20'
                          : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]/50'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash Tendered & Change Return */}
            {selectedPaymentMode === 'CASH' && (
              <div className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#667085] dark:text-[#94A3B8]">Cash Received</span>
                  {posNumericTendered > 0 && (
                    <span
                      className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                        posNumericTendered >= payableGrandTotal
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30'
                      }`}
                    >
                      {posNumericTendered >= payableGrandTotal
                        ? `Change: ₹${posChangeToReturn.toFixed(2)}`
                        : `Short: ₹${(payableGrandTotal - posNumericTendered).toFixed(2)}`}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-extrabold text-xs text-[#DE8626]">₹</span>
                  <input
                    type="number"
                    value={posTenderedText}
                    onChange={(e) => setPosTenderedText(e.target.value)}
                    placeholder={payableGrandTotal.toFixed(0)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-7 pr-3 py-1.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setPosTenderedText(payableGrandTotal.toFixed(0))}
                    className="rounded-lg border border-[#DE8626] bg-amber-500/10 px-2.5 py-1 text-[10px] font-extrabold text-[#DE8626] hover:bg-[#DE8626] hover:text-white transition-colors"
                  >
                    Exact (₹{payableGrandTotal.toFixed(0)})
                  </button>
                  {[
                    Math.ceil((payableGrandTotal + 1) / 50) * 50,
                    Math.ceil((payableGrandTotal + 1) / 100) * 100,
                    500,
                  ]
                    .filter((val, idx, arr) => val > payableGrandTotal && arr.indexOf(val) === idx)
                    .slice(0, 2)
                    .map((val) => (
                      <button
                        key={`pill-${val}`}
                        type="button"
                        onClick={() => setPosTenderedText(val.toString())}
                        className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-2.5 py-1 text-[10px] font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] transition-colors"
                      >
                        ₹{val}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. STICKY ACTION BUTTONS PINNED AT BOTTOM */}
      <div className="shrink-0 p-3 sm:p-3.5 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-lg space-y-2">
        {selectedOrderType === 1 && selectedTable ? (
          /* ==================================================== */
          /* DINE-IN TABLE ORDER ACTIONS                          */
          /* ==================================================== */
          activeTableOrder && cart.length === 0 ? (
            /* Scenario A: Table is running, no new cart items staged */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#DE8626]">
                <span className="flex items-center gap-1.5">
                  <Utensils className="h-3.5 w-3.5 shrink-0" />
                  <span>Tap dishes on menu to send Add-on KOT</span>
                </span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-[#DE8626] text-white">
                  Multi-Round KOT
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePrintGuestCheck}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#DE8626] bg-amber-500/10 py-3.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-all shadow-xs"
                  title="Print Guest Check / Proforma Slip"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Bill Slip</span>
                </button>
                <button
                  type="button"
                  disabled={isSettling}
                  onClick={() => handleCheckout(PosCheckoutModes.PAY_AND_SETTLE)}
                  className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 py-3.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 disabled:opacity-40 transition-all"
                >
                  {isSettling ? (
                    <span>Settling...</span>
                  ) : (
                    <>
                      <Receipt className="h-4 w-4" />
                      <span>Settle Bill ₹{payableGrandTotal.toFixed(2)} [F2]</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : activeTableOrder && cart.length > 0 ? (
            /* Scenario B: Table is running AND cashier has staged new add-on dishes */
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isKotLoading || isSettling}
                onClick={() => handleCheckout(PosCheckoutModes.KOT_PAY_LATER)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 via-[#DE8626] to-[#CB741B] py-3.5 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:brightness-105 disabled:opacity-40 transition-all"
              >
                {isKotLoading ? (
                  <span>Sending...</span>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    <span>Send Add-on KOT 🍳 [F3]</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isSettling}
                onClick={() => handleCheckout(PosCheckoutModes.PAY_AND_SETTLE)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 py-3.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 disabled:opacity-40 transition-all"
              >
                {isSettling ? (
                  <span>Settling...</span>
                ) : (
                  <>
                    <Receipt className="h-4 w-4" />
                    <span>Settle All ₹{payableGrandTotal.toFixed(2)} [F2]</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Scenario C: Fresh table seating (first round) */
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={cart.length === 0 || isKotLoading || isSettling}
                onClick={() => handleCheckout(PosCheckoutModes.KOT_PAY_LATER)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 via-[#DE8626] to-[#CB741B] py-3.5 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isKotLoading ? (
                  <span>Sending...</span>
                ) : (
                  <>
                    <Utensils className="h-4 w-4" />
                    <span>Send to Kitchen (KOT) 🍳 [F3]</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={cart.length === 0 || isSettling}
                onClick={() => handleCheckout(PosCheckoutModes.PAY_AND_SETTLE)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 py-3.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isSettling ? (
                  <span>Settling...</span>
                ) : (
                  <>
                    <IndianRupee className="h-4 w-4" />
                    <span>Pay & Settle ₹{payableGrandTotal.toFixed(2)} [F2]</span>
                  </>
                )}
              </button>
            </div>
          )
        ) : (
          /* Standard Counter / Upfront Settle Actions */
          <>
            <div className="grid grid-cols-2 gap-2">
              {/* Send KOT (Pay Later) */}
              <button
                type="button"
                disabled={cart.length === 0 || isKotLoading || isSettling}
                onClick={() => handleCheckout(PosCheckoutModes.KOT_PAY_LATER)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DE8626] bg-transparent py-2.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Utensils className="h-4 w-4" />
                <span>Send KOT [F3]</span>
              </button>

              {/* Hold Order */}
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleParkCurrentCart}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] py-2.5 text-xs font-bold text-[#667085] hover:text-[#DE8626] hover:border-[#DE8626] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <PauseCircle className="h-4 w-4" />
                <span>Hold Order</span>
              </button>
            </div>

            {/* Pay & Settle (Instant Pre-Paid Settle) */}
            <button
              type="button"
              disabled={(cart.length === 0 && !activeTableOrder) || isKotLoading || isSettling}
              onClick={() => handleCheckout(PosCheckoutModes.PAY_AND_SETTLE)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 py-3.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isSettling ? (
                <span>Settling Bill...</span>
              ) : (
                <>
                  <IndianRupee className="h-4 w-4" />
                  <span>
                    {cart.length === 0 && activeTableOrder
                      ? `Settle Tab ₹${payableGrandTotal.toFixed(2)} [F2]`
                      : `Pay & Settle ₹${payableGrandTotal.toFixed(2)} [F2]`}
                  </span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <AuthGuard>
      <AppShell>
        <div className="flex flex-1 h-full min-h-0 flex-col overflow-hidden bg-[#FAF7F2] dark:bg-[#111418]">
          {/* ======================================================== */}
          {/* 1. WARNING BANNERS (GRACE, EXHAUSTED WALLET, INACTIVE)   */}
          {/* ======================================================== */}
          <div className="shrink-0 px-3 pt-1.5 space-y-1">
            {/* Subscription Grace Banner */}
            <SubscriptionGraceBanner onRenewPress={openRenewalModal} />

            {/* Prepaid Wallet Exhausted Banner */}
            {((restaurantConfig?.walletBalance !== undefined && restaurantConfig.walletBalance <= 0) ||
              operatingStatus?.status === 'WALLET_EXHAUSTED') && (
              <div
                onClick={() => setWalletModalOpen(true)}
                className="flex items-center justify-between rounded-2xl border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs cursor-pointer hover:bg-red-500/15 transition-all shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-500 text-white shrink-0">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-red-700 dark:text-red-400 truncate">
                      PREPAID WALLET EXHAUSTED (₹{(restaurantConfig?.walletBalance ?? 0).toFixed(2)})
                    </p>
                    <p className="text-[10px] text-red-600/80 dark:text-red-400/80 truncate">
                      Orders and billing locked. Click to recharge wallet and resume operations.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWalletModalOpen(true);
                  }}
                  className="rounded-xl bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 transition-colors shadow-xs shrink-0"
                >
                  Recharge
                </button>
              </div>
            )}

            {/* Inactive or Closed Warning Banner */}
            {(activeRestaurant?.isActive === false ||
              restaurantConfig?.isActive === false ||
              (operatingStatus && !operatingStatus.canPlaceOrder && operatingStatus.status !== 'WALLET_EXHAUSTED')) && (
              <div
                onClick={() => setOperatingModalOpen(true)}
                className="flex items-center justify-between rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs cursor-pointer hover:bg-amber-500/15 transition-all shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <p className="font-extrabold text-amber-800 dark:text-amber-300 truncate">
                      {activeRestaurant?.isActive === false || restaurantConfig?.isActive === false
                        ? 'STORE IS INACTIVE (ORDERS DISABLED)'
                        : operatingStatus?.status === 'PAUSED'
                        ? `KITCHEN PAUSED (${operatingStatus.remainingPauseMinutes || 0}m left)`
                        : 'STORE CLOSED FOR TAKING ORDERS'}
                    </p>
                    <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 truncate">
                      {operatingStatus?.statusMessage || 'Cannot take or place orders while inactive/closed. Click to reopen.'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-[#DE8626] shrink-0 hover:underline">
                  Reopen ⚙️
                </span>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* 3. MAIN WORKSPACE (LEFT CATALOG + RIGHT CHECKOUT PANEL)  */}
          {/* ======================================================== */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden pt-1.5">
            {/* LEFT SIDE: Order Types, Category Tabs, Search, Dishes */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-[#E7E1DA] dark:border-[#2B3540]">
              {/* Dynamic Order Types / Locked Dine-In Table Banner */}
              <div className="px-3 sm:px-4 py-2 bg-[#FFFFFF] dark:bg-[#1B2127] border-b border-[#E7E1DA] dark:border-[#2B3540] space-y-2">
                {selectedTable ? (
                  <div className="flex items-center justify-between rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-[#DE8626]/10 p-2.5 shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-[#DE8626] text-white shadow-xs shrink-0">
                        <Utensils className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-[#DE8626] uppercase">DINE-IN ORDER</span>
                          <span className="rounded-md bg-[#DE8626] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                            Table {selectedTable.tableNumber}
                          </span>
                          {activeTableOrder ? (
                            <span className="rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                              Active KOT (Order #{activeTableOrder.id})
                            </span>
                          ) : (
                            <span className="rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                              Fresh Seating
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] truncate">
                          Section: <strong className="text-[#1E2930] dark:text-[#F3F4F6]">{selectedTable.sectionName || 'Main Hall'}</strong> • Printed on Bill & KOT
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleOpenTablePicker}
                        className="rounded-xl border border-[#DE8626] bg-white dark:bg-[#1B2127] px-2.5 py-1 text-xs font-bold text-[#DE8626] hover:bg-amber-500/10 transition-colors shadow-xs flex items-center gap-1"
                        title="Switch to another table or view active orders"
                      >
                        <span>Switch Table 🪑</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTable(null);
                          setActiveTableOrder(null);
                          if (typeof window !== 'undefined') {
                            const url = new URL(window.location.href);
                            url.searchParams.delete('tableId');
                            window.history.replaceState({}, '', url.toString());
                          }
                          const firstActive = orderTypes.find((t) => t.isActive && t.id !== 1)?.id || 4;
                          setSelectedOrderType(firstActive);
                        }}
                        className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-2.5 py-1 text-xs font-bold text-[#667085] hover:text-red-500 transition-colors shadow-xs"
                        title="Clear table lock and return to standard POS"
                      >
                        Exit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {/* Dynamic Order Type Selector Chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {orderTypes.map((ot) => {
                          const isSelected = selectedOrderType === ot.id;
                          const isAllowed = ot.isAllowedByPlan;
                          const isStoreEnabled = ot.isEnabledByStore;
                          const isAvailable = ot.isActive;

                          const renderIcon = () => {
                            switch (ot.code) {
                              case 'COUNTER':
                                return <Store className="h-3.5 w-3.5" />;
                              case 'DINE_IN':
                                return <Utensils className="h-3.5 w-3.5" />;
                              case 'TAKEAWAY':
                                return <ShoppingBag className="h-3.5 w-3.5" />;
                              case 'DELIVERY':
                                return <Truck className="h-3.5 w-3.5" />;
                              default:
                                return <Store className="h-3.5 w-3.5" />;
                            }
                          };

                          return (
                            <button
                              key={`order-type-${ot.id}`}
                              type="button"
                              onClick={() => {
                                if (!isAllowed) {
                                  showAlert(
                                    'Feature Locked 🔒',
                                    `${ot.typeName} ordering is not included in your active subscription plan. Please upgrade to unlock this channel.`,
                                    'warning',
                                    'Upgrade Plan',
                                    'Cancel',
                                    openRenewalModal
                                  );
                                  return;
                                }
                                if (!isStoreEnabled) {
                                  showAlert(
                                    'Channel Disabled ⚙️',
                                    `${ot.typeName} ordering is currently disabled in your Store Settings. Enable it under Order Configuration.`,
                                    'warning'
                                  );
                                  return;
                                }
                                setSelectedOrderType(ot.id);
                                if ((ot.id === 1 || ot.code === 'DINE_IN') && !selectedTable) {
                                  handleOpenTablePicker();
                                }
                              }}
                              className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-gradient-to-r from-amber-500 to-[#DE8626] text-white shadow-xs shadow-[#DE8626]/20'
                                  : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
                              } ${!isAvailable ? 'opacity-60' : ''}`}
                            >
                              {renderIcon()}
                              <span>{ot.typeName}</span>
                              {!isAllowed && <Lock className="h-2.5 w-2.5 text-red-500" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Keyboard Shortcuts Hint */}
                      <div className="hidden xl:flex items-center gap-1.5 text-[10px] text-[#667085] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540]">
                        <Keyboard className="h-3.5 w-3.5 text-[#DE8626]" />
                        <span>F1: Search • F2: Settle • F3: KOT • F4: Clear</span>
                      </div>
                    </div>

                    {/* Dine-In Table Picker Banner Prompt if Dine-In selected without a table */}
                    {selectedOrderType === 1 && !selectedTable && (
                      <div
                        onClick={handleOpenTablePicker}
                        className="flex items-center justify-between p-2.5 rounded-2xl border border-dashed border-[#DE8626] bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-[#DE8626] text-white shadow-xs shrink-0">
                            <Utensils className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#DE8626]">No Table Selected for Dine-In</p>
                            <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                              Click here to select an active table to add dishes, or seat guests at an available table
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-[#DE8626] px-3 py-1 rounded-xl bg-white dark:bg-[#1B2127] border border-[#DE8626]/30 shadow-2xs hover:bg-[#DE8626] hover:text-white transition-all shrink-0">
                          Select Table 🪑
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Search Bar & Veg/Non-Veg Filter Controls Row */}
                <div className="flex items-center gap-2 pt-0.5">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#DE8626]" />
                    <input
                      id="pos-menu-search-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search dishes or item codes [Press F1]..."
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-9 pr-8 py-1.5 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C7A6B] hover:text-[#1E2930]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Veg / Non-Veg Toggle Chips */}
                  <div className="flex items-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-1 text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setVegFilter('ALL')}
                      className={`rounded-lg px-2 sm:px-2.5 py-1 font-semibold ${
                        vegFilter === 'ALL'
                          ? 'bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] shadow-xs'
                          : 'text-[#667085]'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setVegFilter('VEG')}
                      className={`flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 font-semibold ${
                        vegFilter === 'VEG'
                          ? 'bg-[#17845A] text-white shadow-xs'
                          : 'text-[#667085]'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      Veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setVegFilter('NON_VEG')}
                      className={`flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 font-semibold ${
                        vegFilter === 'NON_VEG'
                          ? 'bg-[#DC2626] text-white shadow-xs'
                          : 'text-[#667085]'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
                      Non-Veg
                    </button>
                  </div>

                  {/* Tablet & Mobile Cart Drawer Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setCartDrawerOpen(true)}
                    className={`lg:hidden relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all shrink-0 ${
                      cartTotalItems > 0
                        ? 'border-[#DE8626] bg-gradient-to-r from-amber-500 to-[#DE8626] text-white shadow-xs'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085]'
                    }`}
                    title="Open Order Cart"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>{cartTotalItems}</span>
                  </button>
                </div>
              </div>

              {/* Category Horizontal Scrolling Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] px-3 sm:px-4 py-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedCategory === null
                      ? 'bg-[#DE8626] text-white shadow-xs shadow-[#DE8626]/20'
                      : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
                  }`}
                >
                  All Dishes ({items.length})
                </button>
                {visibleCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-[#DE8626] text-white shadow-xs shadow-[#DE8626]/20'
                        : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
                    }`}
                  >
                    {cat.categoryName}
                  </button>
                ))}
              </div>

              {/* Product Menu Dishes Responsive Grid */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-28 lg:pb-4">
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <div
                        key={n}
                        className="h-44 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="py-24 text-center text-xs text-[#667085] dark:text-[#94A3B8]">
                    No dishes found matching your search keywords or filters.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
                    {filteredItems.map((dish) => {
                      const dishId = dish.id;
                      const isAvailable = isItemAvailable(dish);
                      const inCartMatches = cart.filter((ci) => ci.itemId === dishId);
                      const inCartQty = inCartMatches.reduce((s, ci) => s + ci.quantity, 0);

                      const portionTag =
                        dish.portionDisplay ||
                        (dish.unitName ? `${dish.quantity && dish.quantity > 0 ? dish.quantity : 1} ${dish.unitName}` : '') ||
                        (dish.categoryName ? dish.categoryName : dish.isVeg ? 'Veg' : 'Non-Veg');

                      // Station warning check
                      const stationId = dish.kitchenStationId;
                      const stationObj = stationId ? stations.find((s) => s.id === stationId) : null;
                      const isStationPaused = stationObj?.isPaused && (stationObj.remainingPauseMinutes || 0) > 0;
                      const isStationInactive = stationObj && !stationObj.isActive;

                      return (
                        <div
                          key={`dish-${dishId}`}
                          onClick={() => {
                            if (!isAvailable) return;
                            addToCartQuick(dish);
                          }}
                          className={`group relative flex flex-col justify-between rounded-2xl border overflow-hidden shadow-xs transition-all cursor-pointer select-none ${
                            inCartQty > 0
                              ? 'border-[#DE8626] bg-amber-500/5 ring-1 ring-[#DE8626]'
                              : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] hover:border-[#DE8626] hover:shadow-md'
                          } ${!isAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {/* Dish Image Banner */}
                          <div className="relative h-24 sm:h-28 w-full overflow-hidden bg-amber-500/5 dark:bg-amber-500/5">
                            <DishImage
                              src={dish.imageUrl}
                              alt={dish.itemName}
                              isVeg={dish.isVeg}
                              showDietBadge={false}
                              fallbackIconSize={26}
                            />

                            {/* Veg / Non-Veg Dot Badge Overlay */}
                            <div className="absolute top-2 left-2 flex h-4 w-4 items-center justify-center rounded-sm bg-white/95 dark:bg-[#1B2127]/95 shadow-xs border border-gray-200">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  dish.isVeg ? 'bg-[#17845A]' : 'bg-[#DC2626]'
                                }`}
                              />
                            </div>

                            {/* In-Cart Total Badge Overlay */}
                            {inCartQty > 0 && (
                              <div className="absolute top-2 right-2 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-[#DE8626] text-[10px] font-black text-white shadow-xs">
                                {inCartQty}
                              </div>
                            )}

                            {/* Station Warning Badge Overlay */}
                            {(isStationPaused || isStationInactive) && (
                              <div
                                className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-black text-white ${
                                  isStationInactive ? 'bg-red-600' : 'bg-amber-600'
                                }`}
                              >
                                {isStationInactive ? `${stationObj?.stationCode} OFF` : `PAUSED ${stationObj?.remainingPauseMinutes}m`}
                              </div>
                            )}

                            {/* Out of Stock Overlay */}
                            {!isAvailable && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-2xs">
                                <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                                  Out of Stock
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Card Details */}
                          <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="text-xs sm:text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6] leading-snug break-words">
                                {dish.itemName}
                              </h4>
                              {Boolean(dish.description) && (
                                <p className="text-[10px] text-[#667085] dark:text-[#94A3B8] line-clamp-1 mt-0.5">
                                  {dish.description}
                                </p>
                              )}
                              <p className="text-[10px] font-bold text-[#DE8626] mt-0.5">
                                {portionTag}
                              </p>
                            </div>

                            {/* Bottom Row: Price & Menza Stepper or + ADD button */}
                            <div className="mt-2 flex items-center justify-between pt-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
                              <span className="text-xs sm:text-sm font-black text-[#1E2930] dark:text-[#F3F4F6]">
                                ₹{dish.price}
                              </span>

                              {isAvailable && (
                                inCartQty > 0 ? (
                                  /* Inline Stepper matching Menza */
                                  <div
                                    className="flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 p-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const firstCartItem = inCartMatches[0];
                                        if (firstCartItem) updateQuantity(firstCartItem.cartKey, -1);
                                      }}
                                      className="flex h-6 w-6 items-center justify-center rounded-lg bg-white dark:bg-[#1B2127] text-[#D96B14] hover:bg-amber-500 hover:text-white transition-colors"
                                    >
                                      <Minus className="h-3 w-3 stroke-[3]" />
                                    </button>

                                    {/* Clickable quantity badge opening numpad */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const firstCartItem = inCartMatches[0];
                                        if (firstCartItem) {
                                          setNumpadItem({
                                            cartKey: firstCartItem.cartKey,
                                            itemId: dishId,
                                            itemName: dish.itemName,
                                            currentQuantity: inCartQty,
                                            unitPrice: dish.price,
                                            description: dish.description,
                                          });
                                        }
                                      }}
                                      className="min-w-[22px] px-1 text-center font-extrabold text-xs text-[#D96B14] hover:underline"
                                      title="Enter exact quantity via numpad"
                                    >
                                      {inCartQty}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => addToCartQuick(dish)}
                                      className="flex h-6 w-6 items-center justify-center rounded-lg bg-white dark:bg-[#1B2127] text-[#D96B14] hover:bg-amber-500 hover:text-white transition-colors"
                                    >
                                      <Plus className="h-3 w-3 stroke-[3]" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addToCartQuick(dish);
                                      }}
                                      className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500/15 to-[#DE8626]/20 border border-[#DE8626] px-2.5 py-1 text-xs font-black text-[#DE8626] hover:bg-[#DE8626] hover:text-white transition-all shadow-xs"
                                    >
                                      <Plus className="h-3 w-3 stroke-[3]" />
                                      <span>ADD</span>
                                    </button>

                                    {/* Customization Icon */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCustomizingItem(dish);
                                      }}
                                      title="Customize Portions & Notes"
                                      className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] hover:text-[#DE8626] hover:border-[#DE8626] transition-colors"
                                    >
                                      <SlidersHorizontal className="h-3 w-3" />
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDE: Pinned Desktop Checkout Drawer Panel (>= 1024px) */}
            <div className="hidden lg:flex w-[320px] xl:w-[360px] 2xl:w-[400px] flex-col border-l border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] h-full overflow-hidden shrink-0">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] px-3.5 py-2.5 sm:px-4 sm:py-3 bg-[#FAF7F2] dark:bg-[#151A20] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-[#DE8626] shrink-0">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs sm:text-sm font-black text-[#1E2930] dark:text-[#F3F4F6]">
                        Order Cart
                      </h3>
                      <span className="rounded-full bg-[#DE8626] px-1.5 py-0.2 text-[10px] font-black text-white">
                        {cartTotalItems}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                      {selectedTable ? `Table T-${selectedTable.tableNumber}` : 'Counter Quick Sale'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setParkedModalOpen(true)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-extrabold border transition-all ${
                      parkedCarts.length > 0
                        ? 'bg-amber-500/10 text-[#DE8626] border-[#DE8626]/40 hover:bg-amber-500/20'
                        : 'bg-black/5 dark:bg-white/5 border-transparent text-[#667085] hover:text-[#1E2930]'
                    }`}
                    title="View Held / Parked Carts"
                  >
                    <Clock className="h-3 w-3" />
                    <span>Held ({parkedCarts.length})</span>
                  </button>

                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={clearCart}
                      className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-700 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors"
                      title="Clear Cart"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Shared Checkout Controls */}
              {renderCheckoutControls()}
            </div>
          </div>

          {/* ======================================================== */}
          {/* 4. RESPONSIVE FLOATING CART STICKY BANNER (MOBILE/TABLET)*/}
          {/* ======================================================== */}
          {cart.length > 0 && (
            <div className="lg:hidden fixed bottom-20 left-3 right-3 max-w-lg mx-auto z-40">
              <button
                type="button"
                onClick={() => setCartDrawerOpen(true)}
                className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-500 via-[#DE8626] to-[#CB741B] px-4 py-3 text-white shadow-xl shadow-[#DE8626]/30 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#DE8626] font-black text-xs shadow-xs">
                    {cartTotalItems}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-extrabold leading-tight">Items Added</p>
                    <p className="text-[10px] text-white/90">
                      {selectedTable ? `Table ${selectedTable.tableNumber}` : 'Counter Order'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-black">₹{payableGrandTotal.toFixed(2)}</span>
                  <ChevronUp className="h-5 w-5" />
                </div>
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* 5. RESPONSIVE CART DRAWER BOTTOM SHEET (MOBILE/TABLET)   */}
          {/* ======================================================== */}
          {cartDrawerOpen && (
            <div
              className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setCartDrawerOpen(false)}
            >
              <div
                className="w-full max-h-[90vh] rounded-t-3xl border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top Handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                  <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E7E1DA] dark:border-[#2B3540] shrink-0 bg-[#FAF7F2] dark:bg-[#151A20]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-[#DE8626] shrink-0">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs sm:text-sm font-black text-[#1E2930] dark:text-[#F3F4F6]">
                          Order Cart
                        </h3>
                        <span className="rounded-full bg-[#DE8626] px-1.5 py-0.2 text-[10px] font-black text-white">
                          {cartTotalItems}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                        {selectedTable ? `Table T-${selectedTable.tableNumber}` : 'Counter Quick Sale'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setParkedModalOpen(true)}
                      className="text-[11px] font-bold text-[#DE8626] bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20"
                    >
                      Held ({parkedCarts.length})
                    </button>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-xs font-bold text-red-500 hover:text-red-700 px-1.5"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCartDrawerOpen(false)}
                      className="rounded-xl p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Full rich checkout controls matching desktop */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {renderCheckoutControls()}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 6. MODALS & POPUPS                                       */}
          {/* ======================================================== */}

          {/* Order Success & Thermal Slip Modal */}
          {orderSuccessData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 sm:p-6 shadow-2xl">
                <div className="flex flex-col items-center text-center mb-4 sm:mb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-2">
                    <Check className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    Order #{orderSuccessData.orderId} Placed!
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                    {orderSuccessData.paymentMode} • Total ₹{orderSuccessData.grandTotal}
                  </p>
                </div>

                {/* Printable Receipt Preview Area */}
                <div
                  id="thermal-print-area"
                  className="rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] p-3.5 sm:p-4 text-xs font-mono bg-[#FAF7F2] dark:bg-[#151A20] mb-4 sm:mb-5 max-h-64 overflow-y-auto"
                >
                  {(orderSuccessData.receiptData?.logoUrl ||
                    restaurantConfig?.logoUrl ||
                    (activeRestaurant as any)?.logoUrl) && (
                    <div className="flex justify-center pb-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          orderSuccessData.receiptData?.logoUrl ||
                          restaurantConfig?.logoUrl ||
                          (activeRestaurant as any)?.logoUrl
                        }
                        alt="Store Logo"
                        className="max-h-28 max-w-[140px] object-contain mx-auto"
                      />
                    </div>
                  )}
                  <div className="text-center font-bold pb-2 border-b border-dashed border-gray-400">
                    {storeDisplayName}
                  </div>
                  <div className="flex justify-between py-1 text-[11px]">
                    <span>Order: #{orderSuccessData.orderId}</span>
                    <span>{orderSuccessData.date}</span>
                  </div>
                  <div className="py-1 text-[11px]">
                    <span>Customer: {orderSuccessData.customerName}</span>
                  </div>
                  <div className="border-t border-b border-dashed border-gray-400 my-2 py-1 space-y-1">
                    {orderSuccessData.items.map((i: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start gap-2 text-[11px]">
                        <span className="break-words flex-1 min-w-0">{i.quantity}x {i.itemName}</span>
                        <span className="shrink-0">₹{((i.price || i.unitPrice) * i.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-bold pt-1">
                    <span>Grand Total:</span>
                    <span>₹{orderSuccessData.grandTotal}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={handlePrintReceipt}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DE8626] bg-amber-500/10 py-2.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Receipt</span>
                  </button>
                  <button
                    onClick={handlePrintKot}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-bold text-[#667085] hover:border-[#DE8626] hover:text-[#DE8626] transition-colors"
                  >
                    <Utensils className="h-4 w-4" />
                    <span>KOT</span>
                  </button>
                  <button
                    onClick={handleShareWhatsApp}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={clearFullSale}
                    className="flex items-center justify-center rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] transition-colors"
                  >
                    <span>New Sale</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dish Customization Modal */}
          <DishCustomizationModal
            isOpen={Boolean(customizingItem)}
            item={customizingItem}
            onClose={() => setCustomizingItem(null)}
            onConfirm={handleCustomizationConfirm}
          />

          {/* Fast Numeric Keypad Modal */}
          <QuickNumpadModal
            isOpen={Boolean(numpadItem)}
            itemName={numpadItem?.itemName || ''}
            currentQuantity={numpadItem?.currentQuantity || 1}
            unitPrice={numpadItem?.unitPrice || 0}
            description={numpadItem?.description}
            onClose={() => setNumpadItem(null)}
            onApply={(qty) => {
              if (numpadItem) {
                updateExactQuantity(numpadItem.cartKey, qty);
              }
            }}
          />

          {/* Parked Carts Modal */}
          <ParkedCartsModal
            isOpen={parkedModalOpen}
            parkedCarts={parkedCarts}
            onClose={() => setParkedModalOpen(false)}
            onResume={handleResumeParkedCart}
            onDiscard={handleDiscardParkedCart}
          />

          {/* Dine-In Table Picker & Active Order Selector Modal */}
          <TablePickerModal
            isOpen={tablePickerModalOpen}
            onClose={() => setTablePickerModalOpen(false)}
            tables={tables}
            currentSelectedTableId={selectedTable?.id}
            onSelectTable={handleSelectTableFromModal}
            onOpenFloorView={() => router.push('/tables')}
          />

          {/* Store Operating Status Controls Modal */}
          <StoreOperatingStatusModal
            isOpen={operatingModalOpen}
            onClose={() => setOperatingModalOpen(false)}
            restaurantId={currentRestId}
            restaurantName={storeDisplayName}
            status={operatingStatus}
            onStatusUpdated={(updated) => setOperatingStatus(updated)}
          />

          {/* Wallet Recharge Modal */}
          <WalletRechargeModal
            isOpen={walletModalOpen}
            onClose={() => {
              setWalletModalOpen(false);
              loadRestaurantConfig();
              loadOperatingStatus();
            }}
            restaurantId={currentRestId}
            onRechargeSuccess={() => {
              loadRestaurantConfig();
              loadOperatingStatus();
            }}
          />


          {/* Order Notification Drawer */}
          <OrderNotificationDrawer
            isOpen={notificationDrawerOpen}
            onClose={() => setNotificationDrawerOpen(false)}
            onSelectOrder={(orderId, tableId) => {
              if (tableId) {
                const matched = tables.find((t) => t.id === tableId);
                if (matched) {
                  setSelectedTable(matched);
                  setSelectedOrderType(1);
                  loadActiveTableOrder(tableId, true);
                }
              }
              setNotificationDrawerOpen(false);
            }}
          />

          {/* Web Printer Settings Modal */}
          <WebPrinterModal
            isOpen={printerModalOpen}
            onClose={() => setPrinterModalOpen(false)}
            restaurantName={storeDisplayName}
          />

          {/* Gilded Alert Modal */}
          <GildedAlertModal
            {...alertConfig}
            onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
          />
        </div>
      </AppShell>
    </AuthGuard>
  );
}
