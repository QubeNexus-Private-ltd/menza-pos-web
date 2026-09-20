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
} from 'lucide-react-native';
import { useNotificationStore } from '../state/useNotificationStore';
import { OrderRemoteDataSource } from '../../data/datasources/OrderRemoteDataSource';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const orderDataSource = new OrderRemoteDataSource();

interface OrderAlertBannerProps {
  onPress: () => void;
  onSettleOrder?: (orderData: any) => void;
}

export const OrderAlertBanner: React.FC<OrderAlertBannerProps> = ({ onPress, onSettleOrder }) => {
  const { latestIncomingOrder, dismissBanner, handleOrderStatusChanged } = useNotificationStore();

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
