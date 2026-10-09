'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Receipt,
  User,
  Phone,
  Table as TableIcon,
  Sparkles,
  MessageCircle,
  Store,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { DishImage } from '@/components/common/DishImage';
import { StoreOperatingStatusModal } from '@/components/pos/StoreOperatingStatusModal';
import { WebPrinterService } from '@/services/webPrinterService';
import { WebWhatsAppService } from '@/services/whatsAppService';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { usePrinterStore } from '@shared/presentation/state/usePrinterStore';
import { useNotificationStore } from '@shared/presentation/state/useNotificationStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { CatalogRemoteDataSource } from '@shared/data/datasources/CatalogRemoteDataSource';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { OrderRepositoryImpl } from '@shared/data/repositories/OrderRepositoryImpl';
import { TableRemoteDataSource } from '@shared/data/datasources/TableRemoteDataSource';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { MenuItem } from '@shared/domain/models/Item';
import { Category } from '@shared/domain/models/Category';
import { TableMaster } from '@shared/domain/models/Table';
import { RestaurantConfig, StoreOperatingStatus } from '@shared/domain/models/RestaurantConfig';
import { BillingModes, PosCheckoutModes, OrderMaster } from '@shared/domain/models/Order';
import { ReceiptData } from '@shared/core/printer/EscPosBuilder';
import {
  startPosSignalRConnection,
  onStoreOperatingStatusChanged,
  onWalletBalanceChanged,
  onPosTableStatusChanged,
} from '@/lib/signalr/signalrService';

const catalogDataSource = new CatalogRemoteDataSource();
const orderRemoteDataSource = new OrderRemoteDataSource();
const orderRepository = new OrderRepositoryImpl(orderRemoteDataSource);
const tableDataSource = new TableRemoteDataSource();
const configDataSource = new RestaurantConfigRemoteDataSource();

interface CartItem {
  itemId: number;
  itemName: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  notes?: string;
}

export default function PosPage() {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const { markOrderAsKnown } = useNotificationStore();
  const { paperWidth, customFooter, autoPrintReceipt, autoPrintKot } = usePrinterStore();
  const { canTakeOrders, hasEntitlement, openRenewalModal } = useSubscriptionStore();

  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<TableMaster[]>([]);
  const [restaurantConfig, setRestaurantConfig] = useState<RestaurantConfig | null>(null);
  const [operatingStatus, setOperatingStatus] = useState<StoreOperatingStatus | null>(null);
  const [operatingModalOpen, setOperatingModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Active Dining Table State
  const [activeTableOrder, setActiveTableOrder] = useState<OrderMaster | null>(null);
  const [loadingActiveTable, setLoadingActiveTable] = useState(false);
  const [showRunningTableDetails, setShowRunningTableDetails] = useState(false);

  // Filters & State
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null); // null = all
  const [searchQuery, setSearchQuery] = useState('');
  const [vegFilter, setVegFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [orderType, setOrderType] = useState<'COUNTER' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('COUNTER');
  const [selectedTable, setSelectedTable] = useState<TableMaster | null>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  // Settlement Modal State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'DUE'>('CASH');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState<any | null>(null);

  // Load menu items, categories, tables, config, and operating status
  useEffect(() => {
    if (!currentRestId) return;

    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const [catsRes, itemsRes, tablesRes, cfgRes, opRes] = await Promise.allSettled([
          catalogDataSource.getCategories(currentRestId),
          catalogDataSource.getMenuItems(currentRestId),
          tableDataSource.getTables(currentRestId),
          configDataSource.getConfig(currentRestId),
          configDataSource.getOperatingStatus(currentRestId),
        ]);

        if (!isMounted) return;

        if (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value)) {
          setCategories(catsRes.value);
        }
        if (itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value)) {
          setItems(itemsRes.value);
        }
        if (tablesRes.status === 'fulfilled' && Array.isArray(tablesRes.value)) {
          setTables(tablesRes.value);
          if (typeof window !== 'undefined') {
            const qTableId = new URLSearchParams(window.location.search).get('tableId');
            if (qTableId) {
              const matched = tablesRes.value.find((t) => t.id === Number(qTableId));
              if (matched) {
                setOrderType('DINE_IN');
                setSelectedTable(matched);
              }
            }
          }
        }
        if (cfgRes.status === 'fulfilled' && cfgRes.value) {
          setRestaurantConfig(cfgRes.value);
        }
        if (opRes.status === 'fulfilled' && opRes.value) {
          setOperatingStatus(opRes.value);
        }
        // Load subscription status in background
        useSubscriptionStore.getState().fetchSubscriptionStatus(currentRestId).catch(() => {});
      } catch (err) {
        console.warn('POS data load failed', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    // Start Real-Time SignalR Connection for Live Store & Order Sync
    startPosSignalRConnection(currentRestId).catch(() => {});

    const unsubStatus = onStoreOperatingStatusChanged((status) => {
      if (status && isMounted) {
        setOperatingStatus(status);
      }
    });

    const unsubWallet = onWalletBalanceChanged((data) => {
      if (data?.newBalance !== undefined && isMounted) {
        setRestaurantConfig((prev) =>
          prev ? { ...prev, walletBalance: Number(data.newBalance) } : prev
        );
        setOperatingStatus((prev) =>
          prev ? { ...prev, walletBalance: Number(data.newBalance) } : prev
        );
      }
    });

    const unsubTable = onPosTableStatusChanged((tableData) => {
      if (isMounted && tableData && currentRestId) {
        tableDataSource.getTables(currentRestId).then((tList) => {
          if (isMounted) setTables(tList);
        }).catch(() => {});
      }
    });

    return () => {
      isMounted = false;
      unsubStatus();
      unsubWallet();
      unsubTable();
    };
  }, [currentRestId]);

  // Load active dining table order whenever a table is selected
  const loadActiveTableOrder = useCallback(
    async (tableId: number) => {
      if (!currentRestId || !tableId) {
        setActiveTableOrder(null);
        return;
      }
      try {
        setLoadingActiveTable(true);
        const active = await orderRepository.getActiveOrderByTable(tableId, currentRestId);
        setActiveTableOrder(active);
        if (active?.customerName && !customerName) {
          setCustomerName(active.customerName);
        }
        if (active?.mobileNumber && !customerPhone) {
          setCustomerPhone(active.mobileNumber);
        }
      } catch (err) {
        console.warn('Failed to load active table order:', err);
        setActiveTableOrder(null);
      } finally {
        setLoadingActiveTable(false);
      }
    },
    [currentRestId, customerName, customerPhone]
  );

  useEffect(() => {
    if (orderType === 'DINE_IN' && selectedTable?.id) {
      loadActiveTableOrder(selectedTable.id);
    } else {
      setActiveTableOrder(null);
    }
  }, [orderType, selectedTable, loadActiveTableOrder]);

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Category Filter
      if (selectedCategory !== null && item.categoryId !== selectedCategory) {
        return false;
      }
      // 2. Veg / Non-Veg Filter
      if (vegFilter === 'VEG' && !item.isVeg) return false;
      if (vegFilter === 'NON_VEG' && item.isVeg) return false;
      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.itemName.toLowerCase().includes(q) || Boolean((item as any).itemCode && (item as any).itemCode.toLowerCase().includes(q));
      }
      return true;
    });
  }, [items, selectedCategory, vegFilter, searchQuery]);

  // Cart Operations
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.itemId === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.itemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          itemName: item.itemName,
          price: item.price,
          quantity: 1,
          isVeg: Boolean(item.isVeg),
        },
      ];
    });
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((ci) => {
          if (ci.itemId === itemId) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (itemId: number) => {
    setCart((prev) => prev.filter((ci) => ci.itemId !== itemId));
  };

  const clearCartOnly = () => {
    setCart([]);
    setDiscountAmount(0);
    setTenderedAmount('');
  };

  const clearCart = () => {
    setCart([]);
    setSelectedTable(null);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountAmount(0);
    setTenderedAmount('');
    setActiveTableOrder(null);
  };

  const clearFullSale = () => {
    clearCart();
    setOrderSuccessData(null);
  };

  // GST & Tax Calculations
  const hasGstNumber = Boolean(
    restaurantConfig?.gstNumber && restaurantConfig.gstNumber.trim().length > 0
  );
  const sgstRate = hasGstNumber ? Number(restaurantConfig?.sgstPercentage ?? 2.5) : 0;
  const cgstRate = hasGstNumber ? Number(restaurantConfig?.cgstPercentage ?? 2.5) : 0;
  const totalGstRate = sgstRate + cgstRate;

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const sgstAmount = hasGstNumber ? Math.round(((subtotal * sgstRate) / 100) * 100) / 100 : 0;
  const cgstAmount = hasGstNumber ? Math.round(((subtotal * cgstRate) / 100) * 100) / 100 : 0;
  const totalTax = hasGstNumber ? Math.round((sgstAmount + cgstAmount) * 100) / 100 : 0;

  // Grand Total for currently staged cart items
  const grandTotal = hasGstNumber
    ? Math.max(0, Math.round((subtotal + totalTax - discountAmount) * 100) / 100)
    : Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  // Consolidated dining total (Existing running table items + new cart items)
  const existingTableTotal = activeTableOrder ? Number(activeTableOrder.totalAmount || 0) : 0;
  const consolidatedGrandTotal = Math.round((existingTableTotal + grandTotal) * 100) / 100;
  const payableGrandTotal = activeTableOrder ? consolidatedGrandTotal : grandTotal;

  // Cash change calculation
  const numericTendered = parseFloat(tenderedAmount) || 0;
  const changeToReturn = Math.max(0, Math.round((numericTendered - payableGrandTotal) * 100) / 100);

  // Place Order Execution (Send KOT vs Pay & Settle)
  const executeOrder = async (isPostPaidKOT: boolean) => {
    if (isPlacingOrder) return;

    // Direct settlement of an existing active table when cart is empty
    if (cart.length === 0) {
      if (activeTableOrder && !isPostPaidKOT) {
        try {
          setIsPlacingOrder(true);
          await orderRemoteDataSource.settleOrder(activeTableOrder.id, {
            orderId: activeTableOrder.id,
            paymentMode,
            discountAmount,
            tenderedAmount: paymentMode === 'CASH' && numericTendered > 0 ? numericTendered : undefined,
            changeAmount: paymentMode === 'CASH' && changeToReturn > 0 ? changeToReturn : undefined,
            billingMode: BillingModes.PRE_PAID,
            orderStatus: 'Settled',
          });

          // Print settled invoice
          const receiptData: ReceiptData = {
            orderId: activeTableOrder.id,
            orderNumber: String(activeTableOrder.orderNumber || activeTableOrder.id),
            pickupToken: String(activeTableOrder.pickupToken || activeTableOrder.id),
            restaurantName: restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
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
            paymentMode,
            tenderedAmount: numericTendered,
            changeAmount: changeToReturn,
            date: new Date().toLocaleString('en-IN'),
            footerMessage: customFooter || 'Thank you! Please visit again.',
          };

          if (autoPrintReceipt) {
            WebPrinterService.printReceipt(receiptData, paperWidth).catch(() => {});
          }

          setOrderSuccessData({
            orderId: activeTableOrder.id,
            orderType: 'DINE_IN',
            table: selectedTable?.tableNumber,
            customerName: activeTableOrder.customerName,
            customerPhone: activeTableOrder.mobileNumber,
            items: activeTableOrder.items || [],
            subtotal: activeTableOrder.subtotal || existingTableTotal,
            totalTax: hasGstNumber ? ((activeTableOrder.cgst || 0) + (activeTableOrder.sgst || 0)) : 0,
            grandTotal: payableGrandTotal,
            paymentMode,
            tendered: numericTendered,
            change: changeToReturn,
            date: new Date().toLocaleTimeString(),
            receiptData,
          });

          setActiveTableOrder(null);
          clearCart();
          setSettleModalOpen(false);
          return;
        } catch (err: any) {
          alert(err?.message || 'Failed to settle table order.');
          return;
        } finally {
          setIsPlacingOrder(false);
        }
      }

      alert('Please add dishes to the cart before placing an order.');
      return;
    }

    // 1. Subscription Safeguard
    if (!canTakeOrders()) {
      openRenewalModal();
      return;
    }

    // 2. Inactive Restaurant Safeguard
    if (activeRestaurant?.isActive === false || restaurantConfig?.isActive === false) {
      alert('This store is currently marked as inactive in Menza Admin. You cannot take or place orders while inactive.');
      return;
    }

    // 3. Store Operating Status Safeguard (Closed / Paused)
    if (operatingStatus && !operatingStatus.canPlaceOrder) {
      alert(
        operatingStatus.statusMessage ||
          'This restaurant outlet is currently marked as closed or paused for taking orders. Please resume or open the store in Store Controls before taking orders.'
      );
      setOperatingModalOpen(true);
      return;
    }

    // 4. Prepaid Wallet Zero / Negative Safeguard
    const walletBal = operatingStatus?.walletBalance ?? restaurantConfig?.walletBalance;
    if (operatingStatus?.status === 'WALLET_EXHAUSTED' || (walletBal !== undefined && walletBal <= 0)) {
      alert(
        `Prepaid Wallet Exhausted 💳\n\nYour restaurant's prepaid wallet balance is ₹${(walletBal ?? 0).toFixed(2)}. Orders and billing cannot be processed while the wallet balance is zero or negative.\n\nPlease recharge your wallet to continue taking orders.`
      );
      router.push('/wallet');
      return;
    }

    // 5. Customer Phone Validation
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '').trim();
    if (cleanPhone.length > 0 && cleanPhone.length !== 10) {
      alert('Customer mobile number must be exactly 10 digits.');
      return;
    }

    // 6. Dine-In Plan Entitlement & Table Selection
    if (orderType === 'DINE_IN' && !hasEntitlement('IsTableOrderingEnabled')) {
      alert('Table / Dine-in ordering is not included in your active subscription plan. Please upgrade your plan to unlock.');
      openRenewalModal();
      return;
    }

    if (orderType === 'DINE_IN' && !selectedTable) {
      alert('Please select a dining table for Dine-in orders.');
      setTableModalOpen(true);
      return;
    }

    try {
      setIsPlacingOrder(true);
      const itemsPayload = cart.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitId: 1,
        amount: item.price,
        totalAmount: item.price * item.quantity,
      }));

      const orderTypeId =
        orderType === 'DINE_IN' ? 1 : orderType === 'TAKEAWAY' ? 2 : orderType === 'DELIVERY' ? 3 : 4;

      const effectiveCustomerName = customerName.trim() || (selectedTable ? `Table ${selectedTable.tableNumber}` : 'Walk-in Customer');

      const orderPayload: any = {
        restaurantId: currentRestId,
        name: effectiveCustomerName,
        mobileNumber: cleanPhone || undefined,
        tableId: selectedTable?.id,
        tableNumber: selectedTable?.tableNumber,
        sectionName: selectedTable?.sectionName,
        orderTypeId,
        orderStatus: 'Confirmed',
        paymentStatus: isPostPaidKOT ? 'Pending' : 'Paid',
        billingMode: isPostPaidKOT ? BillingModes.POST_PAID : BillingModes.PRE_PAID,
        paymentMode: isPostPaidKOT ? undefined : paymentMode,
        tenderedAmount: !isPostPaidKOT && paymentMode === 'CASH' && numericTendered > 0 ? numericTendered : undefined,
        changeAmount: !isPostPaidKOT && paymentMode === 'CASH' && changeToReturn > 0 ? changeToReturn : undefined,
        source: selectedTable ? `Table ${selectedTable.tableNumber}` : 'POS_ADMIN',
        cgst: cgstAmount,
        sgst: sgstAmount,
        totalAmount: grandTotal,
        items: itemsPayload,
      };

      const orderId = await orderRepository.placeOrder(orderPayload);

      if (orderId && orderId > 0) {
        markOrderAsKnown(orderId, isPostPaidKOT ? 'Pending' : 'Confirmed');

        // If this was an instant settle order, mark it as settled
        if (!isPostPaidKOT) {
          try {
            await orderRemoteDataSource.settleOrder(orderId, {
              orderId,
              paymentMode,
              discountAmount,
              tenderedAmount: paymentMode === 'CASH' && numericTendered > 0 ? numericTendered : undefined,
              changeAmount: paymentMode === 'CASH' && changeToReturn > 0 ? changeToReturn : undefined,
              billingMode: BillingModes.PRE_PAID,
              orderStatus: 'Settled',
            });
          } catch (settleErr) {
            console.warn('Instant settle warning:', settleErr);
          }
        }

        const receiptData: ReceiptData = {
          orderId,
          orderNumber: String(orderId),
          pickupToken: String(orderId),
          restaurantName: restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
          address: restaurantConfig?.address || activeRestaurant?.address || '',
          city: restaurantConfig?.city || activeRestaurant?.city || '',
          state: restaurantConfig?.state || activeRestaurant?.state || '',
          contactPhone: restaurantConfig?.contactNumber || (activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || '',
          gstNumber: hasGstNumber ? (restaurantConfig?.gstNumber || '') : undefined,
          customerName: effectiveCustomerName,
          customerPhone: cleanPhone || undefined,
          orderType,
          tableName: selectedTable ? `Table ${selectedTable.tableNumber}` : undefined,
          sectionName: selectedTable?.sectionName || undefined,
          items: cart.map((c) => ({
            itemName: c.itemName,
            quantity: c.quantity,
            unitPrice: c.price,
            totalPrice: c.price * c.quantity,
            cookingInstruction: c.notes,
          })),
          subtotal,
          discountAmount,
          cgstPercentage: hasGstNumber ? cgstRate : undefined,
          cgstAmount: hasGstNumber ? cgstAmount : undefined,
          sgstPercentage: hasGstNumber ? sgstRate : undefined,
          sgstAmount: hasGstNumber ? sgstAmount : undefined,
          taxAmount: totalTax,
          grandTotal,
          paymentMode: isPostPaidKOT ? 'KOT (Pay Later)' : paymentMode,
          tenderedAmount: numericTendered,
          changeAmount: changeToReturn,
          date: new Date().toLocaleString('en-IN'),
          footerMessage: customFooter || 'Thank you! Please visit again.',
        };

        // Automatic Thermal Printing if enabled in Settings
        if (!isPostPaidKOT) {
          if (autoPrintReceipt && autoPrintKot) {
            WebPrinterService.printBifurcatedOrder(receiptData, paperWidth, true, true).catch((err) =>
              console.warn('Auto print bifurcated error:', err)
            );
          } else if (autoPrintReceipt) {
            WebPrinterService.printReceipt(receiptData, paperWidth).catch((err) =>
              console.warn('Auto print receipt error:', err)
            );
          } else if (autoPrintKot) {
            WebPrinterService.printStationKots(receiptData, paperWidth).catch((err) =>
              console.warn('Auto print KOT error:', err)
            );
          }
        } else {
          // KOT only
          if (autoPrintKot || isPostPaidKOT) {
            WebPrinterService.printStationKots(receiptData, paperWidth).catch((err) =>
              console.warn('Auto print KOT error:', err)
            );
          }
        }

        setOrderSuccessData({
          orderId,
          orderType,
          table: selectedTable?.tableNumber,
          customerName: orderPayload.name,
          customerPhone: cleanPhone,
          items: cart,
          subtotal,
          totalTax,
          grandTotal,
          paymentMode: isPostPaidKOT ? 'KOT (Pay Later)' : paymentMode,
          tendered: numericTendered,
          change: changeToReturn,
          date: new Date().toLocaleTimeString(),
          receiptData,
        });

        if (isPostPaidKOT) {
          clearCartOnly();
          setSettleModalOpen(false);
          // If it was a table order, reload running active order on table
          if (selectedTable?.id) {
            loadActiveTableOrder(selectedTable.id);
          }
        } else {
          clearCart();
          setSettleModalOpen(false);
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
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

  const handleShareWhatsApp = async () => {
    if (!orderSuccessData) return;
    let phone = orderSuccessData.customerPhone;
    if (!phone) {
      const entered = window.prompt('Enter 10-digit customer WhatsApp number:');
      if (!entered) return;
      phone = entered.replace(/[^0-9]/g, '').slice(-10);
    }
    if (!phone || phone.length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    const url = WebWhatsAppService.getWhatsAppReceiptUrl(phone, {
      restaurantName: activeRestaurant?.restaurantName || 'Menza Restaurant',
      orderId: orderSuccessData.orderId,
      customerName: orderSuccessData.customerName,
      items: orderSuccessData.items,
      grandTotal: orderSuccessData.grandTotal,
      paymentMode: orderSuccessData.paymentMode,
    });
    window.open(url, '_blank');

    if (activeRestaurant?.restaurantId) {
      WebWhatsAppService.sendOrderStatusNotification({
        orderId: Number(orderSuccessData.orderId),
        restaurantId: activeRestaurant.restaurantId,
        restaurantName: activeRestaurant.restaurantName,
        mobileNumber: phone,
        customerName: orderSuccessData.customerName,
        orderStatus: 'CONFIRMED',
        orderTypeName: orderSuccessData.orderType,
        tableName: orderSuccessData.table ? `Table ${orderSuccessData.table}` : undefined,
        totalAmount: orderSuccessData.grandTotal,
      }).catch((e) => console.warn('Background WhatsApp push failed:', e));
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-[#FAF7F2] dark:bg-[#111418]">
          {/* LEFT 65%: Menu Catalog & Category Filters */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-[#E7E1DA] dark:border-[#2B3540]">
            {/* Top POS Action Toolbar */}
            <div className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-3 sm:p-4 space-y-3">
              {/* Row 1: Order Type Selector, Table Picker & Store Status */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Service Type Switcher */}
                  <div className="flex items-center gap-1.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-1">
                    {(['COUNTER', 'DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setOrderType(type);
                          if (type === 'DINE_IN' && !selectedTable) {
                            setTableModalOpen(true);
                          }
                        }}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                          orderType === type
                            ? 'bg-[#DE8626] text-white shadow-sm shadow-[#DE8626]/30'
                            : 'text-[#667085] dark:text-[#94A3B8] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                        }`}
                      >
                        {type === 'DINE_IN' ? 'Dine-In' : type === 'TAKEAWAY' ? 'Takeaway' : type === 'DELIVERY' ? 'Delivery' : 'Counter'}
                      </button>
                    ))}
                  </div>

                  {/* Table Picker Button (If Dine-In) */}
                  {orderType === 'DINE_IN' && (
                    <button
                      onClick={() => setTableModalOpen(true)}
                      className="flex items-center gap-2 rounded-xl border border-[#DE8626] bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors"
                    >
                      <TableIcon className="h-4 w-4" />
                      <span>{selectedTable ? `Table #${selectedTable.tableNumber}` : 'Assign Table'}</span>
                    </button>
                  )}

                  {/* Store Operating Status Indicator Pill */}
                  <button
                    onClick={() => setOperatingModalOpen(true)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                      operatingStatus?.status === 'OPEN' || (!operatingStatus && restaurantConfig?.isActive !== false)
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                        : operatingStatus?.status === 'PAUSED'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                        : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20'
                    }`}
                    title="Manage Store Operating Status (Open / Pause / Close)"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        operatingStatus?.status === 'OPEN' || (!operatingStatus && restaurantConfig?.isActive !== false)
                          ? 'bg-emerald-500 animate-pulse'
                          : operatingStatus?.status === 'PAUSED'
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-red-500'
                      }`}
                    />
                    <Store className="h-3.5 w-3.5" />
                    <span>
                      {operatingStatus?.status === 'PAUSED'
                        ? 'Store Paused'
                        : operatingStatus?.status === 'CLOSED'
                        ? 'Store Closed'
                        : operatingStatus?.status === 'WALLET_EXHAUSTED'
                        ? 'Wallet Empty'
                        : 'Store Open'}
                    </span>
                  </button>
                </div>

                {/* Veg / Non-Veg Toggle Filter */}
                <div className="flex items-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-1 text-xs">
                  <button
                    onClick={() => setVegFilter('ALL')}
                    className={`rounded-lg px-2.5 py-1 font-semibold ${
                      vegFilter === 'ALL'
                        ? 'bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] shadow-sm'
                        : 'text-[#667085]'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setVegFilter('VEG')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                      vegFilter === 'VEG' ? 'bg-emerald-500 text-white shadow-sm' : 'text-[#667085]'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    Veg
                  </button>
                  <button
                    onClick={() => setVegFilter('NON_VEG')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                      vegFilter === 'NON_VEG' ? 'bg-red-500 text-white shadow-sm' : 'text-[#667085]'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-red-300" />
                    Non-Veg
                  </button>
                </div>
              </div>

              {/* Row 2: Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dishes by name or item code (e.g. Masala Dosa, Chai, 101)..."
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-10 pr-4 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#1E2930]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Horizontal Scrolling Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] px-4 py-2.5">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  selectedCategory === null
                    ? 'bg-[#DE8626] text-white shadow-sm shadow-[#DE8626]/20'
                    : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
                }`}
              >
                All Menu ({items.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-[#DE8626] text-white shadow-sm shadow-[#DE8626]/20'
                      : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
                  }`}
                >
                  {cat.categoryName}
                </button>
              ))}
            </div>

            {/* Dishes / Menu Items Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div
                      key={n}
                      className="h-32 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-20 text-center text-xs text-[#667085] dark:text-[#94A3B8]">
                  No dishes found matching your search or filters.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredItems.map((item) => {
                    const inCart = cart.find((ci) => ci.itemId === item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className={`group relative flex flex-col justify-between rounded-2xl border overflow-hidden shadow-sm transition-all cursor-pointer select-none ${
                          inCart
                            ? 'border-[#DE8626] bg-amber-500/5 ring-1 ring-[#DE8626]'
                            : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] hover:border-[#DE8626] hover:shadow-md'
                        }`}
                      >
                        {/* Dish Image Banner */}
                        <div className="relative h-24 sm:h-28 w-full overflow-hidden bg-amber-500/5 dark:bg-amber-500/5">
                          <DishImage
                            src={item.imageUrl}
                            alt={item.itemName}
                            isVeg={item.isVeg}
                            showDietBadge
                            fallbackIconSize={22}
                          />
                          {inCart && (
                            <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#DE8626] text-[11px] font-extrabold text-white shadow-sm">
                              {inCart.quantity}
                            </span>
                          )}
                        </div>

                        {/* Card Details */}
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] line-clamp-2 leading-snug">
                              {item.itemName}
                            </h4>
                            {item.portionDisplay && (
                              <p className="text-[10px] text-[#667085] dark:text-[#94A3B8] mt-0.5">{item.portionDisplay}</p>
                            )}
                          </div>

                          <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-[#E7E1DA]/40 dark:border-[#2B3540]/40">
                            <span className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                              ₹{item.price}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(item);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF7F2] dark:bg-[#151A20] text-[#DE8626] group-hover:bg-[#DE8626] group-hover:text-white transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 35%: Sticky Checkout & Cart Panel */}
          <div className="w-full lg:w-96 flex flex-col border-t lg:border-t-0 border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127]">
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] p-4 bg-[#FAF7F2] dark:bg-[#151A20]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#DE8626]" />
                <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Order Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
                </h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Customer & Table Meta */}
            <div className="p-3 border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name (Optional)"
                  className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-1.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                  placeholder="Phone"
                  maxLength={10}
                  className="w-28 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-1.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none"
                />
              </div>

              {orderType === 'DINE_IN' && (
                <div className="flex items-center justify-between rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-[#DE8626]">
                  <span className="flex items-center gap-1.5">
                    <TableIcon className="h-3.5 w-3.5" />
                    {selectedTable ? `Table ${selectedTable.tableNumber}` : 'No table assigned'}
                  </span>
                  <button onClick={() => setTableModalOpen(true)} className="underline text-[11px]">
                    {selectedTable ? 'Change' : 'Select'}
                  </button>
                </div>
              )}

              {/* Running Table Order Banner (If Table has an Active Tab) */}
              {activeTableOrder && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Utensils className="h-4 w-4 text-[#DE8626] shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-[#DE8626] block">
                          Table #{selectedTable?.tableNumber} • Running Tab #{activeTableOrder.orderNumber || activeTableOrder.id}
                        </span>
                        <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                          {activeTableOrder.items?.length || 0} active item{(activeTableOrder.items?.length || 0) !== 1 ? 's' : ''} in kitchen
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRunningTableDetails(!showRunningTableDetails)}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#DE8626] hover:underline"
                    >
                      <span>{showRunningTableDetails ? 'Hide' : 'View'}</span>
                      {showRunningTableDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* Running Table Items Accordion */}
                  {showRunningTableDetails && (
                    <div className="mt-1 pt-1.5 border-t border-amber-500/20 max-h-36 overflow-y-auto space-y-1 text-xs">
                      {(activeTableOrder.items || []).map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] text-[#1E2930] dark:text-[#F3F4F6]">
                          <span>{it.quantity}x {it.itemName}</span>
                          <span className="font-semibold">₹{(it.unitPrice || it.amount || 0) * (it.quantity || 1)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold pt-1 border-t border-amber-500/20 text-[#DE8626]">
                        <span>Previous Tab Total:</span>
                        <span>₹{existingTableTotal}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center text-xs text-[#667085] dark:text-[#94A3B8]">
                  <ShoppingBag className="h-8 w-8 text-[#DE8626]/40 mb-2" />
                  <p className="font-semibold">Cart is empty</p>
                  <p className="text-[11px] mt-0.5">Tap on any dish to add to this order</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center justify-between rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-2.5 bg-[#FAF7F2]/40 dark:bg-[#151A20]/40 text-xs"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6] truncate">{item.itemName}</p>
                      </div>
                      <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-0.5">
                        ₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}
                      </p>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.itemId, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.itemId, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#DE8626] text-white hover:bg-[#C4721C]"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Summary & Sticky Checkout Buttons */}
            <div className="border-t border-[#E7E1DA] dark:border-[#2B3540] p-4 bg-[#FAF7F2] dark:bg-[#151A20] space-y-3">
              <div className="space-y-1.5 text-xs">
                {activeTableOrder && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                    <span>Running Tab Total</span>
                    <span>₹{existingTableTotal}</span>
                  </div>
                )}
                {cart.length > 0 && (
                  <>
                    <div className="flex justify-between text-[#667085] dark:text-[#94A3B8]">
                      <span>{activeTableOrder ? 'New Items Subtotal' : 'Subtotal'}</span>
                      <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">₹{subtotal}</span>
                    </div>
                    {hasGstNumber && (
                      <div className="flex justify-between text-[#667085] dark:text-[#94A3B8]">
                        <span>Taxes (CGST + SGST)</span>
                        <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">₹{totalTax}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6] pt-1.5 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                  <span>Total Payable</span>
                  <span className="text-[#DE8626]">₹{payableGrandTotal}</span>
                </div>
              </div>

              {/* Action Buttons: Send KOT vs Collect Payment */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* Send KOT Button */}
                <button
                  disabled={cart.length === 0 || isPlacingOrder}
                  onClick={() => executeOrder(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DE8626] bg-transparent py-2.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Utensils className="h-4 w-4" />
                  <span>Send KOT</span>
                </button>

                {/* Pay & Settle Button */}
                <button
                  disabled={(cart.length === 0 && !activeTableOrder) || isPlacingOrder}
                  onClick={() => setSettleModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <IndianRupee className="h-4 w-4" />
                  <span>
                    {cart.length === 0 && activeTableOrder
                      ? `Settle Tab ₹${payableGrandTotal}`
                      : `Settle ₹${payableGrandTotal}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Dining Table Selection Modal */}
        {tableModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Select Dining Table</h3>
                </div>
                <button onClick={() => setTableModalOpen(false)} className="rounded-lg p-1 text-[#667085]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-1">
                {tables.map((tbl) => {
                  const isOccupied = tbl.status?.toUpperCase() === 'OCCUPIED' || Boolean(tbl.activeOrderId);
                  const isSelected = selectedTable?.id === tbl.id;
                  return (
                    <button
                      key={tbl.id}
                      onClick={() => {
                        setSelectedTable(tbl);
                        setTableModalOpen(false);
                      }}
                      className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all ${
                        isSelected
                          ? 'border-[#DE8626] bg-[#DE8626] text-white shadow-md'
                          : isOccupied
                          ? 'border-amber-400 bg-amber-500/10 text-[#1E2930] dark:text-[#F3F4F6]'
                          : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]'
                      }`}
                    >
                      <span className="text-lg font-extrabold">T-{tbl.tableNumber}</span>
                      <span className="text-[10px] opacity-75">{tbl.seatingCapacity || 4} Seats</span>
                      <span className="mt-1 text-[9px] font-bold uppercase">
                        {isOccupied ? 'Occupied' : 'Available'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 2. Settlement & Payment Modal */}
        {settleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Collect Payment & Settle</h3>
                <button onClick={() => setSettleModalOpen(false)} className="rounded-lg p-1 text-[#667085]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Amount Display */}
              <div className="rounded-2xl bg-amber-500/10 p-4 text-center mb-5">
                <span className="text-xs font-semibold text-[#DE8626] uppercase">Payable Bill Amount</span>
                <h2 className="text-3xl font-extrabold text-[#DE8626]">₹{payableGrandTotal}</h2>
                {activeTableOrder && (
                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-1">
                    Consolidated: Tab ₹{existingTableTotal} + Current ₹{grandTotal}
                  </p>
                )}
              </div>

              {/* Payment Mode Options */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['CASH', 'UPI', 'CARD', 'DUE'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPaymentMode(mode)}
                      className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                        paymentMode === mode
                          ? 'border-[#DE8626] bg-[#DE8626] text-white shadow-md'
                          : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Tendered & Change Return (If Cash) */}
              {paymentMode === 'CASH' && (
                <div className="space-y-3 mb-5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] p-3.5 bg-[#FAF7F2] dark:bg-[#151A20]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                      Cash Tendered by Customer
                    </label>
                    {numericTendered > 0 && (
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          numericTendered >= payableGrandTotal
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {numericTendered >= payableGrandTotal
                          ? `Change: ₹${changeToReturn.toFixed(2)}`
                          : `Short: ₹${(payableGrandTotal - numericTendered).toFixed(2)}`}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-[#DE8626]">₹</span>
                    <input
                      type="number"
                      value={tenderedAmount}
                      onChange={(e) => setTenderedAmount(e.target.value)}
                      placeholder={String(payableGrandTotal)}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-8 pr-3 py-2 text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  {/* Quick Cash Preset Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setTenderedAmount(payableGrandTotal.toFixed(0))}
                      className="rounded-lg border border-[#DE8626] bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20"
                    >
                      Exact (₹{payableGrandTotal})
                    </button>
                    {[
                      Math.ceil((payableGrandTotal + 1) / 50) * 50,
                      Math.ceil((payableGrandTotal + 1) / 100) * 100,
                      500,
                      1000,
                      2000,
                    ]
                      .filter((val, idx, arr) => val > payableGrandTotal && arr.indexOf(val) === idx)
                      .slice(0, 3)
                      .map((val) => (
                        <button
                          key={`cash-chip-${val}`}
                          type="button"
                          onClick={() => setTenderedAmount(val.toString())}
                          className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-2.5 py-1 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]"
                        >
                          ₹{val}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                disabled={isPlacingOrder}
                onClick={() => executeOrder(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#DE8626] py-3.5 text-sm font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-all"
              >
                <span>{isPlacingOrder ? 'Processing Bill...' : `Confirm & Collect ₹${payableGrandTotal}`}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Order Success & Thermal Print Receipt Modal */}
        {orderSuccessData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex flex-col items-center text-center mb-5">
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
                className="rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] p-4 text-xs font-mono bg-[#FAF7F2] dark:bg-[#151A20] mb-5 max-h-60 overflow-y-auto"
              >
                <div className="text-center font-bold pb-2 border-b border-dashed border-gray-400">
                  {activeRestaurant?.restaurantName || 'Menza Restaurant'}
                </div>
                <div className="flex justify-between py-1 text-[11px]">
                  <span>Order: #{orderSuccessData.orderId}</span>
                  <span>{orderSuccessData.date}</span>
                </div>
                <div className="py-1 text-[11px]">
                  <span>Customer: {orderSuccessData.customerName}</span>
                </div>
                <div className="border-t border-b border-dashed border-gray-400 my-2 py-1 space-y-1">
                  {orderSuccessData.items.map((i: any) => (
                    <div key={i.itemId} className="flex justify-between text-[11px]">
                      <span>{i.quantity}x {i.itemName}</span>
                      <span>₹{i.price * i.quantity}</span>
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
                {orderSuccessData.paymentMode?.includes('KOT') ? (
                  <button
                    onClick={() => setOrderSuccessData(null)}
                    className="flex items-center justify-center rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-colors"
                  >
                    <span>Continue Tab</span>
                  </button>
                ) : null}
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

        {/* 4. Store Operating Status Controls Modal */}
        <StoreOperatingStatusModal
          isOpen={operatingModalOpen}
          onClose={() => setOperatingModalOpen(false)}
          restaurantId={currentRestId}
          restaurantName={restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant'}
          status={operatingStatus}
          onStatusUpdated={(updated) => setOperatingStatus(updated)}
        />
      </AppShell>
    </AuthGuard>
  );
}
