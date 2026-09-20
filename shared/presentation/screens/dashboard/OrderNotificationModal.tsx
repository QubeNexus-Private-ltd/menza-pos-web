import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  CheckCheck,
  Trash2,
  Clock,
  User,
  ShoppingBag,
  IndianRupee,
  ChevronRight,
  Printer,
  CheckCircle2,
  Table as TableIcon,
  Check,
  Sparkles,
  Banknote,
  CreditCard,
  Receipt,
  Phone,
  Utensils,
  Tag,
  ChefHat,
} from 'lucide-react-native';
import { formatToIstTime, formatToIstDateTime } from '../../../core/utils/formatters';
import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import {
  useNotificationStore,
  OrderNotificationItem,
} from '../../state/useNotificationStore';
import { usePrinterStore } from '../../state/usePrinterStore';
import { useAuthStore } from '../../state/useAuthStore';
import { OrderMaster } from '../../../domain/models/Order';
import { OrderRemoteDataSource } from '../../../data/datasources/OrderRemoteDataSource';
import { CashierSettlementModal } from '../../components/CashierSettlementModal';
import { logger } from '../../../core/logging';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const orderDataSource = new OrderRemoteDataSource();

interface OrderNotificationModalProps {
  visible: boolean;
  onClose: () => void;
  restaurantId?: number;
  restaurantName?: string;
  onViewOrderDetails?: (order: OrderMaster) => void;
  onOpenTodayOrders?: () => void;
  onSettlementSuccess?: () => void;
}

export const OrderNotificationModal: React.FC<OrderNotificationModalProps> = ({
  visible,
  onClose,
  restaurantId,
  restaurantName,
  onViewOrderDetails,
  onOpenTodayOrders,
  onSettlementSuccess,
}) => {
  const { activeRestaurant } = useAuthStore();
  const {
    notifications,
    unreadCount,
    soundEnabled,
    setSoundEnabled,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    clearNotification,
  } = useNotificationStore();

  const { connectedDevice, printKot, printReceipt } = usePrinterStore();
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [settleOrderTarget, setSettleOrderTarget] = useState<OrderMaster | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderMaster | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [printingOrderId, setPrintingOrderId] = useState<string | number | null>(null);

  const effectiveRestId = restaurantId || activeRestaurant?.restaurantId || 0;
  const effectiveRestName = restaurantName || activeRestaurant?.restaurantName || '';

  const filteredNotifications = useMemo(() => {
    const list = filterTab === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications;
    // Deduplicate so only the latest notification per orderId is visible
    const seenOrderIds = new Set<number>();
    const uniqueList: OrderNotificationItem[] = [];
    for (const item of list) {
      if (!seenOrderIds.has(item.orderId)) {
        seenOrderIds.add(item.orderId);
        uniqueList.push(item);
      }
    }
    return uniqueList;
  }, [notifications, filterTab]);

  // Auto-mark notifications as read when opening notification modal drawer
  useEffect(() => {
    if (visible && unreadCount > 0) {
      markAllAsRead();
    }
  }, [visible, unreadCount, markAllAsRead]);

  const formatTimeAgo = (timestamp: number) => {
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 30) return 'Just now';
    if (elapsed < 60) return `${elapsed}s ago`;
    const mins = Math.floor(elapsed / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const extractNumericOrderId = (item: OrderNotificationItem | OrderMaster): number => {
    if (!item) return 0;
    if ('orderId' in item && typeof (item as OrderNotificationItem).orderId === 'number' && (item as OrderNotificationItem).orderId > 0) {
      return (item as OrderNotificationItem).orderId;
    }
    if (typeof (item as any).orderId === 'number' && (item as any).orderId > 0) {
      return (item as any).orderId;
    }
    if (typeof item.id === 'number' && item.id > 0) {
      return item.id;
    }
    if (typeof item.id === 'string' && item.id.startsWith('notif_')) {
      const match = item.id.match(/^notif_(\d+)_/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    const parsed = parseInt(String(item.id), 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : 0;
  };

  const handleViewDetails = async (item: OrderNotificationItem) => {
    const numericOrderId = extractNumericOrderId(item);
    if (numericOrderId > 0) {
      markAsRead(numericOrderId);
    } else {
      markAsRead(item.id);
    }
    let baseOrder: OrderMaster = item.orderData ? { ...item.orderData, id: numericOrderId } : {
      id: numericOrderId,
      restaurantId: effectiveRestId,
      customerName: item.customerName,
      mobileNumber: item.customerPhone,
      totalAmount: item.totalAmount,
      tableName: item.tableName,
      orderTypeId: item.orderTypeId || 1,
      orderTypeName: item.orderTypeName,
      status: item.orderStatus,
      paymentMode: ((item.orderData as any)?.paymentMode || 'CASH') as any,
      paymentStatus: ((item.orderData as any)?.paymentStatus || 'Pending') as any,
      items: (item.orderData as any)?.items || [],
      createdAt: item.createdAt,
    };
    setSelectedOrderDetail(baseOrder);

    if (!baseOrder.items || baseOrder.items.length === 0) {
      try {
        setLoadingDetails(true);
        const fullOrder = await orderDataSource.getOrderById(numericOrderId);
        if (fullOrder) {
          setSelectedOrderDetail({ ...fullOrder, id: numericOrderId });
          baseOrder = { ...fullOrder, id: numericOrderId };
        }
      } catch (err: any) {
        logger.api('API_ERROR', 'Failed to fetch order details for notification', { error: err?.message });
      } finally {
        setLoadingDetails(false);
      }
    }

    if (onViewOrderDetails) {
      onViewOrderDetails(baseOrder);
    }
  };

  const handleSettleOrder = async (item: OrderNotificationItem | OrderMaster) => {
    const isNotificationItem = 'orderId' in item || (typeof (item as any).id === 'string' && (item as any).id.startsWith('notif_'));
    const numericOrderId = extractNumericOrderId(item);
    if (numericOrderId > 0) {
      markAsRead(numericOrderId);
    } else if (isNotificationItem) {
      markAsRead((item as OrderNotificationItem).id);
    }

    let orderToSettle: OrderMaster | null = null;
    if (!isNotificationItem && typeof (item as any).id === 'number') {
      orderToSettle = { ...(item as OrderMaster), id: numericOrderId };
    } else if (isNotificationItem && (item as OrderNotificationItem).orderData) {
      orderToSettle = { ...(item as OrderNotificationItem).orderData!, id: numericOrderId };
    }

    if (!orderToSettle || !orderToSettle.items || orderToSettle.items.length === 0) {
      try {
        const fullOrder = await orderDataSource.getOrderById(numericOrderId);
        if (fullOrder) {
          orderToSettle = { ...fullOrder, id: numericOrderId };
        }
      } catch (err: any) {
        logger.api('API_ERROR', 'Failed to fetch full order for settlement', { error: err?.message });
      }
    }

    if (!orderToSettle) {
      const notif = item as OrderNotificationItem;
      orderToSettle = {
        id: numericOrderId,
        restaurantId: effectiveRestId,
        customerName: notif.customerName,
        mobileNumber: notif.customerPhone,
        totalAmount: notif.totalAmount,
        tableName: notif.tableName,
        orderTypeId: notif.orderTypeId || 1,
        orderTypeName: notif.orderTypeName,
        status: notif.orderStatus,
        paymentMode: 'CASH',
        paymentStatus: 'Pending',
        items: [],
        createdAt: notif.createdAt,
      };
    }

    orderToSettle.id = numericOrderId;
    setSettleOrderTarget(orderToSettle);
  };

  const handlePrint = async (item: OrderNotificationItem | OrderMaster) => {
    const isNotificationItem = 'orderId' in item || (typeof (item as any).id === 'string' && (item as any).id.startsWith('notif_'));
    const orderId = extractNumericOrderId(item);
    if (orderId > 0) {
      markAsRead(orderId);
    } else if (isNotificationItem) {
      markAsRead((item as OrderNotificationItem).id);
    }

    if (!connectedDevice) {
      Alert.alert(
        'No Printer Connected 🖨️',
        'Please connect a Bluetooth thermal printer from the Printer Settings screen to print KOT tickets.'
      );
      return;
    }

    try {
      setPrintingOrderId(orderId);
      let targetOrder: OrderMaster | null = isNotificationItem
        ? (item as OrderNotificationItem).orderData || null
        : (item as OrderMaster);

      if (!targetOrder || !targetOrder.items || targetOrder.items.length === 0) {
        try {
          const fetched = await orderDataSource.getOrderById(orderId);
          if (fetched) targetOrder = { ...fetched, id: orderId };
        } catch {}
      }

      const itemsList = targetOrder?.items && targetOrder.items.length > 0
        ? targetOrder.items
        : [{ itemName: (isNotificationItem ? (item as OrderNotificationItem).itemsSummary : 'Order Items') || 'Order Item', quantity: 1, unitPrice: targetOrder?.totalAmount || 0, totalPrice: targetOrder?.totalAmount || 0 }];

      const effectiveToken =
        targetOrder?.pickupToken ||
        (targetOrder as any)?.tokenNumber ||
        (item as any)?.pickupToken ||
        (item as any)?.tokenNumber ||
        String(orderId);

      const receiptData: any = {
        orderId: orderId,
        orderNumber: targetOrder?.orderNumber || String(orderId),
        pickupToken: effectiveToken,
        restaurantName: effectiveRestName,
        customerName: targetOrder?.customerName || (isNotificationItem ? (item as OrderNotificationItem).customerName : 'Guest'),
        customerPhone: targetOrder?.mobileNumber || (isNotificationItem ? (item as OrderNotificationItem).customerPhone : undefined),
        tableName: targetOrder?.tableName || (isNotificationItem ? (item as OrderNotificationItem).tableName : 'Table'),
        orderType: targetOrder?.orderTypeName || 'Dine-In',
        items: itemsList.map((it: any) => ({
          itemName: it.itemName || it.name || it.dishName || 'Item',
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || it.amount || it.price || 0),
          totalPrice: Number(it.totalPrice || (Number(it.quantity || 1) * Number(it.unitPrice || it.amount || it.price || 0))),
          cookingInstruction: it.cookingInstruction,
        })),
        grandTotal: targetOrder?.totalAmount || (isNotificationItem ? (item as OrderNotificationItem).totalAmount : 0),
        date: targetOrder?.createdAt ? new Date(targetOrder.createdAt) : new Date(),
        isKot: true,
      };

      await printKot(receiptData);
      Alert.alert('KOT Printed! 🖨️', `Kitchen Order Ticket for Order #${orderId} sent to printer.`);
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Failed to print KOT ticket.');
    } finally {
      setPrintingOrderId(null);
    }
  };

  const handlePrintReceipt = async (order: OrderMaster) => {
    if (!connectedDevice) {
      Alert.alert(
        'No Printer Connected 🖨️',
        'Please connect a Bluetooth thermal printer from the Printer Settings screen to print customer receipts.'
      );
      return;
    }

    try {
      setPrintingOrderId(order.id);
      let targetOrder = order;
      if (!targetOrder.items || targetOrder.items.length === 0) {
        try {
          const fetched = await orderDataSource.getOrderById(order.id);
          if (fetched) targetOrder = fetched;
        } catch {}
      }

      const itemsList = targetOrder.items && targetOrder.items.length > 0
        ? targetOrder.items
        : [{ itemName: 'Order Items', quantity: 1, unitPrice: targetOrder.totalAmount, totalPrice: targetOrder.totalAmount }];

      const effectiveAddress = (() => {
        const addr = targetOrder.address?.trim() || activeRestaurant?.address?.trim() || '';
        const city = targetOrder.city?.trim() || activeRestaurant?.city?.trim() || '';
        const state = targetOrder.state?.trim() || activeRestaurant?.state?.trim() || '';

        const parts: string[] = [];
        if (addr) parts.push(addr);
        if (city && !addr.toLowerCase().includes(city.toLowerCase())) parts.push(city);
        if (state && !addr.toLowerCase().includes(state.toLowerCase())) parts.push(state);

        return parts.join(', ');
      })();

      const receiptData: any = {
        orderId: targetOrder.id,
        orderNumber: targetOrder.orderNumber || String(targetOrder.id),
        pickupToken: targetOrder.pickupToken || String(targetOrder.orderNumber || targetOrder.id),
        restaurantName: effectiveRestName,
        address: effectiveAddress || undefined,
        contactPhone: targetOrder.contactNumber || targetOrder.contactPhone || (activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || undefined,
        gstNumber: targetOrder.gstNumber || undefined,
        logoUrl: targetOrder.logoUrl || activeRestaurant?.logoUrl || undefined,
        customerName: targetOrder.customerName || 'Guest',
        customerPhone: targetOrder.mobileNumber,
        tableName: targetOrder.tableName || 'Table',
        orderType: targetOrder.orderTypeName || 'Dine-In',
        items: itemsList.map((it: any) => ({
          itemName: it.itemName || it.name || it.dishName || 'Item',
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || it.amount || it.price || 0),
          totalPrice: Number(it.totalPrice || (Number(it.quantity || 1) * Number(it.unitPrice || it.amount || it.price || 0))),
          cookingInstruction: it.cookingInstruction,
        })),
        subtotal: targetOrder.subtotal || targetOrder.totalAmount,
        cgstAmount: targetOrder.cgst || 0,
        sgstAmount: targetOrder.sgst || 0,
        grandTotal: targetOrder.totalAmount,
        paymentMode: targetOrder.paymentMode || 'CASH',
        paymentStatus: targetOrder.paymentStatus || 'PAID',
        date: targetOrder.createdAt ? new Date(targetOrder.createdAt) : new Date(),
        isKot: false,
      };

      await printReceipt(receiptData);
      Alert.alert('Receipt Printed! 🧾', `Tax invoice receipt for Order #${order.id} sent to printer.`);
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Failed to print receipt.');
    } finally {
      setPrintingOrderId(null);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.sheetContainer} edges={['bottom']}>
            {/* Top Bar Header */}
            <View style={styles.header}>
              <View style={styles.headerLeftRow}>
                <View style={styles.bellIconCircle}>
                  <BellRing size={20} color="#DE8626" />
                  {unreadCount > 0 && (
                    <View style={styles.headerBadge}>
                      <Text style={styles.headerBadgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>

                <View>
                  <Text style={styles.headerTitle}>Order Notifications</Text>
                  <Text style={styles.headerSubtitle}>
                    {unreadCount > 0
                      ? `${unreadCount} unread order alert${unreadCount > 1 ? 's' : ''}`
                      : 'All notifications are up to date'}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActionsRow}>
                {/* Sound Toggle */}
                <TouchableOpacity
                  style={[
                    styles.headerToolBtn,
                    soundEnabled && styles.headerToolBtnActive,
                  ]}
                  onPress={() => setSoundEnabled(!soundEnabled)}
                  accessibilityLabel="Toggle Notification Chime"
                >
                  {soundEnabled ? (
                    <Volume2 size={16} color="#DE8626" />
                  ) : (
                    <VolumeX size={16} color="#8C7A6B" />
                  )}
                </TouchableOpacity>

                {/* Mark all read */}
                {unreadCount > 0 && (
                  <TouchableOpacity
                    style={styles.headerToolBtn}
                    onPress={markAllAsRead}
                    accessibilityLabel="Mark all as read"
                  >
                    <CheckCheck size={16} color="#17845A" />
                  </TouchableOpacity>
                )}

                {/* Close (X) */}
                <TouchableOpacity
                  style={styles.headerCloseBtn}
                  onPress={onClose}
                  accessibilityLabel="Close Notifications"
                >
                  <X size={18} color="#4A3E35" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Filter Pills Bar */}
            <View style={styles.filterPillsRow}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  filterTab === 'ALL' && styles.filterPillActive,
                ]}
                onPress={() => setFilterTab('ALL')}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterTab === 'ALL' && styles.filterPillTextActive,
                  ]}
                >
                  All ({notifications.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  filterTab === 'UNREAD' && styles.filterPillActive,
                ]}
                onPress={() => setFilterTab('UNREAD')}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterTab === 'UNREAD' && styles.filterPillTextActive,
                  ]}
                >
                  Unread ({unreadCount})
                </Text>
              </TouchableOpacity>

              {notifications.length > 0 && (
                <TouchableOpacity
                  style={styles.clearAllBtn}
                  onPress={clearAllNotifications}
                >
                  <Trash2 size={13} color="#DC2626" />
                  <Text style={styles.clearAllBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Notification List */}
            {filteredNotifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Bell size={36} color="#C4B7AA" strokeWidth={1.5} />
                </View>
                <Text style={styles.emptyTitle}>No Order Alerts</Text>
                <Text style={styles.emptySubtitle}>
                  {filterTab === 'UNREAD'
                    ? 'You have caught up on all incoming orders!'
                    : 'New customer QR orders and online orders will notify here in real-time with sound and vibration.'}
                </Text>

                {onOpenTodayOrders && (
                  <TouchableOpacity
                    style={styles.emptyViewOrdersBtn}
                    onPress={() => {
                      onClose();
                      onOpenTodayOrders();
                    }}
                  >
                    <ShoppingBag size={15} color="#FFFFFF" />
                    <Text style={styles.emptyViewOrdersBtnText}>
                      Open Today's Orders Desk
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={filteredNotifications}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const statusLower = item.orderStatus.toLowerCase();
                  const isPlaced = statusLower === 'placed' || statusLower === 'pending' || statusLower === 'created';
                  const isSettled = statusLower === 'settled' || statusLower === 'completed' || statusLower === 'cancelled';
                  const isCash = !item.orderData?.paymentMode || item.orderData?.paymentMode?.toUpperCase() === 'CASH';

                  return (
                    <TouchableOpacity
                      style={[
                        styles.card,
                        !item.isRead && styles.cardUnread,
                      ]}
                      activeOpacity={0.92}
                      onPress={() => handleViewDetails(item)}
                    >
                      {/* Top Row: Unread Dot + Order ID + Table + Time */}
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          {!item.isRead && <View style={styles.unreadDot} />}
                          <View style={styles.orderIdBadge}>
                            <Text style={styles.orderIdBadgeText}>
                              ORDER #{item.orderId}
                            </Text>
                          </View>

                          {(item.tokenNumber || item.pickupToken) ? (
                            <View style={styles.tokenBadge}>
                              <Tag size={10} color="#4338CA" />
                              <Text style={styles.tokenBadgeText}>
                                TOKEN #{item.tokenNumber ?? item.pickupToken}
                              </Text>
                            </View>
                          ) : null}

                          <View style={styles.tableBadge}>
                            <TableIcon size={11} color="#DE8626" />
                            <Text style={styles.tableBadgeText}>
                              {item.tableName}
                            </Text>
                          </View>

                          {item.stations ? (
                            <View style={styles.stationBadge}>
                              <ChefHat size={10} color="#DE8626" />
                              <Text style={styles.stationBadgeText}>
                                {item.stations}
                              </Text>
                            </View>
                          ) : null}

                          {/* Cash / Online indicator */}
                          <View style={[
                            styles.paymentModeBadge,
                            isCash ? styles.paymentModeBadgeCash : styles.paymentModeBadgeOnline
                          ]}>
                            {isCash ? <IndianRupee size={10} color="#D97706" /> : <CreditCard size={10} color="#16A34A" />}
                            <Text style={[
                              styles.paymentModeBadgeText,
                              isCash ? styles.paymentModeBadgeTextCash : styles.paymentModeBadgeTextOnline
                            ]}>
                              {isCash ? 'CASH' : 'ONLINE'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.cardHeaderRight}>
                          <Clock size={11} color="#8C7A6B" />
                          <Text style={styles.timeAgoText}>
                            {item.createdAt ? formatToIstTime(item.createdAt) : formatTimeAgo(item.timestamp)}
                          </Text>
                        </View>
                      </View>

                      {/* Middle Row: Customer Info & Dish Summary */}
                      <View style={styles.cardBody}>
                        <View style={styles.cardDetailsRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.customerName} numberOfLines={1}>
                              {item.customerName}
                            </Text>
                            <Text style={styles.itemsSummary} numberOfLines={2}>
                              {item.itemsSummary}
                            </Text>
                          </View>

                          <View style={styles.amountBox}>
                            <Text style={styles.amountValue}>
                              ₹{item.totalAmount.toLocaleString('en-IN')}
                            </Text>
                            <Text style={styles.itemsCountText}>
                              {item.itemCount} item{item.itemCount > 1 ? 's' : ''}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Card Actions Footer */}
                      <View style={styles.cardFooter}>
                        <View style={styles.statusPill}>
                          <View
                            style={[
                              styles.statusDot,
                              {
                                backgroundColor: isPlaced
                                  ? '#E58B24'
                                  : statusLower === 'confirmed'
                                  ? '#2563EB'
                                  : statusLower === 'settled'
                                  ? '#10B981'
                                  : '#17845A',
                              },
                            ]}
                          />
                          <Text style={styles.statusPillText}>
                            {item.orderStatus}
                          </Text>
                        </View>

                        <View style={styles.cardButtonsRow}>
                          {/* Print KOT */}
                          <TouchableOpacity
                            style={styles.cardActionBtnSecondary}
                            onPress={(e) => {
                              e.stopPropagation();
                              handlePrint(item);
                            }}
                            disabled={printingOrderId === item.orderId}
                          >
                            {printingOrderId === item.orderId ? (
                              <ActivityIndicator size="small" color="#4A3E35" />
                            ) : (
                              <Printer size={13} color="#4A3E35" />
                            )}
                            <Text style={styles.cardActionBtnSecondaryText}>
                              KOT
                            </Text>
                          </TouchableOpacity>

                          {/* Settle Immediately / Settle Order Button */}
                          {!isSettled && (
                            <TouchableOpacity
                              style={styles.cardActionBtnSettle}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleSettleOrder(item);
                              }}
                            >
                              <IndianRupee size={13} color="#FFFFFF" strokeWidth={2.5} />
                              <Text style={styles.cardActionBtnSettleText}>
                                Settle Order
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* View Details */}
                          <TouchableOpacity
                            style={styles.cardActionBtnOutline}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleViewDetails(item);
                            }}
                          >
                            <Text style={styles.cardActionBtnOutlineText}>
                              Details
                            </Text>
                            <ChevronRight size={12} color="#DE8626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {/* Bottom Bar: Today's Orders shortcut */}
            {notifications.length > 0 && onOpenTodayOrders && (
              <View style={styles.footerBar}>
                <TouchableOpacity
                  style={styles.viewTodayOrdersFooterBtn}
                  onPress={() => {
                    onClose();
                    onOpenTodayOrders();
                  }}
                >
                  <ShoppingBag size={16} color="#DE8626" />
                  <Text style={styles.viewTodayOrdersFooterBtnText}>
                    Open Full Today's Orders Desk
                  </Text>
                  <ChevronRight size={15} color="#DE8626" />
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Order Details Drawer / Modal */}
      <Modal
        visible={!!selectedOrderDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedOrderDetail(null)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.sheetContainer} edges={['bottom']}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <View style={styles.detailHeaderLeft}>
                <View style={styles.detailIconCircle}>
                  <IndianRupee size={18} color="#DE8626" />
                </View>
                <View>
                  <Text style={styles.detailTitle}>
                    Order #{selectedOrderDetail?.orderNumber || selectedOrderDetail?.id}
                  </Text>
                  <Text style={styles.detailSubtitle}>
                    {selectedOrderDetail?.orderTypeName || 'Dine-In'} • {selectedOrderDetail?.tableName || 'Table'}
                    {selectedOrderDetail?.pickupToken ? ` • Token #${selectedOrderDetail.pickupToken}` : ''}
                    {selectedOrderDetail?.createdAt ? ` • ${formatToIstDateTime(selectedOrderDetail.createdAt)}` : ''}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.headerCloseBtn}
                onPress={() => setSelectedOrderDetail(null)}
              >
                <X size={18} color="#4A3E35" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailScroll}
              contentContainerStyle={styles.detailScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Customer Info Card */}
              <View style={styles.detailCustomerCard}>
                <View style={styles.detailCustomerRow}>
                  <View style={styles.detailUserAvatar}>
                    <User size={16} color="#DE8626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailCustomerName}>
                      {selectedOrderDetail?.customerName || 'Walk-in Guest'}
                    </Text>
                    {selectedOrderDetail?.mobileNumber ? (
                      <Text style={styles.detailCustomerPhone}>
                        {selectedOrderDetail.mobileNumber}
                      </Text>
                    ) : null}
                  </View>

                  {selectedOrderDetail?.mobileNumber ? (
                    <TouchableOpacity
                      style={styles.callCustomerBtn}
                      onPress={() => Linking.openURL(`tel:${selectedOrderDetail.mobileNumber}`)}
                    >
                      <Phone size={14} color="#17845A" />
                      <Text style={styles.callCustomerBtnText}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Items Card */}
              <View style={styles.detailItemsCard}>
                <View style={styles.detailSectionTitleRow}>
                  <Utensils size={15} color="#DE8626" />
                  <Text style={styles.detailSectionTitle}>Dishes Ordered</Text>
                  <Text style={styles.detailItemCountText}>
                    ({selectedOrderDetail?.items?.length || 0} items)
                  </Text>
                </View>

                {loadingDetails ? (
                  <View style={styles.detailLoadingBox}>
                    <ActivityIndicator size="small" color="#DE8626" />
                    <Text style={styles.detailLoadingText}>Loading dishes breakdown...</Text>
                  </View>
                ) : selectedOrderDetail?.items && selectedOrderDetail.items.length > 0 ? (
                  <View style={styles.detailItemsList}>
                    {selectedOrderDetail.items.map((it, idx) => (
                      <View key={`detail-it-${idx}`} style={styles.detailItemRow}>
                        <View style={styles.detailItemQtyBadge}>
                          <Text style={styles.detailItemQtyText}>
                            {it.quantity}x
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailItemName}>
                            {it.itemName || (it as any).name || (it as any).dishName || 'Item'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                            {(it.stationName || it.stationCode) ? (
                              <View
                                style={[
                                  styles.itemStationTag,
                                  {
                                    backgroundColor: `${it.stationBadgeColor || '#DE8626'}18`,
                                    borderColor: it.stationBadgeColor || '#DE8626',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.itemStationTagText,
                                    { color: it.stationBadgeColor || '#DE8626' },
                                  ]}
                                >
                                  {it.stationName || it.stationCode}
                                </Text>
                              </View>
                            ) : null}
                            {it.gstRate ? (
                              <View style={styles.itemGstBadge}>
                                <Text style={styles.itemGstBadgeText}>{it.gstRate}% GST</Text>
                              </View>
                            ) : null}
                          </View>
                          {it.cookingInstruction ? (
                            <Text style={styles.detailItemNotes}>
                              Note: {it.cookingInstruction}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.detailItemPrice}>
                          ₹{(it.totalPrice || (it.quantity * it.unitPrice)).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.detailNoItemsText}>
                    Total Amount: ₹{selectedOrderDetail?.totalAmount?.toLocaleString('en-IN')}
                  </Text>
                )}

                {/* Subtotal / Taxes / Total */}
                <View style={styles.detailTotalsBox}>
                  <View style={styles.detailTotalRow}>
                    <Text style={styles.detailTotalLabel}>Grand Total</Text>
                    <Text style={styles.detailGrandTotalVal}>
                      ₹{selectedOrderDetail?.totalAmount?.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={styles.detailPaymentStatusRow}>
                    <View style={[
                      styles.paymentModeBadge,
                      selectedOrderDetail?.paymentMode?.toUpperCase() === 'CASH'
                        ? styles.paymentModeBadgeCash
                        : styles.paymentModeBadgeOnline
                    ]}>
                      {selectedOrderDetail?.paymentMode?.toUpperCase() === 'CASH' ? (
                        <IndianRupee size={11} color="#D97706" />
                      ) : (
                        <CreditCard size={11} color="#16A34A" />
                      )}
                      <Text style={[
                        styles.paymentModeBadgeText,
                        selectedOrderDetail?.paymentMode?.toUpperCase() === 'CASH'
                          ? styles.paymentModeBadgeTextCash
                          : styles.paymentModeBadgeTextOnline
                      ]}>
                        {selectedOrderDetail?.paymentMode?.toUpperCase() || 'CASH'}
                      </Text>
                    </View>

                    <Text style={[
                      styles.detailPaymentStatusText,
                      selectedOrderDetail?.paymentStatus?.toUpperCase() === 'PAID'
                        ? { color: '#16A34A' }
                        : { color: '#D97706' }
                    ]}>
                      Status: {selectedOrderDetail?.paymentStatus || 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Bottom Actions for Order Detail */}
            <View style={styles.detailBottomActions}>
              <TouchableOpacity
                style={styles.detailPrintKotBtn}
                onPress={() => selectedOrderDetail && handlePrint(selectedOrderDetail)}
                disabled={printingOrderId === selectedOrderDetail?.id}
              >
                {printingOrderId === selectedOrderDetail?.id ? (
                  <ActivityIndicator size="small" color="#4A3E35" />
                ) : (
                  <Printer size={15} color="#4A3E35" />
                )}
                <Text style={styles.detailPrintKotBtnText}>Print KOT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.detailPrintReceiptBtn}
                onPress={() => selectedOrderDetail && handlePrintReceipt(selectedOrderDetail)}
                disabled={printingOrderId === selectedOrderDetail?.id}
              >
                <Printer size={15} color="#4A3E35" />
                <Text style={styles.detailPrintReceiptBtnText}>Print Bill</Text>
              </TouchableOpacity>

              {selectedOrderDetail?.status?.toLowerCase() !== 'settled' &&
               selectedOrderDetail?.status?.toLowerCase() !== 'completed' &&
               selectedOrderDetail?.status?.toLowerCase() !== 'cancelled' && (
                <TouchableOpacity
                  style={styles.detailSettleBtn}
                  onPress={() => {
                    if (selectedOrderDetail) {
                      const tgt = selectedOrderDetail;
                      setSelectedOrderDetail(null);
                      handleSettleOrder(tgt);
                    }
                  }}
                >
                  <IndianRupee size={15} color="#FFFFFF" />
                  <Text style={styles.detailSettleBtnText}>Settle Order</Text>
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Cashier Settlement Modal for instant settlement from notification drawer */}
      <CashierSettlementModal
        visible={!!settleOrderTarget}
        order={settleOrderTarget}
        restaurantId={effectiveRestId}
        restaurantName={effectiveRestName}
        onClose={() => setSettleOrderTarget(null)}
        onSettlementSuccess={(result) => {
          setSettleOrderTarget(null);
          if (result.orderId) {
            useNotificationStore.getState().handleOrderStatusChanged({
              orderId: result.orderId,
              orderStatus: 'Settled',
              status: 'Settled',
              paymentStatus: 'PAID',
              paymentMode: result.paymentMode || 'CASH',
              totalAmount: result.totalAmount,
            });
          }
          if (onSettlementSuccess) {
            onSettlementSuccess();
          }
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 24, 17, 0.55)',
    justifyContent: 'flex-end',
  },

  sheetContainer: {
    backgroundColor: '#FAF7F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE7DE',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },

  bellIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  headerTitle: {
    color: '#1F1811',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  headerSubtitle: {
    color: '#8C7A6B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerToolBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DFD5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerToolBtnActive: {
    backgroundColor: '#FFF0DE',
    borderColor: '#FED7AA',
  },

  headerCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F0ECE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },

  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F1EB',
    backgroundColor: '#FAF7F2',
  },

  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },

  filterPillActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },

  filterPillText: {
    color: '#6B5D52',
    fontSize: 11,
    fontWeight: '700',
  },

  filterPillTextActive: {
    color: '#FFFFFF',
  },

  clearAllBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  clearAllBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },

  listContent: {
    padding: 16,
    gap: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE4DC',
    padding: 14,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  cardUnread: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFFCF7',
    borderLeftWidth: 4,
    borderLeftColor: '#DE8626',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#DE8626',
  },

  orderIdBadge: {
    backgroundColor: '#F5F1EB',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },

  orderIdBadgeText: {
    color: '#1F1811',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },

  tableBadgeText: {
    color: '#DE8626',
    fontSize: 10,
    fontWeight: '800',
  },

  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },

  tokenBadgeText: {
    color: '#4338CA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  stationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },

  stationBadgeText: {
    color: '#DE8626',
    fontSize: 9.5,
    fontWeight: '700',
  },

  paymentModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  paymentModeBadgeCash: {
    backgroundColor: '#FEF3C7',
  },

  paymentModeBadgeOnline: {
    backgroundColor: '#DCFCE7',
  },

  paymentModeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },

  paymentModeBadgeTextCash: {
    color: '#B45309',
  },

  paymentModeBadgeTextOnline: {
    color: '#15803D',
  },

  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  timeAgoText: {
    color: '#8C7A6B',
    fontSize: 11,
    fontWeight: '600',
  },

  cardBody: {
    gap: 4,
  },

  cardDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },

  customerName: {
    color: '#1F1811',
    fontSize: 14,
    fontWeight: '800',
  },

  itemsSummary: {
    color: '#6B5D52',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },

  amountBox: {
    alignItems: 'flex-end',
  },

  amountValue: {
    color: '#17845A',
    fontSize: 16,
    fontWeight: '800',
  },

  itemsCountText: {
    color: '#8C7A6B',
    fontSize: 10,
    fontWeight: '600',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F1EB',
    flexWrap: 'wrap',
    gap: 8,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F1EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusPillText: {
    color: '#4A3E35',
    fontSize: 10,
    fontWeight: '800',
  },

  cardButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  cardActionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0ECE5',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },

  cardActionBtnSecondaryText: {
    color: '#4A3E35',
    fontSize: 11,
    fontWeight: '700',
  },

  cardActionBtnConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },

  cardActionBtnConfirmText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  cardActionBtnSettle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#17845A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },

  cardActionBtnSettleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  cardActionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },

  cardActionBtnOutlineText: {
    color: '#DE8626',
    fontSize: 11,
    fontWeight: '800',
  },

  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  emptyTitle: {
    color: '#1F1811',
    fontSize: 16,
    fontWeight: '800',
  },

  emptySubtitle: {
    color: '#8C7A6B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  emptyViewOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DE8626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 10,
  },

  emptyViewOrdersBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  footerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDE7DE',
  },

  viewTodayOrdersFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingVertical: 11,
    borderRadius: 12,
  },

  viewTodayOrdersFooterBtnText: {
    color: '#DE8626',
    fontSize: 12,
    fontWeight: '800',
  },

  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE7DE',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  detailHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },

  detailIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailTitle: {
    color: '#1F1811',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  detailSubtitle: {
    color: '#8C7A6B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  detailScroll: {
    flex: 1,
  },

  detailScrollContent: {
    padding: 16,
    gap: 12,
  },

  detailCustomerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE4DC',
    padding: 12,
  },

  detailCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  detailUserAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailCustomerName: {
    color: '#1F1811',
    fontSize: 13,
    fontWeight: '800',
  },

  detailCustomerPhone: {
    color: '#8C7A6B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },

  callCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F5EC',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },

  callCustomerBtnText: {
    color: '#17845A',
    fontSize: 11,
    fontWeight: '800',
  },

  detailItemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE4DC',
    padding: 14,
    gap: 12,
  },

  detailSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  detailSectionTitle: {
    color: '#1F1811',
    fontSize: 13,
    fontWeight: '800',
  },

  detailItemCountText: {
    color: '#8C7A6B',
    fontSize: 11,
    fontWeight: '600',
  },

  detailLoadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },

  detailLoadingText: {
    color: '#8C7A6B',
    fontSize: 11,
  },

  detailItemsList: {
    gap: 8,
  },

  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F1EB',
  },

  detailItemQtyBadge: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },

  detailItemQtyText: {
    color: '#DE8626',
    fontSize: 11,
    fontWeight: '800',
  },

  detailItemName: {
    color: '#1F1811',
    fontSize: 13,
    fontWeight: '700',
  },

  detailItemNotes: {
    color: '#D97706',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },

  itemStationTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
  },

  itemStationTagText: {
    fontSize: 8.5,
    fontWeight: '700',
  },

  itemGstBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },

  itemGstBadgeText: {
    color: '#0369A1',
    fontSize: 8.5,
    fontWeight: '800',
  },

  detailItemPrice: {
    color: '#1F1811',
    fontSize: 13,
    fontWeight: '800',
  },

  detailNoItemsText: {
    color: '#6B5D52',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 8,
  },

  detailTotalsBox: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDE7DE',
    gap: 8,
  },

  detailTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  detailTotalLabel: {
    color: '#1F1811',
    fontSize: 14,
    fontWeight: '800',
  },

  detailGrandTotalVal: {
    color: '#17845A',
    fontSize: 18,
    fontWeight: '900',
  },

  detailPaymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  detailPaymentStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  detailBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDE7DE',
    gap: 8,
  },

  detailPrintKotBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0ECE5',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },

  detailPrintKotBtnText: {
    color: '#4A3E35',
    fontSize: 12,
    fontWeight: '800',
  },

  detailPrintReceiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingVertical: 11,
    borderRadius: 12,
  },

  detailPrintReceiptBtnText: {
    color: '#DE8626',
    fontSize: 12,
    fontWeight: '800',
  },

  detailSettleBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#17845A',
    paddingVertical: 11,
    borderRadius: 12,
  },

  detailSettleBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
