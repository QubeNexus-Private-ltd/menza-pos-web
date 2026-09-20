import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  TextInput,
  Switch,
} from 'react-native';
import {
  X,
  Clock,
  Flame,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  PowerOff,
  Calendar,
  Settings,
  ShieldAlert,
  Sparkles,
  Zap,
  RotateCw,
  Coffee,
  UtensilsCrossed,
  Layers,
  Store,
  ChefHat,
  History,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit3,
  Trash2,
  Power,
  Utensils,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../core/theme/colors';
import { Typography } from '../../core/theme/typography';
import { Spacing } from '../../core/theme/spacing';
import { RestaurantConfigRemoteDataSource } from '../../data/datasources/RestaurantConfigRemoteDataSource';
import { StoreOperatingStatus, RestaurantOperatingHistoryEntry } from '../../domain/models/RestaurantConfig';
import { useKitchenStationStore } from '../state/useKitchenStationStore';
import { useAuthStore } from '../state/useAuthStore';
import { canConfigureKitchenStations } from '../../core/auth/rolePermissions';

const configDataSource = new RestaurantConfigRemoteDataSource();
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StoreOperatingStatusModalProps {
  visible: boolean;
  onClose: () => void;
  restaurantId: number;
  restaurantName: string;
  isOwnerOrAdmin?: boolean;
  initialStatus?: StoreOperatingStatus | null;
  isTableOrderingAllowed?: boolean;
  onEditHours?: () => void;
  onStatusUpdated?: (status: StoreOperatingStatus) => void;
  onProfileUpdated?: (profile: 'QSR_CAFE' | 'DINE_IN' | 'HYBRID') => void;
}

export const StoreOperatingStatusModal: React.FC<StoreOperatingStatusModalProps> = ({
  visible,
  onClose,
  restaurantId,
  restaurantName,
  isOwnerOrAdmin = false,
  initialStatus,
  isTableOrderingAllowed = true,
  onEditHours,
  onStatusUpdated,
  onProfileUpdated,
}) => {
  const [loading, setLoading] = useState<boolean>(!initialStatus);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<StoreOperatingStatus | null>(initialStatus || null);
  const [selectedProfile, setSelectedProfile] = useState<'QSR_CAFE' | 'DINE_IN' | 'HYBRID'>(
    isTableOrderingAllowed ? 'HYBRID' : 'QSR_CAFE'
  );
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [stationActionLoading, setStationActionLoading] = useState<string | null>(null);
  const [history, setHistory] = useState<RestaurantOperatingHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Auth role checking: Owner, Cashier, Manager can configure stations
  const { user, activeRestaurant } = useAuthStore();
  const canManageStations = canConfigureKitchenStations(user, activeRestaurant) || isOwnerOrAdmin;

  const {
    stations,
    fetchStations,
    createStation,
    updateStation,
    deleteStation,
    toggleStationStatus,
    initializeDefaults,
  } = useKitchenStationStore();

  // Station Modal State
  const [stationModalVisible, setStationModalVisible] = useState<boolean>(false);
  const [editingStationId, setEditingStationId] = useState<number | null>(null);
  const [stationCode, setStationCode] = useState<string>('');
  const [stationName, setStationName] = useState<string>('');
  const [stationIcon, setStationIcon] = useState<string>('utensils');
  const [stationBadgeColor, setStationBadgeColor] = useState<string>('#DE8626');
  const [stationPrinter, setStationPrinter] = useState<string>('');
  const [stationOrder, setStationOrder] = useState<string>('1');
  const [stationIsActive, setStationIsActive] = useState<boolean>(true);

  const handleOpenAddStation = () => {
    setEditingStationId(null);
    setStationCode('');
    setStationName('');
    setStationIcon('utensils');
    setStationBadgeColor('#DE8626');
    setStationPrinter('');
    setStationOrder(String(stations.length + 1));
    setStationIsActive(true);
    setStationModalVisible(true);
  };

  const handleOpenEditStation = (st: any) => {
    setEditingStationId(st.id);
    setStationCode(st.stationCode);
    setStationName(st.stationName);
    setStationIcon(st.iconName || 'utensils');
    setStationBadgeColor(st.badgeColor || '#DE8626');
    setStationPrinter(st.assignedPrinterMacOrIp || '');
    setStationOrder(String(st.displayOrder || 1));
    setStationIsActive(st.isActive !== false);
    setStationModalVisible(true);
  };

  const handleSaveStation = async () => {
    if (!stationCode.trim() || !stationName.trim()) {
      Alert.alert('Required Fields', 'Station Code and Station Name are required.');
      return;
    }
    try {
      setStationActionLoading(editingStationId ? `update_${editingStationId}` : 'create_station');
      if (editingStationId) {
        await updateStation(editingStationId, {
          stationCode: stationCode.trim().toUpperCase(),
          stationName: stationName.trim(),
          iconName: stationIcon,
          badgeColor: stationBadgeColor,
          assignedPrinterMacOrIp: stationPrinter.trim(),
          displayOrder: parseInt(stationOrder, 10) || 1,
        });
        const currentSt = stations.find((s) => s.id === editingStationId);
        if (currentSt && currentSt.isActive !== stationIsActive) {
          await toggleStationStatus(editingStationId, {
            isActive: stationIsActive,
            pauseMinutes: 0,
          });
        }
        Alert.alert('Station Updated', `Kitchen station "${stationName.trim()}" updated successfully.`);
      } else {
        const created = await createStation({
          restaurantId,
          stationCode: stationCode.trim().toUpperCase(),
          stationName: stationName.trim(),
          iconName: stationIcon,
          badgeColor: stationBadgeColor,
          assignedPrinterMacOrIp: stationPrinter.trim(),
          displayOrder: parseInt(stationOrder, 10) || (stations.length + 1),
        });
        if (created && !stationIsActive) {
          await toggleStationStatus(created.id, {
            isActive: false,
            pauseMinutes: 0,
          });
        }
        Alert.alert('Station Created', `Kitchen station "${stationName.trim()}" created successfully.`);
      }
      setStationModalVisible(false);
      fetchStations(restaurantId);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not save kitchen station.');
    } finally {
      setStationActionLoading(null);
    }
  };

  const handleDeleteStation = (st: any) => {
    Alert.alert(
      'Delete Kitchen Station?',
      `Are you sure you want to remove "${st.stationName}" (${st.stationCode})? Dishes assigned to it will fallback to Main Kitchen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setStationActionLoading(`delete_${st.id}`);
              await deleteStation(st.id);
              Alert.alert('Station Deleted', `Kitchen station "${st.stationName}" removed.`);
              fetchStations(restaurantId);
            } catch (err: any) {
              Alert.alert('Delete Failed', err?.message || 'Could not delete station.');
            } finally {
              setStationActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleInitializeDefaults = async () => {
    if (!restaurantId || restaurantId <= 0) return;
    Alert.alert(
      'Initialize Standard 7 Stations?',
      'This will set up standard kitchen stations (Tandoor & Grill, Curries & Rice, Chinese & Wok, Beverages & Bar, Desserts & Bakery, Starters & Snacks, Main Kitchen).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Initialize',
          onPress: async () => {
            try {
              setStationActionLoading('init_defaults');
              await initializeDefaults(restaurantId);
              Alert.alert('Stations Initialized', '7 standard kitchen stations loaded successfully.');
              fetchStations(restaurantId);
            } catch (err: any) {
              Alert.alert('Initialization Failed', err?.message || 'Could not initialize default stations.');
            } finally {
              setStationActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const fetchHistory = useCallback(async () => {
    if (!restaurantId || restaurantId <= 0) return;
    try {
      setHistoryLoading(true);
      const data = await configDataSource.getOperatingHistory(restaurantId, 15);
      setHistory(data);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (visible && restaurantId > 0) {
      fetchStations(restaurantId);
      fetchHistory();
    }
  }, [visible, restaurantId, fetchStations, fetchHistory]);

  const handleToggleStationActive = async (st: any) => {
    try {
      setStationActionLoading(`active_${st.id}`);
      await toggleStationStatus(st.id, { isActive: !st.isActive, pauseMinutes: 0 });
    } catch (err: any) {
      Alert.alert('Station Toggle Error', err?.message || 'Could not update station active status.');
    } finally {
      setStationActionLoading(null);
    }
  };

  const handlePauseStation = async (st: any, minutes: number) => {
    try {
      setStationActionLoading(`pause_${st.id}_${minutes}`);
      await toggleStationStatus(st.id, {
        isActive: true,
        pauseMinutes: minutes,
        pauseReason: `Rush Pause (${minutes} mins)`,
      });
    } catch (err: any) {
      Alert.alert('Station Pause Error', err?.message || 'Could not pause station.');
    } finally {
      setStationActionLoading(null);
    }
  };

  const handleResumeStation = async (st: any) => {
    try {
      setStationActionLoading(`resume_${st.id}`);
      await toggleStationStatus(st.id, {
        isActive: true,
        pauseMinutes: 0,
      });
    } catch (err: any) {
      Alert.alert('Station Resume Error', err?.message || 'Could not resume station.');
    } finally {
      setStationActionLoading(null);
    }
  };

  useEffect(() => {
    if (status?.businessProfile) {
      setSelectedProfile(status.businessProfile as any);
    } else {
      setSelectedProfile(isTableOrderingAllowed ? 'HYBRID' : 'QSR_CAFE');
    }
  }, [status?.businessProfile, isTableOrderingAllowed]);

  const onStatusUpdatedRef = React.useRef(onStatusUpdated);
  useEffect(() => {
    onStatusUpdatedRef.current = onStatusUpdated;
  }, [onStatusUpdated]);

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
      if (initialStatus.businessProfile) {
        setSelectedProfile(initialStatus.businessProfile as any);
      }
      setLoading(false);
    }
  }, [initialStatus]);

  const fetchStatus = useCallback(async (isSilent = false) => {
    if (!restaurantId || restaurantId <= 0) return;
    try {
      if (!isSilent) setLoading(true);
      const res = await configDataSource.getOperatingStatus(restaurantId);
      if (res) {
        setStatus(res);
        if (res.businessProfile) {
          setSelectedProfile(res.businessProfile as any);
        }
        onStatusUpdatedRef.current?.(res);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (visible && restaurantId > 0) {
      fetchStatus(Boolean(status || initialStatus));
    }
  }, [visible, restaurantId]);

  const handleToggle = async (
    options: {
      isAccepting?: boolean;
      pauseMinutes?: number;
      reason?: string;
      mode?: 'SCHEDULE' | 'MANUAL';
      businessProfile?: 'QSR_CAFE' | 'DINE_IN' | 'HYBRID';
      isKitchenActive?: boolean;
      kitchenMode?: 'SINGLE_KITCHEN' | 'MULTI_STATION';
      kitchenPauseMinutes?: number;
      kitchenPauseReason?: string;
    },
    actionKey: string
  ) => {
    if (!restaurantId || restaurantId <= 0) return;
    try {
      setActionLoading(actionKey);
      const updatedRaw: any = await configDataSource.toggleOrdering(restaurantId, options);
      const updated =
        updatedRaw && typeof updatedRaw.status === 'object' && updatedRaw.status !== null && 'isOpen' in updatedRaw.status
          ? updatedRaw.status
          : updatedRaw;
      if (updated) {
        if (options.isKitchenActive !== undefined) {
          updated.isKitchenActive = options.isKitchenActive;
        }
        setStatus(updated);
        onStatusUpdatedRef.current?.(updated);
        fetchHistory();
      }
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not update operating status.');
    } finally {
      setActionLoading(null);
    }
  };

  const isKitchenActive =
    typeof status?.isKitchenActive === 'boolean'
      ? status.isKitchenActive
      : typeof (status as any)?.status?.isKitchenActive === 'boolean'
      ? (status as any).status.isKitchenActive
      : status?.isKitchenActive !== false;

  const handleToggleKitchenActive = async () => {
    const nextVal = !isKitchenActive;
    setStatus((prev) => (prev ? { ...prev, isKitchenActive: nextVal } : prev));
    await handleToggle({ isKitchenActive: nextVal }, 'toggleKitchenActive');
    Alert.alert(
      nextVal ? 'Live Kitchen Status Activated 🟢' : 'Live Kitchen Status Deactivated ⚪',
      nextVal
        ? 'Live 5-step KDS stepper, real-time decreasing countdown timers, and chef cooking alerts are now active for customers.'
        : 'Live kitchen tracking and timers are now disabled for customers. A simplified confirmation and order status will be displayed.'
    );
  };

  const handleProfileChange = async (profile: 'QSR_CAFE' | 'DINE_IN' | 'HYBRID') => {
    if (!restaurantId || restaurantId <= 0) return;
    try {
      setProfileLoading(true);
      setSelectedProfile(profile);
      const updated = await configDataSource.toggleOrdering(restaurantId, { businessProfile: profile });
      if (updated) {
        setStatus(updated);
        onStatusUpdatedRef.current?.(updated);
        fetchHistory();
      }
      onProfileUpdated?.(profile);
      Alert.alert(
        'Store Business Profile Updated 🏬',
        profile === 'QSR_CAFE'
          ? 'Store switched to Quick Cafe / QSR Mode. Table ordering & floor plan are disabled. Token pickup active.'
          : profile === 'DINE_IN'
          ? 'Store switched to Dine-In Restaurant Mode. Table QR ordering & interactive floor plan active.'
          : 'Store switched to Hybrid Mode. Both Table Dine-In and Counter Takeaway tokens are active.'
      );
    } catch (err: any) {
      Alert.alert('Profile Update Error', err?.message || 'Failed to update store business profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const isPaused = status?.status === 'PAUSED';
  const isOpen = status?.status === 'OPEN';
  const isClosed = status?.status === 'CLOSED';
  const isScheduleMode = status?.orderingMode === 'SCHEDULE';

  const formatUtcToLocal = (dateUtc?: string | null) => {
    if (!dateUtc) return null;
    try {
      const d = new Date(dateUtc);
      if (isNaN(d.getTime())) return null;
      return (
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) +
        ', ' +
        d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      );
    } catch {
      return null;
    }
  };

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'STORE_OPENED':
        return { label: 'Store Opened', color: '#16A34A', bg: '#DCFCE7' };
      case 'STORE_CLOSED_MANUAL':
        return { label: 'Store Closed', color: '#DC2626', bg: '#FEE2E2' };
      case 'ORDERS_RESUMED':
        return { label: 'Orders Resumed', color: '#16A34A', bg: '#DCFCE7' };
      case 'ORDERS_PAUSED':
        return { label: 'Orders Paused', color: '#D97706', bg: '#FEF3C7' };
      case 'MODE_CHANGED':
        return { label: 'Timing Mode Switched', color: '#2563EB', bg: '#DBEAFE' };
      case 'KITCHEN_ACTIVE_TOGGLE':
        return { label: 'Kitchen Live Status', color: '#9333EA', bg: '#F3E8FF' };
      case 'KITCHEN_PAUSED':
        return { label: 'Kitchen Rush Paused', color: '#EA580C', bg: '#FFEDD5' };
      case 'PROFILE_CHANGED':
        return { label: 'Profile Changed', color: '#0891B2', bg: '#CFFAFE' };
      case 'HOURS_UPDATED':
        return { label: 'Hours Updated', color: '#4F46E5', bg: '#EEF2FF' };
      default:
        return { label: eventType.replace(/_/g, ' '), color: '#78716C', bg: '#F5F5F4' };
    }
  };

  const formatTime12h = (time24?: string) => {
    if (!time24) return '--:--';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m < 10 ? '0' + m : m} ${ampm}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleBox}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {restaurantName || 'Outlet Ordering Controls'}
              </Text>
              <Text style={styles.modalSubtitle}>Order Acceptance & Kitchen Hours</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color="#78716C" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#DE8626" />
                <Text style={styles.loadingText}>Fetching operating status...</Text>
              </View>
            ) : (
              <>
                {/* 1. Live Operating Status Banner */}
                <View
                  style={[
                    styles.statusHeroCard,
                    isOpen && styles.statusHeroCardOpen,
                    isPaused && styles.statusHeroCardPaused,
                    isClosed && styles.statusHeroCardClosed,
                  ]}
                >
                  <View style={styles.statusHeroTop}>
                    <View
                      style={[
                        styles.statusDotBeacon,
                        isOpen && styles.statusDotBeaconOpen,
                        isPaused && styles.statusDotBeaconPaused,
                        isClosed && styles.statusDotBeaconClosed,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusHeroTitle,
                        isOpen && styles.statusHeroTitleOpen,
                        isPaused && styles.statusHeroTitlePaused,
                        isClosed && styles.statusHeroTitleClosed,
                      ]}
                    >
                      {isOpen
                        ? '🟢 ACCEPTING ORDERS'
                        : isPaused
                        ? `🟡 KITCHEN PAUSED (${status?.remainingPauseMinutes || 0}M LEFT)`
                        : '🔴 STORE CLOSED'}
                    </Text>
                    <View style={styles.modeChip}>
                      <Text style={styles.modeChipText}>
                        {isScheduleMode ? 'AUTO SCHEDULE' : 'MANUAL CONTROL'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.statusHeroMessage}>
                    {status?.statusMessage || 'Status updated.'}
                  </Text>

                  {/* Schedule Breakdown Bar */}
                  <View style={styles.timingMetaBar}>
                    <View style={styles.timingMetaCol}>
                      <Text style={styles.timingMetaLabel}>OPENS</Text>
                      <Text style={styles.timingMetaVal}>
                        {formatTime12h(status?.openingTime)}
                      </Text>
                    </View>
                    <View style={styles.timingMetaDivider} />
                    <View style={styles.timingMetaCol}>
                      <Text style={styles.timingMetaLabel}>LAST ORDER</Text>
                      <Text style={[styles.timingMetaVal, { color: '#DE8626', fontWeight: '800' }]}>
                        {formatTime12h(status?.lastOrderTime)}
                      </Text>
                    </View>
                    <View style={styles.timingMetaDivider} />
                    <View style={styles.timingMetaCol}>
                      <Text style={styles.timingMetaLabel}>CLOSES</Text>
                      <Text style={styles.timingMetaVal}>
                        {formatTime12h(status?.closingTime)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 1b. Real-Time Operational Event Audit Tracker */}
                {(status?.lastOpenedAtUtc ||
                  status?.lastClosedAtUtc ||
                  status?.lastOrderPausedAtUtc ||
                  status?.lastOrderResumedAtUtc ||
                  status?.lastKitchenStatusChangedAtUtc) && (
                  <View style={styles.auditCard}>
                    <View style={styles.auditHeader}>
                      <Clock size={12} color="#8C7A6B" />
                      <Text style={styles.auditHeaderTitle}>OPERATIONAL EVENT AUDIT TRACKER</Text>
                    </View>
                    <View style={styles.auditGrid}>
                      {status?.lastOpenedAtUtc && (
                        <View style={styles.auditItem}>
                          <Text style={styles.auditItemLabel}>Last Opened</Text>
                          <Text style={[styles.auditItemValue, { color: '#16A34A' }]}>
                            {formatUtcToLocal(status.lastOpenedAtUtc)}
                          </Text>
                        </View>
                      )}
                      {status?.lastClosedAtUtc && (
                        <View style={styles.auditItem}>
                          <Text style={styles.auditItemLabel}>Last Closed</Text>
                          <Text style={[styles.auditItemValue, { color: '#DC2626' }]}>
                            {formatUtcToLocal(status.lastClosedAtUtc)}
                          </Text>
                          {status.closeReason && (
                            <Text style={styles.auditItemSub} numberOfLines={1}>
                              {status.closeReason}
                            </Text>
                          )}
                        </View>
                      )}
                      {status?.lastOrderPausedAtUtc && (
                        <View style={styles.auditItem}>
                          <Text style={styles.auditItemLabel}>Last Pause</Text>
                          <Text style={[styles.auditItemValue, { color: '#D97706' }]}>
                            {formatUtcToLocal(status.lastOrderPausedAtUtc)} ({status.lastPauseDurationMinutes || 0}m)
                          </Text>
                        </View>
                      )}
                      {status?.lastOrderResumedAtUtc && (
                        <View style={styles.auditItem}>
                          <Text style={styles.auditItemLabel}>Last Resumed</Text>
                          <Text style={[styles.auditItemValue, { color: '#16A34A' }]}>
                            {formatUtcToLocal(status.lastOrderResumedAtUtc)}
                          </Text>
                        </View>
                      )}
                      {status?.lastKitchenStatusChangedAtUtc && (
                        <View style={styles.auditItem}>
                          <Text style={styles.auditItemLabel}>Kitchen Status Toggled</Text>
                          <Text style={[styles.auditItemValue, { color: '#9333EA' }]}>
                            {formatUtcToLocal(status.lastKitchenStatusChangedAtUtc)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* 2. Store Business Profile Selector (QSR vs Dine-In vs Hybrid) */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Store size={14} color="#DE8626" />
                    <Text style={styles.sectionTitle}>STORE BUSINESS PROFILE</Text>
                  </View>
                  <Text style={styles.sectionDesc}>
                    Select how ordering and seating operate for this outlet.
                  </Text>

                  <View style={styles.serviceProfileCol}>
                    {/* Option 1: Quick Cafe / QSR */}
                    <TouchableOpacity
                      style={[
                        styles.profileOptionCard,
                        selectedProfile === 'QSR_CAFE' && styles.profileOptionCardActive,
                      ]}
                      onPress={() => handleProfileChange('QSR_CAFE')}
                      disabled={profileLoading}
                      activeOpacity={0.8}
                    >
                      <View style={styles.profileOptionHeader}>
                        <View style={[styles.profileIconBox, selectedProfile === 'QSR_CAFE' && styles.profileIconBoxActive]}>
                          <Coffee size={16} color={selectedProfile === 'QSR_CAFE' ? '#DE8626' : '#78716C'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.profileTitleRow}>
                            <Text style={[styles.profileTitle, selectedProfile === 'QSR_CAFE' && styles.profileTitleActive]}>
                              Quick Cafe / QSR
                            </Text>
                            <View style={styles.profileBadge}>
                              <Text style={styles.profileBadgeText}>🎟️ TOKEN SYSTEM</Text>
                            </View>
                          </View>
                          <Text style={styles.profileDesc}>
                            Counter takeout & token pickup. Table seating & floor map are hidden.
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Option 2: Dine-In Restaurant */}
                    <TouchableOpacity
                      style={[
                        styles.profileOptionCard,
                        selectedProfile === 'DINE_IN' && styles.profileOptionCardActive,
                      ]}
                      onPress={() => handleProfileChange('DINE_IN')}
                      disabled={profileLoading}
                      activeOpacity={0.8}
                    >
                      <View style={styles.profileOptionHeader}>
                        <View style={[styles.profileIconBox, selectedProfile === 'DINE_IN' && styles.profileIconBoxActive]}>
                          <UtensilsCrossed size={16} color={selectedProfile === 'DINE_IN' ? '#DE8626' : '#78716C'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.profileTitleRow}>
                            <Text style={[styles.profileTitle, selectedProfile === 'DINE_IN' && styles.profileTitleActive]}>
                              Dine-In Restaurant
                            </Text>
                            <View style={[styles.profileBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                              <Text style={[styles.profileBadgeText, { color: '#1D4ED8' }]}>🪑 TABLE DINE-IN</Text>
                            </View>
                          </View>
                          <Text style={styles.profileDesc}>
                            QR code per table, interactive floor map, running table tabs, and waiter service.
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Option 3: Hybrid */}
                    <TouchableOpacity
                      style={[
                        styles.profileOptionCard,
                        selectedProfile === 'HYBRID' && styles.profileOptionCardActive,
                      ]}
                      onPress={() => handleProfileChange('HYBRID')}
                      disabled={profileLoading}
                      activeOpacity={0.8}
                    >
                      <View style={styles.profileOptionHeader}>
                        <View style={[styles.profileIconBox, selectedProfile === 'HYBRID' && styles.profileIconBoxActive]}>
                          <Layers size={16} color={selectedProfile === 'HYBRID' ? '#DE8626' : '#78716C'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.profileTitleRow}>
                            <Text style={[styles.profileTitle, selectedProfile === 'HYBRID' && styles.profileTitleActive]}>
                              Hybrid Store
                            </Text>
                            <View style={[styles.profileBadge, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                              <Text style={[styles.profileBadgeText, { color: '#15803D' }]}>🪑 TABLES + 🎟️ TOKEN</Text>
                            </View>
                          </View>
                          <Text style={styles.profileDesc}>
                            Both table seating with running tabs and quick counter takeaway token ordering.
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 3. Quick Kitchen Rush Timers */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Flame size={14} color="#DE8626" />
                    <Text style={styles.sectionTitle}>KITCHEN RUSH OVERLOAD CONTROLS</Text>
                  </View>
                  <Text style={styles.sectionDesc}>
                    Temporarily pause incoming QR & online orders while clearing kitchen rush. Resumes automatically when the timer finishes.
                  </Text>

                  <View style={styles.quickTimersRow}>
                    <TouchableOpacity
                      style={[
                        styles.timerBtn,
                        isPaused && status?.remainingPauseMinutes === 15 && styles.timerBtnActive,
                      ]}
                      onPress={() =>
                        handleToggle({ pauseMinutes: 15, reason: 'Kitchen Rush Pause' }, 'pause15')
                      }
                      disabled={actionLoading !== null}
                      activeOpacity={0.8}
                    >
                      {actionLoading === 'pause15' ? (
                        <ActivityIndicator size="small" color="#DE8626" />
                      ) : (
                        <>
                          <Clock size={14} color="#DE8626" />
                          <Text style={styles.timerBtnText}>15 Mins</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.timerBtn,
                        isPaused && status?.remainingPauseMinutes === 30 && styles.timerBtnActive,
                      ]}
                      onPress={() =>
                        handleToggle({ pauseMinutes: 30, reason: 'Peak Capacity Pause' }, 'pause30')
                      }
                      disabled={actionLoading !== null}
                      activeOpacity={0.8}
                    >
                      {actionLoading === 'pause30' ? (
                        <ActivityIndicator size="small" color="#DE8626" />
                      ) : (
                        <>
                          <Clock size={14} color="#DE8626" />
                          <Text style={styles.timerBtnText}>30 Mins</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.timerBtn,
                        isPaused && status?.remainingPauseMinutes === 60 && styles.timerBtnActive,
                      ]}
                      onPress={() =>
                        handleToggle({ pauseMinutes: 60, reason: 'Ingredient Restock' }, 'pause60')
                      }
                      disabled={actionLoading !== null}
                      activeOpacity={0.8}
                    >
                      {actionLoading === 'pause60' ? (
                        <ActivityIndicator size="small" color="#DE8626" />
                      ) : (
                        <>
                          <Clock size={14} color="#DE8626" />
                          <Text style={styles.timerBtnText}>1 Hour</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 3B. Kitchen Live Status Toggle (Customer Order Tracking) */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <ChefHat size={14} color="#DE8626" />
                    <Text style={styles.sectionTitle}>KITCHEN LIVE STATUS (CUSTOMER TRACKING)</Text>
                  </View>
                  <Text style={styles.sectionDesc}>
                    Control whether customers see real-time 5-stage kitchen progress and decreasing countdown timers or a simplified order status.
                  </Text>

                  <View
                    style={[
                      styles.kitchenLiveCard,
                      isKitchenActive ? styles.kitchenLiveCardActive : styles.kitchenLiveCardInactive,
                    ]}
                  >
                    <View style={styles.kitchenLiveHeader}>
                      <View
                        style={[
                          styles.kitchenLiveIconBox,
                          isKitchenActive ? styles.kitchenLiveIconBoxActive : styles.kitchenLiveIconBoxInactive,
                        ]}
                      >
                        {isKitchenActive ? (
                          <Flame size={18} color="#D97706" />
                        ) : (
                          <UtensilsCrossed size={18} color="#78716C" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.kitchenLiveTitleRow}>
                          <Text style={[styles.kitchenLiveTitle, isKitchenActive && styles.kitchenLiveTitleActive]}>
                            {isKitchenActive ? 'Live Kitchen Tracking Active' : 'Live Kitchen Tracking Deactivated'}
                          </Text>
                          <View
                            style={[
                              styles.kitchenLiveBadge,
                              isKitchenActive ? styles.kitchenLiveBadgeActive : styles.kitchenLiveBadgeInactive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.kitchenLiveBadgeText,
                                isKitchenActive ? styles.kitchenLiveBadgeTextActive : styles.kitchenLiveBadgeTextInactive,
                              ]}
                            >
                              {isKitchenActive ? '🟢 ACTIVE' : '⚪ DEACTIVATED'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.kitchenLiveDesc}>
                          {isKitchenActive
                            ? 'Customers see the 5-step KDS stepper (Pending → Confirmed → Preparing → Ready → Served), live 1-second countdown clock, and chef cooking alerts.'
                            : 'Simplified mode: Ticking timers, chef flame alerts, and item prep badges are hidden from customers. Clean confirmation displayed.'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.kitchenLiveActionRow}>
                      <TouchableOpacity
                        style={[
                          styles.kitchenLiveActionBtn,
                          isKitchenActive
                            ? styles.kitchenLiveActionBtnDeactivate
                            : styles.kitchenLiveActionBtnActivate,
                        ]}
                        onPress={handleToggleKitchenActive}
                        disabled={actionLoading !== null}
                        activeOpacity={0.85}
                      >
                        {actionLoading === 'toggleKitchenActive' ? (
                          <ActivityIndicator size="small" color={isKitchenActive ? '#DC2626' : '#16A34A'} />
                        ) : (
                          <>
                            <PowerOff size={13} color={isKitchenActive ? '#DC2626' : '#16A34A'} />
                            <Text
                              style={[
                                styles.kitchenLiveActionBtnText,
                                { color: isKitchenActive ? '#DC2626' : '#16A34A' },
                              ]}
                            >
                              {isKitchenActive
                                ? 'DEACTIVATE KITCHEN LIVE STATUS'
                                : 'ACTIVATE KITCHEN LIVE STATUS'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* 4. Kitchen Stations Live Status & Fast Controls (Multi-Station) */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <UtensilsCrossed size={14} color="#DE8626" />
                      <Text style={styles.sectionTitle}>
                        PREPARATION STATIONS ({stations.length})
                      </Text>
                    </View>
                    {canManageStations && (
                      <TouchableOpacity
                        style={styles.addStationHeaderPillBtn}
                        onPress={handleOpenAddStation}
                        activeOpacity={0.8}
                      >
                        <Plus size={11} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={styles.addStationHeaderPillBtnText}>Add Station</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.sectionDesc}>
                    Create stations, toggle Active/Deactivate lines, and trigger rush pauses. Accessible by Owner, Manager & Cashier.
                  </Text>

                  {stations.length === 0 ? (
                    <View style={styles.modalStationEmptyBox}>
                      <ChefHat size={26} color="#D97706" />
                      <Text style={styles.modalStationEmptyTitle}>No Kitchen Stations Configured</Text>
                      <Text style={styles.modalStationEmptyDesc}>
                        Create custom preparation lines (Grill, Bar, Chinese, Curries) for automated order routing and split KOT printing.
                      </Text>
                      {canManageStations && (
                        <View style={styles.modalStationEmptyBtnsRow}>
                          <TouchableOpacity
                            style={styles.modalStationEmptyAddBtn}
                            onPress={handleOpenAddStation}
                            activeOpacity={0.8}
                          >
                            <Plus size={13} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={styles.modalStationEmptyAddBtnText}>Add Station</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.modalStationEmptyDefaultsBtn}
                            onPress={handleInitializeDefaults}
                            activeOpacity={0.8}
                            disabled={stationActionLoading === 'init_defaults'}
                          >
                            {stationActionLoading === 'init_defaults' ? (
                              <ActivityIndicator size="small" color="#DE8626" />
                            ) : (
                              <>
                                <Sparkles size={13} color="#DE8626" />
                                <Text style={styles.modalStationEmptyDefaultsBtnText}>Standard 7 Stations</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.modalStationList}>
                      {stations.map((st) => {
                        const stPaused = st.isPaused && st.remainingPauseMinutes > 0;
                        const stStatusColor = !st.isActive ? '#DC2626' : stPaused ? '#D97706' : '#16A34A';
                        const stStatusBg = !st.isActive ? '#FEE2E2' : stPaused ? '#FEF3C7' : '#DCFCE7';
                        const stStatusText = !st.isActive ? 'DEACTIVATED' : stPaused ? `PAUSED (${st.remainingPauseMinutes}m)` : 'ACTIVE';
                        const isToggleLoading = stationActionLoading === `active_${st.id}`;

                        return (
                          <View key={st.id} style={styles.modalStationCard}>
                            <View style={[styles.modalStationColorBar, { backgroundColor: st.badgeColor || '#DE8626' }]} />
                            <View style={styles.modalStationCardBody}>
                              <View style={styles.modalStationHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                  <Text style={styles.modalStationName} numberOfLines={1}>{st.stationName}</Text>
                                  <View style={[styles.modalStationCodeBadge, { borderColor: st.badgeColor || '#DE8626' }]}>
                                    <Text style={[styles.modalStationCodeText, { color: st.badgeColor || '#DE8626' }]}>{st.stationCode}</Text>
                                  </View>
                                </View>
                                <View style={[styles.modalStationStatusBadge, { backgroundColor: stStatusBg }]}>
                                  <Text style={[styles.modalStationStatusText, { color: stStatusColor }]}>{stStatusText}</Text>
                                </View>
                              </View>

                              {/* Station Control Action Buttons */}
                              <View style={styles.modalStationActionsRow}>
                                {/* Active / Deactivate Toggle Button */}
                                <TouchableOpacity
                                  style={[
                                    styles.stationPillBtn,
                                    st.isActive ? styles.stationPillBtnActive : styles.stationPillBtnInactive,
                                  ]}
                                  onPress={() => handleToggleStationActive(st)}
                                  disabled={stationActionLoading !== null}
                                  activeOpacity={0.8}
                                >
                                  {isToggleLoading ? (
                                    <ActivityIndicator size="small" color={st.isActive ? '#16A34A' : '#DC2626'} />
                                  ) : (
                                    <>
                                      <Power size={11} color={st.isActive ? '#16A34A' : '#DC2626'} strokeWidth={2.4} />
                                      <Text style={[styles.stationPillBtnText, { color: st.isActive ? '#16A34A' : '#DC2626' }]}>
                                        {st.isActive ? 'Deactivate' : 'Activate'}
                                      </Text>
                                    </>
                                  )}
                                </TouchableOpacity>

                                {/* 15m Pause */}
                                {st.isActive && (
                                  <TouchableOpacity
                                    style={[styles.stationPillBtn, stPaused && st.remainingPauseMinutes <= 15 && styles.stationPillBtnPaused]}
                                    onPress={() => handlePauseStation(st, 15)}
                                    disabled={stationActionLoading !== null}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.stationPillBtnText}>+15m</Text>
                                  </TouchableOpacity>
                                )}

                                {/* 30m Pause */}
                                {st.isActive && (
                                  <TouchableOpacity
                                    style={[styles.stationPillBtn, stPaused && st.remainingPauseMinutes > 15 && styles.stationPillBtnPaused]}
                                    onPress={() => handlePauseStation(st, 30)}
                                    disabled={stationActionLoading !== null}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.stationPillBtnText}>+30m</Text>
                                  </TouchableOpacity>
                                )}

                                {/* Resume Button (if paused) */}
                                {stPaused && (
                                  <TouchableOpacity
                                    style={[styles.stationPillBtn, { backgroundColor: '#E4F5EC', borderColor: '#17845A' }]}
                                    onPress={() => handleResumeStation(st)}
                                    disabled={stationActionLoading !== null}
                                    activeOpacity={0.8}
                                  >
                                    <PlayCircle size={11} color="#17845A" />
                                    <Text style={[styles.stationPillBtnText, { color: '#17845A', fontWeight: '800' }]}>Resume</Text>
                                  </TouchableOpacity>
                                )}

                                {canManageStations && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                                    <TouchableOpacity
                                      style={styles.stationIconBtn}
                                      onPress={() => handleOpenEditStation(st)}
                                      activeOpacity={0.7}
                                    >
                                      <Edit3 size={12} color="#4B5563" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={[styles.stationIconBtn, { backgroundColor: '#FEE2E2' }]}
                                      onPress={() => handleDeleteStation(st)}
                                      activeOpacity={0.7}
                                      disabled={stationActionLoading === `delete_${st.id}`}
                                    >
                                      <Trash2 size={12} color="#DC2626" />
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}

                      {canManageStations && (
                        <View style={styles.stationBottomBarRow}>
                          <TouchableOpacity
                            style={styles.stationBottomAddBtn}
                            onPress={handleOpenAddStation}
                            activeOpacity={0.8}
                          >
                            <Plus size={12} color="#DE8626" strokeWidth={2.4} />
                            <Text style={styles.stationBottomAddBtnText}>Add Station</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.stationBottomResetBtn}
                            onPress={handleInitializeDefaults}
                            activeOpacity={0.8}
                            disabled={stationActionLoading === 'init_defaults'}
                          >
                            <Sparkles size={12} color="#78716C" />
                            <Text style={styles.stationBottomResetBtnText}>Reset 7 Defaults</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* 5. Primary Manual Actions */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <PowerOff size={14} color="#5C4E3D" />
                    <Text style={styles.sectionTitle}>MANUAL OVERRIDE ACTIONS</Text>
                  </View>

                  <View style={styles.actionButtonsCol}>
                    {/* Resume / Open Now Button */}
                    <TouchableOpacity
                      style={styles.resumePrimaryBtn}
                      onPress={() =>
                        handleToggle(
                          { isAccepting: true, pauseMinutes: 0, mode: 'MANUAL' },
                          'resume'
                        )
                      }
                      disabled={actionLoading !== null}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#17845A', '#0F5B3E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.resumeGradient}
                      >
                        {actionLoading === 'resume' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <PlayCircle size={18} color="#FFFFFF" />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.resumePrimaryBtnTitle}>
                                Resume Accepting Orders Now
                              </Text>
                              <Text style={styles.resumePrimaryBtnSub}>
                                Clears pause and activates online/QR ordering
                              </Text>
                            </View>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Manual Close Store Button */}
                    <TouchableOpacity
                      style={styles.manualCloseBtn}
                      onPress={() => {
                        Alert.alert(
                          'Close Store for Ordering?',
                          'Are you sure you want to stop taking customer QR & digital orders?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Close Orders',
                              style: 'destructive',
                              onPress: () =>
                                handleToggle(
                                  { isAccepting: false, mode: 'MANUAL', reason: 'Store Closed by Staff' },
                                  'closeManual'
                                ),
                            },
                          ]
                        );
                      }}
                      disabled={actionLoading !== null}
                      activeOpacity={0.85}
                    >
                      {actionLoading === 'closeManual' ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                      ) : (
                        <>
                          <PauseCircle size={18} color="#DC2626" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.manualCloseBtnTitle}>
                              Close Store for Today (Manual Close)
                            </Text>
                            <Text style={styles.manualCloseBtnSub}>
                              Disables QR checkout until manually reopened
                            </Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 5. Operating Mode Switcher */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Settings size={14} color="#78716C" />
                    <Text style={styles.sectionTitle}>TIMING MODE</Text>
                  </View>

                  <View style={styles.modeToggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.modeOptionCard,
                        isScheduleMode && styles.modeOptionCardActive,
                      ]}
                      onPress={() => handleToggle({ mode: 'SCHEDULE' }, 'modeSchedule')}
                      disabled={actionLoading !== null}
                      activeOpacity={0.8}
                    >
                      <View style={styles.modeOptionHeader}>
                        <Calendar
                          size={15}
                          color={isScheduleMode ? '#DE8626' : '#8C7A6B'}
                        />
                        <Text
                          style={[
                            styles.modeOptionTitle,
                            isScheduleMode && styles.modeOptionTitleActive,
                          ]}
                        >
                          Auto Schedule
                        </Text>
                      </View>
                      <Text style={styles.modeOptionDesc}>
                        Automatically opens & closes according to daily business hours.
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.modeOptionCard,
                        !isScheduleMode && styles.modeOptionCardActive,
                      ]}
                      onPress={() => handleToggle({ mode: 'MANUAL' }, 'modeManual')}
                      disabled={actionLoading !== null}
                      activeOpacity={0.8}
                    >
                      <View style={styles.modeOptionHeader}>
                        <Zap
                          size={15}
                          color={!isScheduleMode ? '#DE8626' : '#8C7A6B'}
                        />
                        <Text
                          style={[
                            styles.modeOptionTitle,
                            !isScheduleMode && styles.modeOptionTitleActive,
                          ]}
                        >
                          Manual Control
                        </Text>
                      </View>
                      <Text style={styles.modeOptionDesc}>
                        Cashier & Owner manually toggle Open and Closed as needed.
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 6. Operational Activity History Log (Accordion) */}
                <View style={styles.sectionContainer}>
                  <TouchableOpacity
                    style={styles.historyToggleBtn}
                    onPress={() => {
                      const next = !showHistory;
                      setShowHistory(next);
                      if (next && history.length === 0) {
                        fetchHistory();
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sectionHeaderRow}>
                      <History size={14} color="#DE8626" />
                      <Text style={styles.sectionTitle}>OPERATIONAL ACTIVITY HISTORY</Text>
                      {history.length > 0 && (
                        <View style={styles.historyCountBadge}>
                          <Text style={styles.historyCountText}>{history.length}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {showHistory ? (
                        <ChevronUp size={16} color="#78716C" />
                      ) : (
                        <ChevronDown size={16} color="#78716C" />
                      )}
                    </View>
                  </TouchableOpacity>

                  {showHistory && (
                    <View style={styles.historyContentBox}>
                      <View style={styles.historyHeaderActions}>
                        <Text style={[styles.sectionDesc, { flex: 1, marginBottom: 0 }]}>
                          Immutable audit log of all store status changes, order pauses, and mode switches.
                        </Text>
                        <TouchableOpacity
                          style={styles.historyRefreshBtn}
                          onPress={fetchHistory}
                          disabled={historyLoading}
                          activeOpacity={0.7}
                        >
                          <RotateCw size={12} color="#DE8626" />
                          <Text style={styles.historyRefreshText}>Refresh</Text>
                        </TouchableOpacity>
                      </View>

                      {historyLoading ? (
                        <View style={styles.historyLoadingBox}>
                          <ActivityIndicator size="small" color="#DE8626" />
                          <Text style={styles.historyLoadingText}>Loading audit history...</Text>
                        </View>
                      ) : history.length === 0 ? (
                        <View style={styles.historyEmptyBox}>
                          <Text style={styles.historyEmptyText}>No operational history logged yet.</Text>
                        </View>
                      ) : (
                        <View style={styles.historyList}>
                          {history.map((entry) => {
                            const badge = getEventBadge(entry.eventType);
                            const timeFormatted = formatUtcToLocal(entry.createdDateUtc);
                            return (
                              <View key={entry.id} style={styles.historyItemCard}>
                                <View style={styles.historyItemTop}>
                                  <View style={[styles.historyBadge, { backgroundColor: badge.bg }]}>
                                    <Text style={[styles.historyBadgeText, { color: badge.color }]}>
                                      {badge.label}
                                    </Text>
                                  </View>
                                  <Text style={styles.historyTimeText}>{timeFormatted}</Text>
                                </View>

                                {entry.remarks && (
                                  <Text style={styles.historyRemarksText}>{entry.remarks}</Text>
                                )}

                                <View style={styles.historyMetaRow}>
                                  {entry.previousStatus && entry.newStatus && (
                                    <Text style={styles.historyMetaText}>
                                      {entry.previousStatus} → {entry.newStatus}
                                    </Text>
                                  )}
                                  {entry.pauseDurationMinutes ? (
                                    <Text style={styles.historyMetaText}>
                                      • Duration: {entry.pauseDurationMinutes}m
                                    </Text>
                                  ) : null}
                                  <Text style={styles.historyMetaText}>
                                    • By: {entry.actionSource || 'Owner App'}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* 7. Owner Edit Operating Hours Shortcut */}
                {isOwnerOrAdmin && onEditHours && (
                  <TouchableOpacity
                    style={styles.editHoursShortcutBtn}
                    onPress={() => {
                      onClose();
                      onEditHours();
                    }}
                    activeOpacity={0.8}
                  >
                    <Settings size={14} color="#8C7A6B" />
                    <Text style={styles.editHoursShortcutText}>
                      Configure Daily Opening, Closing & Cutoff Hours
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        </View>

        {/* ADD / EDIT KITCHEN STATION MODAL INSIDE STATUS & CONTROLS */}
        <Modal visible={stationModalVisible} transparent animationType="fade" onRequestClose={() => setStationModalVisible(false)}>
          <View style={styles.stationModalOverlay}>
            <View style={styles.stationModalContent}>
              <View style={styles.stationModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <UtensilsCrossed size={16} color="#DE8626" />
                  <Text style={styles.stationModalTitle}>
                    {editingStationId ? 'Edit Kitchen Station' : 'Create Kitchen Station'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setStationModalVisible(false)}
                  style={styles.stationModalCloseBtn}
                  activeOpacity={0.7}
                >
                  <X size={18} color="#5C4E3D" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 16 }}>
                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalFieldLabel}>STATION CODE (UNIQUE SHORT CODE) *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={stationCode}
                    onChangeText={(t) => setStationCode(t.toUpperCase())}
                    placeholder="e.g. BAR, GRILL, CHINESE, CURRY, DESSERT"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                </View>

                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalFieldLabel}>STATION DISPLAY NAME *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={stationName}
                    onChangeText={setStationName}
                    placeholder="e.g. Beverages & Bar Counter"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Active Status Switch */}
                <View style={styles.modalSwitchRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.modalSwitchTitle}>Station Status: {stationIsActive ? 'Active (Online)' : 'Deactivated (Offline)'}</Text>
                    <Text style={styles.modalSwitchDesc}>
                      {stationIsActive
                        ? 'Active: Order items route to this station display and printer.'
                        : 'Deactivated: Dishes will temporarily route to Main Kitchen.'}
                    </Text>
                  </View>
                  <Switch
                    value={stationIsActive}
                    onValueChange={setStationIsActive}
                    trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                    thumbColor={stationIsActive ? '#DE8626' : '#9CA3AF'}
                  />
                </View>

                {/* Theme Color Picker */}
                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalFieldLabel}>BADGE COLOR</Text>
                  <View style={styles.modalColorPickerRow}>
                    {['#DE8626', '#EF4444', '#10B981', '#06B6D4', '#8B5CF6', '#EC4899', '#F59E0B'].map((col) => (
                      <TouchableOpacity
                        key={col}
                        style={[
                          styles.modalColorDot,
                          { backgroundColor: col },
                          stationBadgeColor === col && styles.modalColorDotSelected,
                        ]}
                        onPress={() => setStationBadgeColor(col)}
                        activeOpacity={0.8}
                      >
                        {stationBadgeColor === col && <CheckCircle2 size={14} color="#FFFFFF" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Assigned Printer */}
                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalFieldLabel}>ASSIGNED BLUETOOTH / NETWORK PRINTER (OPTIONAL)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={stationPrinter}
                    onChangeText={setStationPrinter}
                    placeholder="e.g. 66:32:04:AB:CD:12 or 192.168.1.150"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.modalFieldHint}>
                    Leave blank if this station uses central kitchen printer or KDS screen.
                  </Text>
                </View>

                {/* Display Order */}
                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalFieldLabel}>DISPLAY ORDER</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={stationOrder}
                    onChangeText={(t) => setStationOrder(t.replace(/[^0-9]/g, ''))}
                    placeholder="1"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.modalSaveBtn, stationActionLoading !== null && { opacity: 0.6 }]}
                  onPress={handleSaveStation}
                  disabled={stationActionLoading !== null}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalSaveGradient}
                  >
                    {stationActionLoading === (editingStationId ? `update_${editingStationId}` : 'create_station') ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Utensils size={14} color="#FFFFFF" />
                        <Text style={styles.modalSaveBtnText}>
                          {editingStationId ? 'Save Station Changes' : 'Create Kitchen Station'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 20, 16, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
    backgroundColor: '#FCFAF7',
  },
  modalHeaderTitleBox: {
    flex: 1,
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2B231D',
  },
  modalSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8C7A6B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5EFE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 18,
    gap: 16,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#8C7A6B',
    fontWeight: '600',
  },

  /* 1. STATUS HERO CARD */
  statusHeroCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EFEAE2',
  },
  statusHeroCardOpen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  statusHeroCardPaused: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusHeroCardClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDotBeacon: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#78716C',
  },
  statusDotBeaconOpen: {
    backgroundColor: '#17845A',
  },
  statusDotBeaconPaused: {
    backgroundColor: '#DE8626',
  },
  statusDotBeaconClosed: {
    backgroundColor: '#DC2626',
  },
  statusHeroTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#44403C',
    letterSpacing: 0.5,
    flex: 1,
  },
  statusHeroTitleOpen: {
    color: '#17845A',
  },
  statusHeroTitlePaused: {
    color: '#D97706',
  },
  statusHeroTitleClosed: {
    color: '#DC2626',
  },
  modeChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modeChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#78716C',
    letterSpacing: 0.3,
  },
  statusHeroMessage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#57534E',
    marginTop: 8,
    lineHeight: 17,
  },
  timingMetaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  timingMetaCol: {
    alignItems: 'center',
    flex: 1,
  },
  timingMetaLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.4,
  },
  timingMetaVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2B231D',
    marginTop: 2,
  },
  timingMetaDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E7E1DA',
  },

  /* SECTIONS */
  sectionContainer: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#5C4E3D',
    letterSpacing: 0.5,
  },
  sectionDesc: {
    fontSize: 11,
    color: '#78716C',
    lineHeight: 15,
  },

  /* TIMERS ROW */
  quickTimersRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  timerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFF0DE',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.35)',
  },
  timerBtnActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  timerBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#C66910',
  },

  /* ACTION BUTTONS */
  actionButtonsCol: {
    gap: 8,
    marginTop: 4,
  },
  resumePrimaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  resumeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  resumePrimaryBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  resumePrimaryBtnSub: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },
  manualCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF1F2',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  manualCloseBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  manualCloseBtnSub: {
    fontSize: 10,
    color: '#9F1239',
    marginTop: 1,
  },

  /* MODE SELECTOR */
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  modeOptionCard: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  modeOptionCardActive: {
    backgroundColor: '#FFFDF9',
    borderColor: '#DE8626',
    borderWidth: 1.5,
  },
  modeOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  modeOptionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#5C4E3D',
  },
  modeOptionTitleActive: {
    color: '#DE8626',
  },
  modeOptionDesc: {
    fontSize: 10,
    color: '#8C7A6B',
    lineHeight: 13,
  },

  /* SERVICE PROFILE SELECTOR */
  serviceProfileCol: {
    gap: 8,
    marginTop: 4,
  },
  profileOptionCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  profileOptionCardActive: {
    backgroundColor: '#FFFDF9',
    borderColor: '#DE8626',
    borderWidth: 1.5,
  },
  profileOptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  profileIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F5EFE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  profileIconBoxActive: {
    backgroundColor: '#FEF3E2',
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2B231D',
  },
  profileTitleActive: {
    color: '#DE8626',
  },
  profileBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#FEF3E2',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  profileBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#C66910',
    letterSpacing: 0.2,
  },
  profileDesc: {
    fontSize: 10.5,
    color: '#78716C',
    lineHeight: 14,
  },

  /* SHORTCUT */
  editHoursShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#F7F3EE',
    borderRadius: 10,
    marginTop: 4,
  },
  editHoursShortcutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78716C',
  },

  /* MODAL STATION CONTROLS */
  modalStationList: {
    gap: 8,
    marginTop: 4,
  },
  modalStationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    overflow: 'hidden',
  },
  modalStationColorBar: {
    width: 4,
  },
  modalStationCardBody: {
    flex: 1,
    padding: 8,
    gap: 6,
  },
  modalStationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalStationName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    maxWidth: 160,
  },
  modalStationCodeBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: '#FFFDF9',
  },
  modalStationCodeText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  modalStationStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modalStationStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  modalStationActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stationPillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stationPillBtnActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  stationPillBtnInactive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  stationPillBtnPaused: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  stationPillBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },

  /* KITCHEN LIVE STATUS CARD */
  kitchenLiveCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E7E1DA',
    gap: 12,
  },
  kitchenLiveCardActive: {
    backgroundColor: '#FFFDF9',
    borderColor: '#FDE68A',
  },
  kitchenLiveCardInactive: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  kitchenLiveHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  kitchenLiveIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  kitchenLiveIconBoxActive: {
    backgroundColor: '#FEF3C7',
  },
  kitchenLiveIconBoxInactive: {
    backgroundColor: '#E5E7EB',
  },
  kitchenLiveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'wrap',
  },
  kitchenLiveTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    flex: 1,
  },
  kitchenLiveTitleActive: {
    color: '#92400E',
  },
  kitchenLiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  kitchenLiveBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  kitchenLiveBadgeInactive: {
    backgroundColor: '#E5E7EB',
  },
  kitchenLiveBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#6B7280',
  },
  kitchenLiveBadgeTextActive: {
    color: '#15803D',
  },
  kitchenLiveBadgeTextInactive: {
    color: '#6B7280',
  },
  kitchenLiveDesc: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
    marginTop: 4,
  },
  kitchenLiveActionRow: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  kitchenLiveActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  kitchenLiveActionBtnActivate: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  kitchenLiveActionBtnDeactivate: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  kitchenLiveActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* OPERATIONAL EVENT AUDIT TRACKER */
  auditCard: {
    backgroundColor: '#FBF9F5',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFE7DC',
    marginBottom: 16,
    gap: 10,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  auditHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.8,
  },
  auditGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  auditItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F0ECE4',
    minWidth: '46%',
    flex: 1,
  },
  auditItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A89F91',
    textTransform: 'uppercase',
  },
  auditItemValue: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#292524',
    marginTop: 2,
  },
  auditItemSub: {
    fontSize: 10,
    color: '#78716C',
    marginTop: 1,
  },

  /* OPERATIONAL HISTORY ACCORDION */
  historyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  historyCountBadge: {
    backgroundColor: '#FED7AA',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  historyCountText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#9A3412',
  },
  historyContentBox: {
    marginTop: 10,
    gap: 10,
  },
  historyHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  historyRefreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DE8626',
  },
  historyLoadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  historyLoadingText: {
    fontSize: 11,
    color: '#8C7A6B',
  },
  historyEmptyBox: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  historyEmptyText: {
    fontSize: 11.5,
    color: '#A89F91',
    fontStyle: 'italic',
  },
  historyList: {
    gap: 8,
  },
  historyItemCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFEAE3',
    gap: 4,
  },
  historyItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  historyTimeText: {
    fontSize: 10,
    color: '#8C7A6B',
    fontWeight: '600',
  },
  historyRemarksText: {
    fontSize: 11.5,
    color: '#44403C',
    fontWeight: '600',
    marginTop: 2,
  },
  historyMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  historyMetaText: {
    fontSize: 10,
    color: '#78716C',
  },
  addStationHeaderPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DE8626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  addStationHeaderPillBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalStationEmptyBox: {
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EFEAE2',
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  modalStationEmptyTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2B231D',
    marginTop: 4,
  },
  modalStationEmptyDesc: {
    fontSize: 11,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 15,
    maxWidth: 280,
  },
  modalStationEmptyBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  modalStationEmptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DE8626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modalStationEmptyAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalStationEmptyDefaultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modalStationEmptyDefaultsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DE8626',
  },
  stationIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationBottomBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  stationBottomAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  stationBottomAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DE8626',
  },
  stationBottomResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#F7F3EE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  stationBottomResetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78716C',
  },
  stationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 20, 16, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  stationModalContent: {
    width: '100%',
    maxWidth: 440,
    maxHeight: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  stationModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
    backgroundColor: '#FCFAF7',
  },
  stationModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2B231D',
  },
  stationModalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5EFE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFieldGroup: {
    gap: 4,
    marginBottom: 12,
  },
  modalFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.4,
  },
  modalTextInput: {
    backgroundColor: '#FBF9F5',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#2B231D',
  },
  modalFieldHint: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  modalSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    marginBottom: 12,
  },
  modalSwitchTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#2B231D',
  },
  modalSwitchDesc: {
    fontSize: 10,
    color: '#78716C',
    marginTop: 2,
  },
  modalColorPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  modalColorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalColorDotSelected: {
    borderWidth: 2.5,
    borderColor: '#2B231D',
  },
  modalSaveBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
  },
  modalSaveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
