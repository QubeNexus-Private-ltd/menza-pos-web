import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Wallet, Plus, AlertCircle, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../core/theme/colors';
import { Typography } from '../../core/theme/typography';
import { Spacing } from '../../core/theme/spacing';
import { StatusBadge } from './StatusBadge';
import { SkeletonLoader } from './SkeletonLoader';
import { RestaurantWallet } from '../../domain/models/Wallet';
import { WalletRemoteDataSource } from '../../data/datasources/WalletRemoteDataSource';
import { WalletRepositoryImpl } from '../../data/repositories/WalletRepositoryImpl';
import { WalletRechargeModal } from './WalletRechargeModal';
import { useAuthStore } from '../state/useAuthStore';

import { WalletEvents } from '../../core/utils/walletEvents';

const walletRepository = new WalletRepositoryImpl(new WalletRemoteDataSource());

interface WalletBalanceWidgetProps {
  restaurantId?: number;
  onPress?: () => void;
  variant?: 'card' | 'compact' | 'pill';
}

export const WalletBalanceWidget: React.FC<WalletBalanceWidgetProps> = ({
  restaurantId,
  onPress,
  variant = 'card',
}) => {
  const { activeRestaurant } = useAuthStore();
  const [wallet, setWallet] = useState<RestaurantWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const effectiveRestId =
    restaurantId ||
    activeRestaurant?.restaurantId ||
    (activeRestaurant as any)?.id ||
    (activeRestaurant as any)?.RestaurantId ||
    (globalThis as any).__MENZA_ACTIVE_REST_ID__ ||
    0;

  const loadWallet = React.useCallback(async () => {
    if (effectiveRestId <= 0) return;
    try {
      setLoading(true);
      const data = await walletRepository.getWallet(effectiveRestId);
      if (data) {
        setWallet(data);
      }
    } catch {
      // Fail-safe
    } finally {
      setLoading(false);
    }
  }, [effectiveRestId]);

  useEffect(() => {
    if (effectiveRestId > 0) {
      loadWallet();
    }
    const unsubscribe = WalletEvents.subscribe(() => {
      if (effectiveRestId > 0) {
        loadWallet();
      }
    });
    return unsubscribe;
  }, [effectiveRestId, loadWallet]);

  const handleOpenModal = () => {
    if (onPress) {
      onPress();
    } else {
      setModalVisible(true);
    }
  };

  const balance = wallet?.balance ?? 0;
  const isLowBalance = balance < (wallet?.lowBalanceThreshold ?? 200);

  if (variant === 'pill') {
    return (
      <>
        <TouchableOpacity
          style={[styles.pillContainer, isLowBalance && styles.pillLowBalance]}
          onPress={handleOpenModal}
          activeOpacity={0.8}
        >
          <Wallet size={14} color={isLowBalance ? '#FEA619' : Colors.amber} />
          {loading && !wallet ? (
            <SkeletonLoader width={40} height={12} borderRadius={4} />
          ) : (
            <Text style={styles.pillText}>₹{balance.toLocaleString('en-IN')}</Text>
          )}
          <View style={styles.pillPlus}>
            <Plus size={10} color="#FFFFFF" strokeWidth={3} />
          </View>
        </TouchableOpacity>

        <WalletRechargeModal
          visible={modalVisible}
          restaurantId={effectiveRestId}
          onClose={() => setModalVisible(false)}
          onRechargeSuccess={() => {
            loadWallet();
            WalletEvents.emit();
          }}
        />
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <TouchableOpacity
          style={[styles.compactContainer, isLowBalance && styles.compactLowBalance]}
          onPress={handleOpenModal}
          activeOpacity={0.8}
        >
          <View style={styles.compactLeft}>
            <Wallet size={16} color={Colors.amber} />
            <Text style={styles.compactLabel}>Prepaid Wallet:</Text>
            {loading && !wallet ? (
              <SkeletonLoader width={50} height={14} borderRadius={4} />
            ) : (
              <Text style={styles.compactAmount}>₹{balance.toLocaleString('en-IN')}</Text>
            )}
          </View>
          <View style={styles.compactRechargeBtn}>
            <Text style={styles.compactRechargeText}>Top Up</Text>
            <ChevronRight size={14} color="#000000" />
          </View>
        </TouchableOpacity>

        <WalletRechargeModal
          visible={modalVisible}
          restaurantId={effectiveRestId}
          onClose={() => setModalVisible(false)}
          onRechargeSuccess={() => {
            loadWallet();
            WalletEvents.emit();
          }}
        />
      </>
    );
  }

  // Standard 'card' variant
  return (
    <>
      <View style={[styles.cardContainer, isLowBalance && styles.cardLowBalance]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.titleBox}>
            <Wallet size={18} color={Colors.amber} />
            <Text style={styles.cardTitle}>Platform Fee Wallet</Text>
          </View>
          <StatusBadge
            label={isLowBalance ? 'LOW CREDIT' : 'ACTIVE'}
            variant={isLowBalance ? 'warning' : 'success'}
          />
        </View>

        <View style={styles.balanceRow}>
          {loading && !wallet ? (
            <SkeletonLoader width={100} height={26} borderRadius={6} />
          ) : (
            <Text style={styles.balanceText}>₹{balance.toLocaleString('en-IN')}</Text>
          )}
          <TouchableOpacity
            style={styles.rechargeButton}
            onPress={handleOpenModal}
            activeOpacity={0.85}
          >
            <Plus size={14} color="#000000" />
            <Text style={styles.rechargeButtonText}>Recharge</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.cardSubtext}>
          Auto-deducted for platform fees on walk-in POS cash orders
        </Text>
      </View>

      <WalletRechargeModal
        visible={modalVisible}
        restaurantId={effectiveRestId}
        onClose={() => setModalVisible(false)}
        onRechargeSuccess={() => {
          loadWallet();
          WalletEvents.emit();
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E1DA',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardLowBalance: {
    borderColor: 'rgba(254, 166, 25, 0.45)',
    backgroundColor: '#FFF3DC',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  balanceText: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
  },
  rechargeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DE8626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Spacing.borderRadius.sm,
    gap: 4,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  rechargeButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  cardSubtext: {
    color: '#5C4E3D',
    fontSize: 11,
    marginTop: 4,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E0D6',
    borderWidth: 1,
    borderRadius: 20,
    height: 34,
    paddingHorizontal: 9,
    gap: 5,
    shadowColor: '#2B1A09',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  pillLowBalance: {
    borderColor: 'rgba(254, 166, 25, 0.5)',
    backgroundColor: '#FFF7EE',
  },
  pillText: {
    color: '#1C1917',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  pillPlus: {
    backgroundColor: '#DE8626',
    borderRadius: 8,
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E1DA',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.sm,
    marginVertical: 4,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  compactLowBalance: {
    borderColor: 'rgba(254, 166, 25, 0.4)',
    backgroundColor: '#FFF3DC',
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactLabel: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  compactAmount: {
    color: '#1F2937',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  compactRechargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DE8626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Spacing.borderRadius.sm,
    gap: 2,
  },
  compactRechargeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
  },
});
