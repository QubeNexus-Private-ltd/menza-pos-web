import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  BellRing,
  X,
  ChevronRight,
  Sparkles,
  Table as TableIcon,
  CheckCircle2,
  Banknote,
  Receipt,
} from 'lucide-react-native';
import { useNotificationStore } from '../state/useNotificationStore';
import { usePrinterStore } from '../state/usePrinterStore';
import { useAuthStore } from '../state/useAuthStore';
import { OrderRemoteDataSource } from '../../data/datasources/OrderRemoteDataSource';
import { Alert, ActivityIndicator } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const orderDataSource = new OrderRemoteDataSource();

interface OrderAlertBannerProps {
  onPress: () => void;
  onSettleOrder?: (orderData: any) => void;
}

export const OrderAlertBanner: React.FC<OrderAlertBannerProps> = ({ onPress, onSettleOrder }) => {
  const { latestIncomingOrder, dismissBanner, handleOrderStatusChanged } = useNotificationStore();
  const { connectedDevice, printReceipt } = usePrinterStore();
  const { activeRestaurant } = useAuthStore();
  const [isPrintingBill, setIsPrintingBill] = React.useState(false);

  useEffect(() => {
    if (latestIncomingOrder) {
      const timer = setTimeout(() => {
        dismissBanner();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [latestIncomingOrder, dismissBanner]);

  if (!latestIncomingOrder) return null;

  const statusLower = latestIncomingOrder.orderStatus.toLowerCase();
  const isSettled = statusLower === 'settled' || statusLower === 'completed' || statusLower === 'cancelled';

  const handleQuickSettle = (e: any) => {
    e.stopPropagation();
    dismissBanner();
    if (onSettleOrder) {
      onSettleOrder(latestIncomingOrder.orderData || {
        id: latestIncomingOrder.orderId,
        customerName: latestIncomingOrder.customerName,
        mobileNumber: latestIncomingOrder.customerPhone,
        totalAmount: latestIncomingOrder.totalAmount,
        tableName: latestIncomingOrder.tableName,
        orderTypeId: latestIncomingOrder.orderTypeId || 1,
        orderTypeName: latestIncomingOrder.orderTypeName,
        status: latestIncomingOrder.orderStatus,
        paymentMode: 'CASH',
        paymentStatus: 'Pending',
        items: [],
        createdAt: latestIncomingOrder.createdAt,
      });
    } else {
      onPress();
    }
  };

  const isBillRequest = latestIncomingOrder.eventType === 'REQUEST_BILL' || statusLower === 'bill_requested';

  const handleQuickPrintBill = async (e: any) => {
    e.stopPropagation();

    let targetOrderId = latestIncomingOrder.orderId;
    let targetOrder = latestIncomingOrder.orderData;

    if ((!targetOrderId || targetOrderId <= 0) && latestIncomingOrder.tableId && latestIncomingOrder.tableId > 0) {
      try {
        const fetched = await orderDataSource.getActiveOrderByTable(latestIncomingOrder.tableId);
        if (fetched) {
          targetOrder = fetched;
          targetOrderId = fetched.id;
        }
      } catch {}
    }

    if (!targetOrderId || targetOrderId <= 0) {
      Alert.alert('Cannot Print Bill', 'Order ID is missing for this bill request.');
      return;
    }
    if (!connectedDevice) {
      Alert.alert('No Printer Connected 🖨️', 'Please connect a Bluetooth thermal printer to print customer bills.');
      return;
    }

    try {
      setIsPrintingBill(true);
      if (!targetOrder || !targetOrder.items || targetOrder.items.length === 0) {
        try {
          const fetched = await orderDataSource.getOrderById(targetOrderId);
          if (fetched) targetOrder = fetched;
        } catch {}
      }

      const totalAmount = (targetOrder?.totalAmount && targetOrder.totalAmount > 0)
        ? targetOrder.totalAmount
        : (latestIncomingOrder.totalAmount > 0 ? latestIncomingOrder.totalAmount : 0);
      const itemsList = targetOrder?.items && targetOrder.items.length > 0
        ? targetOrder.items
        : [{ itemName: latestIncomingOrder.itemsSummary || 'Order Items', quantity: 1, unitPrice: totalAmount, totalPrice: totalAmount }];

      const receiptData: any = {
        orderId: targetOrderId,
        orderNumber: targetOrder?.orderNumber || String(targetOrderId),
        pickupToken: targetOrder?.pickupToken || String(targetOrderId),
        restaurantName: activeRestaurant?.restaurantName || 'Menza Restaurant',
        address: targetOrder?.address?.trim() || activeRestaurant?.address?.trim() || undefined,
        contactPhone: targetOrder?.contactNumber || (activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || undefined,
        customerName: latestIncomingOrder.customerName || 'Guest',
        customerPhone: latestIncomingOrder.customerPhone,
        tableName: latestIncomingOrder.tableName,
        orderType: latestIncomingOrder.orderTypeName || 'Dine-In',
        items: itemsList.map((it: any) => ({
          itemName: it.itemName || it.name || it.dishName || 'Item',
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || it.amount || it.price || 0),
          totalPrice: Number(it.totalPrice || (Number(it.quantity || 1) * Number(it.unitPrice || it.amount || it.price || 0))),
          cookingInstruction: it.cookingInstruction,
        })),
        subtotal: targetOrder?.subtotal || totalAmount,
        cgstAmount: targetOrder?.cgst || 0,
        sgstAmount: targetOrder?.sgst || 0,
        grandTotal: totalAmount,
        paymentMode: targetOrder?.paymentMode || 'CASH',
        paymentStatus: targetOrder?.paymentStatus || 'PENDING',
        date: new Date(),
        isKot: false,
      };

      await printReceipt(receiptData);
      Alert.alert('Bill Printed! 🧾', `Pre-bill receipt for ${latestIncomingOrder.tableName} (Order #${targetOrderId}) sent to printer.`);
      dismissBanner();
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Failed to print customer bill.');
    } finally {
      setIsPrintingBill(false);
    }
  };

  return (
    <View style={styles.bannerContainer}>
      <TouchableOpacity
        style={styles.bannerCard}
        activeOpacity={0.92}
        onPress={() => {
          dismissBanner();
          onPress();
        }}
      >
        <View style={styles.iconCircle}>
          <BellRing size={18} color="#FFFFFF" />
        </View>

        <View style={styles.textContent}>
          <View style={styles.titleRow}>
            <Text style={[
              styles.badgeText,
              latestIncomingOrder.eventType === 'CALL_WAITER' ? { backgroundColor: '#DC2626' } :
              latestIncomingOrder.eventType === 'REQUEST_WATER' ? { backgroundColor: '#2563EB' } :
              latestIncomingOrder.eventType === 'REQUEST_BILL' ? { backgroundColor: '#059669' } :
              latestIncomingOrder.eventType === 'SETTLED' ? { backgroundColor: '#10B981' } :
              latestIncomingOrder.eventType === 'CANCELLED' ? { backgroundColor: '#EF4444' } :
              latestIncomingOrder.eventType === 'STATUS_CHANGED' ? { backgroundColor: '#3B82F6' } :
              { backgroundColor: '#DE8626' }
            ]}>
              {latestIncomingOrder.eventType === 'CALL_WAITER'
                ? '🛎️ CALL WAITER'
                : latestIncomingOrder.eventType === 'REQUEST_WATER'
                ? '💧 WATER REFILL'
                : latestIncomingOrder.eventType === 'REQUEST_BILL'
                ? '🧾 BILL REQUEST'
                : latestIncomingOrder.eventType === 'SETTLED'
                ? 'SETTLED'
                : latestIncomingOrder.eventType === 'CANCELLED'
                ? 'CANCELLED'
                : latestIncomingOrder.eventType === 'STATUS_CHANGED'
                ? latestIncomingOrder.orderStatus.toUpperCase()
                : 'NEW ORDER'}
            </Text>
            <Text style={styles.orderIdText}>
              {latestIncomingOrder.orderId > 0 ? `#${latestIncomingOrder.orderId}` : 'Assistance'}
            </Text>
            <Text style={styles.tableText} numberOfLines={1}>
              • {latestIncomingOrder.tableName}
            </Text>
          </View>

          <Text style={styles.summaryText} numberOfLines={1}>
            {latestIncomingOrder.itemsSummary}
          </Text>

          <View style={styles.amountAndActionRow}>
            <Text style={styles.amountText}>
              {latestIncomingOrder.totalAmount > 0
                ? `₹${latestIncomingOrder.totalAmount.toLocaleString('en-IN')}`
                : 'Floor Alert'}
            </Text>

            {/* Print Bill Shortcut Button for Bill Requests */}
            {isBillRequest && (latestIncomingOrder.orderId > 0 || (latestIncomingOrder.tableId != null && latestIncomingOrder.tableId > 0)) && (
              <TouchableOpacity
                style={styles.quickPrintBillBtn}
                onPress={handleQuickPrintBill}
                disabled={isPrintingBill}
              >
                {isPrintingBill ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Receipt size={11} color="#FFFFFF" />
                    <Text style={styles.quickPrintBillBtnText}>Print Bill</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Quick Settle Button (only for billable orders) */}
            {!isSettled && latestIncomingOrder.totalAmount > 0 && (
              <TouchableOpacity
                style={styles.quickSettleBtn}
                onPress={handleQuickSettle}
              >
                <Banknote size={11} color="#FFFFFF" />
                <Text style={styles.quickSettleBtnText}>Settle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.actionBlock}>
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>View</Text>
            <ChevronRight size={12} color="#DE8626" />
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={(e) => {
              e.stopPropagation();
              dismissBanner();
            }}
          >
            <X size={14} color="#8C7A6B" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 50,
    left: 14,
    right: 14,
    zIndex: 99999,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#1F1811',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },

  bannerCard: {
    width: '100%',
    backgroundColor: '#1F1811',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#DE8626',
  },

  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
  },

  textContent: {
    flex: 1,
    gap: 3,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.4,
  },

  orderIdText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  tableText: {
    color: '#C4B7AA',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },

  summaryText: {
    color: '#E6DFD5',
    fontSize: 11,
    lineHeight: 14,
  },

  amountAndActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },

  amountText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '900',
  },

  quickConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  quickConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  quickPrintBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  quickPrintBillBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  quickSettleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#17845A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  quickSettleBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  actionBlock: {
    alignItems: 'center',
    gap: 6,
  },

  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#382D22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  viewBtnText: {
    color: '#DE8626',
    fontSize: 11,
    fontWeight: '800',
  },

  closeBtn: {
    padding: 4,
  },
});
