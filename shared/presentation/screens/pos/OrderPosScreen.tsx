import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Store,
  Wifi,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  X,
  User,
  Lock,
  Truck,
  Utensils,
  Search,
  Phone,
  Receipt,
  ChevronUp,
  IndianRupee,
  Smartphone,
  Check,
  Bell,
  BellRing,
} from 'lucide-react-native';
import { Spacing } from '../../../core/theme/spacing';
import { WalletBalanceWidget } from '../../components/WalletBalanceWidget';
import { WalletEvents } from '../../../core/utils/walletEvents';
import { getSanitizedErrorMessage } from '../../../core/utils/errorSanitizer';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { GildedAlertModal, GildedAlertConfig } from '../../components/GildedAlertModal';
import { OrderRemoteDataSource } from '../../../data/datasources/OrderRemoteDataSource';
import { OrderRepositoryImpl } from '../../../data/repositories/OrderRepositoryImpl';
import { CatalogRemoteDataSource } from '../../../data/datasources/CatalogRemoteDataSource';
import { MenuItem } from '../../../domain/models/Item';
import {
  OrderMaster,
  ActiveOrderType,
  BillingModes,
  PosCheckoutModes,
  PosOrderSources,
} from '../../../domain/models/Order';
import { RestaurantConfig, StoreOperatingStatus } from '../../../domain/models/RestaurantConfig';
import { RestaurantConfigRemoteDataSource } from '../../../data/datasources/RestaurantConfigRemoteDataSource';
import { useAuthStore } from '../../state/useAuthStore';
import { useKitchenStationStore } from '../../state/useKitchenStationStore';
import { usePrinterStore } from '../../state/usePrinterStore';
import { useNotificationStore } from '../../state/useNotificationStore';
import { useSubscriptionStore } from '../../state/useSubscriptionStore';
import { SubscriptionGraceBanner } from '../../components/subscription/SubscriptionGraceBanner';
import { SubscriptionBillingScreen } from '../subscription/SubscriptionBillingScreen';
import { BluetoothPrinterScreen } from '../printer/BluetoothPrinterScreen';
import { OrderNotificationModal } from '../dashboard/OrderNotificationModal';
import { OrderAlertBanner } from '../../components/OrderAlertBanner';
import { StoreOperatingStatusModal } from '../../components/StoreOperatingStatusModal';
import { WalletRechargeModal } from '../../components/WalletRechargeModal';
import { ReceiptData } from '../../../core/printer/EscPosBuilder';
import { NetworkStrengthIndicator } from '../../components/NetworkStrengthIndicator';
import {
  startPosSignalRConnection,
  onStoreOperatingStatusChanged,
  onPosOrderCreated,
  onSignalRReconnected,
} from '../../../core/network/signalrService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const orderRemoteDataSource = new OrderRemoteDataSource();
const orderRepository = new OrderRepositoryImpl(orderRemoteDataSource);
const catalogDataSource = new CatalogRemoteDataSource();
const configDataSource = new RestaurantConfigRemoteDataSource();

interface OrderPosScreenProps {
  onClose?: () => void;
  isCounterOrderingAllowed?: boolean;
  isSelfPickupAllowed?: boolean;
  isTableOrderingAllowed?: boolean;
  isDeliveryAllowed?: boolean;
  isKdsAllowed?: boolean;
  isSmsAllowed?: boolean;
  initialTableId?: number;
  initialTableNumber?: string;
  initialSectionName?: string;
  isTableLocked?: boolean;
  onClearTableLock?: () => void;
}

const PosMenuSkeleton: React.FC = () => (
  <View style={styles.menuGrid2Col}>
    {[1, 2, 3, 4, 5, 6].map((idx) => (
      <View key={`pos-skel-${idx}`} style={styles.dishCardSkeleton}>
        <SkeletonLoader width="100%" height={92} borderRadius={12} />
        <View style={{ gap: 6, marginTop: 8 }}>
          <SkeletonLoader width="75%" height={14} borderRadius={4} />
          <SkeletonLoader width="40%" height={11} borderRadius={4} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <SkeletonLoader width={45} height={16} borderRadius={4} />
          <SkeletonLoader width={54} height={24} borderRadius={6} />
        </View>
      </View>
    ))}
  </View>
);

export const OrderPosScreen: React.FC<OrderPosScreenProps> = ({
  onClose,
  isCounterOrderingAllowed = true,
  isSelfPickupAllowed = true,
  isTableOrderingAllowed = true,
  isDeliveryAllowed = false,
  isKdsAllowed = true,
  isSmsAllowed = true,
  initialTableId,
  initialTableNumber,
  initialSectionName,
  isTableLocked = false,
  onClearTableLock,
}) => {
  const insets = useSafeAreaInsets();
  const { activeRestaurant } = useAuthStore();
  const activeRestId = activeRestaurant?.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;

  const {
    connectedDevice,
    autoPrintReceipt,
    autoPrintKot,
    printReceipt,
    printKot,
    printBifurcatedOrder,
    init: initPrinter,
  } = usePrinterStore();

  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [isKotLoading, setIsKotLoading] = useState(false);

  // Global Notification Store for POS Cashier Notifications
  const { unreadCount, processIncomingOrders } = useNotificationStore();

  // Initial sync of orders on screen mount
  useEffect(() => {
    if (!activeRestId || activeRestId <= 0) return;
    orderRemoteDataSource
      .getTodayOrders(activeRestId, 'ALL', 1, 20)
      .then((res) => {
        if (res?.items && res.items.length > 0) {
          processIncomingOrders(res.items);
        }
      })
      .catch(() => {});
  }, [activeRestId, processIncomingOrders]);

  // Dynamic active order types resolved from backend API
  const [orderTypes, setOrderTypes] = useState<ActiveOrderType[]>([
    { id: 4, code: 'COUNTER', typeName: 'Counter', configKey: 'IsCounterOrderingEnabled', isAllowedByPlan: isCounterOrderingAllowed, isEnabledByStore: true, isActive: isCounterOrderingAllowed, displayOrder: 1 },
    { id: 1, code: 'DINE_IN', typeName: 'Dine-in', configKey: 'IsTableOrderingEnabled', isAllowedByPlan: isTableOrderingAllowed, isEnabledByStore: true, isActive: isTableOrderingAllowed, displayOrder: 2 },
    { id: 2, code: 'TAKEAWAY', typeName: 'Takeaway', configKey: 'IsSelfPickupEnabled', isAllowedByPlan: isSelfPickupAllowed, isEnabledByStore: true, isActive: isSelfPickupAllowed, displayOrder: 3 },
  ]);

  const [selectedOrderType, setSelectedOrderType] = useState<number>(
    isTableLocked || initialTableNumber ? 1 : 4
  );

  const isTableAssigned = Boolean(isTableLocked || initialTableNumber || initialTableId);
  const isDineInTableOrder = isTableAssigned;
  const [dineInPaymentFlow, setDineInPaymentFlow] = useState<'pay_later' | 'pay_now'>(
    isTableAssigned ? 'pay_later' : 'pay_now'
  );

  useEffect(() => {
    if (isTableAssigned && isTableOrderingAllowed) {
      setSelectedOrderType(1);
      setDineInPaymentFlow('pay_later');
    } else {
      if (selectedOrderType === 1 && !isTableOrderingAllowed) {
        setSelectedOrderType(4);
      }
      setDineInPaymentFlow('pay_now');
    }
  }, [isTableAssigned, isTableOrderingAllowed]);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cartDrawerVisible, setCartDrawerVisible] = useState<boolean>(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('CASH');
  const [posTenderedText, setPosTenderedText] = useState<string>('');
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const [cartItems, setCartItems] = useState<
    Array<{
      itemId: number;
      itemName: string;
      description?: string;
      quantity: number;
      price: number;
      isVeg: boolean;
      portionLabel?: string;
      imageUrl?: string;
      stationName?: string;
      stationCode?: string;
    }>
  >([]);

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

  const [restaurantConfig, setRestaurantConfig] = useState<RestaurantConfig | null>(null);
  const [operatingStatus, setOperatingStatus] = useState<StoreOperatingStatus | null>(null);
  const [operatingStatusModalVisible, setOperatingStatusModalVisible] = useState<boolean>(false);
  const [walletModalVisible, setWalletModalVisible] = useState<boolean>(false);
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState<boolean>(false);

  const {
    subscription,
    lifecycleState: subscriptionLifecycleState,
    isExpired: isSubscriptionExpired,
    fetchSubscriptionStatus,
  } = useSubscriptionStore();

  const { stations, fetchStations } = useKitchenStationStore();

  useEffect(() => {
    initPrinter();
    if (activeRestId > 0) {
      startPosSignalRConnection(activeRestId);
      loadOrderTypes();
      loadRestaurantMenuItems();
      loadRestaurantConfig();
      loadOperatingStatus();
      fetchStations(activeRestId);
      fetchSubscriptionStatus(activeRestId);

      const unsubscribeStatus = onStoreOperatingStatusChanged((data) => {
        if (data) setOperatingStatus(data);
      });

      const unsubscribeCreated = onPosOrderCreated((data) => {
        if (data) {
          useNotificationStore.getState().handleOrderStatusChanged(data);
        }
      });

      const unsubscribeReconnect = onSignalRReconnected(() => {
        loadOperatingStatus();
        loadRestaurantConfig();
      });

      const unsubscribeWallet = WalletEvents.subscribe(() => {
        loadOperatingStatus();
        loadRestaurantConfig();
      });

      return () => {
        unsubscribeStatus();
        unsubscribeCreated();
        unsubscribeReconnect();
        unsubscribeWallet();
      };
    } else {
      setLoadingItems(false);
    }
  }, [activeRestId, initPrinter]);

  const loadOperatingStatus = async () => {
    try {
      const status = await configDataSource.getOperatingStatus(activeRestId);
      if (status) setOperatingStatus(status);
    } catch (err) {
      console.warn('Failed to load operating status for POS:', err);
    }
  };

  const loadOrderTypes = async () => {
    try {
      const types = await orderRemoteDataSource.getActiveOrderTypes(activeRestId);
      if (Array.isArray(types) && types.length > 0) {
        setOrderTypes(types);
        if (isTableLocked || initialTableNumber) {
          setSelectedOrderType(1);
        } else {
          const firstActive = types.find((t) => t.isActive);
          if (firstActive) {
            setSelectedOrderType(firstActive.id);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load active order types:', err);
    }
  };

  const loadRestaurantConfig = async () => {
    try {
      const cfg = await configDataSource.getConfig(activeRestId);
      setRestaurantConfig(cfg);
    } catch (err) {
      console.warn('Failed to load store config for POS:', err);
    }
  };

  const loadRestaurantMenuItems = async () => {
    try {
      setLoadingItems(true);
      const items = await catalogDataSource.getMenuItems(activeRestId);
      setMenuItems(Array.isArray(items) ? items : []);
    } catch (err) {
      console.warn('Failed to load menu items for POS:', err);
      setMenuItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Extract unique categories dynamically from menu items (without All)
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    menuItems.forEach((it) => {
      if (it.categoryName && it.categoryName.trim().length > 0) {
        cats.add(it.categoryName.trim());
      }
    });
    return Array.from(cats);
  }, [menuItems]);

  useEffect(() => {
    if (availableCategories.length > 0) {
      if (!selectedCategory || !availableCategories.includes(selectedCategory)) {
        setSelectedCategory(availableCategories[0]);
      }
    } else {
      setSelectedCategory('');
    }
  }, [availableCategories]);

  const filteredMenuItems = useMemo(() => {
    let result = menuItems;

    // 1. Category Filter
    if (selectedCategory && selectedCategory.trim().length > 0) {
      result = result.filter(
        (it: any) =>
          (it.categoryName || '').toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // 2. Veg / Non-Veg Filter
    if (selectedFilter === 'veg') {
      result = result.filter((it: any) => Boolean(it.isVeg ?? (it as any).IsVeg));
    } else if (selectedFilter === 'non-veg') {
      result = result.filter((it: any) => !Boolean(it.isVeg ?? (it as any).IsVeg));
    }

    // 3. Search Query Filter
    if (!menuSearchQuery.trim()) return result;
    const query = menuSearchQuery.toLowerCase().trim();
    return result.filter(
      (it: any) =>
        (it.itemName || '').toLowerCase().includes(query) ||
        (it.description || it.itemDescription || '').toLowerCase().includes(query) ||
        (it.categoryName || '').toLowerCase().includes(query)
    );
  }, [menuItems, selectedCategory, selectedFilter, menuSearchQuery]);

  const isItemAvailable = (dish: any): boolean => {
    if (dish?.isAvailable !== undefined) return Boolean(dish.isAvailable);
    if (dish?.IsAvailable !== undefined) return Boolean(dish.IsAvailable);
    if (dish?.isActive !== undefined) return Boolean(dish.isActive);
    if (dish?.IsActive !== undefined) return Boolean(dish.IsActive);
    return true;
  };

  const addItemToCart = (item: MenuItem) => {
    if (!isItemAvailable(item)) {
      showAlert('Out of Stock', `"${item.itemName || 'This item'}" is currently out of stock.`, 'warning');
      return;
    }

    const id = Number(item.id || (item as any).Id || 0);
    const name = item.itemName || (item as any).ItemName || 'Item';
    const price = Number(item.price ?? (item as any).Price ?? 0);
    const isVeg = Boolean(item.isVeg ?? (item as any).IsVeg ?? true);
    const imageUrl = item.imageUrl || (item as any).ImageUrl || (item as any).dishImageUrl || '';
    const portionLabel =
      item.portionDisplay ||
      (item.unitName ? `${item.quantity && item.quantity > 0 ? item.quantity : 1} ${item.unitName}` : '');
    const itemDesc = (item.description || (item as any).itemDescription || (item as any).ItemDescription || '').trim() || undefined;

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((c) => c.itemId === id);
      if (existingIndex >= 0) {
        return prev.map((c, idx) =>
          idx === existingIndex ? { ...c, quantity: c.quantity + 1 } : c
        );
      } else {
        return [
          ...prev,
          {
            itemId: id,
            itemName: name,
            description: itemDesc,
            quantity: 1,
            price,
            isVeg,
            portionLabel,
            imageUrl,
            stationName: item.kitchenStationName,
          },
        ];
      }
    });
  };

  // Quick Quantity Keypad Modal State
  const [qtyModalItem, setQtyModalItem] = useState<{
    itemId: number;
    itemName: string;
    description?: string;
    price: number;
    currentQty: number;
  } | null>(null);
  const [qtyInputValue, setQtyInputValue] = useState<string>('1');

  const openQtyModal = (itemId: number, itemName: string, currentQty: number, price: number, description?: string) => {
    setQtyModalItem({ itemId, itemName, description, currentQty, price });
    setQtyInputValue(currentQty.toString());
  };

  const handleApplyExactQuantity = () => {
    if (!qtyModalItem) return;
    const parsed = parseInt(qtyInputValue, 10);
    const targetQty = isNaN(parsed) || parsed < 0 ? 0 : parsed;

    if (targetQty <= 0) {
      setCartItems((prev) => prev.filter((c) => c.itemId !== qtyModalItem.itemId));
    } else {
      setCartItems((prev) => {
        const exists = prev.some((c) => c.itemId === qtyModalItem.itemId);
        if (exists) {
          return prev.map((c) =>
            c.itemId === qtyModalItem.itemId ? { ...c, quantity: targetQty } : c
          );
        } else {
          return [
            ...prev,
            {
              itemId: qtyModalItem.itemId,
              itemName: qtyModalItem.itemName,
              quantity: targetQty,
              price: qtyModalItem.price,
              isVeg: true,
            },
          ];
        }
      });
    }
    setQtyModalItem(null);
  };

  const handleNumpadPress = (digit: string) => {
    if (qtyInputValue === '0' || qtyInputValue === '') {
      setQtyInputValue(digit);
    } else if (qtyInputValue.length < 3) {
      setQtyInputValue(qtyInputValue + digit);
    }
  };

  const handleNumpadBackspace = () => {
    if (qtyInputValue.length <= 1) {
      setQtyInputValue('0');
    } else {
      setQtyInputValue(qtyInputValue.slice(0, -1));
    }
  };

  const handleNumpadClear = () => {
    setQtyInputValue('0');
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setCartItems(
      cartItems
        .map((item) => {
          if (item.itemId === itemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as typeof cartItems
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setPosTenderedText('');
  };

  const calculateSubtotal = () => cartItems.reduce((acc, curr) => acc + curr.quantity * curr.price, 0);
  const subtotal = calculateSubtotal();

  const cartTotalItems = useMemo(
    () => cartItems.reduce((acc, curr) => acc + curr.quantity, 0),
    [cartItems]
  );

  // Check if active restaurant has a configured GST number
  const hasGstNumber = Boolean(
    restaurantConfig?.gstNumber && restaurantConfig.gstNumber.trim().length > 0
  );

  // SGST & CGST rates (defaults to 2.5% each = 5% total if configured)
  const sgstRate = hasGstNumber ? Number(restaurantConfig?.sgstPercentage ?? 2.5) : 0;
  const cgstRate = hasGstNumber ? Number(restaurantConfig?.cgstPercentage ?? 2.5) : 0;
  const totalGstRate = sgstRate + cgstRate;

  // Tax amounts (calculated when GST number is present)
  const sgstAmount = hasGstNumber ? Number(((subtotal * sgstRate) / 100).toFixed(2)) : 0;
  const cgstAmount = hasGstNumber ? Number(((subtotal * cgstRate) / 100).toFixed(2)) : 0;
  const totalTaxAmount = hasGstNumber ? Number((sgstAmount + cgstAmount).toFixed(2)) : 0;

  // Grand Total: With GST -> subtotal + taxes; Without GST -> subtotal (incl. of all taxes)
  const grandTotal = hasGstNumber ? Number((subtotal + totalTaxAmount).toFixed(2)) : subtotal;

  // Live calculation of cash tendered and change to return
  const posNumericTendered = parseFloat(posTenderedText) || 0;
  const posChangeToReturn = Math.max(0, posNumericTendered - grandTotal);

  const handleCheckout = async (
    mode: (typeof PosCheckoutModes)[keyof typeof PosCheckoutModes]
  ) => {
    if (cartItems.length === 0) {
      showAlert('Cart is Empty', 'Please add items to cart before placing an order.', 'warning');
      return;
    }

    const cleanPhone = customerPhone.replace(/[^0-9]/g, '').trim();
    if (cleanPhone.length > 0 && cleanPhone.length !== 10) {
      showAlert('Invalid Phone Number 📱', 'Phone number must be exactly 10 digits.', 'warning');
      return;
    }

    const cleanName = (customerName || '').slice(0, 50).trim();
    const effectiveCustomerName = cleanName || 'Walk-in Customer';

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
        () => setWalletModalVisible(true)
      );
      return;
    }

    if (isSubscriptionExpired || subscriptionLifecycleState === 'EXPIRED') {
      showAlert(
        'Subscription Expired 🔒',
        'Your restaurant subscription has expired beyond the grace period. Order taking and billing are locked until your plan is renewed.\n\nPlease renew your plan to resume operations.',
        'danger',
        'Renew Subscription',
        'Cancel',
        () => setSubscriptionModalVisible(true)
      );
      return;
    }

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
        isInactive ? undefined : () => setOperatingStatusModalVisible(true)
      );
      return;
    }

    try {
      if (mode === PosCheckoutModes.KOT_PAY_LATER) {
        setIsKotLoading(true);
      } else {
        setIsSettling(true);
      }

      const itemsPayload = cartItems.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitId: 1,
        amount: item.price,
        totalAmount: item.price * item.quantity,
      }));

      // 1. Place the order
      const isPostPaid = mode === PosCheckoutModes.KOT_PAY_LATER;
      const orderTendered = (!isPostPaid && selectedPaymentMode === 'CASH' && posNumericTendered > 0) ? posNumericTendered : undefined;
      const orderChange = (!isPostPaid && selectedPaymentMode === 'CASH' && posChangeToReturn > 0) ? posChangeToReturn : undefined;

      const isTableOrder = Boolean(isTableLocked || initialTableNumber || initialTableId);
      const effectiveTableSource = initialTableNumber
        ? `Table ${initialTableNumber}${initialSectionName ? ` (${initialSectionName})` : ''}`
        : PosOrderSources.POS_ADMIN;

      const orderId = await orderRepository.placeOrder({
        restaurantId: activeRestId,
        name: effectiveCustomerName,
        mobileNumber: cleanPhone || undefined,
        tableId: isTableOrder ? initialTableId : undefined,
        tableNumber: isTableOrder ? initialTableNumber : undefined,
        sectionName: isTableOrder ? initialSectionName : undefined,
        orderTypeId: isTableOrder ? 1 : selectedOrderType,
        orderStatus: 'Confirmed',
        paymentStatus: isPostPaid ? 'Pending' : 'Paid',
        billingMode: isPostPaid ? BillingModes.POST_PAID : BillingModes.PRE_PAID,
        paymentMode: isPostPaid ? undefined : selectedPaymentMode,
        tenderedAmount: orderTendered,
        changeAmount: orderChange,
        source: effectiveTableSource,
        cgst: cgstAmount,
        sgst: sgstAmount,
        totalAmount: grandTotal,
        items: itemsPayload,
      });

      let fetchedOrder: OrderMaster | null = null;
      let pickupToken: string | undefined = undefined;

      if (orderId && orderId > 0) {
        // Silently mark this cashier-placed POS order as known in notification store
        // so background polling won't trigger incoming order alerts/chimes for the cashier
        useNotificationStore.getState().markOrderAsKnown(orderId, isPostPaid ? 'Pending' : 'Confirmed');

        try {
          fetchedOrder = await orderRepository.getOrder(orderId);
          if (fetchedOrder && fetchedOrder.pickupToken) {
            pickupToken = fetchedOrder.pickupToken;
          }
        } catch {}
      }

      const selectedTypeObj = orderTypes.find((t) => t.id === selectedOrderType);
      const effectiveOrderType = isTableOrder
        ? 'Dine-in'
        : fetchedOrder?.orderTypeName ||
          selectedTypeObj?.typeName ||
          (selectedOrderType === 2 ? 'Takeaway' : selectedOrderType === 3 ? 'Delivery' : selectedOrderType === 4 ? 'Counter' : 'Dine-in');

      const effectiveTableName = isTableOrder
        ? `Table ${initialTableNumber}`
        : fetchedOrder?.tableName ||
          (selectedOrderType === 4 ? 'Counter' : selectedOrderType === 2 ? 'Takeaway Counter' : selectedOrderType === 3 ? 'Delivery' : 'Dine-in');

      const effectiveSectionName = isTableOrder ? (initialSectionName || undefined) : undefined;
      const effectiveReceiptSource = isTableOrder
        ? `Table ${initialTableNumber}${initialSectionName ? ` (${initialSectionName})` : ''}`
        : fetchedOrder?.source || effectiveTableName;

      const effectiveAddress = (() => {
        const addr = restaurantConfig?.address?.trim() || activeRestaurant?.address?.trim() || '';
        const city = restaurantConfig?.city?.trim() || activeRestaurant?.city?.trim() || '';
        const state = restaurantConfig?.state?.trim() || activeRestaurant?.state?.trim() || '';

        const parts: string[] = [];
        if (addr) parts.push(addr);
        if (city && !addr.toLowerCase().includes(city.toLowerCase())) parts.push(city);
        if (state && !addr.toLowerCase().includes(state.toLowerCase())) parts.push(state);

        return parts.join(', ');
      })();

      const receiptData: ReceiptData = {
        orderId: fetchedOrder?.orderNumber || (orderId ? String(orderId) : ''),
        orderNumber: String(fetchedOrder?.orderNumber || (orderId ? String(orderId) : '')),
        pickupToken: pickupToken || String(fetchedOrder?.orderNumber || (orderId ? String(orderId) : '')),
        restaurantName: restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || '',
        address: effectiveAddress || undefined,
        contactPhone:
          restaurantConfig?.contactNumber ||
          (activeRestaurant as any)?.contactNumber ||
          activeRestaurant?.ownerMobile ||
          '',
        logoUrl: restaurantConfig?.logoUrl || (activeRestaurant as any)?.logoUrl || undefined,
        gstNumber: hasGstNumber ? restaurantConfig?.gstNumber?.trim() : undefined,
        customerName: fetchedOrder?.customerName || effectiveCustomerName,
        customerPhone: fetchedOrder?.mobileNumber || customerPhone.trim() || undefined,
        source: effectiveReceiptSource,
        tableName: effectiveTableName,
        sectionName: effectiveSectionName,
        orderType: effectiveOrderType,
        items: cartItems.map((item) => ({
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
          stationName: item.stationName,
          stationCode: item.stationCode,
        })),
        subtotal: subtotal,
        cgstAmount: hasGstNumber ? cgstAmount : undefined,
        sgstAmount: hasGstNumber ? sgstAmount : undefined,
        cgstPercentage: hasGstNumber ? cgstRate : undefined,
        sgstPercentage: hasGstNumber ? sgstRate : undefined,
        taxAmount: hasGstNumber ? totalTaxAmount : 0,
        taxPercentage: hasGstNumber ? totalGstRate : 0,
        grandTotal: fetchedOrder?.totalAmount && fetchedOrder.totalAmount > 0 ? fetchedOrder.totalAmount : grandTotal,
        paymentMode: isPostPaid ? 'PAY LATER' : selectedPaymentMode,
        paymentStatus: isPostPaid ? 'Pending' : 'Paid',
        tenderedAmount: orderTendered,
        changeAmount: orderChange,
        date: fetchedOrder?.createdAt ? new Date(fetchedOrder.createdAt) : new Date(),
      };

      let printStatusNote = '';

      if (mode === PosCheckoutModes.KOT_PAY_LATER) {
        // Mode 1: Send to Kitchen (Pay Later / Unsettled)
        const kdsNote = isKdsAllowed ? ' & KDS' : '';
        if (connectedDevice) {
          try {
            await printKot(receiptData);
            printStatusNote = `\n\n🖨️ KOT ticket sent to kitchen printer! (Token: #${receiptData.pickupToken})${isKdsAllowed ? '\n📺 Live KOT dispatched to Kitchen Display System (KDS)' : ''}`;
          } catch (printErr: any) {
            printStatusNote = `\n\n⚠️ KOT print failed: ${printErr?.message || 'Check printer connection'}${isKdsAllowed ? '\n📺 Live KOT dispatched to Kitchen Display System (KDS)' : ''}`;
          }
        } else {
          printStatusNote = isKdsAllowed
            ? "\n\n📺 Live KOT dispatched to Kitchen Display System (KDS)."
            : "\n\n💡 Order queued in Unsettled Orders. Settle anytime from Today's Revenue.";
        }

        const smsNote = (cleanPhone && isSmsAllowed) ? `\n📲 SMS confirmation sent to +91 ${cleanPhone}` : '';

        showAlert(
          `Sent to Kitchen${kdsNote} (Pay Later) 🍳`,
          `Order #${orderId || ''}${pickupToken ? ` (Token #${pickupToken})` : ''} placed for ${effectiveCustomerName}.\nStatus: Active Unsettled Order.${smsNote}${printStatusNote}`,
          'success',
          'OK',
          undefined,
          () => {
            clearCart();
            setCustomerName('');
            setCustomerPhone('');
            setMenuSearchQuery('');
            setCartDrawerVisible(false);
          }
        );
      } else {
        // Mode 2: Pay & Settle (Pre-Paid / Instant POS Settle)
        if (orderId && orderId > 0) {
          try {
            await orderRemoteDataSource.settleOrder(orderId, {
              orderId,
              paymentMode: selectedPaymentMode,
              discountAmount: 0,
              tenderedAmount: orderTendered,
              changeAmount: orderChange,
              billingMode: BillingModes.PRE_PAID,
              orderStatus: 'Settled',
            });
            WalletEvents.emit();
          } catch (settleErr: any) {
            console.warn('Settle order call warning:', settleErr?.message);
          }
        }

        if (connectedDevice) {
          try {
            let finalReceiptData = { ...receiptData };
            if (isTableOrder && initialTableId) {
              try {
                const tableActive = await orderRemoteDataSource.getActiveOrderByTable(initialTableId, activeRestId);
                if (tableActive && tableActive.items && tableActive.items.length > 0) {
                  finalReceiptData.items = tableActive.items.map((it) => ({
                    itemName: it.itemName || 'Dish',
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    totalPrice: it.totalPrice || it.quantity * it.unitPrice,
                  }));
                  if (tableActive.subtotal && tableActive.subtotal > 0) {
                    finalReceiptData.subtotal = tableActive.subtotal;
                  }
                  if (tableActive.cgst !== undefined) finalReceiptData.cgstAmount = tableActive.cgst;
                  if (tableActive.sgst !== undefined) finalReceiptData.sgstAmount = tableActive.sgst;
                  if (tableActive.totalAmount && tableActive.totalAmount > 0) {
                    finalReceiptData.grandTotal = tableActive.totalAmount;
                  }
                }
              } catch (tableOrderErr) {
                console.warn('Failed to fetch consolidated table items for invoice:', tableOrderErr);
              }
            }

            const { receiptPrinted, kotPrinted } = await printBifurcatedOrder(finalReceiptData);
            if (receiptPrinted && kotPrinted) {
              printStatusNote = `\n\n🖨️ Tax Invoice & KOT printed & bifurcated (Token #${receiptData.pickupToken})!`;
            } else if (receiptPrinted) {
              printStatusNote = `\n\n🖨️ Tax Invoice printed (Token #${receiptData.pickupToken})!`;
            } else if (kotPrinted) {
              printStatusNote = `\n\n🖨️ KOT printed for kitchen!`;
            } else {
              printStatusNote = `\n\n⚠️ Print warning: Check printer paper and connection.`;
            }
          } catch (printErr: any) {
            printStatusNote = `\n\n⚠️ Receipt print failed: ${printErr?.message || 'Check printer'}`;
          }
        }

        const changeNote = (selectedPaymentMode === 'CASH' && orderChange !== undefined && orderChange > 0)
          ? `\n💵 Change to Return: ₹${orderChange.toFixed(2)}`
          : '';

        const smsNote = (cleanPhone && isSmsAllowed) ? `\n📲 SMS confirmation sent to +91 ${cleanPhone}` : '';

        showAlert(
          'Order Paid & Settled! 💵',
          `Order #${orderId || '101'}${pickupToken ? ` (Token #${pickupToken})` : ''} for ${effectiveCustomerName} settled via ${selectedPaymentMode}.\nAmount: ₹${grandTotal.toFixed(2)} added to Live Revenue.${changeNote}${smsNote}${printStatusNote}`,
          'success',
          'OK',
          undefined,
          () => {
            clearCart();
            setCustomerName('');
            setCustomerPhone('');
            setMenuSearchQuery('');
            setCartDrawerVisible(false);
          }
        );
      }
    } catch (err: any) {
      showAlert('Checkout Error', getSanitizedErrorMessage(err, 'Failed to process order. Please try again.'), 'danger');
    } finally {
      setLoading(false);
      setIsKotLoading(false);
      setIsSettling(false);
    }
  };

  const handlePlaceOrder = (isKotOnly: boolean = false) => {
    handleCheckout(isKotOnly ? PosCheckoutModes.KOT_PAY_LATER : PosCheckoutModes.PAY_AND_SETTLE);
  };

  const storeDisplayName = restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Saffron Café';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" translucent={false} />
      <View style={styles.container}>
        {/* TOP STREAMLINED UNIFIED HEADER (Identical to HomePage) */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeftRow}>
            <View style={styles.headerLogoWrapper}>
              <Image
                source={
                  restaurantConfig?.logoUrl && restaurantConfig.logoUrl.trim().length > 0
                    ? { uri: restaurantConfig.logoUrl.trim() }
                    : activeRestaurant?.logoUrl && activeRestaurant.logoUrl.trim().length > 0
                    ? { uri: activeRestaurant.logoUrl.trim() }
                    : (activeRestaurant as any)?.logo && (activeRestaurant as any).logo.trim().length > 0
                    ? { uri: (activeRestaurant as any).logo.trim() }
                    : require('../../../../assets/menza-logo.png')
                }
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.headerInfoBlock}>
              <Text style={styles.headerOutletTitle} numberOfLines={1}>
                {storeDisplayName}
              </Text>
              <View style={styles.headerSubtitleRow}>
                <TouchableOpacity
                  onPress={() => setOperatingStatusModalVisible(true)}
                  style={[
                    styles.posStatusMiniBadge,
                    operatingStatus?.status === 'OPEN' && styles.posStatusMiniBadgeOpen,
                    operatingStatus?.status === 'PAUSED' && styles.posStatusMiniBadgePaused,
                    operatingStatus?.status === 'CLOSED' && styles.posStatusMiniBadgeClosed,
                  ]}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.posStatusMiniDot,
                      operatingStatus?.status === 'OPEN' && styles.posStatusMiniDotOpen,
                      operatingStatus?.status === 'PAUSED' && styles.posStatusMiniDotPaused,
                      operatingStatus?.status === 'CLOSED' && styles.posStatusMiniDotClosed,
                    ]}
                  />
                  <Text
                    style={[
                      styles.posStatusMiniText,
                      operatingStatus?.status === 'OPEN' && styles.posStatusMiniTextOpen,
                      operatingStatus?.status === 'PAUSED' && styles.posStatusMiniTextPaused,
                      operatingStatus?.status === 'CLOSED' && styles.posStatusMiniTextClosed,
                    ]}
                  >
                    {operatingStatus?.status === 'OPEN'
                      ? 'OPEN'
                      : operatingStatus?.status === 'PAUSED'
                      ? 'PAUSED'
                      : 'CLOSED'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.headerSubtitleDot}>•</Text>

                <Text style={styles.headerOutletSubtitle} numberOfLines={1}>
                  POS Terminal • Quick Billing
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRightRow}>
            {/* Dynamic Real-time Network Strength Indicator */}
            <NetworkStrengthIndicator size={16} />

            {/* Order Notification Bell Button */}
            <TouchableOpacity
              onPress={() => setNotificationModalVisible(true)}
              style={[styles.posBellBtn, unreadCount > 0 && styles.posBellBtnActive]}
              activeOpacity={0.8}
              accessibilityLabel={`Order Notifications, ${unreadCount} unread`}
            >
              {unreadCount > 0 ? (
                <BellRing size={16} color="#DE8626" />
              ) : (
                <Bell size={16} color="#7C6F62" />
              )}
              {unreadCount > 0 && (
                <View style={styles.posBellBadge}>
                  <Text style={styles.posBellBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Quick Bluetooth Printer Status */}
            <TouchableOpacity
              onPress={() => setPrinterModalVisible(true)}
              style={[styles.headerActionBtn, connectedDevice && styles.headerActionBtnConnected]}
              activeOpacity={0.8}
              accessibilityLabel={connectedDevice ? 'Printer Connected' : 'Pair Bluetooth Printer'}
            >
              <Printer size={16} color={connectedDevice ? '#16A34A' : '#78716C'} />
              <View
                style={[
                  styles.headerActionStatusDot,
                  connectedDevice ? styles.headerActionStatusDotGreen : styles.headerActionStatusDotAmber,
                ]}
              />
            </TouchableOpacity>

            {activeRestId > 0 && (
              <WalletBalanceWidget
                restaurantId={activeRestId}
                variant="pill"
                onPress={() => setWalletModalVisible(true)}
              />
            )}

            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtnCircle} activeOpacity={0.7}>
                <X size={16} color="#8C7A6B" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* SUBSCRIPTION GRACE PERIOD / EXPIRATION BANNER */}
        <SubscriptionGraceBanner
          onRenewPress={() => setSubscriptionModalVisible(true)}
          style={{ marginHorizontal: 12, marginBottom: 4 }}
        />

        {/* PREPAID WALLET EXHAUSTED BANNER */}
        {((restaurantConfig?.walletBalance !== undefined && restaurantConfig.walletBalance <= 0) || operatingStatus?.status === 'WALLET_EXHAUSTED') && (
          <TouchableOpacity
            style={styles.posWalletExhaustedBanner}
            onPress={() => setWalletModalVisible(true)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={styles.posWalletExhaustedIconBox}>
                <CreditCard size={14} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.posWalletExhaustedBannerTitle} numberOfLines={1}>
                  PREPAID WALLET EXHAUSTED (₹{(restaurantConfig?.walletBalance ?? 0).toFixed(2)})
                </Text>
                <Text style={styles.posWalletExhaustedBannerSub} numberOfLines={1}>
                  Orders and billing locked. Tap to recharge wallet and resume.
                </Text>
              </View>
            </View>
            <View style={styles.posWalletExhaustedBtn}>
              <Text style={styles.posWalletExhaustedBtnText}>Recharge</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* INACTIVE OR CLOSED WARNING BANNER */}
        {(activeRestaurant?.isActive === false || restaurantConfig?.isActive === false || (operatingStatus && !operatingStatus.canPlaceOrder && operatingStatus.status !== 'WALLET_EXHAUSTED')) && (
          <TouchableOpacity
            style={[
              styles.posClosedAlertBanner,
              (activeRestaurant?.isActive === false || restaurantConfig?.isActive === false || operatingStatus?.status === 'CLOSED')
                ? styles.posClosedAlertBannerClosed
                : styles.posClosedAlertBannerPaused
            ]}
            onPress={() => setOperatingStatusModalVisible(true)}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.posClosedAlertDot,
                (activeRestaurant?.isActive === false || restaurantConfig?.isActive === false || operatingStatus?.status === 'CLOSED')
                  ? styles.posClosedAlertDotClosed
                  : styles.posClosedAlertDotPaused
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.posClosedAlertTitle,
                  (activeRestaurant?.isActive === false || restaurantConfig?.isActive === false || operatingStatus?.status === 'CLOSED')
                    ? styles.posClosedAlertTitleClosed
                    : styles.posClosedAlertTitlePaused
                ]}
              >
                {activeRestaurant?.isActive === false || restaurantConfig?.isActive === false
                  ? 'STORE IS INACTIVE (ORDERS DISABLED)'
                  : operatingStatus?.status === 'PAUSED'
                  ? `KITCHEN PAUSED (${operatingStatus.remainingPauseMinutes || 0}m left)`
                  : 'STORE CLOSED FOR TAKING ORDERS'}
              </Text>
              <Text style={styles.posClosedAlertSubtitle}>
                {operatingStatus?.statusMessage || 'Cannot take or place orders while inactive/closed. Tap to reopen.'}
              </Text>
            </View>
            <Text style={styles.posClosedAlertAction}>Reopen ⚙️</Text>
          </TouchableOpacity>
        )}

        {/* 1. DYNAMIC ORDER TYPE SELECTOR / LOCKED DINE-IN TABLE BANNER */}
        {isTableLocked || initialTableNumber ? (
          <View style={styles.lockedTableBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.lockedTableIconBox}>
                <Utensils size={17} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.lockedTableTitle}>DINE-IN ORDER</Text>
                  <View style={styles.lockedTablePill}>
                    <Text style={styles.lockedTablePillText}>Table {initialTableNumber}</Text>
                  </View>
                </View>
                <Text style={styles.lockedTableSub} numberOfLines={1}>
                  Section: <Text style={{ fontWeight: '700', color: '#1F2937' }}>{initialSectionName || 'Main Hall'}</Text> • Printed on Bill & KOT
                </Text>
              </View>
            </View>
            {onClearTableLock && (
              <TouchableOpacity
                onPress={onClearTableLock}
                style={styles.unlockTableBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.unlockTableBtnText}>Change</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.orderTypeRow}>
            {orderTypes
              .filter((ot) => ot.code !== 'DINE_IN' || isTableOrderingAllowed)
              .map((ot) => {
                const isSelected = selectedOrderType === ot.id;
                const isAllowed = ot.isAllowedByPlan;
                const isStoreEnabled = ot.isEnabledByStore;
                const isAvailable = ot.isActive;

                const renderIcon = () => {
                  const iconColor = isSelected ? '#FFFFFF' : '#DE8626';
                  switch (ot.code) {
                    case 'COUNTER':
                      return <Store size={16} color={iconColor} strokeWidth={2.2} />;
                    case 'DINE_IN':
                      return <Utensils size={16} color={iconColor} strokeWidth={2.2} />;
                    case 'TAKEAWAY':
                      return <ShoppingBag size={16} color={iconColor} strokeWidth={2.2} />;
                    case 'DELIVERY':
                      return <Truck size={16} color={iconColor} strokeWidth={2.2} />;
                    default:
                      return <Store size={16} color={iconColor} strokeWidth={2.2} />;
                  }
                };

                return (
                  <TouchableOpacity
                    key={`order-type-${ot.id}`}
                    style={[
                      styles.orderTypePill,
                      isSelected && styles.orderTypePillActive,
                      !isAvailable && styles.orderTypePillDisabled,
                    ]}
                    onPress={() => {
                      if (!isAllowed) {
                        showAlert(
                          'Feature Locked 🔒',
                          `${ot.typeName} ordering is not included in your active subscription plan. Please upgrade to unlock this channel.`,
                          'warning'
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
                    }}
                    activeOpacity={0.8}
                  >
                    {renderIcon()}
                    <Text
                      style={[
                        styles.orderTypePillText,
                        isSelected && styles.orderTypePillTextActive,
                      ]}
                    >
                      {ot.typeName}
                    </Text>
                    {!isAllowed && <Lock size={10} color="#DC2626" />}
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        {/* 2. CATEGORY TABS HORIZONTAL ROW */}
        <View style={styles.categoryTabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {availableCategories.map((cat) => {
              const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <TouchableOpacity
                  key={`pos-cat-${cat}`}
                  style={[styles.categoryTabPill, isActive && styles.categoryTabPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
                      isActive && styles.categoryTabTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 3. LUXURY SEARCH & VEG/NON-VEG FILTER BAR */}
        <View style={styles.filterControlsRow}>
          <View style={[styles.searchBox, isSearchFocused && styles.searchBoxFocused]}>
            <View style={styles.searchIconBadge}>
              <Search size={14} color="#DE8626" strokeWidth={2.4} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search dishes or items..."
              placeholderTextColor="#9CA3AF"
              value={menuSearchQuery}
              onChangeText={setMenuSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
            {!!menuSearchQuery && (
              <TouchableOpacity
                onPress={() => setMenuSearchQuery('')}
                style={styles.searchClearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <X size={12} color="#8C7A6B" strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.vegToggleRow}>
            <TouchableOpacity
              style={[styles.vegChip, selectedFilter === 'all' && styles.vegChipActive]}
              onPress={() => setSelectedFilter('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.vegChipText, selectedFilter === 'all' && styles.vegChipTextActive]}>All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vegChip, selectedFilter === 'veg' && styles.vegChipActiveEmerald]}
              onPress={() => setSelectedFilter('veg')}
              activeOpacity={0.8}
            >
              <View style={[styles.vegInnerDot, { backgroundColor: '#17845A' }]} />
              <Text style={[styles.vegChipText, selectedFilter === 'veg' && { color: '#17845A', fontWeight: '800' }]}>Veg</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vegChip, selectedFilter === 'non-veg' && styles.vegChipActiveRuby]}
              onPress={() => setSelectedFilter('non-veg')}
              activeOpacity={0.8}
            >
              <View style={[styles.vegInnerDot, { backgroundColor: '#DC2626' }]} />
              <Text style={[styles.vegChipText, selectedFilter === 'non-veg' && { color: '#DC2626', fontWeight: '800' }]}>Non-Veg</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. PRODUCT MENU DISHES 2-COLUMN GRID (WITH DISH IMAGES) */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.menuScrollContent,
            cartItems.length > 0 && { paddingBottom: Math.max(insets.bottom, 12) + 85 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {loadingItems ? (
            <PosMenuSkeleton />
          ) : filteredMenuItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {menuSearchQuery ? 'No dishes match your search keywords.' : 'No menu dishes available in this category.'}
              </Text>
            </View>
          ) : (
            <View style={styles.menuGrid2Col}>
              {filteredMenuItems.map((dish) => {
                const dishId = Number(dish.id || (dish as any).Id || 0);
                const isAvailable = isItemAvailable(dish);
                const inCartItem = cartItems.find((c) => c.itemId === dishId);
                const inCartQty = inCartItem?.quantity || 0;

                const portionTag =
                  dish.portionDisplay ||
                  (dish.unitName ? `${dish.quantity && dish.quantity > 0 ? dish.quantity : 1} ${dish.unitName}` : '') ||
                  (dish.categoryName ? dish.categoryName : dish.isVeg ? 'Veg' : 'Non-Veg');

                return (
                  <TouchableOpacity
                    key={`dish-${dishId}`}
                    style={[
                      styles.dishCard,
                      inCartQty > 0 && styles.dishCardInCart,
                      !isAvailable && styles.dishCardDisabled,
                    ]}
                    onPress={() => addItemToCart(dish)}
                    activeOpacity={isAvailable ? 0.78 : 1}
                  >
                    {/* Dish Image / Placeholder Banner */}
                    <View style={styles.dishImageContainer}>
                      {dish.imageUrl ? (
                        <Image
                          source={{ uri: dish.imageUrl }}
                          style={styles.dishImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.dishImagePlaceholder}>
                          <Utensils size={24} color="#DE8626" />
                        </View>
                      )}

                      {/* Veg / Non-Veg Dot Badge Overlay */}
                      <View style={styles.dishVegOverlayBadge}>
                        <View
                          style={[
                            styles.dishVegDotSmall,
                            { backgroundColor: dish.isVeg ? '#17845A' : '#DC2626' },
                          ]}
                        />
                      </View>

                      {/* Station Warning Overlay Badge */}
                      {(() => {
                        const stationId = dish.kitchenStationId || (dish as any).KitchenStationId;
                        if (!stationId) return null;
                        const st = stations.find((s) => s.id === stationId);
                        if (!st) return null;
                        const isPaused = st.isPaused && st.remainingPauseMinutes > 0;
                        const isInactive = !st.isActive;
                        if (!isPaused && !isInactive) return null;
                        return (
                          <View style={[styles.dishStationWarningBadge, isInactive ? styles.dishStationInactiveBadge : styles.dishStationPausedBadge]}>
                            <Text style={styles.dishStationWarningText}>
                              {isInactive ? `${st.stationCode} OFF` : `PAUSED ${st.remainingPauseMinutes}m`}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>

                    {/* Dish Details Section */}
                    <View style={styles.dishContentSection}>
                      <Text
                        style={[
                          styles.dishCardName,
                          !isAvailable && styles.dishCardNameDisabled,
                        ]}
                        numberOfLines={1}
                      >
                        {dish.itemName}
                      </Text>

                      {Boolean((dish.description || (dish as any).itemDescription || (dish as any).ItemDescription)?.trim()) && (
                        <Text
                          style={[
                            styles.dishCardDesc,
                            !isAvailable && styles.dishCardDescDisabled,
                          ]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {(dish.description || (dish as any).itemDescription || (dish as any).ItemDescription).trim()}
                        </Text>
                      )}

                      <Text
                        style={[
                          styles.dishCardTag,
                          !isAvailable && styles.dishCardTagDisabled,
                        ]}
                        numberOfLines={1}
                      >
                        {portionTag}
                      </Text>

                      {/* Bottom Row: Price & Action Stepper / ADD Button */}
                      <View style={styles.dishCardBottomRow}>
                        <Text
                          style={[
                            styles.dishCardPrice,
                            !isAvailable && styles.dishCardPriceDisabled,
                          ]}
                        >
                          ₹{dish.price}
                        </Text>

                        {/* Action Button: Stepper in Menza warm amber theme if in cart, or ADD button */}
                        {isAvailable && (
                          inCartQty > 0 ? (
                            <View style={styles.dishCardInlineStepper}>
                              <TouchableOpacity
                                style={styles.dishCardStepperBtn}
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  updateQuantity(dishId, -1);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                activeOpacity={0.7}
                              >
                                <Minus size={12} color="#D96B14" strokeWidth={3} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.dishCardQtyBtn}
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  openQtyModal(dishId, dish.itemName, inCartQty, dish.price, (dish.description || (dish as any).itemDescription || (dish as any).ItemDescription)?.trim());
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                activeOpacity={0.75}
                              >
                                <Text style={styles.dishCardQtyText}>{inCartQty}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.dishCardStepperBtn}
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  updateQuantity(dishId, 1);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                activeOpacity={0.7}
                              >
                                <Plus size={12} color="#D96B14" strokeWidth={3} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.dishCardAddBtn}
                              onPress={() => addItemToCart(dish)}
                              activeOpacity={0.8}
                            >
                              <Plus size={11} color="#D96B14" strokeWidth={3} />
                              <Text style={styles.dishCardAddBtnText}>ADD</Text>
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                    </View>

                    {!isAvailable && (
                      <View style={styles.dishCardOutOfStockOverlay}>
                        <Text style={styles.dishCardOutOfStockText}>Out of Stock</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* 5. RESPONSIVE FLOATING BOTTOM CART STICKY BANNER */}
        {cartItems.length > 0 && (
          <View
            pointerEvents="box-none"
            style={[
              styles.floatingCartBannerContainer,
              { bottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <TouchableOpacity
              style={styles.floatingCartBannerWrapper}
              onPress={() => setCartDrawerVisible(true)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.floatingCartBannerGradient}
              >
                <View style={styles.floatingCartLeft}>
                  <View style={styles.floatingCartCountCircle}>
                    <Text style={styles.floatingCartCountText}>{cartTotalItems}</Text>
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.floatingCartLabel}>Items Added</Text>
                      {/* Active Delivery / Order Type Badge on Floating Cart */}
                      {(() => {
                        const activeTypeObj = orderTypes.find((t) => t.id === selectedOrderType);
                        return (
                          <View style={styles.floatingCartTypeBadge}>
                            {activeTypeObj?.code === 'DELIVERY' ? (
                              <Truck size={10} color="#D96B14" strokeWidth={2.4} />
                            ) : activeTypeObj?.code === 'TAKEAWAY' ? (
                              <ShoppingBag size={10} color="#D96B14" strokeWidth={2.4} />
                            ) : activeTypeObj?.code === 'DINE_IN' ? (
                              <Utensils size={10} color="#D96B14" strokeWidth={2.4} />
                            ) : (
                              <Store size={10} color="#D96B14" strokeWidth={2.4} />
                            )}
                            <Text style={styles.floatingCartTypeBadgeText}>
                              {activeTypeObj?.typeName || 'Counter'}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </View>
                </View>
                <View style={styles.floatingCartRight}>
                  <Text style={styles.floatingCartAmount}>₹{grandTotal.toFixed(2)}</Text>
                  <ChevronUp size={20} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 6. RESPONSIVE CART & CHECKOUT BOTTOM SHEET MODAL */}
      <Modal
        visible={cartDrawerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCartDrawerVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.cartDrawerOverlay}
        >
          <TouchableOpacity
            style={styles.cartDrawerBackdrop}
            activeOpacity={1}
            onPress={() => setCartDrawerVisible(false)}
          />
          <View
            style={[
              styles.cartDrawerCard,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {/* Modal Top Handle */}
            <View style={styles.cartDrawerHandle} />

            {/* Modal Header */}
            <View style={styles.cartDrawerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShoppingBag size={18} color="#DE8626" />
                <Text style={styles.cartDrawerTitle}>Order Cart ({cartTotalItems} items)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={clearCart} style={styles.cartDrawerClearBtn}>
                  <Trash2 size={14} color="#DC2626" />
                  <Text style={styles.cartDrawerClearText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCartDrawerVisible(false)}
                  style={styles.cartDrawerCloseBtn}
                  activeOpacity={0.7}
                >
                  <X size={18} color="#8C7A6B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Active Delivery / Order Type Selector inside Cart Drawer */}
            <View style={styles.cartOrderTypeSection}>
              <View style={styles.cartOrderTypeHeaderRow}>
                <Text style={styles.cartOrderTypeSectionLabel}>DELIVERY / ORDER TYPE</Text>
                {isTableLocked || initialTableNumber ? (
                  <Text style={styles.cartActiveOrderTypeHint}>
                    Locked: Dine-In Table Order
                  </Text>
                ) : (
                  (() => {
                    const activeTypeObj = orderTypes.find((t) => t.id === selectedOrderType);
                    return (
                      <Text style={styles.cartActiveOrderTypeHint}>
                        Selected: {activeTypeObj?.typeName || 'Counter'}
                      </Text>
                    );
                  })()
                )}
              </View>
              {isTableLocked || initialTableNumber ? (
                <View style={styles.cartLockedTableBadge}>
                  <Utensils size={14} color="#D96B14" strokeWidth={2.5} />
                  <Text style={styles.cartLockedTableText}>
                    Table {initialTableNumber} ({initialSectionName || 'Main Hall'}) • Dine-in
                  </Text>
                </View>
              ) : (
                <View style={styles.cartOrderTypeSelectorRow}>
                  {orderTypes.map((ot) => {
                    const isSelected = selectedOrderType === ot.id;
                    const isAvailable = ot.isActive;

                    const renderCartIcon = () => {
                      const iconColor = isSelected ? '#FFFFFF' : '#DE8626';
                      switch (ot.code) {
                        case 'COUNTER':
                          return <Store size={13} color={iconColor} strokeWidth={2.2} />;
                        case 'DINE_IN':
                          return <Utensils size={13} color={iconColor} strokeWidth={2.2} />;
                        case 'TAKEAWAY':
                          return <ShoppingBag size={13} color={iconColor} strokeWidth={2.2} />;
                        case 'DELIVERY':
                          return <Truck size={13} color={iconColor} strokeWidth={2.2} />;
                        default:
                          return <Store size={13} color={iconColor} strokeWidth={2.2} />;
                      }
                    };

                    return (
                      <TouchableOpacity
                        key={`cart-drawer-type-${ot.id}`}
                        style={[
                          styles.cartOrderTypeChip,
                          isSelected && styles.cartOrderTypeChipActive,
                          !isAvailable && styles.cartOrderTypeChipDisabled,
                        ]}
                        onPress={() => {
                          if (!ot.isAllowedByPlan) {
                            showAlert(
                              'Feature Locked 🔒',
                              `${ot.typeName} ordering is not included in your active subscription plan.`,
                              'warning'
                            );
                            return;
                          }
                          if (!ot.isEnabledByStore) {
                            showAlert(
                              'Channel Disabled ⚙️',
                              `${ot.typeName} ordering is currently disabled in your Store Settings.`,
                              'warning'
                            );
                            return;
                          }
                          setSelectedOrderType(ot.id);
                        }}
                        activeOpacity={0.8}
                      >
                        {renderCartIcon()}
                        <Text
                          style={[
                            styles.cartOrderTypeChipText,
                            isSelected && styles.cartOrderTypeChipTextActive,
                          ]}
                        >
                          {ot.typeName}
                        </Text>
                        {!ot.isAllowedByPlan && <Lock size={9} color="#DC2626" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Scrollable Content (Customer info, Items, Tax summary) */}
            <ScrollView
              style={styles.cartDrawerScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {/* Customer Details Inputs (50-char Name & 10-digit Phone) */}
              <View style={styles.cartCustomerBox}>
                <View style={styles.cartCustomerInputRow}>
                  <User size={13} color="#DE8626" />
                  <TextInput
                    style={styles.cartCustomerInput}
                    placeholder="Guest Name (Max 50)"
                    placeholderTextColor="#9CA3AF"
                    maxLength={50}
                    value={customerName}
                    onChangeText={(text) => setCustomerName(text.slice(0, 50))}
                  />
                </View>
                <View style={styles.cartCustomerInputRow}>
                  <Phone size={13} color="#DE8626" />
                  <TextInput
                    style={styles.cartCustomerInput}
                    placeholder="Phone (10 Digits)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={customerPhone}
                    onChangeText={(text) => setCustomerPhone(text.replace(/[^0-9]/g, '').slice(0, 10))}
                  />
                </View>
              </View>

              {/* Cart Items List */}
              <View style={styles.cartItemsListContainer}>
                {cartItems.map((item) => (
                  <View key={`drawer-cart-item-${item.itemId}`} style={styles.cartDrawerItemRow}>
                    <View style={styles.cartDrawerItemLeft}>
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.cartDrawerItemImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.cartDrawerItemImagePlaceholder}>
                          <Utensils size={14} color="#DE8626" />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View
                            style={[
                              styles.dishVegDotSmall,
                              { backgroundColor: item.isVeg ? '#17845A' : '#DC2626' },
                            ]}
                          />
                          <Text style={styles.cartDrawerItemName} numberOfLines={1}>
                            {item.itemName}
                          </Text>
                        </View>
                        {Boolean(item.description) && (
                          <Text style={styles.cartDrawerItemDesc} numberOfLines={1} ellipsizeMode="tail">
                            {item.description}
                          </Text>
                        )}
                        <Text style={styles.cartDrawerItemUnitPrice}>
                          ₹{item.price} {item.portionLabel ? `• ${item.portionLabel}` : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cartDrawerItemRight}>
                      <View style={styles.qtyStepper}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateQuantity(item.itemId, -1)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Minus size={13} color="#D96B14" strokeWidth={3} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.qtyTextBtn}
                          onPress={() => openQtyModal(item.itemId, item.itemName, item.quantity, item.price, item.description)}
                          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.qtyText}>{item.quantity}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateQuantity(item.itemId, 1)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Plus size={13} color="#D96B14" strokeWidth={3} />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.cartDrawerItemTotal}>₹{(item.quantity * item.price).toFixed(2)}</Text>

                      <TouchableOpacity
                        onPress={() => updateQuantity(item.itemId, -item.quantity)}
                        style={styles.cartDrawerTrashBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Trash2 size={15} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Tax & Bill Breakdown */}
              <View style={styles.cartBillCard}>
                {hasGstNumber && Boolean(restaurantConfig?.gstNumber) && (
                  <View style={styles.gstinBadge}>
                    <Receipt size={11} color="#D96B14" />
                    <Text style={styles.gstinBadgeText}>
                      GSTIN: {restaurantConfig!.gstNumber!.trim()}
                    </Text>
                  </View>
                )}

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal (Item Total)</Text>
                  <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
                </View>

                {hasGstNumber ? (
                  <>
                    <View style={styles.gstSummaryRow}>
                      <Text style={styles.gstSummaryLabel}>CGST ({cgstRate.toFixed(2)}%)</Text>
                      <Text style={styles.gstSummaryValue}>+₹{cgstAmount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.gstSummaryRow}>
                      <Text style={styles.gstSummaryLabel}>SGST ({sgstRate.toFixed(2)}%)</Text>
                      <Text style={styles.gstSummaryValue}>+₹{sgstAmount.toFixed(2)}</Text>
                    </View>
                  </>
                ) : null}

                <View style={styles.summaryDivider} />

                <View style={styles.totalRow}>
                  <View>
                    <Text style={styles.totalLabel}>Grand Total</Text>
                    {!hasGstNumber && (
                      <Text style={styles.inclusiveTaxesLabel}>(incl. of all taxes)</Text>
                    )}
                  </View>
                  <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
                </View>
              </View>

              {/* Dynamic Payment & Flow Section */}
              {isDineInTableOrder && dineInPaymentFlow === 'pay_later' ? (
                <View style={styles.cartDineInNoticeBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.cartDineInNoticeIconBox}>
                      <Utensils size={15} color="#DE8626" strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartDineInNoticeTitle}>DINE-IN ORDER • PAY LATER</Text>
                      <Text style={styles.cartDineInNoticeSub}>
                        Dishes will be sent to Kitchen (KOT). Payment mode will be selected when settling the table bill.
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.cartSwitchFlowBtn}
                    onPress={() => setDineInPaymentFlow('pay_now')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cartSwitchFlowBtnText}>Guest paying upfront? Switch to Pay & Settle Now →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cartPaymentModeSection}>
                  <View style={styles.cartPaymentModeHeader}>
                    <Text style={styles.cartPaymentModeLabel}>PAYMENT MODE FOR INSTANT SETTLE</Text>
                    <View style={styles.cartPaymentModeActiveBadge}>
                      <Text style={styles.cartPaymentModeSubLabel}>{selectedPaymentMode}</Text>
                    </View>
                  </View>
                  <View style={styles.cartPaymentModesRow}>
                    {[
                      { key: 'CASH', label: 'Cash', icon: IndianRupee },
                      { key: 'UPI', label: 'UPI / QR', icon: Smartphone },
                      { key: 'CARD', label: 'Card / POS', icon: CreditCard },
                    ].map((mode) => {
                      const isSelected = selectedPaymentMode === mode.key;
                      const IconComponent = mode.icon;
                      return (
                        <TouchableOpacity
                          key={`cart-pay-mode-${mode.key}`}
                          style={[styles.cartPayModeChip, isSelected && styles.cartPayModeChipSelected]}
                          onPress={() => setSelectedPaymentMode(mode.key)}
                          activeOpacity={0.8}
                        >
                          <IconComponent size={13} color={isSelected ? '#FFFFFF' : '#DE8626'} />
                          <Text style={[styles.cartPayModeChipText, isSelected && styles.cartPayModeChipTextSelected]}>
                            {mode.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Cash Tendered & Change Calculation for Cash Payments */}
                  {selectedPaymentMode === 'CASH' && (
                    <View style={styles.cartCashTenderedBox}>
                      <View style={styles.cartCashTenderedHeader}>
                        <Text style={styles.cartCashTenderedLabel}>CASH TENDERED</Text>
                        {posNumericTendered > 0 && (
                          <View
                            style={[
                              styles.cartChangeBadge,
                              posNumericTendered >= grandTotal
                                ? styles.cartChangeBadgeSuccess
                                : styles.cartChangeBadgeShort,
                            ]}
                          >
                            <Text
                              style={[
                                styles.cartChangeBadgeText,
                                posNumericTendered >= grandTotal
                                  ? styles.cartChangeBadgeTextSuccess
                                  : styles.cartChangeBadgeTextShort,
                              ]}
                            >
                              {posNumericTendered >= grandTotal
                                ? `Change: ₹${posChangeToReturn.toFixed(2)}`
                                : `Short by: ₹${(grandTotal - posNumericTendered).toFixed(2)}`}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.cartCashInputRow}>
                        <View style={styles.cartCashInputWrapper}>
                          <Text style={styles.cartCashRupeePrefix}>₹</Text>
                          <TextInput
                            style={styles.cartCashInput}
                            placeholder={grandTotal.toFixed(0)}
                            placeholderTextColor="#A8A29E"
                            keyboardType="numeric"
                            value={posTenderedText}
                            onChangeText={setPosTenderedText}
                          />
                        </View>
                        <View style={styles.cartCashPillsRow}>
                          <TouchableOpacity
                            style={styles.cartCashPill}
                            onPress={() => setPosTenderedText(grandTotal.toFixed(0))}
                          >
                            <Text style={styles.cartCashPillText}>Exact</Text>
                          </TouchableOpacity>
                          {[
                            Math.ceil((grandTotal + 1) / 50) * 50,
                            Math.ceil((grandTotal + 1) / 100) * 100,
                            500,
                          ]
                            .filter((val, idx, arr) => val > grandTotal && arr.indexOf(val) === idx)
                            .slice(0, 2)
                            .map((val) => (
                              <TouchableOpacity
                                key={`pill-${val}`}
                                style={styles.cartCashPill}
                                onPress={() => setPosTenderedText(val.toString())}
                              >
                                <Text style={styles.cartCashPillText}>₹{val}</Text>
                              </TouchableOpacity>
                            ))}
                        </View>
                      </View>
                    </View>
                  )}

                  {isDineInTableOrder && (
                    <TouchableOpacity
                      style={[styles.cartSwitchFlowBtn, { marginTop: 8 }]}
                      onPress={() => setDineInPaymentFlow('pay_later')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cartSwitchFlowBtnText}>← Switch back to Pay Later (Send KOT)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Pinned Sticky Action Buttons at Bottom of Drawer */}
            <View style={styles.cartDrawerActionsRow}>
              {isDineInTableOrder && dineInPaymentFlow === 'pay_later' ? (
                /* Primary Dine-In Action: Full-width Send to KOT */
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[styles.sendKotBtnPrimary, (loading || isKotLoading || isSettling) && { opacity: 0.85 }]}
                  onPress={() => handleCheckout(PosCheckoutModes.KOT_PAY_LATER)}
                  disabled={loading || isKotLoading || isSettling}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sendKotBtnPrimaryGradient}
                  >
                    {isKotLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.sendKotBtnPrimaryText}>Sending to Kitchen...</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <Printer size={18} color="#FFFFFF" />
                        <View style={{ alignItems: 'flex-start' }}>
                          <Text style={styles.sendKotBtnPrimaryText}>Send to Kitchen (KOT) 🍳</Text>
                          <Text style={styles.sendKotBtnPrimarySubText}>
                            {initialTableNumber ? `Table ${initialTableNumber} • ` : ''}Pay Later at Table Checkout
                          </Text>
                        </View>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                /* Counter / Instant Settle Actions */
                <>
                  {/* Action 1: Send to KOT (Pay Later / Post-Paid) */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.sendKotBtn, (loading || isKotLoading || isSettling) && { opacity: 0.75 }]}
                    onPress={() => handleCheckout(PosCheckoutModes.KOT_PAY_LATER)}
                    disabled={loading || isKotLoading || isSettling}
                  >
                    {isKotLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ActivityIndicator size="small" color="#D96B14" />
                        <Text style={styles.sendKotBtnText}>Sending...</Text>
                      </View>
                    ) : (
                      <>
                        <Printer size={15} color="#DE8626" />
                        <View>
                          <Text style={styles.sendKotBtnText}>Send to KOT</Text>
                          <Text style={styles.sendKotBtnSubText}>Pay Later</Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Action 2: Pay & Settle (Pre-Paid / Instant Settle) */}
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={[styles.paySettleBtn, (loading || isKotLoading || isSettling) && { opacity: 0.88 }]}
                    onPress={() => handleCheckout(PosCheckoutModes.PAY_AND_SETTLE)}
                    disabled={loading || isKotLoading || isSettling}
                  >
                    <LinearGradient
                      colors={['#17845A', '#13714C', '#0E5E3E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.paySettleBtnGradient}
                    >
                      {isSettling ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.paySettleBtnText}>Settling...</Text>
                        </View>
                      ) : (
                        <>
                          <IndianRupee size={16} color="#FFFFFF" strokeWidth={2.5} />
                          <View>
                            <Text style={styles.paySettleBtnText}>
                              Pay & Settle ₹{grandTotal.toFixed(2)}
                            </Text>
                            <Text style={styles.paySettleBtnSubText}>Instant Settle • {selectedPaymentMode}</Text>
                          </View>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* GILDED ALERT MODAL */}
      <GildedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />

      {/* BLUETOOTH PRINTER MODAL */}
      <Modal visible={printerModalVisible} animationType="slide">
        <BluetoothPrinterScreen onClose={() => setPrinterModalVisible(false)} />
      </Modal>

      {/* QUICK NUMERIC QUANTITY KEYPAD MODAL */}
      <Modal
        visible={Boolean(qtyModalItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setQtyModalItem(null)}
      >
        <View style={styles.qtyModalOverlay}>
          <View style={styles.qtyModalCard}>
            <View style={styles.qtyModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.qtyModalDishName} numberOfLines={1}>
                  {qtyModalItem?.itemName}
                </Text>
                {Boolean(qtyModalItem?.description) && (
                  <Text style={styles.qtyModalDishDesc} numberOfLines={2} ellipsizeMode="tail">
                    {qtyModalItem?.description}
                  </Text>
                )}
                <Text style={styles.qtyModalPrice}>
                  ₹{qtyModalItem?.price} per item • Current: {qtyModalItem?.currentQty} in cart
                </Text>
              </View>
              <TouchableOpacity
                style={styles.qtyModalCloseBtn}
                onPress={() => setQtyModalItem(null)}
                activeOpacity={0.7}
              >
                <X size={20} color="#8C7A6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.qtyDisplayBox}>
              <Text style={styles.qtyDisplayLabel}>SET QUANTITY</Text>
              <Text style={styles.qtyDisplayNumber}>{qtyInputValue || '0'}</Text>
              <Text style={styles.qtyDisplaySubtotal}>
                Line Total: ₹
                {(parseInt(qtyInputValue || '0', 10) * (qtyModalItem?.price || 0)).toLocaleString('en-IN')}
              </Text>
            </View>

            <Text style={styles.qtyPresetLabel}>QUICK SELECT</Text>
            <View style={styles.qtyPresetRow}>
              {[1, 2, 3, 5, 10, 15, 20].map((preset) => (
                <TouchableOpacity
                  key={`preset-${preset}`}
                  style={[
                    styles.qtyPresetChip,
                    qtyInputValue === preset.toString() && styles.qtyPresetChipActive,
                  ]}
                  onPress={() => setQtyInputValue(preset.toString())}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.qtyPresetText,
                      qtyInputValue === preset.toString() && styles.qtyPresetTextActive,
                    ]}
                  >
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.numpadGrid}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['C', '0', '⌫'],
              ].map((row, rIdx) => (
                <View key={`numpad-row-${rIdx}`} style={styles.numpadRow}>
                  {row.map((btn) => {
                    const isSpecial = btn === 'C' || btn === '⌫';
                    return (
                      <TouchableOpacity
                        key={`numpad-btn-${btn}`}
                        style={[styles.numpadBtn, isSpecial && styles.numpadBtnSpecial]}
                        onPress={() => {
                          if (btn === 'C') handleNumpadClear();
                          else if (btn === '⌫') handleNumpadBackspace();
                          else handleNumpadPress(btn);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.numpadBtnText,
                            isSpecial && styles.numpadBtnTextSpecial,
                          ]}
                        >
                          {btn}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={styles.qtyModalActions}>
              <TouchableOpacity
                style={styles.qtyModalCancelBtn}
                onPress={() => setQtyModalItem(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.qtyModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qtyModalApplyBtn}
                onPress={handleApplyExactQuantity}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.qtyModalApplyGradient}
                >
                  <Text style={styles.qtyModalApplyText}>
                    Set {qtyInputValue || '0'} in Cart
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* REAL-TIME FLOATING ORDER ALERT BANNER */}
      <OrderAlertBanner onPress={() => setNotificationModalVisible(true)} />

      {/* ORDER NOTIFICATION DRAWER MODAL */}
      <OrderNotificationModal
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
      />

      {/* STORE OPERATING STATUS MODAL */}
      <StoreOperatingStatusModal
        visible={operatingStatusModalVisible}
        onClose={() => setOperatingStatusModalVisible(false)}
        restaurantId={activeRestId}
        restaurantName={storeDisplayName}
        isOwnerOrAdmin={true}
        initialStatus={operatingStatus}
        isTableOrderingAllowed={isTableOrderingAllowed}
        onStatusUpdated={(updated) => {
          setOperatingStatus(updated);
          loadRestaurantConfig();
        }}
      />

      {/* WALLET RECHARGE MODAL */}
      <WalletRechargeModal
        visible={walletModalVisible}
        restaurantId={activeRestId}
        onClose={() => {
          setWalletModalVisible(false);
          loadRestaurantConfig();
          loadOperatingStatus();
        }}
        onRechargeSuccess={() => {
          loadRestaurantConfig();
          loadOperatingStatus();
        }}
      />

      {/* SUBSCRIPTION BILLING / RENEWAL MODAL */}
      <Modal
        visible={subscriptionModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSubscriptionModalVisible(false)}
      >
        <SubscriptionBillingScreen
          onClose={() => {
            setSubscriptionModalVisible(false);
            if (activeRestId > 0) {
              fetchSubscriptionStatus(activeRestId);
            }
          }}
        />
      </Modal>
    </SafeAreaView>
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

  /* 1. TOP STREAMLINED HEADER (Matching HomePage) */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE4DC',
    backgroundColor: '#FAF7F2',
    shadowColor: '#2B1A09',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  headerLogoWrapper: {
    shadowColor: '#2B1A09',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
    backgroundColor: '#FFFFFF',
  },
  headerInfoBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerOutletTitle: {
    color: '#1C1917',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    flexWrap: 'nowrap',
  },
  headerSubtitleDot: {
    color: '#C4B9AD',
    fontSize: 10,
  },
  headerOutletSubtitle: {
    color: '#78716C',
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  posBellBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E0D6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#2B1A09',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  posBellBtnActive: {
    backgroundColor: '#FFF7EE',
    borderColor: '#FED7AA',
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E0D6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#2B1A09',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  headerActionBtnConnected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  headerActionStatusDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  headerActionStatusDotGreen: {
    backgroundColor: '#16A34A',
  },
  headerActionStatusDotAmber: {
    backgroundColor: '#F59E0B',
  },
  posBellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 3.5,
    paddingVertical: 0.5,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  posBellBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
  },
  closeBtnCircle: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E0D6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2B1A09',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  posStatusMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#F3EFEA',
    paddingHorizontal: 5.5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E7E0D6',
  },
  posStatusMiniBadgeOpen: {
    backgroundColor: '#EBF8F1',
    borderColor: '#A4E8C2',
  },
  posStatusMiniBadgePaused: {
    backgroundColor: '#FFF8EB',
    borderColor: '#FBDCA0',
  },
  posStatusMiniBadgeClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  posStatusMiniDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: '#8C7A6B',
  },
  posStatusMiniDotOpen: {
    backgroundColor: '#16A34A',
  },
  posStatusMiniDotPaused: {
    backgroundColor: '#F59E0B',
  },
  posStatusMiniDotClosed: {
    backgroundColor: '#EF4444',
  },
  posStatusMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B5E51',
    letterSpacing: 0.3,
  },
  posStatusMiniTextOpen: {
    color: '#15803D',
  },
  posStatusMiniTextPaused: {
    color: '#B45309',
  },
  posStatusMiniTextClosed: {
    color: '#B91C1C',
  },

  /* Prepaid Wallet Exhausted Banner */
  posWalletExhaustedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.md,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    gap: 8,
  },
  posWalletExhaustedIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posWalletExhaustedBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
    letterSpacing: 0.2,
  },
  posWalletExhaustedBannerSub: {
    fontSize: 10,
    color: '#B91C1C',
    marginTop: 1,
  },
  posWalletExhaustedBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
  },
  posWalletExhaustedBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },

  /* Closed / Inactive Alert Banner */
  posClosedAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  posClosedAlertBannerClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  posClosedAlertBannerPaused: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  posClosedAlertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  posClosedAlertDotClosed: {
    backgroundColor: '#DC2626',
  },
  posClosedAlertDotPaused: {
    backgroundColor: '#D97706',
  },
  posClosedAlertTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  posClosedAlertTitleClosed: {
    color: '#B91C1C',
  },
  posClosedAlertTitlePaused: {
    color: '#B45309',
  },
  posClosedAlertSubtitle: {
    fontSize: 10,
    color: '#78716C',
    marginTop: 1,
  },
  posClosedAlertAction: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D96B14',
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },

  /* 2. ORDER TYPE SELECTOR PILLS */
  orderTypeRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  orderTypePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAF7F2',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  orderTypePillActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  orderTypePillDisabled: {
    opacity: 0.45,
  },
  orderTypePillText: {
    color: '#5C4E3D',
    fontSize: 13,
    fontWeight: '700',
  },
  orderTypePillTextActive: {
    color: '#FFFFFF',
  },

  /* 3. CATEGORY TABS HORIZONTAL ROW */
  categoryTabsWrapper: {
    height: 44,
    marginVertical: 6,
  },
  categoryTabsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  categoryTabPill: {
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  categoryTabPillActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  categoryTabText: {
    color: '#5C4E3D',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* 4. FILTER CONTROLS (SEARCH & VEG/NON-VEG) */
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: 10,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 8,
    height: 42,
    borderWidth: 1.2,
    borderColor: '#E7E1DA',
    gap: 8,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchBoxFocused: {
    borderColor: '#DE8626',
    backgroundColor: '#FFFFFF',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  searchIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    paddingVertical: 0,
  },
  searchClearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  vegToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 2,
  },
  vegChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 4,
  },
  vegChipActive: {
    backgroundColor: '#DE8626',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  vegChipActiveEmerald: {
    backgroundColor: '#E4F5EC',
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.3)',
    shadowColor: '#17845A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  vegChipActiveRuby: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  vegChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C4E3D',
  },
  vegChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  vegInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  /* 5. 2-COLUMN STREAMLINED DISH CARDS GRID WITH THUMBNAIL IMAGES */
  menuScrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 24,
  },
  menuGrid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  dishCard: {
    width: (SCREEN_WIDTH - 32 - 10) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  dishCardInCart: {
    borderColor: '#DE8626',
    borderWidth: 1.5,
  },
  dishCardDisabled: {
    opacity: 0.5,
  },
  dishImageContainer: {
    width: '100%',
    height: 92,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FAF7F2',
    position: 'relative',
  },
  dishImage: {
    width: '100%',
    height: '100%',
  },
  dishImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0DE',
  },
  dishVegOverlayBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    padding: 3,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  dishStationWarningBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishStationPausedBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.9)',
  },
  dishStationInactiveBadge: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
  },
  dishStationWarningText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  dishContentSection: {
    marginTop: 8,
  },
  dishCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 18,
  },
  dishCardNameDisabled: {
    color: '#9CA3AF',
  },
  dishCardDesc: {
    fontSize: 11,
    fontWeight: '400',
    color: '#7C6F62',
    lineHeight: 14,
    marginTop: 2,
  },
  dishCardDescDisabled: {
    color: '#9CA3AF',
  },
  dishVegDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dishCardTag: {
    fontSize: 11,
    fontWeight: '500',
    color: '#78716C',
    marginTop: 2,
  },
  dishCardTagDisabled: {
    color: '#9CA3AF',
  },
  dishCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dishCardPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DE8626',
  },
  dishCardPriceDisabled: {
    color: '#9CA3AF',
  },

  /* DISH CARD ACTIONS: ADD BUTTON & STEPPER (MENZA LUXURY AMBER THEME) */
  dishCardAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
  },
  dishCardAddBtnText: {
    color: '#D96B14',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dishCardInlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0DE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 2,
  },
  dishCardStepperBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  },
  dishCardQtyBtn: {
    minWidth: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dishCardQtyText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '800',
  },

  dishCardOutOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishCardOutOfStockText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  dishCardSkeleton: {
    width: (SCREEN_WIDTH - 32 - 10) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8C7A6B',
    fontSize: 13,
    fontStyle: 'italic',
  },

  /* 6. RESPONSIVE FLOATING BOTTOM CART STICKY BANNER */
  floatingCartBannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  floatingCartBannerWrapper: {
    width: '100%',
    maxWidth: 620,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingCartBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingCartCountCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  floatingCartCountText: {
    color: '#D96B14',
    fontSize: 13,
    fontWeight: '900',
  },
  floatingCartLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingCartTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  floatingCartTypeBadgeText: {
    color: '#D96B14',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  floatingCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingCartAmount: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  /* 7. RESPONSIVE CART & CHECKOUT BOTTOM SHEET MODAL */
  cartDrawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cartDrawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cartDrawerCard: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  cartDrawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1C7BD',
    alignSelf: 'center',
    marginBottom: 8,
  },
  cartDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
    marginBottom: 8,
  },
  cartDrawerTitle: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '800',
  },
  cartDrawerClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cartDrawerClearText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  cartDrawerCloseBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  cartOrderTypeSection: {
    marginBottom: 10,
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  cartOrderTypeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cartOrderTypeSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#78716C',
    letterSpacing: 0.4,
  },
  cartActiveOrderTypeHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D96B14',
  },
  cartOrderTypeSelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cartOrderTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  cartOrderTypeChipActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  cartOrderTypeChipDisabled: {
    opacity: 0.45,
  },
  cartOrderTypeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C4E3D',
  },
  cartOrderTypeChipTextActive: {
    color: '#FFFFFF',
  },
  cartDrawerScroll: {
    flexShrink: 1,
  },
  cartCustomerBox: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  cartCustomerInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 6,
  },
  cartCustomerInput: {
    flex: 1,
    fontSize: 12,
    color: '#1F2937',
    paddingVertical: 0,
  },
  cartItemsListContainer: {
    marginBottom: 12,
  },
  cartDrawerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FAF7F2',
  },
  cartDrawerItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartDrawerItemImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FAF7F2',
  },
  cartDrawerItemImagePlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartDrawerItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  cartDrawerItemUnitPrice: {
    fontSize: 11,
    color: '#78716C',
    marginTop: 1,
  },
  cartDrawerItemDesc: {
    fontSize: 10.5,
    color: '#8C7A6B',
    lineHeight: 13,
    marginTop: 1,
  },
  cartDrawerItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0DE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 2,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  qtyTextBtn: {
    minWidth: 26,
    height: 26,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  qtyText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '800',
  },
  cartDrawerItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    minWidth: 55,
    textAlign: 'right',
  },
  cartDrawerTrashBtn: {
    padding: 4,
  },
  cartBillCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 8,
  },
  gstinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0DE',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  gstinBadgeText: {
    color: '#D96B14',
    fontSize: 10,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#5C4E3D',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '700',
  },
  gstSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  gstSummaryLabel: {
    fontSize: 11,
    color: '#78716C',
  },
  gstSummaryValue: {
    fontSize: 11,
    color: '#1F2937',
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E7E1DA',
    marginVertical: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  inclusiveTaxesLabel: {
    fontSize: 10,
    color: '#78716C',
    fontStyle: 'italic',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#17845A',
  },
  cartPaymentModeSection: {
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  cartPaymentModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cartPaymentModeLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.5,
  },
  cartPaymentModeActiveBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cartPaymentModeSubLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#17845A',
  },
  cartPaymentModesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cartPayModeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E5DDD5',
  },
  cartPayModeChipSelected: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  cartPayModeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8C7A6B',
  },
  cartPayModeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cartCashTenderedBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
  },
  cartCashTenderedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cartCashTenderedLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.5,
  },
  cartChangeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cartChangeBadgeSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  cartChangeBadgeShort: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cartChangeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cartChangeBadgeTextSuccess: {
    color: '#047857',
  },
  cartChangeBadgeTextShort: {
    color: '#DC2626',
  },
  cartCashInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartCashInputWrapper: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#DE8626',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 34,
  },
  cartCashRupeePrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D96B14',
    marginRight: 4,
  },
  cartCashInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    padding: 0,
  },
  cartCashPillsRow: {
    flex: 1.6,
    flexDirection: 'row',
    gap: 4,
  },
  cartCashPill: {
    backgroundColor: '#FFF0DE',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCashPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D96B14',
  },
  cartDrawerActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
  },
  sendKotBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF0DE',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
  },
  sendKotBtnText: {
    color: '#D96B14',
    fontSize: 12,
    fontWeight: '800',
  },
  sendKotBtnSubText: {
    color: '#8C7A6B',
    fontSize: 9.5,
    fontWeight: '600',
  },
  sendKotBtnPrimary: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  sendKotBtnPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sendKotBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  sendKotBtnPrimarySubText: {
    color: '#FEF3C7',
    fontSize: 10,
    fontWeight: '600',
  },
  cartDineInNoticeBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cartDineInNoticeIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartDineInNoticeTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.4,
  },
  cartDineInNoticeSub: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 1,
    lineHeight: 14,
  },
  cartSwitchFlowBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(217, 107, 20, 0.1)',
  },
  cartSwitchFlowBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D96B14',
  },
  paySettleBtn: {
    flex: 1.45,
    borderRadius: 12,
    overflow: 'hidden',
  },
  paySettleBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  paySettleBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  paySettleBtnSubText: {
    color: '#D1FAE5',
    fontSize: 9.5,
    fontWeight: '600',
  },

  /* 8. QUICK NUMERIC QUANTITY KEYPAD MODAL */
  qtyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  qtyModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5DDD5',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  qtyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  qtyModalDishName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  qtyModalDishDesc: {
    fontSize: 11,
    color: '#7C6F62',
    lineHeight: 15,
    marginTop: 2,
  },
  qtyModalPrice: {
    fontSize: 11,
    color: '#78716C',
    marginTop: 2,
  },
  qtyModalCloseBtn: {
    padding: 4,
  },
  qtyDisplayBox: {
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 10,
  },
  qtyDisplayLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#78716C',
    letterSpacing: 0.5,
  },
  qtyDisplayNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: '#DE8626',
    marginVertical: 2,
  },
  qtyDisplaySubtotal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#17845A',
  },
  qtyPresetLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#78716C',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  qtyPresetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  qtyPresetChip: {
    backgroundColor: '#FAF7F2',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  qtyPresetChipActive: {
    backgroundColor: '#FFF0DE',
    borderColor: '#DE8626',
  },
  qtyPresetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C4E3D',
  },
  qtyPresetTextActive: {
    color: '#D96B14',
  },
  numpadGrid: {
    gap: 6,
    marginBottom: 12,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 6,
  },
  numpadBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadBtnSpecial: {
    backgroundColor: '#FFF0DE',
    borderColor: 'rgba(222, 134, 38, 0.3)',
  },
  numpadBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  numpadBtnTextSpecial: {
    color: '#D96B14',
    fontWeight: '800',
  },
  qtyModalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  qtyModalCancelBtn: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyModalCancelText: {
    color: '#5C4E3D',
    fontSize: 13,
    fontWeight: '700',
  },
  qtyModalApplyBtn: {
    flex: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  qtyModalApplyGradient: {
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyModalApplyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // LOCKED TABLE DINE-IN BANNER
  lockedTableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
  },
  lockedTableIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTableTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#9A3412',
    letterSpacing: 0.5,
  },
  lockedTablePill: {
    backgroundColor: '#DE8626',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  lockedTablePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  lockedTableSub: {
    fontSize: 10,
    color: '#7C6F62',
    marginTop: 1,
  },
  unlockTableBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  unlockTableBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#D96B14',
  },

  // CART DRAWER LOCKED TABLE BADGE
  cartLockedTableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignSelf: 'flex-start',
  },
  cartLockedTableText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9A3412',
  },
});
