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
  AlertCircle,
  QrCode,
  ArrowRight,
  Receipt,
  User,
  Phone,
  Table as TableIcon,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { DishImage } from '@/components/common/DishImage';
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
import { RestaurantConfig } from '@shared/domain/models/RestaurantConfig';
import { BillingModes, PosCheckoutModes } from '@shared/domain/models/Order';
import { ReceiptData } from '@shared/core/printer/EscPosBuilder';

const catalogDataSource = new CatalogRemoteDataSource();
const orderRepository = new OrderRepositoryImpl(new OrderRemoteDataSource());
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
  const { canTakeOrders, openRenewalModal } = useSubscriptionStore();

  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<TableMaster[]>([]);
  const [restaurantConfig, setRestaurantConfig] = useState<RestaurantConfig | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Load menu items, categories, tables, and config
  useEffect(() => {
    if (!currentRestId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [catsRes, itemsRes, tablesRes, cfgRes] = await Promise.allSettled([
          catalogDataSource.getCategories(currentRestId),
          catalogDataSource.getMenuItems(currentRestId),
          tableDataSource.getTables(currentRestId),
          configDataSource.getConfig(currentRestId),
        ]);

        if (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value)) {
          setCategories(catsRes.value);
        }
        if (itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value)) {
          setItems(itemsRes.value);
        }
        if (tablesRes.status === 'fulfilled' && Array.isArray(tablesRes.value)) {
          setTables(tablesRes.value);
        }
        if (cfgRes.status === 'fulfilled' && cfgRes.value) {
          setRestaurantConfig(cfgRes.value);
        }
      } catch (err) {
        console.warn('POS data load failed', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentRestId]);

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

  const clearCart = () => {
    setCart([]);
    setSelectedTable(null);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountAmount(0);
    setTenderedAmount('');
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  // Tax calculation (CGST + SGST from config, or standard 2.5% + 2.5% = 5%)
  const cgstRate = restaurantConfig?.cgstPercentage ?? 2.5;
  const sgstRate = restaurantConfig?.sgstPercentage ?? 2.5;
  const cgstAmount = Math.round((subtotal * cgstRate) / 100);
  const sgstAmount = Math.round((subtotal * sgstRate) / 100);
  const totalTax = cgstAmount + sgstAmount;
  const grandTotal = Math.max(0, subtotal + totalTax - discountAmount);

  // Cash change
  const numericTendered = parseFloat(tenderedAmount) || 0;
  const changeToReturn = Math.max(0, numericTendered - grandTotal);

  // Place Order Execution (Send KOT vs Pay & Settle)
  const executeOrder = async (isPostPaidKOT: boolean) => {
    if (cart.length === 0 || isPlacingOrder) return;

    if (!canTakeOrders()) {
      alert('Your restaurant subscription has expired beyond the grace period. Order taking and billing are locked until your plan is renewed.');
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

      const orderPayload: any = {
        restaurantId: currentRestId,
        name: customerName.trim() || (selectedTable ? `Table ${selectedTable.tableNumber}` : 'Counter Customer'),
        mobileNumber: customerPhone.trim() || undefined,
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

        const receiptData: ReceiptData = {
          orderId,
          orderNumber: String(orderId),
          pickupToken: String(orderId),
          restaurantName: restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
          address: restaurantConfig?.address || activeRestaurant?.address || '',
          city: restaurantConfig?.city || activeRestaurant?.city || '',
          state: restaurantConfig?.state || activeRestaurant?.state || '',
          contactPhone: restaurantConfig?.contactNumber || (activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || '',
          gstNumber: restaurantConfig?.gstNumber || '',
          customerName: orderPayload.name || 'Walk-in Customer',
          customerPhone: customerPhone.trim() || undefined,
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
          cgstPercentage: cgstRate,
          cgstAmount,
          sgstPercentage: sgstRate,
          sgstAmount,
          taxAmount: totalTax,
          grandTotal,
          paymentMode: isPostPaidKOT ? 'KOT (Pay Later)' : paymentMode,
          tenderedAmount: numericTendered,
          changeAmount: changeToReturn,
          date: new Date().toLocaleString('en-IN'),
          footerMessage: customFooter || 'Thank you! Please visit again.',
        };

        // Automatic Thermal Printing if enabled in Settings
        if (autoPrintReceipt) {
          WebPrinterService.printReceipt(receiptData, paperWidth).catch((err) =>
            console.warn('Auto print receipt error:', err)
          );
        }
        if (autoPrintKot) {
          WebPrinterService.printKot(receiptData, paperWidth).catch((err) =>
            console.warn('Auto print KOT error:', err)
          );
        }

        setOrderSuccessData({
          orderId,
          orderType,
          table: selectedTable?.tableNumber,
          customerName: orderPayload.name,
          customerPhone: customerPhone.trim(),
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

        clearCart();
        setSettleModalOpen(false);
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
              {/* Row 1: Order Type Selector & Table Picker */}
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                <div className="flex justify-between text-[#667085] dark:text-[#94A3B8]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-[#667085] dark:text-[#94A3B8]">
                  <span>Taxes (CGST + SGST)</span>
                  <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">₹{totalTax}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6] pt-1.5 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                  <span>Grand Total</span>
                  <span className="text-[#DE8626]">₹{grandTotal}</span>
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
                  disabled={cart.length === 0 || isPlacingOrder}
                  onClick={() => setSettleModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <IndianRupee className="h-4 w-4" />
                  <span>Settle ₹{grandTotal}</span>
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
                <h2 className="text-3xl font-extrabold text-[#DE8626]">₹{grandTotal}</h2>
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
                  <div>
                    <label className="block text-xs font-semibold text-[#667085] mb-1">Cash Tendered by Customer</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        value={tenderedAmount}
                        onChange={(e) => setTenderedAmount(e.target.value)}
                        placeholder={String(grandTotal)}
                        className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-8 pr-3 py-2 text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none"
                      />
                    </div>
                  </div>

                  {changeToReturn > 0 && (
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span>Change to Return:</span>
                      <span className="text-sm">₹{changeToReturn}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Button */}
              <button
                disabled={isPlacingOrder}
                onClick={() => executeOrder(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#DE8626] py-3.5 text-sm font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-all"
              >
                <span>{isPlacingOrder ? 'Processing Bill...' : `Confirm & Collect ₹${grandTotal}`}</span>
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
                <button
                  onClick={() => setOrderSuccessData(null)}
                  className="flex items-center justify-center rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] transition-colors"
                >
                  <span>New Sale</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
