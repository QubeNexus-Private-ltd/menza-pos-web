import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  IndianRupee,
  ShoppingBag,
  Users,
  Utensils,
  LogOut,
  Sparkles,
  Shield,
  Layers,
  Activity,
  CreditCard,
  Settings,
  Globe,
  Store,
  Check,
  Crown,
  Zap,
  Lock,
  X,
  ChefHat,
  Flame,
  Plus,
  UserPlus,
  TrendingUp,
  Table,
  BadgeCheck,
  CheckCircle2,
  Gift,
  Sun,
  Moon,
  Smartphone,
  Printer,
  BarChart3,
  AlertTriangle,
  UtensilsCrossed,
  Truck,
  Wallet,
  Scale,
  FileText,
  ShieldCheck,
  Bell,
  BellRing,
  QrCode,
  Share2,
} from 'lucide-react-native';
import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { useTheme } from '../../../core/theme/ThemeContext';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuthStore } from '../../state/useAuthStore';
import { usePrinterStore } from '../../state/usePrinterStore';
import { useNotificationStore } from '../../state/useNotificationStore';
import { isCashierOnly } from '../../../core/auth/rolePermissions';
import { AuthRemoteDataSource } from '../../../data/datasources/AuthRemoteDataSource';
import { SubscriptionRemoteDataSource } from '../../../data/datasources/SubscriptionRemoteDataSource';
import { OrderRemoteDataSource } from '../../../data/datasources/OrderRemoteDataSource';
import { SuperAdminRemoteDataSource } from '../../../data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '../../../data/repositories/SuperAdminRepositoryImpl';
import { WalletRemoteDataSource } from '../../../data/datasources/WalletRemoteDataSource';
import { WalletRepositoryImpl } from '../../../data/repositories/WalletRepositoryImpl';
import { CashfreeSdkService } from '../../../data/datasources/CashfreeSdkService';
import { SubscriptionPlan, UserSubscriptionStatus } from '../../../domain/models/Subscription';
import { RestaurantTodayRevenue } from '../../../domain/models/Order';
import { PaymentProcessingScreen } from '../subscription/PaymentProcessingScreen';
import { MenuCatalogScreen } from '../catalog/MenuCatalogScreen';
import { FloorTableScreen } from '../tables/FloorTableScreen';
import { OrderPosScreen } from '../pos/OrderPosScreen';
import { StaffRoleScreen } from '../roles/StaffRoleScreen';
import { RestaurantConfigScreen } from '../config/RestaurantConfigScreen';
import { RestaurantBankAccountScreen } from '../config/RestaurantBankAccountScreen';
import { BluetoothPrinterScreen } from '../printer/BluetoothPrinterScreen';
import { SuperAdminOnboardingScreen } from '../superadmin/SuperAdminOnboardingScreen';
import { ActiveStoreDirectoryScreen } from '../superadmin/ActiveStoreDirectoryScreen';
import { PlanCreatorScreen } from '../superadmin/PlanCreatorScreen';
import { BusinessReportsScreen } from '../reports/BusinessReportsScreen';
import { BottomNavigationBar, NavTabKey } from '../../components/BottomNavigationBar';
import { WalletBalanceWidget } from '../../components/WalletBalanceWidget';
import { WalletRechargeModal } from '../../components/WalletRechargeModal';
import { WalletEvents } from '../../../core/utils/walletEvents';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { TodayOrdersModal } from './TodayOrdersModal';
import { OrderNotificationModal } from './OrderNotificationModal';
import { OrderAlertBanner } from '../../components/OrderAlertBanner';
import { TermsAndConditionsModal } from '../legal/TermsAndConditionsModal';
import { TermsConsentCard } from '../../components/TermsConsentCard';
import { NetworkStrengthIndicator } from '../../components/NetworkStrengthIndicator';
import { RestaurantQrModal } from '../../components/RestaurantQrModal';
import { StoreOperatingStatusModal } from '../../components/StoreOperatingStatusModal';
import { StoreOperatingStatus } from '../../../domain/models/RestaurantConfig';
import { RestaurantConfigRemoteDataSource } from '../../../data/datasources/RestaurantConfigRemoteDataSource';
import { logger } from '../../../core/logging';
import {
  startPosSignalRConnection,
  onStoreOperatingStatusChanged,
  onPosOrderCreated,
  onPosOrderSettled,
  onPosOrderStatusChanged,
  onSignalRReconnected,
} from '../../../core/network/signalrService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const authRemoteDataSource = new AuthRemoteDataSource();
const walletRepository = new WalletRepositoryImpl(new WalletRemoteDataSource());
const configRemoteDataSource = new RestaurantConfigRemoteDataSource();

const HomeDashboardSkeleton: React.FC = () => (
  <View style={styles.homeSkeletonContainer}>
    {/* 1. Hero Overview Card Skeleton */}
    <View style={styles.heroSkeletonCard}>
      {/* Top Header Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <SkeletonLoader width={140} height={20} borderRadius={6} style={styles.skeletonBg} />
        <SkeletonLoader width={70} height={14} borderRadius={4} style={styles.skeletonBg} />
      </View>

      {/* Revenue Amount Block */}
      <SkeletonLoader width={90} height={11} borderRadius={4} style={styles.skeletonBg} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
        <SkeletonLoader width={160} height={34} borderRadius={8} style={styles.skeletonBg} />
        <SkeletonLoader width={80} height={22} borderRadius={6} style={styles.skeletonBg} />
      </View>
      <SkeletonLoader width="70%" height={12} borderRadius={4} style={styles.skeletonBg} />

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#E7E1DA', marginVertical: 12 }} />

      {/* Triplet Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <SkeletonLoader width={60} height={12} borderRadius={4} style={styles.skeletonBg} />
          <SkeletonLoader width={45} height={14} borderRadius={4} style={styles.skeletonBg} />
        </View>
        <View style={{ width: 1, height: 24, backgroundColor: '#E7E1DA' }} />
        <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <SkeletonLoader width={50} height={12} borderRadius={4} style={styles.skeletonBg} />
          <SkeletonLoader width={45} height={14} borderRadius={4} style={styles.skeletonBg} />
        </View>
        <View style={{ width: 1, height: 24, backgroundColor: '#E7E1DA' }} />
        <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <SkeletonLoader width={50} height={12} borderRadius={4} style={styles.skeletonBg} />
          <SkeletonLoader width={45} height={14} borderRadius={4} style={styles.skeletonBg} />
        </View>
      </View>
    </View>

    {/* 2. Section Title Skeleton */}
    <SkeletonLoader width={100} height={13} borderRadius={4} style={[styles.skeletonBg, { marginBottom: 10, marginTop: 4 }]} />

    {/* 3. Quick Access 2x2 Grid Skeleton */}
    <View style={styles.quickGrid4}>
      {[1, 2, 3, 4].map((idx) => (
        <View key={`quick-skel-${idx}`} style={styles.quickCardSkeleton}>
          <SkeletonLoader width={38} height={38} borderRadius={10} style={styles.skeletonBg} />
          <SkeletonLoader width={80} height={14} borderRadius={4} style={[styles.skeletonBg, { marginTop: 8 }]} />
          <SkeletonLoader width="90%" height={10} borderRadius={4} style={[styles.skeletonBg, { marginTop: 4 }]} />
        </View>
      ))}
    </View>

    {/* 4. Store Operations Shortcuts Skeleton */}
    <SkeletonLoader width={120} height={13} borderRadius={4} style={[styles.skeletonBg, { marginBottom: 10, marginTop: 4 }]} />
    <View style={styles.mgmtSkeletonContainer}>
      {[1, 2, 3, 4].map((idx) => (
        <View key={`mgmt-skel-${idx}`} style={styles.mgmtSkeletonRow}>
          <SkeletonLoader width={32} height={32} borderRadius={8} style={styles.skeletonBg} />
          <View style={{ flex: 1, gap: 4, marginLeft: 10 }}>
            <SkeletonLoader width="50%" height={13} borderRadius={4} style={styles.skeletonBg} />
            <SkeletonLoader width="75%" height={10} borderRadius={4} style={styles.skeletonBg} />
          </View>
          <SkeletonLoader width={14} height={14} borderRadius={4} style={styles.skeletonBg} />
        </View>
      ))}
    </View>
  </View>
);

export const AdminDashboardScreen: React.FC = () => {
  const { user, activeRestaurant, restaurants, setRestaurants, setActiveRestaurant, logout } = useAuthStore();
  const { mode, setMode, theme, isDark } = useTheme();
  const { connectedDevice, init: initPrinter } = usePrinterStore();
  const subscriptionDataSource = useMemo(() => new SubscriptionRemoteDataSource(), []);
  const orderRemoteDataSource = useMemo(() => new OrderRemoteDataSource(), []);
  const superAdminRepository = useMemo(() => new SuperAdminRepositoryImpl(new SuperAdminRemoteDataSource()), []);

  const [activeTab, setActiveTab] = useState<NavTabKey>('dashboard');
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [loadingMyRestaurants, setLoadingMyRestaurants] = useState(false);

  useEffect(() => {
    logger.navigation('AdminDashboardScreen');
    initPrinter();
  }, [initPrinter]);

  // Subscription Lock & Plan Selector State
  const [activeSubscription, setActiveSubscription] = useState<UserSubscriptionStatus | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState<boolean>(true);
  const [planSelectionModalVisible, setPlanSelectionModalVisible] = useState<boolean>(false);
  const [walletModalVisible, setWalletModalVisible] = useState<boolean>(false);
  const [walletModalTab, setWalletModalTab] = useState<'recharge' | 'history'>('recharge');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [subscribingId, setSubscribingId] = useState<number | null>(null);
  const [processingOrder, setProcessingOrder] = useState<{
    orderId: string;
    planName: string;
    amount: number;
    restaurantId: number;
    subscriptionConfigurationId: number;
  } | null>(null);

  // Dynamic Live Metrics State for Restaurant Operations & SuperAdmin Telemetry
  const [totalStoresCount, setTotalStoresCount] = useState<number>(0);
  const [mrrAmount, setMrrAmount] = useState<number>(0);
  const [todayRevenue, setTodayRevenue] = useState<number>(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState<number>(0);
  const [todayRevenueData, setTodayRevenueData] = useState<RestaurantTodayRevenue | null>(null);
  const [loadingRevenue, setLoadingRevenue] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [todayOrdersModalVisible, setTodayOrdersModalVisible] = useState<boolean>(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState<boolean>(false);
  const [termsModalVisible, setTermsModalVisible] = useState<boolean>(false);
  const [restaurantQrModalVisible, setRestaurantQrModalVisible] = useState<boolean>(false);
  const [operatingStatus, setOperatingStatus] = useState<StoreOperatingStatus | null>(null);
  const [operatingStatusModalVisible, setOperatingStatusModalVisible] = useState<boolean>(false);
  const [selectedTableForPos, setSelectedTableForPos] = useState<{
    tableId?: number;
    tableNumber?: string;
    sectionName?: string;
  } | null>(null);

  const roleName = user?.roles?.[0] || 'Owner';
  const isSuperAdmin = user?.roles?.some((r) =>
    ['SUPERADMIN', 'SUPER_ADMIN', 'SUPERADMINONLY'].includes(r.toUpperCase().replace(/[^A-Z]/g, ''))
  ) || Boolean(roleName && roleName.toLowerCase().includes('superadmin'));
  const isCashier = isCashierOnly(user, activeRestaurant);
  const roleColor = (Colors.roles as any)[roleName] || '#DE8626';

  const displayName = user?.name && user.name.trim().length > 0
    ? user.name
    : user?.mobile
    ? user.mobile
    : isSuperAdmin
    ? 'SuperAdmin'
    : isCashier
    ? 'Store Cashier'
    : 'Restaurant Owner';

  // Global Notification Store for Order Chimes & Bell Icon
  const { unreadCount, processIncomingOrders } = useNotificationStore();

  const pollRecentOrders = useCallback(async (restId: number) => {
    if (!restId || restId <= 0 || isSuperAdmin) return;
    try {
      const res = await orderRemoteDataSource.getTodayOrders(restId, 'ALL', 1, 20);
      if (res?.items && res.items.length > 0) {
        processIncomingOrders(res.items);
      }
    } catch {
      // background poll fail safe
    }
  }, [orderRemoteDataSource, isSuperAdmin, processIncomingOrders]);

  const fetchOperatingStatus = useCallback(async (restId: number) => {
    if (!restId || restId <= 0 || isSuperAdmin) return;
    try {
      const res = await configRemoteDataSource.getOperatingStatus(restId);
      if (res) {
        setOperatingStatus(res);
      }
    } catch {
      // ignore
    }
  }, [isSuperAdmin]);

  // SuperAdmin Platform Telemetry (Outlets count & Monthly Recurring Revenue)
  const fetchSuperAdminMetrics = useCallback(async () => {
    try {
      setLoadingRevenue(true);
      const [restResult, subList, planList] = await Promise.all([
        superAdminRepository.getAllRestaurants(undefined, undefined, undefined, undefined, 1, 1000),
        subscriptionDataSource.getAllRestaurantSubscriptions(),
        subscriptionDataSource.getPlans(),
      ]);

      const totalCount = restResult?.totalCount ?? (Array.isArray(restResult?.items) ? restResult.items.length : 0);
      setTotalStoresCount(totalCount);

      // Calculate Monthly Recurring Revenue (MRR)
      let totalMrr = 0;
      if (Array.isArray(subList) && subList.length > 0) {
        subList.forEach((sub: any) => {
          const status = (sub.status || sub.Status || '').toUpperCase();
          if (status === 'ACTIVE' || status === 'SUCCESS' || status === 'PAID') {
            const price = Number(sub.finalPrice ?? sub.FinalPrice ?? sub.price ?? sub.Price ?? 0);
            const duration = Number(sub.durationInDays ?? sub.DurationInDays ?? 30);
            const cycle = (sub.billingCycle || sub.BillingCycle || '').toUpperCase();

            if (cycle === 'ANNUALLY' || duration >= 300) {
              totalMrr += price / 12;
            } else if (cycle === 'HALFYEARLY' || duration >= 150) {
              totalMrr += price / 6;
            } else if (cycle === 'QUARTERLY' || duration >= 75) {
              totalMrr += price / 3;
            } else {
              totalMrr += price;
            }
          }
        });
      }

      // Fallback: If no restaurant subscriptions exist in DB yet, compute potential MRR from active plans and stores
      if (totalMrr === 0 && totalCount > 0 && Array.isArray(planList) && planList.length > 0) {
        const activePlans = planList.filter((p) => p.isActive);
        if (activePlans.length > 0) {
          const avgPlanPrice =
            activePlans.reduce(
              (sum, p) =>
                sum +
                (p.finalPrice || p.price || 0) /
                  (p.durationInDays === 365 ? 12 : p.durationInDays === 180 ? 6 : p.durationInDays === 90 ? 3 : 1),
              0
            ) / activePlans.length;
          totalMrr = Math.round(avgPlanPrice * totalCount);
        }
      }

      setMrrAmount(Math.round(totalMrr));
    } catch (err) {
      console.warn('Failed to load SuperAdmin metrics via API', err);
    } finally {
      setLoadingRevenue(false);
      setLoadingSubscription(false);
    }
  }, [superAdminRepository, subscriptionDataSource]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSuperAdminMetrics();
    } else {
      fetchUserRestaurants();
    }
  }, [isSuperAdmin, fetchSuperAdminMetrics]);

  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const fetchTodayRevenueData = useCallback(async (restId: number, isSilent = false) => {
    if (!restId || restId <= 0) {
      setTodayRevenue(0);
      setTotalOrdersCount(0);
      setTodayRevenueData(null);
      if (!isSilent) setLoadingRevenue(false);
      return;
    }
    try {
      if (!isSilent) setLoadingRevenue(true);
      logger.action('POS', 'FETCH_TODAY_REVENUE', `Fetching today revenue for restaurant #${restId}`);
      const data = await orderRemoteDataSource.getTodayRevenue(restId);
      if (data) {
        setTodayRevenueData(data);
        setTodayRevenue(Number(data.todayRevenue || 0));
        setTotalOrdersCount(Number(data.activeOrdersCount ?? data.todayOrdersCount ?? 0));
        logger.action('POS', 'REVENUE_FETCHED', `Loaded today revenue: ₹${data.todayRevenue}, active orders: ${data.activeOrdersCount}`);
      }
    } catch (err: any) {
      logger.api('API_ERROR', `Failed to fetch today revenue for restaurant #${restId}`, { error: err?.message });
    } finally {
      if (!isSilent) setLoadingRevenue(false);
    }
  }, [orderRemoteDataSource]);

  const fetchWalletBalance = useCallback(async (restId: number) => {
    if (!restId || restId <= 0) {
      setWalletBalance(null);
      return;
    }
    try {
      const data = await walletRepository.getWallet(restId);
      if (data) {
        setWalletBalance(data.balance);
      }
    } catch {
      // fail safe
    }
  }, []);

  // Initial load when current restaurant or SuperAdmin status changes
  useEffect(() => {
    if (!isSuperAdmin) {
      if (currentRestId > 0) {
        fetchSubscriptionData(currentRestId);
        fetchTodayRevenueData(currentRestId, false);
        fetchWalletBalance(currentRestId);
      } else {
        setActiveSubscription(null);
        setLoadingSubscription(false);
        setLoadingRevenue(false);
        setTodayRevenue(0);
        setTotalOrdersCount(0);
        setTodayRevenueData(null);
        setWalletBalance(null);
      }
    } else {
      fetchSuperAdminMetrics();
    }

    const unsubscribe = WalletEvents.subscribe(() => {
      if (currentRestId > 0) {
        fetchWalletBalance(currentRestId);
      }
    });

    return unsubscribe;
  }, [currentRestId, isSuperAdmin, fetchTodayRevenueData, fetchWalletBalance, fetchSuperAdminMetrics]);

  // Real-time Event-Driven SignalR Connection & Push Notification Listeners (Zero Timers)
  useEffect(() => {
    if (isSuperAdmin || !currentRestId || currentRestId <= 0) return;

    // 1. Connect SignalR WebSocket Hub for sub-second real-time notifications
    startPosSignalRConnection(currentRestId);

    // 2. Initial state sync on screen mount / restaurant change
    fetchTodayRevenueData(currentRestId, true);
    fetchOperatingStatus(currentRestId);
    pollRecentOrders(currentRestId);

    // 3. Listen for store operating status updates (open/pause/closed)
    const unsubscribeStatus = onStoreOperatingStatusChanged((data) => {
      if (data) {
        setOperatingStatus(data);
      }
    });

    // 4. Listen for real-time order creation (instantly refreshes metrics without redundant HTTP polling)
    const unsubscribeCreated = onPosOrderCreated(() => {
      fetchTodayRevenueData(currentRestId, true);
    });

    // 5. Listen for order settlement (immediately refreshes revenue & wallet balance)
    const unsubscribeSettled = onPosOrderSettled(() => {
      fetchTodayRevenueData(currentRestId, true);
      fetchWalletBalance(currentRestId);
    });

    // 6. Listen for general order status updates (cooking, ready, delivered)
    const unsubscribeOrderStatus = onPosOrderStatusChanged(() => {
      fetchTodayRevenueData(currentRestId, true);
    });

    // 7. Auto Catch-Up Sync upon Network Reconnect (e.g. Wi-Fi drops & reconnects)
    const unsubscribeReconnect = onSignalRReconnected(() => {
      fetchTodayRevenueData(currentRestId, true);
      fetchOperatingStatus(currentRestId);
      fetchWalletBalance(currentRestId);
      pollRecentOrders(currentRestId);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeCreated();
      unsubscribeSettled();
      unsubscribeOrderStatus();
      unsubscribeReconnect();
    };
  }, [currentRestId, isSuperAdmin, fetchTodayRevenueData, fetchOperatingStatus, fetchWalletBalance, pollRecentOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isSuperAdmin) {
        await fetchSuperAdminMetrics();
      } else {
        await fetchUserRestaurants();
        if (currentRestId > 0) {
          await Promise.all([
            fetchSubscriptionData(currentRestId),
            fetchTodayRevenueData(currentRestId, true),
            fetchWalletBalance(currentRestId),
            fetchOperatingStatus(currentRestId),
            pollRecentOrders(currentRestId),
          ]);
        }
      }
    } catch (err) {
      console.warn('Pull-to-refresh error on dashboard', err);
    } finally {
      setRefreshing(false);
    }
  }, [isSuperAdmin, fetchSuperAdminMetrics, currentRestId, fetchTodayRevenueData, fetchWalletBalance, pollRecentOrders]);

  const fetchUserRestaurants = async () => {
    try {
      setLoadingMyRestaurants(true);
      const userRestList = await authRemoteDataSource.getMyRestaurants();
      if (Array.isArray(userRestList) && userRestList.length > 0) {
        setRestaurants(userRestList);
        const resolvedId = activeRestaurant?.restaurantId || userRestList[0]?.restaurantId;
        if (resolvedId && resolvedId > 0) {
          fetchSubscriptionData(resolvedId);
          fetchTodayRevenueData(resolvedId, true);
        }
      }
    } catch (err) {
      console.warn('Could not fetch user restaurants list via API', err);
    } finally {
      setLoadingMyRestaurants(false);
    }
  };

  const fetchSubscriptionData = async (restId: number) => {
    try {
      setLoadingSubscription(true);
      const sub = await subscriptionDataSource.getRestaurantSubscription(restId);
      setActiveSubscription(sub);
      if (!sub || sub.isExpired || (sub.daysRemaining ?? 0) <= 0) {
        if (!isCashier) {
          loadSubscriptionPlans();
          setPlanSelectionModalVisible(true);
        }
      }
    } catch {
      setActiveSubscription(null);
      if (!isCashier) {
        loadSubscriptionPlans();
        setPlanSelectionModalVisible(true);
      }
    } finally {
      setLoadingSubscription(false);
    }
  };

  const loadSubscriptionPlans = async () => {
    try {
      const plans = await subscriptionDataSource.getPlans();
      setAvailablePlans(plans.filter((p) => p.isActive));
    } catch {
      // fallback
    }
  };

  const handleActivatePlan = async (plan: SubscriptionPlan) => {
    if (!currentRestId) {
      Alert.alert('Selection Error', 'Please select a restaurant location first.');
      return;
    }

    const finalPrice = plan.finalPrice ?? Math.max(0, plan.price - (plan.discountAmount || 0));

    const executePayment = async () => {
      try {
        setSubscribingId(plan.id);

        const payRes = await subscriptionDataSource.initiateCashFreePayment(
          currentRestId,
          plan.id,
          finalPrice,
          user?.mobile || '9999999999'
        );

        if (!payRes.success || !payRes.orderId) {
          Alert.alert('CashFree Payment Error', payRes.message || 'Could not initiate CashFree payment checkout.');
          return;
        }

        setPlanSelectionModalVisible(false);
        setProcessingOrder({
          orderId: payRes.orderId,
          planName: plan.subscriptionName || plan.planName || 'Restaurant Plan',
          amount: finalPrice,
          restaurantId: currentRestId,
          subscriptionConfigurationId: plan.id,
        });

        CashfreeSdkService.getInstance().startPayment({
          orderId: payRes.orderId,
          paymentSessionId: payRes.paymentSessionId || '',
          paymentLink: payRes.instrumentResponseUrl || '',
          environment: 'SANDBOX',
        }).catch((sdkErr) => {
          console.warn('CashFree Native SDK execution note:', sdkErr);
        });
      } catch (err: any) {
        Alert.alert('Payment Exception', err?.message || 'Failed to initiate CashFree PG payment.');
      } finally {
        setSubscribingId(null);
      }
    };

    // If an active subscription exists, inform the owner about renewal vs mid-cycle switch
    if (activeSubscription && !activeSubscription.isExpired && activeSubscription.daysRemaining > 0) {
      const isSamePlan = activeSubscription.subscriptionConfigurationId === plan.id;
      if (isSamePlan) {
        Alert.alert(
          'Renew Subscription Plan 🔄',
          `Renewing "${plan.subscriptionName || plan.planName}" will add ${plan.durationDays || plan.durationInDays || 30} days onto your current expiry date (${new Date(activeSubscription.endDate).toLocaleDateString()}). No days will be lost.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: `Renew & Pay ₹${finalPrice.toLocaleString()}`, onPress: executePayment }
          ]
        );
      } else {
        Alert.alert(
          'Switch Subscription Plan ⚡',
          `Switching to "${plan.subscriptionName || plan.planName}" will start immediately today. The remaining ${activeSubscription.daysRemaining} days of your current plan will be prorated and refunded directly to your Store Wallet.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: `Switch & Pay ₹${finalPrice.toLocaleString()}`, onPress: executePayment }
          ]
        );
      }
      return;
    }

    await executePayment();
  };

  const hasActiveSub = isSuperAdmin || (!!activeSubscription && !activeSubscription.isExpired && activeSubscription.daysRemaining > 0);

  const checkEntitlement = (key: string): boolean => {
    if (isSuperAdmin) return true;
    if (!hasActiveSub || !activeSubscription) return false;
    const entitlements = activeSubscription.entitlements || [];
    if (!Array.isArray(entitlements) || entitlements.length === 0) return false;
    const ent: any = entitlements.find((e: any) => (e.configKey || e.ConfigKey || '').toLowerCase() === key.toLowerCase());
    return ent ? Boolean(ent.isAllowed ?? ent.IsAllowed) : false;
  };

  // Core ordering flows (Counter ordering & Table floor) are NEVER blocked by subscription
  const isTableOrderingAllowed = true;
  const isTableOrderingActive = operatingStatus?.businessProfile !== 'QSR_CAFE';
  const isCounterOrderingAllowed = true;
  // Feature-gated by subscription plan
  const isKdsAllowed = checkEntitlement('IsKdsEnabled');
  const isSmsAllowed = checkEntitlement('IsSmsNotificationsEnabled');
  const isPosAndCounterOrderingAllowed = true;

  const handleTabChange = (tab: NavTabKey) => {
    // POS billing, table ordering, menus, and management are NEVER blocked by subscription
    setActiveTab(tab);
  };

  const handleModulePress = (moduleKey: 'catalog' | 'tables' | 'pos' | 'roles' | 'config' | 'reports', isFeatureAllowed: boolean = true) => {
    logger.action('NAVIGATION', 'DASHBOARD_MODULE_OPENED', `Opened dashboard module: ${moduleKey}`, { moduleKey });
    setActiveTab(moduleKey as NavTabKey);
  };

  const renderSettingsHub = () => (
    <ScrollView style={styles.settingsHubScroll} showsVerticalScrollIndicator={false}>
      {/* Settings Top Header */}
      <View style={styles.settingsHeader}>
        <View style={styles.settingsIconCircle}>
          <Settings size={22} color="#DE8626" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingsTitle}>
            {isSuperAdmin ? 'SuperAdmin Control Hub' : 'Settings & Management'}
          </Text>
          <Text style={styles.settingsSub}>
            {isSuperAdmin ? 'Platform master controls, governance & session' : 'Manage staff, outlet settings, and subscription'}
          </Text>
        </View>
      </View>

      {isSuperAdmin ? (
        <>
          {/* Master Profile Hero Card */}
          <View style={styles.saSettingsProfileCard}>
            <LinearGradient
              colors={['#2D2319', '#3D2F20', '#1F1811']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saSettingsProfileGradient}
            >
              <View style={styles.saSettingsProfileTop}>
                <View style={styles.saSettingsAvatarBox}>
                  <Crown size={22} color="#FEA619" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.saSettingsBadgeRow}>
                    <View style={styles.saSettingsMasterBadge}>
                      <BadgeCheck size={11} color="#FEA619" />
                      <Text style={styles.saSettingsMasterBadgeText}>SUPERADMIN MASTER</Text>
                    </View>
                    <View style={styles.saSettingsLiveBadge}>
                      <View style={styles.saSettingsLiveDot} />
                      <Text style={styles.saSettingsLiveText}>API ACTIVE</Text>
                    </View>
                  </View>
                  <Text style={styles.saSettingsProfileName}>{displayName}</Text>
                  <Text style={styles.saSettingsProfileMobile}>
                    {user?.mobile ? `+91 ${user.mobile}` : 'Platform Root Administrator'}
                  </Text>
                </View>
              </View>

              <View style={styles.saSettingsTelemetryRow}>
                <View style={styles.saSettingsTelemItem}>
                  <Text style={styles.saSettingsTelemLabel}>PLATFORM OUTLETS</Text>
                  <Text style={styles.saSettingsTelemVal}>{totalStoresCount}</Text>
                  <Text style={styles.saSettingsTelemSub}>Active Stores</Text>
                </View>
                <View style={styles.saSettingsTelemDivider} />
                <View style={styles.saSettingsTelemItem}>
                  <Text style={styles.saSettingsTelemLabel}>SAAS MRR</Text>
                  <Text style={styles.saSettingsTelemVal}>₹{mrrAmount.toLocaleString('en-IN')}</Text>
                  <Text style={styles.saSettingsTelemSub}>Monthly Recurring</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <Text style={styles.settingsSectionHeading}>PLATFORM GOVERNANCE & TOOLS</Text>

          {/* Outlets Directory Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setActiveTab('directory')}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsTileIconBox, { backgroundColor: '#FFF0DE' }]}>
              <Store size={20} color="#DE8626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTileTitle}>Active Stores Directory</Text>
              <Text style={styles.settingsTileDesc}>
                {totalStoresCount > 0
                  ? `${totalStoresCount} Platform Stores • Channel toggles & config`
                  : 'Manage stores, channels & operating modes'}
              </Text>
            </View>
            <View style={styles.saActionPill}>
              <Text style={styles.saActionPillText}>MANAGE</Text>
            </View>
          </TouchableOpacity>

          {/* Onboard Outlet Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setActiveTab('superadmin')}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsTileIconBox, { backgroundColor: '#E4F5EC' }]}>
              <UserPlus size={20} color="#17845A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTileTitle}>Onboard Restaurant Outlet</Text>
              <Text style={styles.settingsTileDesc}>3-Stage wizard to provision new store and admin user</Text>
            </View>
            <View style={[styles.saActionPill, { backgroundColor: '#E4F5EC', borderColor: 'rgba(23, 132, 90, 0.3)' }]}>
              <Text style={[styles.saActionPillText, { color: '#17845A' }]}>+ ONBOARD</Text>
            </View>
          </TouchableOpacity>

          {/* Subscription Plans Creator Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setActiveTab('planCreator')}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsTileIconBox, { backgroundColor: '#FFF3DC' }]}>
              <Crown size={20} color="#E58B24" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTileTitle}>Subscription Plans & Pricing</Text>
              <Text style={styles.settingsTileDesc}>Configure SaaS tiers, discounts, and order commission splits</Text>
            </View>
            <View style={[styles.saActionPill, { backgroundColor: '#FFF3DC', borderColor: 'rgba(229, 139, 36, 0.3)' }]}>
              <Text style={[styles.saActionPillText, { color: '#D96B14' }]}>BUILDER</Text>
            </View>
          </TouchableOpacity>

          {/* Reports & Analytics Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setActiveTab('reports')}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsTileIconBox, { backgroundColor: '#EFF6FF' }]}>
              <BarChart3 size={20} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTileTitle}>Reports & Business Analytics</Text>
              <Text style={styles.settingsTileDesc}>Aggregated sales trends, rush heatmaps, and order metrics</Text>
            </View>
            <View style={[styles.saActionPill, { backgroundColor: '#EFF6FF', borderColor: 'rgba(37, 99, 235, 0.3)' }]}>
              <Text style={[styles.saActionPillText, { color: '#2563EB' }]}>VIEW</Text>
            </View>
          </TouchableOpacity>

          {/* Bluetooth Thermal Printer Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setActiveTab('printer')}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsTileIconBox, { backgroundColor: '#F3E8FF' }]}>
              <Printer size={20} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTileTitle}>Bluetooth Receipt Printer</Text>
              <Text style={styles.settingsTileDesc}>
                {connectedDevice
                  ? `Connected: ${connectedDevice.name || 'Mobile Printer'}`
                  : 'Scan & pair ESC/POS thermal printers for testing receipts'}
              </Text>
            </View>
            <View style={[styles.saActionPill, connectedDevice ? { backgroundColor: '#E4F5EC', borderColor: 'rgba(23, 132, 90, 0.3)' } : { backgroundColor: '#F3E8FF', borderColor: 'rgba(124, 58, 237, 0.3)' }]}>
              <Text style={[styles.saActionPillText, { color: connectedDevice ? '#17845A' : '#7C3AED' }]}>
                {connectedDevice ? 'CONNECTED' : 'PAIR'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Platform Rules & Regulations / Legal Terms Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setTermsModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsTileIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Scale size={20} color="#D96B14" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTileTitle}>Terms & Conditions, Rules & Regulations</Text>
              <Text style={styles.settingsTileDesc}>20 official legal articles • Compliance, policies & liability</Text>
            </View>
            <View style={[styles.saActionPill, { backgroundColor: '#FFF7ED', borderColor: 'rgba(217, 107, 20, 0.3)' }]}>
              <Text style={[styles.saActionPillText, { color: '#D96B14' }]}>LEGAL</Text>
            </View>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Active Outlet Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setRestModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.settingsTileIconBox}>
              <Building2 size={20} color="#DE8626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTileTitle}>
                {activeRestaurant?.restaurantName || 'Select Restaurant Outlet'}
              </Text>
              <Text style={styles.settingsTileDesc}>
                Tap to switch location
              </Text>
            </View>
            <ChevronDown size={16} color="#8C7A6B" />
          </TouchableOpacity>

          <Text style={styles.settingsSectionHeading}>STORE OPERATIONS</Text>

          {/* Staff & Roles Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setActiveTab('roles')}
            activeOpacity={0.8}
          >
            <View style={styles.settingsTileIconBox}>
              <Users size={20} color="#DE8626" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.settingsTileTitle}>Staff Members & Permissions</Text>
                {isCashier && (
                  <View style={styles.viewOnlyPill}>
                    <Text style={styles.viewOnlyPillText}>VIEW ONLY</Text>
                  </View>
                )}
              </View>
              <Text style={styles.settingsTileDesc}>
                {isCashier
                  ? 'View team directory and active shift schedules'
                  : 'Assign roles, cashier logins, and access keys'}
              </Text>
            </View>
            <ChevronRight size={16} color="#8C7A6B" />
          </TouchableOpacity>

          {/* Restaurant Configuration Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setActiveTab('config')}
            activeOpacity={0.8}
          >
            <View style={styles.settingsTileIconBox}>
              <Store size={20} color="#DE8626" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.settingsTileTitle}>Store Configuration</Text>
                {isCashier && (
                  <View style={styles.viewOnlyPill}>
                    <Text style={styles.viewOnlyPillText}>VIEW ONLY</Text>
                  </View>
                )}
              </View>
              <Text style={styles.settingsTileDesc}>
                {isCashier
                  ? 'View store profile, GSTIN, tax rates, and address'
                  : 'Taxes, GSTIN, receipt templates, and kitchen notes'}
              </Text>
            </View>
            <ChevronRight size={16} color="#8C7A6B" />
          </TouchableOpacity>

          {/* Kitchen Live Status & Operating Controls Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setOperatingStatusModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsTileIconBox, { backgroundColor: '#FEF3C7' }]}>
              <ChefHat size={20} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.settingsTileTitle}>Kitchen Live Status & Controls</Text>
                <View
                  style={[
                    styles.saActionPill,
                    operatingStatus?.isKitchenActive === false
                      ? { backgroundColor: '#F3F4F6', borderColor: 'rgba(107, 114, 128, 0.3)' }
                      : { backgroundColor: '#DCFCE7', borderColor: 'rgba(22, 163, 74, 0.3)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.saActionPillText,
                      { color: operatingStatus?.isKitchenActive === false ? '#6B7280' : '#16A34A' },
                    ]}
                  >
                    {operatingStatus?.isKitchenActive === false ? 'SIMPLIFIED' : 'LIVE KDS'}
                  </Text>
                </View>
              </View>
              <Text style={styles.settingsTileDesc}>
                Create stations, active/deactivate preparation lines, rush pause & tracking
              </Text>
            </View>
            <ChevronRight size={16} color="#8C7A6B" />
          </TouchableOpacity>

          {/* Bank Account & Direct QR Settlements Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setActiveTab('bankAccount')}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsTileIconBox, { backgroundColor: '#E4F5EC' }]}>
              <CreditCard size={20} color="#17845A" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.settingsTileTitle}>Bank Account & QR Payouts</Text>
                <View style={[styles.saActionPill, { backgroundColor: '#E4F5EC', borderColor: 'rgba(23, 132, 90, 0.3)' }]}>
                  <Text style={[styles.saActionPillText, { color: '#17845A' }]}>100% PAYOUT</Text>
                </View>
              </View>
              <Text style={styles.settingsTileDesc}>
                {isCashier
                  ? 'View linked bank account for 100% direct QR order settlements'
                  : 'Link bank account for 100% direct payouts via Cashfree Easy Split'}
              </Text>
            </View>
            <ChevronRight size={16} color="#8C7A6B" />
          </TouchableOpacity>

          {/* Reports & Analytics Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setActiveTab('reports')}
            activeOpacity={0.8}
          >
            <View style={styles.settingsTileIconBox}>
              <BarChart3 size={20} color="#DE8626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTileTitle}>Reports & Business Analytics</Text>
              <Text style={styles.settingsTileDesc}>Sales trends, rush heatmaps, and best-selling dishes</Text>
            </View>
            <ChevronRight size={16} color="#8C7A6B" />
          </TouchableOpacity>

          {/* Bluetooth Thermal Printer Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setActiveTab('printer')}
            activeOpacity={0.8}
          >
            <View style={styles.settingsTileIconBox}>
              <Printer size={20} color="#DE8626" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.settingsTileTitle}>Bluetooth Receipt Printer</Text>
                {connectedDevice ? (
                  <View style={styles.connectedBadgePill}>
                    <View style={styles.connectedBadgeDot} />
                    <Text style={styles.connectedBadgePillText}>CONNECTED</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.settingsTileDesc}>
                {connectedDevice
                  ? `Connected: ${connectedDevice.name || 'Mobile Printer'}`
                  : 'Scan & pair ESC/POS thermal printers for auto-receipts'}
              </Text>
            </View>
            <ChevronRight size={16} color="#8C7A6B" />
          </TouchableOpacity>

          {/* Commission Wallet & Transactions Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => {
              setWalletModalTab('history');
              setWalletModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.settingsTileIconBox}>
              <Wallet size={20} color="#DE8626" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.settingsTileTitle}>Commission Wallet & Transactions</Text>
              </View>
              <Text style={styles.settingsTileDesc}>
                {walletBalance !== null
                  ? `Balance: ₹${walletBalance.toLocaleString('en-IN')} • View ledger, statement & history`
                  : 'View prepaid balance, order deductions & top-ups'}
              </Text>
            </View>
            <ChevronRight size={16} color="#8C7A6B" />
          </TouchableOpacity>

          {/* Restaurant QR Code & Standee Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setRestaurantQrModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsTileIconBox, { backgroundColor: '#FFF0DE' }]}>
              <QrCode size={20} color="#D96B14" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTileTitle}>Generate Restaurant QR & Standee</Text>
              <Text style={styles.settingsTileDesc}>Share QR code with marketing taglines or export printable PDF</Text>
            </View>
            <ChevronRight size={16} color="#8C7A6B" />
          </TouchableOpacity>

          {/* Rules & Regulations / Terms Tile */}
          <TouchableOpacity
            style={styles.settingsTileCard}
            onPress={() => setTermsModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.settingsTileIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Scale size={20} color="#D96B14" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTileTitle}>Terms & Conditions, Rules & Regulations</Text>
              <Text style={styles.settingsTileDesc}>20 official legal articles • Billing, wallet & food safety</Text>
            </View>
            <ChevronRight size={16} color="#8C7A6B" />
          </TouchableOpacity>

          {/* Subscription & Billing Section (Store Owner Only) */}
          {!isCashier && (
            <>
              <Text style={styles.settingsSectionHeading}>BILLING & SUBSCRIPTION</Text>
              <TouchableOpacity
                style={styles.settingsTileCard}
                onPress={() => {
                  loadSubscriptionPlans();
                  setPlanSelectionModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.settingsTileIconBox}>
                  <CreditCard size={20} color="#DE8626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsTileTitle}>Active Subscription</Text>
                  <Text style={styles.settingsTileDesc}>
                    {activeSubscription
                      ? `${activeSubscription.planName || 'Active'} Plan • ${activeSubscription.daysRemaining ?? 30} Days Left`
                      : 'Manage plan, invoices & upgrade features'}
                  </Text>
                </View>
                <View style={styles.managePlanBadge}>
                  <Text style={styles.managePlanBadgeText}>UPGRADE</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      <Text style={styles.settingsSectionHeading}>THEME & APPEARANCE</Text>
      <View style={styles.themeSelectorRow}>
        <TouchableOpacity
          style={[styles.themeOptionBtn, mode === 'system' && styles.themeOptionBtnActive]}
          onPress={() => setMode('system')}
          activeOpacity={0.8}
        >
          <Smartphone size={15} color={mode === 'system' ? '#DE8626' : '#8C7A6B'} />
          <Text style={[styles.themeOptionText, mode === 'system' && styles.themeOptionTextActive]}>
            System (Auto)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.themeOptionBtn, mode === 'dark' && styles.themeOptionBtnActive]}
          onPress={() => setMode('dark')}
          activeOpacity={0.8}
        >
          <Moon size={15} color={mode === 'dark' ? '#DE8626' : '#8C7A6B'} />
          <Text style={[styles.themeOptionText, mode === 'dark' && styles.themeOptionTextActive]}>
            Gilded Noir
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.themeOptionBtn, mode === 'light' && styles.themeOptionBtnActive]}
          onPress={() => setMode('light')}
          activeOpacity={0.8}
        >
          <Sun size={15} color={mode === 'light' ? '#DE8626' : '#8C7A6B'} />
          <Text style={[styles.themeOptionText, mode === 'light' && styles.themeOptionTextActive]}>
            Ivory Royale
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.settingsSectionHeading}>
        {isSuperAdmin ? 'SUPERADMIN SESSION & SECURITY' : 'ACCOUNT & SESSION'}
      </Text>

      {/* SuperAdmin System Info / User Info */}
      {isSuperAdmin ? (
        <View style={styles.saSystemInfoCard}>
          <View style={styles.saSystemInfoRow}>
            <View style={styles.saSystemInfoLeft}>
              <Shield size={16} color="#DE8626" />
              <Text style={styles.saSystemInfoLabel}>Platform Engine</Text>
            </View>
            <Text style={styles.saSystemInfoValue}>Menza .NET 10 (v2.4)</Text>
          </View>
          <View style={styles.saSystemInfoRow}>
            <View style={styles.saSystemInfoLeft}>
              <CheckCircle2 size={16} color="#17845A" />
              <Text style={styles.saSystemInfoLabel}>Database & API Status</Text>
            </View>
            <Text style={[styles.saSystemInfoValue, { color: '#17845A' }]}>Operational ●</Text>
          </View>
        </View>
      ) : (
        <View style={styles.settingsTileCard}>
          <View style={styles.settingsTileIconBox}>
            <Shield size={20} color="#7C6F62" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsTileTitle}>{displayName}</Text>
            <Text style={styles.settingsTileDesc}>{user?.mobile || 'Store Admin Account'}</Text>
          </View>
        </View>
      )}

      {/* Logout CTA */}
      <TouchableOpacity
        style={[styles.settingsLogoutBtn, isSuperAdmin && styles.saSettingsLogoutBtn]}
        onPress={() => {
          Alert.alert(
            'Confirm Logout',
            `Are you sure you want to log out of ${isSuperAdmin ? 'SuperAdmin' : 'Menza'}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: logout },
            ]
          );
        }}
        activeOpacity={0.8}
      >
        <LogOut size={16} color="#DC2626" />
        <Text style={styles.settingsLogoutText}>
          {isSuperAdmin ? 'Log Out of SuperAdmin Session' : 'Log Out of Menza'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />
      <View style={styles.container}>
        {/* TAB 1: MENU CATALOG */}
        {activeTab === 'catalog' && (
          <View style={{ flex: 1 }}>
            <MenuCatalogScreen onClose={() => setActiveTab('dashboard')} />
          </View>
        )}

        {/* TAB 2: POS BILLING */}
        {activeTab === 'pos' && (
          <View style={{ flex: 1 }}>
            <OrderPosScreen
              onClose={() => {
                setSelectedTableForPos(null);
                setActiveTab('dashboard');
              }}
              isCounterOrderingAllowed={isCounterOrderingAllowed}
              isSelfPickupAllowed={checkEntitlement('IsSelfPickupEnabled')}
              isTableOrderingAllowed={isTableOrderingActive}
              isDeliveryAllowed={checkEntitlement('IsDeliveryEnabled')}
              isKdsAllowed={isKdsAllowed}
              isSmsAllowed={isSmsAllowed}
              initialTableId={selectedTableForPos?.tableId}
              initialTableNumber={selectedTableForPos?.tableNumber}
              initialSectionName={selectedTableForPos?.sectionName}
              isTableLocked={!!selectedTableForPos?.tableNumber}
              onClearTableLock={() => setSelectedTableForPos(null)}
            />
          </View>
        )}

        {/* TAB 3: TABLES */}
        {activeTab === 'tables' && (
          <View style={{ flex: 1 }}>
            <FloorTableScreen
              onClose={() => setActiveTab('dashboard')}
              onOpenPos={(tableInfo) => {
                if (tableInfo) {
                  setSelectedTableForPos(tableInfo);
                }
                setActiveTab('pos');
              }}
            />
          </View>
        )}

        {/* TAB 4: SUPERADMIN DIRECTORY */}
        {activeTab === 'directory' && (
          <View style={{ flex: 1 }}>
            <ActiveStoreDirectoryScreen onClose={() => setActiveTab('dashboard')} />
          </View>
        )}

        {/* TAB 5: SUPERADMIN ONBOARDING */}
        {activeTab === 'superadmin' && (
          <View style={{ flex: 1 }}>
            <SuperAdminOnboardingScreen onClose={() => setActiveTab('dashboard')} />
          </View>
        )}

        {/* TAB 6: SUPERADMIN PLANS */}
        {activeTab === 'planCreator' && (
          <View style={{ flex: 1 }}>
            <PlanCreatorScreen onClose={() => setActiveTab('dashboard')} />
          </View>
        )}

        {/* TAB 7: SETTINGS & CONTROLS HUB */}
        {activeTab === 'more' && (
          <View style={{ flex: 1 }}>
            {renderSettingsHub()}
          </View>
        )}

        {/* TAB 8: STAFF MEMBERS & PERMISSIONS */}
        {activeTab === 'roles' && (
          <View style={{ flex: 1 }}>
            <StaffRoleScreen onClose={() => setActiveTab('more')} />
          </View>
        )}

        {/* TAB 9: STORE CONFIGURATION & TAXES */}
        {activeTab === 'config' && (
          <View style={{ flex: 1 }}>
            <RestaurantConfigScreen onClose={() => setActiveTab('more')} />
          </View>
        )}

        {/* TAB 9B: BANK ACCOUNT & 100% QR SETTLEMENTS */}
        {activeTab === 'bankAccount' && (
          <View style={{ flex: 1 }}>
            <RestaurantBankAccountScreen onClose={() => setActiveTab('more')} />
          </View>
        )}

        {/* TAB 10: BUSINESS REPORTS & ANALYTICS */}
        {activeTab === 'reports' && (
          <View style={{ flex: 1 }}>
            <BusinessReportsScreen
              onClose={() => setActiveTab('more')}
              isKdsAllowed={checkEntitlement('IsKdsEnabled')}
            />
          </View>
        )}

        {/* TAB 11: BLUETOOTH THERMAL RECEIPT PRINTER */}
        {activeTab === 'printer' && (
          <View style={{ flex: 1 }}>
            <BluetoothPrinterScreen onClose={() => setActiveTab('more')} />
          </View>
        )}

        {/* TAB 12: MAIN DASHBOARD (CLEAN & LUXURY EXECUTIVE HOME) */}
        {activeTab === 'dashboard' && (
          <View style={{ flex: 1 }}>
            {/* 1. UNIFIED EXECUTIVE TOP HEADER */}
            <View style={styles.topHeader}>
              <View style={styles.headerLeftContainer}>
                <TouchableOpacity
                  style={styles.headerLogoWrapper}
                  onPress={() => !isSuperAdmin && setRestModalVisible(true)}
                  activeOpacity={0.85}
                  disabled={isSuperAdmin}
                >
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
                </TouchableOpacity>

                {!isSuperAdmin ? (
                  <View style={styles.headerInfoBlock}>
                    {/* Row 1: Outlet Name + Switch Chevron */}
                    <TouchableOpacity
                      style={styles.headerOutletSelector}
                      onPress={() => setRestModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.headerOutletTitle} numberOfLines={1}>
                        {activeRestaurant?.restaurantName || (restaurants.length > 0 ? restaurants[0].restaurantName : 'Select Outlet')}
                      </Text>
                      <ChevronDown size={13} color="#8C7A6B" style={{ marginTop: 1 }} />
                    </TouchableOpacity>

                    {/* Row 2: Status Pill & Role Details */}
                    <View style={styles.headerSubtitleRow}>
                      <TouchableOpacity
                        onPress={() => setOperatingStatusModalVisible(true)}
                        style={[
                          styles.headerStatusMiniBadge,
                          operatingStatus?.status === 'OPEN' && styles.headerStatusMiniBadgeOpen,
                          operatingStatus?.status === 'PAUSED' && styles.headerStatusMiniBadgePaused,
                          operatingStatus?.status === 'CLOSED' && styles.headerStatusMiniBadgeClosed,
                        ]}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.headerStatusMiniDot,
                            operatingStatus?.status === 'OPEN' && styles.headerStatusMiniDotOpen,
                            operatingStatus?.status === 'PAUSED' && styles.headerStatusMiniDotPaused,
                            operatingStatus?.status === 'CLOSED' && styles.headerStatusMiniDotClosed,
                          ]}
                        />
                        <Text
                          style={[
                            styles.headerStatusMiniText,
                            operatingStatus?.status === 'OPEN' && styles.headerStatusMiniTextOpen,
                            operatingStatus?.status === 'PAUSED' && styles.headerStatusMiniTextPaused,
                            operatingStatus?.status === 'CLOSED' && styles.headerStatusMiniTextClosed,
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
                        {displayName} ({roleName})
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.headerInfoBlock}>
                    <Text style={styles.headerOutletTitle}>Menza Master</Text>
                    <Text style={styles.headerOutletSubtitle}>SuperAdmin Access</Text>
                  </View>
                )}
              </View>

              <View style={styles.headerRightRow}>
                {/* Dynamic Real-time Network Strength Indicator */}
                <NetworkStrengthIndicator size={16} />

                {/* Order Notification Bell Button */}
                <TouchableOpacity
                  onPress={() => setNotificationModalVisible(true)}
                  style={[
                    styles.headerNotificationBellBtn,
                    unreadCount > 0 && styles.headerNotificationBellBtnActive,
                  ]}
                  activeOpacity={0.8}
                  accessibilityLabel={`Order Notifications, ${unreadCount} unread`}
                >
                  {unreadCount > 0 ? (
                    <BellRing size={16} color="#DE8626" />
                  ) : (
                    <Bell size={16} color="#7C6F62" />
                  )}
                  {unreadCount > 0 && (
                    <View style={styles.headerBellBadge}>
                      <Text style={styles.headerBellBadgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {isSuperAdmin ? (
                  <>
                    <TouchableOpacity
                      onPress={() => setActiveTab('more')}
                      style={styles.headerActionCircle}
                      activeOpacity={0.8}
                    >
                      <Settings size={15} color="#7C6F62" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('Confirm Logout', 'Are you sure you want to log out of Menza SuperAdmin?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Log Out', style: 'destructive', onPress: logout },
                        ]);
                      }}
                      style={styles.headerSuperAdminLogoutBtn}
                      activeOpacity={0.8}
                    >
                      <LogOut size={13} color="#DC2626" />
                      <Text style={styles.headerSuperAdminLogoutText}>Logout</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* Bluetooth Printer Status Button */}
                    <TouchableOpacity
                      onPress={() => setActiveTab('printer')}
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

                    {/* Prepaid Commission Wallet Pill */}
                    {currentRestId > 0 && (
                      <WalletBalanceWidget restaurantId={currentRestId} variant="pill" onPress={() => setWalletModalVisible(true)} />
                    )}
                  </>
                )}
              </View>
            </View>

            {!isSuperAdmin && ((loadingSubscription && !activeSubscription) || (loadingRevenue && !todayRevenueData) || (loadingMyRestaurants && restaurants.length === 0)) ? (
              <HomeDashboardSkeleton />
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#DE8626"
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                  />
                }
              >
                {/* SUPERADMIN VIEW */}
                {isSuperAdmin ? (
                  <>
                    {/* SuperAdmin Hero Metric Banner */}
                    <View style={styles.saHeroCard}>
                      <LinearGradient
                        colors={['#2D2319', '#3D2F20', '#1F1811']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.saHeroGradient}
                      >
                        <View style={styles.saHeroTopRow}>
                          <View style={styles.saEmblemBadge}>
                            <Crown size={16} color="#FEA619" />
                            <Text style={styles.saEmblemText}>PLATFORM MASTER</Text>
                          </View>
                          <Text style={styles.saLiveIndicator}>● System Operational</Text>
                        </View>

                        <View style={styles.saMetricsRow}>
                          <View style={styles.saMetricItem}>
                            <Text style={styles.saMetricLabel}>PLATFORM OUTLETS</Text>
                            {loadingRevenue && totalStoresCount === 0 ? (
                              <SkeletonLoader width={60} height={28} borderRadius={6} style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', marginVertical: 2 }} />
                            ) : (
                              <Text style={styles.saMetricValue}>{totalStoresCount}</Text>
                            )}
                            <Text style={styles.saMetricSub}>Active tenants</Text>
                          </View>
                          <View style={styles.saMetricDivider} />
                          <View style={styles.saMetricItem}>
                            <Text style={styles.saMetricLabel}>SAAS MRR</Text>
                            {loadingRevenue && mrrAmount === 0 ? (
                              <SkeletonLoader width={90} height={28} borderRadius={6} style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', marginVertical: 2 }} />
                            ) : (
                              <Text style={styles.saMetricValue}>₹{mrrAmount.toLocaleString('en-IN')}</Text>
                            )}
                            <Text style={styles.saMetricSub}>Monthly recurring</Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </View>

                    {/* SuperAdmin Quick Modules */}
                    <Text style={styles.sectionHeading}>PLATFORM MANAGEMENT</Text>
                    <View style={styles.saActionsGrid}>
                      <TouchableOpacity
                        style={styles.saActionCard}
                        onPress={() => setActiveTab('superadmin')}
                        activeOpacity={0.8}
                      >
                        <View style={styles.saActionIconBox}>
                          <Globe size={22} color="#DE8626" />
                        </View>
                        <Text style={styles.saActionTitle}>Onboard Outlet</Text>
                        <Text style={styles.saActionSub}>3-Stage wizard & store creation</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.saActionCard}
                        onPress={() => setActiveTab('directory')}
                        activeOpacity={0.8}
                      >
                        <View style={styles.saActionIconBox}>
                          <Store size={22} color="#DE8626" />
                        </View>
                        <Text style={styles.saActionTitle}>Outlets Directory</Text>
                        <Text style={styles.saActionSub}>Manage stores & channel configs</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.saActionCard}
                        onPress={() => setActiveTab('planCreator')}
                        activeOpacity={0.8}
                      >
                        <View style={styles.saActionIconBox}>
                          <Sparkles size={22} color="#DE8626" />
                        </View>
                        <Text style={styles.saActionTitle}>Subscription Plans</Text>
                        <Text style={styles.saActionSub}>Create SaaS tiers & pricing</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {/* RESTAURANT OWNER & CASHIER VIEW */}

                    {/* SUBSCRIPTION PROMOTION / STATUS BANNER */}
                    {!hasActiveSub && (
                      <View style={styles.subLockCard}>
                        <View style={styles.subLockHeader}>
                          <View style={styles.subLockIconBadge}>
                            <Crown size={22} color="#DE8626" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.subLockTitle}>
                              {activeSubscription ? 'Subscription Plan Expired' : 'Standard Commission (2.5%) Active'}
                            </Text>
                            <Text style={styles.subLockSub}>
                              {activeSubscription
                                ? `Plan expired on ${new Date(activeSubscription.endDate).toLocaleDateString()}. Renew to lower commission & unlock Kitchen Display System (KDS) & SMS.`
                                : 'Subscribe to reduce platform commission (down to 1.5%) and enable Kitchen Display System (KDS) & SMS notifications.'}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.activatePlanBtnWrapper}
                          onPress={() => {
                            loadSubscriptionPlans();
                            setPlanSelectionModalVisible(true);
                          }}
                          activeOpacity={0.88}
                        >
                          <LinearGradient
                            colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.activatePlanBtnGradient}
                          >
                            <Zap size={16} color="#FFFFFF" />
                            <Text style={styles.activatePlanBtnText}>
                              {activeSubscription ? 'Renew Subscription Plan' : 'Explore Subscription Plans'}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* LOW / EXHAUSTED COMMISSION WALLET BANNER */}
                    {walletBalance !== null && (walletBalance <= 0 || walletBalance < 200) && (
                      <View style={[styles.lowWalletBanner, walletBalance <= 0 && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                        <View style={styles.lowWalletBannerLeft}>
                          <View style={[styles.lowWalletIconCircle, walletBalance <= 0 && { backgroundColor: '#FEE2E2' }]}>
                            <AlertTriangle size={16} color={walletBalance <= 0 ? '#DC2626' : '#DE8626'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.lowWalletTitle, walletBalance <= 0 && { color: '#991B1B' }]}>
                              {walletBalance <= 0
                                ? `Prepaid Wallet Exhausted (₹${walletBalance.toFixed(2)}) ⚠️`
                                : `Low Wallet Balance: ₹${walletBalance.toLocaleString('en-IN')}`}
                            </Text>
                            <Text style={[styles.lowWalletSubtitle, walletBalance <= 0 && { color: '#7F1D1D' }]}>
                              {walletBalance <= 0
                                ? 'Recharge your wallet to ensure smooth automated commission deductions.'
                                : 'Add balance for uninterrupted order placement and commission deductions.'}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={[styles.lowWalletRechargeBtn, walletBalance <= 0 && { backgroundColor: '#DC2626' }]}
                          onPress={() => {
                            setWalletModalTab('recharge');
                            setWalletModalVisible(true);
                          }}
                          activeOpacity={0.85}
                        >
                          <Plus size={12} color="#FFFFFF" strokeWidth={3} />
                          <Text style={styles.lowWalletRechargeText}>
                            {walletBalance <= 0 ? 'Recharge Now' : 'Add Funds'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* 1. EXECUTIVE HERO STORE METRICS CARD */}
                    <TouchableOpacity
                      style={styles.heroOverviewCard}
                      activeOpacity={0.9}
                      onPress={() => {
                        setTodayOrdersModalVisible(true);
                      }}
                    >
                      {(activeRestaurant?.imageUrl || activeRestaurant?.bannerUrl) ? (
                        <Image
                          source={{ uri: (activeRestaurant.imageUrl || activeRestaurant.bannerUrl)!.trim() }}
                          style={styles.heroBannerBackground}
                          resizeMode="cover"
                        />
                      ) : null}
                      <LinearGradient
                        colors={
                          (activeRestaurant?.imageUrl || activeRestaurant?.bannerUrl)
                            ? ['rgba(255, 255, 255, 0.94)', 'rgba(250, 247, 242, 0.96)']
                            : ['#FFFFFF', '#FAF7F2']
                        }
                        style={styles.heroOverviewGradient}
                      >
                        {/* Header Row: Status badge & Tap Hint */}
                        <View style={styles.heroHeaderRow}>
                          <View style={styles.heroLivePill}>
                            <View style={styles.heroLiveDot} />
                            <Text
                              style={styles.heroLivePillText}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {hasActiveSub
                                ? `${activeSubscription?.planName || 'Pro Plan'} • ${activeSubscription?.daysRemaining ?? 30} Days Left`
                                : 'Standard Commission (2.5%)'}
                            </Text>
                          </View>
                          <View style={styles.heroViewOrdersHint}>
                            <Text style={styles.heroViewOrdersHintText}>View Orders</Text>
                            <ChevronRight size={13} color="#DE8626" />
                          </View>
                        </View>

                        {/* Middle Row: Grand Today's Revenue */}
                        <View style={styles.heroRevenueBlock}>
                          <Text style={styles.heroRevenueLabel}>TODAY'S REVENUE</Text>
                          <View style={styles.heroRevenueValueRow}>
                            {loadingRevenue && !todayRevenueData ? (
                              <SkeletonLoader width={160} height={36} borderRadius={8} />
                            ) : (
                              <Text
                                style={styles.heroRevenueValue}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                              >
                                {hasActiveSub ? `₹${todayRevenue.toLocaleString('en-IN')}` : '—'}
                              </Text>
                            )}
                            {totalOrdersCount > 0 && (
                              <View style={styles.heroOrdersCountBadge}>
                                <ShoppingBag size={12} color="#17845A" />
                                <Text style={styles.heroOrdersCountBadgeText} numberOfLines={1}>
                                  {todayRevenueData?.completedOrdersCount ?? totalOrdersCount} Settled
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.heroRevenueSub} numberOfLines={2}>
                            {hasActiveSub
                              ? totalOrdersCount > 0
                                ? `Processed ${totalOrdersCount} orders today • Tap for detailed list`
                                : 'No orders recorded yet today • Ready for billing'
                              : 'Activate subscription plan to view live sales'}
                          </Text>
                        </View>

                        {/* Divider */}
                        <View style={styles.heroDivider} />

                        {/* Bottom Row: 4 Quick Metric Pills */}
                        <View style={styles.heroMetricsTripletRow}>
                          {/* Total Orders Placed */}
                          <View style={styles.heroTripletCol}>
                            <View style={styles.heroTripletIconRow}>
                              <ShoppingBag size={12} color="#DE8626" />
                              <Text style={styles.heroTripletLabel} numberOfLines={1}>Total</Text>
                            </View>
                            <Text
                              style={styles.heroTripletValue}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              {todayRevenueData?.todayOrdersCount ?? 0}
                            </Text>
                          </View>

                          <View style={styles.heroTripletDivider} />

                          {/* Active / In-Progress */}
                          <View style={styles.heroTripletCol}>
                            <View style={styles.heroTripletIconRow}>
                              <Activity size={12} color="#D96B14" />
                              <Text style={styles.heroTripletLabel} numberOfLines={1}>Active</Text>
                            </View>
                            <Text
                              style={styles.heroTripletValue}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              {todayRevenueData?.activeOrdersCount ?? 0}
                            </Text>
                          </View>

                          <View style={styles.heroTripletDivider} />

                          {/* Settled / Completed */}
                          <View style={styles.heroTripletCol}>
                            <View style={styles.heroTripletIconRow}>
                              <BadgeCheck size={12} color="#17845A" />
                              <Text style={styles.heroTripletLabel} numberOfLines={1}>Settled</Text>
                            </View>
                            <Text
                              style={styles.heroTripletValue}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              {todayRevenueData?.completedOrdersCount ?? 0}
                            </Text>
                          </View>

                          <View style={styles.heroTripletDivider} />

                          {/* Avg Ticket (AOV) */}
                          <View style={styles.heroTripletCol}>
                            <View style={styles.heroTripletIconRow}>
                              <Sparkles size={12} color="#8C7A6B" />
                              <Text style={styles.heroTripletLabel} numberOfLines={1}>Avg Bill</Text>
                            </View>
                            <Text
                              style={styles.heroTripletValue}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              ₹{(() => {
                                const count = todayRevenueData?.completedOrdersCount || todayRevenueData?.todayOrdersCount || 0;
                                return count > 0 ? Math.round(todayRevenue / count) : 0;
                              })()}
                            </Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* 2. HIGH-IMPACT QUICK ACTIONS GRID (4 CARDS) */}
                    <Text style={styles.sectionHeading}>QUICK ACCESS</Text>
                    <View style={styles.quickGrid4}>
                      {/* POS Terminal */}
                      <TouchableOpacity
                        style={styles.quickCardAction}
                        onPress={() => handleModulePress('pos', isPosAndCounterOrderingAllowed)}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={['#FFF8F0', '#FFFFFF']}
                          style={styles.quickCardInner}
                        >
                          <View style={[styles.quickCardIconCircle, { backgroundColor: '#FFF0DE' }]}>
                            <ShoppingBag size={20} color="#D96B14" strokeWidth={2.4} />
                          </View>
                          <Text style={styles.quickCardTitle}>POS Terminal</Text>
                          <Text style={styles.quickCardDesc}>New Order & Billing</Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      {/* Floor Tables */}
                      {isTableOrderingActive && (
                        <TouchableOpacity
                          style={styles.quickCardAction}
                          onPress={() => handleModulePress('tables', isTableOrderingActive)}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={['#FFF8F0', '#FFFFFF']}
                            style={styles.quickCardInner}
                          >
                            <View style={[styles.quickCardIconCircle, { backgroundColor: '#E4F5EC' }]}>
                              <Table size={20} color="#17845A" strokeWidth={2.4} />
                            </View>
                            <Text style={styles.quickCardTitle}>Floor Tables</Text>
                            <Text style={styles.quickCardDesc}>Table Seating</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}

                      {/* Menu Catalog */}
                      <TouchableOpacity
                        style={styles.quickCardAction}
                        onPress={() => handleModulePress('catalog', true)}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={['#FFF8F0', '#FFFFFF']}
                          style={styles.quickCardInner}
                        >
                          <View style={[styles.quickCardIconCircle, { backgroundColor: '#FFF0DE' }]}>
                            <UtensilsCrossed size={20} color="#DE8626" strokeWidth={2.4} />
                          </View>
                          <Text style={styles.quickCardTitle}>Menu Catalog</Text>
                          <Text style={styles.quickCardDesc}>Dishes & Prices</Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      {/* Business Analytics */}
                      <TouchableOpacity
                        style={styles.quickCardAction}
                        onPress={() => handleModulePress('reports', true)}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={['#FFF8F0', '#FFFFFF']}
                          style={styles.quickCardInner}
                        >
                          <View style={[styles.quickCardIconCircle, { backgroundColor: '#EBF4FF' }]}>
                            <BarChart3 size={20} color="#2563EB" strokeWidth={2.4} />
                          </View>
                          <Text style={styles.quickCardTitle}>Reports & BI</Text>
                          <Text style={styles.quickCardDesc}>Sales Trends</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>

                    {/* 3. STORE MANAGEMENT SHORTCUTS */}
                    <Text style={styles.sectionHeading}>STORE OPERATIONS</Text>
                    <View style={styles.managementCardContainer}>
                      {/* Staff Roles */}
                      <TouchableOpacity
                        style={styles.mgmtRowItem}
                        onPress={() => handleModulePress('roles', true)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.mgmtIconBox}>
                          <Users size={18} color="#DE8626" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mgmtRowTitle}>Staff Members & Permissions</Text>
                          <Text style={styles.mgmtRowDesc}>
                            {isCashier ? 'View team directory & shifts' : 'Assign roles, cashiers & access keys'}
                          </Text>
                        </View>
                        <ChevronRight size={16} color="#8C7A6B" />
                      </TouchableOpacity>

                      <View style={styles.mgmtRowDivider} />

                      {/* Store Config */}
                      <TouchableOpacity
                        style={styles.mgmtRowItem}
                        onPress={() => handleModulePress('config', true)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.mgmtIconBox}>
                          <Store size={18} color="#DE8626" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.mgmtRowTitle}>Store Configuration</Text>
                            {isCashier && (
                              <View style={styles.viewOnlyPill}>
                                <Text style={styles.viewOnlyPillText}>VIEW ONLY</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.mgmtRowDesc}>
                            {isCashier ? 'View store profile, GSTIN & tax rates' : 'GSTIN, tax rates, address & receipts'}
                          </Text>
                        </View>
                        <ChevronRight size={16} color="#8C7A6B" />
                      </TouchableOpacity>

                      <View style={styles.mgmtRowDivider} />

                      {/* Restaurant QR Code & Standee Generator */}
                      <TouchableOpacity
                        style={styles.mgmtRowItem}
                        onPress={() => setRestaurantQrModalVisible(true)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.mgmtIconBox, { backgroundColor: '#FFF0DE' }]}>
                          <QrCode size={18} color="#D96B14" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.mgmtRowTitle}>Generate Restaurant QR & Standee</Text>
                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#B45309' }}>SHARE</Text>
                            </View>
                          </View>
                          <Text style={styles.mgmtRowDesc}>
                            Generate table & store QR codes with marketing taglines & printable PDF
                          </Text>
                        </View>
                        <ChevronRight size={16} color="#8C7A6B" />
                      </TouchableOpacity>

                      <View style={styles.mgmtRowDivider} />

                      {/* Bluetooth Thermal Printer */}
                      <TouchableOpacity
                        style={styles.mgmtRowItem}
                        onPress={() => setActiveTab('printer')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.mgmtIconBox}>
                          <Printer size={18} color="#DE8626" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.mgmtRowTitle}>Thermal Receipt Printer</Text>
                            {connectedDevice && (
                              <View style={styles.mgmtConnectedDotBadge}>
                                <Text style={styles.mgmtConnectedDotText}>CONNECTED</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.mgmtRowDesc}>
                            {connectedDevice
                              ? `Connected: ${connectedDevice.name || 'Printer'}`
                              : 'Scan and pair ESC/POS Bluetooth printers'}
                          </Text>
                        </View>
                        <ChevronRight size={16} color="#8C7A6B" />
                      </TouchableOpacity>

                      <View style={styles.mgmtRowDivider} />

                      {/* Commission Wallet & Transactions */}
                      <TouchableOpacity
                        style={styles.mgmtRowItem}
                        onPress={() => {
                          setWalletModalTab('history');
                          setWalletModalVisible(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.mgmtIconBox}>
                          <Wallet size={18} color="#DE8626" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mgmtRowTitle}>Commission Wallet & Transactions</Text>
                          <Text style={styles.mgmtRowDesc}>
                            {walletBalance !== null
                              ? `Balance: ₹${walletBalance.toLocaleString('en-IN')} • View ledger statement`
                              : 'Prepaid commission transactions & statement'}
                          </Text>
                        </View>
                        <ChevronRight size={16} color="#8C7A6B" />
                      </TouchableOpacity>

                      {/* Subscription & Billing (Store Owner Only) */}
                      {!isCashier && (
                        <>
                          <View style={styles.mgmtRowDivider} />
                          <TouchableOpacity
                            style={styles.mgmtRowItem}
                            onPress={() => {
                              loadSubscriptionPlans();
                              setPlanSelectionModalVisible(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.mgmtIconBox}>
                              <CreditCard size={18} color="#DE8626" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.mgmtRowTitle}>Active Subscription</Text>
                              <Text style={styles.mgmtRowDesc}>
                                {activeSubscription
                                  ? `${activeSubscription.planName || 'Active'} Tier • ${activeSubscription.daysRemaining ?? 30} Days Left`
                                  : 'Select plan & upgrade features'}
                              </Text>
                            </View>
                            <ChevronRight size={16} color="#8C7A6B" />
                          </TouchableOpacity>
                        </>
                      )}

                      <View style={styles.mgmtRowDivider} />

                      {/* Rules & Regulations / Terms */}
                      <TouchableOpacity
                        style={styles.mgmtRowItem}
                        onPress={() => setTermsModalVisible(true)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.mgmtIconBox}>
                          <Scale size={18} color="#DE8626" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mgmtRowTitle}>Rules & Regulations (Terms)</Text>
                          <Text style={styles.mgmtRowDesc}>
                            Official 20-article compliance & legal framework
                          </Text>
                        </View>
                        <ChevronRight size={16} color="#8C7A6B" />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        )}

        {/* Global Bottom Navigation Bar */}
        <BottomNavigationBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isSuperAdmin={isSuperAdmin}
          isTableOrderingAllowed={isTableOrderingActive}
        />

        {/* Restaurant Switcher Modal */}
        <Modal visible={restModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Restaurant Location</Text>

              {loadingMyRestaurants ? (
                <ActivityIndicator size="small" color="#DE8626" style={{ marginVertical: Spacing.md }} />
              ) : restaurants.length === 0 ? (
                <Text style={styles.emptyRestText}>No restaurant outlets assigned to your account.</Text>
              ) : (
                restaurants.map((rest) => {
                  const isSelected = rest.restaurantId === activeRestaurant?.restaurantId;
                  return (
                    <TouchableOpacity
                      key={`rest-opt-${rest.restaurantId}`}
                      style={[styles.restOption, isSelected && styles.restOptionSelected]}
                      onPress={() => {
                        setActiveRestaurant(rest);
                        setRestModalVisible(false);
                      }}
                      activeOpacity={0.8}
                    >
                      {rest.logoUrl && rest.logoUrl.trim().length > 0 ? (
                        <Image source={{ uri: rest.logoUrl.trim() }} style={styles.restOptionLogo} resizeMode="cover" />
                      ) : (
                        <View style={[styles.restOptionIconBox, isSelected && styles.restOptionIconBoxSelected]}>
                          <Building2 size={18} color={isSelected ? '#DE8626' : '#8C7A6B'} />
                        </View>
                      )}
                      <View style={styles.restOptionInfo}>
                        <Text style={[styles.restOptionName, isSelected && styles.restOptionNameSelected]}>
                          {rest.restaurantName}
                        </Text>
                        <Text style={styles.restOptionRole}>
                          {rest.city ? `${rest.city} • ` : ''}Tap to switch
                        </Text>
                      </View>
                      {isSelected && <Check size={18} color="#DE8626" />}
                    </TouchableOpacity>
                  );
                })
              )}

              <TouchableOpacity onPress={() => setRestModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* SUBSCRIPTION PLAN SELECTION MODAL */}
        <Modal visible={planSelectionModalVisible} animationType="slide" transparent>
          <View style={styles.planModalOverlay}>
            <View style={styles.planModalCard}>
              <View style={styles.planModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planModalTitle}>Select Subscription Plan</Text>
                  <Text style={styles.planModalSub}>Choose plan for outlet "{activeRestaurant?.restaurantName || 'My Restaurant'}"</Text>
                </View>
                <TouchableOpacity onPress={() => setPlanSelectionModalVisible(false)} style={styles.modalCloseCircle}>
                  <X size={16} color="#DE8626" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                {availablePlans.length === 0 ? (
                  <Text style={styles.emptyRestText}>No subscription plans available currently.</Text>
                ) : (
                  availablePlans.map((plan) => {
                    const finalPrice = plan.finalPrice ?? Math.max(0, plan.price - (plan.discountAmount || 0));
                    return (
                      <View key={`plan-opt-${plan.id}`} style={styles.planCardItem}>
                        <View style={styles.planCardItemHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.planCardTitle}>{plan.subscriptionName || plan.planName}</Text>
                            <Text style={styles.planCardCode}>CODE: {plan.subscriptionCode || 'N/A'}</Text>
                          </View>
                          <StatusBadge label={plan.billingCycle || 'MONTHLY'} variant="success" />
                        </View>

                        <View style={styles.planPriceRow}>
                          <Text style={styles.planFinalPrice}>₹{finalPrice.toLocaleString()}</Text>
                          {plan.discountAmount ? plan.discountAmount > 0 && (
                            <Text style={styles.planStruckPrice}>₹{plan.price.toLocaleString()}</Text>
                          ) : null}
                          <Text style={styles.planDays}>{plan.durationInDays || plan.durationDays} Days Duration</Text>
                        </View>

                        {/* Included Wallet Credit Banner */}
                        {plan.includedWalletCredit && plan.includedWalletCredit > 0 ? (
                          <View style={styles.bonusWalletChip}>
                            <Gift size={13} color="#17845A" />
                            <Text style={styles.bonusWalletText}>
                              Includes ₹{plan.includedWalletCredit.toLocaleString('en-IN')} Free Wallet Credit
                            </Text>
                          </View>
                        ) : null}

                        {plan.description ? (
                          <Text style={styles.planDescText}>{plan.description}</Text>
                        ) : null}

                        {/* Commission Breakdown Box */}
                        <View style={styles.ownerCommissionBox}>
                          <View style={styles.ownerCommissionRow}>
                            <Text style={styles.ownerCommissionLabel}>Commission Model:</Text>
                            <Text style={styles.ownerCommissionVal}>{plan.commissionType || 'PERCENTAGE'}</Text>
                          </View>
                          <View style={styles.ownerCommissionRow}>
                            <Text style={styles.ownerCommissionLabel}>Base Order Commission:</Text>
                            <Text style={styles.ownerCommissionVal}>
                              {plan.baseCommissionPercentage || 0}% + ₹{plan.baseFlatCommissionPerOrder || 0}/order
                            </Text>
                          </View>
                          {plan.maxCommissionCapPerOrder && plan.maxCommissionCapPerOrder > 0 ? (
                            <View style={styles.ownerCommissionRow}>
                              <Text style={styles.ownerCommissionLabel}>Max Fee Cap / Order:</Text>
                              <Text style={styles.ownerCommissionVal}>Capped at ₹{plan.maxCommissionCapPerOrder.toFixed(2)}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Included Feature Entitlements Section */}
                        {plan.entitlements && plan.entitlements.length > 0 ? (
                          <View style={styles.ownerEntitlementsSection}>
                            <Text style={styles.ownerEntitlementsTitle}>INCLUDED FEATURE ENTITLEMENTS</Text>
                            <View style={styles.ownerEntitlementsGrid}>
                              {plan.entitlements.map((ent, eIdx) => {
                                const isAllowed = ent.isAllowed;
                                const hasAddonPct = (ent.featureCommissionPercentage || 0) > 0;
                                const hasAddonFlat = (ent.featureFlatFeePerOrder || 0) > 0;

                                return (
                                  <View
                                    key={`owner-ent-${ent.configKey}-${eIdx}`}
                                    style={[
                                      styles.ownerEntitlementBadge,
                                      isAllowed ? styles.ownerEntitlementAllowed : styles.ownerEntitlementDisabled,
                                    ]}
                                  >
                                    {isAllowed ? (
                                      <CheckCircle2 size={12} color="#17845A" />
                                    ) : (
                                      <X size={12} color="#8C7A6B" />
                                    )}
                                    <Text
                                      style={[
                                        styles.ownerEntitlementText,
                                        isAllowed ? styles.ownerEntitlementTextAllowed : styles.ownerEntitlementTextDisabled,
                                      ]}
                                    >
                                      {ent.configKey}
                                    </Text>
                                    {isAllowed && (hasAddonPct || hasAddonFlat) ? (
                                      <Text style={styles.ownerEntitlementAddonText}>
                                        ({hasAddonPct ? `+${ent.featureCommissionPercentage}%` : ''}
                                        {hasAddonPct && hasAddonFlat ? ' ' : ''}
                                        {hasAddonFlat ? `+₹${ent.featureFlatFeePerOrder}` : ''})
                                      </Text>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        ) : null}

                        <TouchableOpacity
                          activeOpacity={0.88}
                          style={styles.payBtn}
                          onPress={() => handleActivatePlan(plan)}
                          disabled={subscribingId === plan.id}
                        >
                          <LinearGradient
                            colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.payBtnGradient}
                          >
                            {subscribingId === plan.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.payBtnText}>Pay ₹{finalPrice.toLocaleString()} via CashFree</Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* CASHFREE PAYMENT PROCESSING SCREEN */}
        {processingOrder && (
          <PaymentProcessingScreen
            visible={!!processingOrder}
            orderId={processingOrder.orderId}
            planName={processingOrder.planName}
            amount={processingOrder.amount}
            restaurantId={processingOrder.restaurantId}
            subscriptionConfigurationId={processingOrder.subscriptionConfigurationId}
            onSuccess={() => {
              setProcessingOrder(null);
              WalletEvents.emit();
              if (currentRestId > 0) {
                fetchSubscriptionData(currentRestId);
                fetchWalletBalance(currentRestId);
              }
            }}
            onClose={() => {
              setProcessingOrder(null);
              WalletEvents.emit();
              if (currentRestId > 0) {
                fetchSubscriptionData(currentRestId);
                fetchWalletBalance(currentRestId);
              }
            }}
          />
        )}

        {/* COMMISSION WALLET RECHARGE MODAL */}
        <WalletRechargeModal
          visible={walletModalVisible}
          initialTab={walletModalTab}
          restaurantId={currentRestId}
          onClose={() => {
            setWalletModalVisible(false);
            WalletEvents.emit();
            if (currentRestId > 0) {
              fetchWalletBalance(currentRestId);
            }
          }}
          onRechargeSuccess={() => {
            WalletEvents.emit();
            if (currentRestId > 0) {
              fetchWalletBalance(currentRestId);
            }
          }}
        />

        {/* TODAY'S REVENUE ORDERS BREAKDOWN MODAL */}
        <TodayOrdersModal
          visible={todayOrdersModalVisible}
          onClose={() => setTodayOrdersModalVisible(false)}
          restaurantId={currentRestId}
          restaurantName={activeRestaurant?.restaurantName || 'Active Restaurant'}
          todayRevenue={todayRevenue}
          revenueData={todayRevenueData}
          onOpenPos={() => {
            setTodayOrdersModalVisible(false);
            handleModulePress('pos', isCounterOrderingAllowed || isPosAndCounterOrderingAllowed);
          }}
        />

        {/* TERMS & CONDITIONS, RULES & REGULATIONS MODAL */}
        <TermsAndConditionsModal
          visible={termsModalVisible}
          onClose={() => setTermsModalVisible(false)}
        />

        {/* OWNER TERMS & CONDITIONS CONSENT CARD OVERLAY */}
        <TermsConsentCard />

        {/* RESTAURANT QR CODE & STANDEE GENERATOR MODAL */}
        <RestaurantQrModal
          visible={restaurantQrModalVisible}
          onClose={() => setRestaurantQrModalVisible(false)}
          restaurant={activeRestaurant}
        />

        {/* REAL-TIME FLOATING ORDER ALERT BANNER */}
        <OrderAlertBanner
          onPress={() => setNotificationModalVisible(true)}
          onSettleOrder={(orderData) => {
            setNotificationModalVisible(true);
          }}
        />

        {/* ORDER NOTIFICATION DRAWER / CENTER MODAL */}
        <OrderNotificationModal
          visible={notificationModalVisible}
          onClose={() => setNotificationModalVisible(false)}
          restaurantId={currentRestId}
          restaurantName={activeRestaurant?.restaurantName}
          onViewOrderDetails={(order) => {
            setTodayOrdersModalVisible(true);
          }}
          onOpenTodayOrders={() => {
            setTodayOrdersModalVisible(true);
          }}
          onSettlementSuccess={() => {
            if (currentRestId > 0) {
              fetchTodayRevenueData(currentRestId, true);
              fetchWalletBalance(currentRestId);
              pollRecentOrders(currentRestId);
            }
          }}
        />

        {/* STORE OPERATING STATUS & ORDER ACCEPTANCE MODAL */}
        <StoreOperatingStatusModal
          visible={operatingStatusModalVisible}
          onClose={() => setOperatingStatusModalVisible(false)}
          restaurantId={currentRestId}
          restaurantName={activeRestaurant?.restaurantName || 'Active Restaurant'}
          isOwnerOrAdmin={!isCashier}
          initialStatus={operatingStatus}
          isTableOrderingAllowed={isTableOrderingAllowed}
          onEditHours={() => {
            setActiveTab('config');
          }}
          onStatusUpdated={(updated) => {
            setOperatingStatus(updated);
          }}
          onProfileUpdated={(newProfile) => {
            if (operatingStatus) {
              setOperatingStatus({
                ...operatingStatus,
                businessProfile: newProfile,
                isTableOrderingActive: newProfile !== 'QSR_CAFE',
              });
            }
            if (activeTab === 'tables' && newProfile === 'QSR_CAFE') {
              setActiveTab('dashboard');
            }
          }}
        />
      </View>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FAF7F2',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE4DC',
    shadowColor: '#2B1A09',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLeftContainer: {
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
  headerOutletSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
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
  headerNotificationBellBtn: {
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
  headerNotificationBellBtnActive: {
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
  headerBellBadge: {
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
  headerBellBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
  },
  headerStatusMiniBadge: {
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
  headerStatusMiniBadgeOpen: {
    backgroundColor: '#EBF8F1',
    borderColor: '#A4E8C2',
  },
  headerStatusMiniBadgePaused: {
    backgroundColor: '#FFF8EB',
    borderColor: '#FBDCA0',
  },
  headerStatusMiniBadgeClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  headerStatusMiniDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: '#8C7A6B',
  },
  headerStatusMiniDotOpen: {
    backgroundColor: '#16A34A',
  },
  headerStatusMiniDotPaused: {
    backgroundColor: '#F59E0B',
  },
  headerStatusMiniDotClosed: {
    backgroundColor: '#EF4444',
  },
  headerStatusMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B5E51',
    letterSpacing: 0.3,
  },
  headerStatusMiniTextOpen: {
    color: '#15803D',
  },
  headerStatusMiniTextPaused: {
    color: '#B45309',
  },
  headerStatusMiniTextClosed: {
    color: '#B91C1C',
  },
  headerActionCircle: {
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
  headerSuperAdminLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
    shadowColor: '#2B1A09',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  headerSuperAdminLogoutText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  logoutBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 24,
  },

  /* 1. EXECUTIVE HERO STORE METRICS CARD */
  heroOverviewCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: '#E7E1DA',
    marginBottom: 14,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },
  heroBannerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.12,
  },
  heroOverviewGradient: {
    padding: 16,
    borderRadius: 18,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.25)',
    flexShrink: 1,
    marginRight: 8,
  },
  heroLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#17845A',
  },
  heroLivePillText: {
    color: '#17845A',
    fontSize: 11,
    fontWeight: '700',
  },
  heroViewOrdersHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  heroViewOrdersHintText: {
    color: '#D96B14',
    fontSize: 11,
    fontWeight: '700',
  },
  heroRevenueBlock: {
    marginBottom: 12,
  },
  heroRevenueLabel: {
    color: '#8C7A6B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroRevenueValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroRevenueValue: {
    color: '#1F2937',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  heroOrdersCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  heroOrdersCountBadgeText: {
    color: '#17845A',
    fontSize: 11,
    fontWeight: '800',
  },
  heroRevenueSub: {
    color: '#5C4E3D',
    fontSize: 11,
    marginTop: 4,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#E7E1DA',
    marginVertical: 10,
  },
  heroMetricsTripletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTripletCol: {
    flex: 1,
    minWidth: 50,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  heroTripletIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    maxWidth: '100%',
  },
  heroTripletLabel: {
    color: '#78716C',
    fontSize: 10.5,
    fontWeight: '600',
  },
  heroTripletValue: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '800',
  },
  heroTripletDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E7E1DA',
  },

  /* SECTION HEADINGS */
  sectionHeading: {
    color: '#78716C',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },

  /* 2. HIGH-IMPACT QUICK ACCESS 4-GRID */
  quickGrid4: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  quickCardAction: {
    width: (SCREEN_WIDTH - 32 - 10) / 2,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  quickCardInner: {
    padding: 12,
    borderRadius: 14,
    gap: 6,
  },
  quickCardIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCardTitle: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '800',
  },
  quickCardDesc: {
    color: '#78716C',
    fontSize: 11,
    lineHeight: 14,
  },

  /* 3. STORE MANAGEMENT SHORTCUTS CONTAINER */
  managementCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 18,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  mgmtRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  mgmtIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  mgmtRowTitle: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
  },
  mgmtRowDesc: {
    color: '#8C7A6B',
    fontSize: 10,
    marginTop: 1,
  },
  mgmtConnectedDotBadge: {
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mgmtConnectedDotText: {
    color: '#17845A',
    fontSize: 8,
    fontWeight: '800',
  },
  mgmtRowDivider: {
    height: 1,
    backgroundColor: '#FAF7F2',
  },

  /* SUPERADMIN DASHBOARD STYLES */
  saHeroCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  saHeroGradient: {
    padding: 16,
    borderRadius: 18,
  },
  saHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  saEmblemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(254, 166, 25, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(254, 166, 25, 0.3)',
  },
  saEmblemText: {
    color: '#FEA619',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  saLiveIndicator: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  saMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saMetricItem: {
    flex: 1,
  },
  saMetricLabel: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  saMetricValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  saMetricSub: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  saMetricDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 12,
  },
  saActionsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  saActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 12,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  saActionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saActionTitle: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '800',
  },
  saActionSub: {
    color: '#78716C',
    fontSize: 11,
    marginTop: 1,
  },

  subLockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#DE8626',
    marginBottom: Spacing.md,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  subLockHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.xs,
  },
  subLockIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(224, 135, 38, 0.3)',
  },
  subLockTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
  },
  subLockSub: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.body2,
    marginTop: 2,
    lineHeight: 18,
  },
  activatePlanBtnWrapper: {
    marginTop: 10,
    borderRadius: Spacing.borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  activatePlanBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Spacing.borderRadius.md,
    gap: 6,
  },
  activatePlanBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  lockedCard: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
  lockedText: {
    color: '#9CA3AF',
  },
  /* HOME SKELETON STYLES */
  homeSkeletonContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
  },
  heroSkeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.2,
    borderColor: '#E7E1DA',
    marginBottom: 14,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  quickCardSkeleton: {
    width: (SCREEN_WIDTH - 32 - 10) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    minHeight: 95,
  },
  mgmtSkeletonContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  mgmtSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  skeletonBg: {
    backgroundColor: '#EDE8E1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 20, 20, 0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.cardLarge,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
  },
  emptyRestText: {
    color: '#5C4E3D',
    textAlign: 'center',
    marginVertical: Spacing.md,
  },
  restOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Spacing.borderRadius.md,
    backgroundColor: '#FAF7F2',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  restOptionSelected: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1.5,
    borderColor: '#DE8626',
  },
  restOptionLogo: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    backgroundColor: '#FFFFFF',
  },
  restOptionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restOptionIconBoxSelected: {
    borderColor: 'rgba(222, 134, 38, 0.4)',
    backgroundColor: '#FFF3DC',
  },
  restOptionInfo: {
    flex: 1,
    marginLeft: 10,
  },
  restOptionName: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body1,
    fontWeight: Typography.fontWeight.semiBold,
  },
  restOptionNameSelected: {
    color: '#D96B14',
    fontWeight: Typography.fontWeight.bold,
  },
  restOptionRole: {
    color: '#7C6F62',
    fontSize: Typography.fontSize.xs,
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  modalCloseText: {
    color: '#6B7280',
    fontWeight: Typography.fontWeight.bold,
  },
  planModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 20, 20, 0.55)',
    justifyContent: 'flex-end',
  },
  planModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Spacing.borderRadius.cardLarge,
    borderTopRightRadius: Spacing.borderRadius.cardLarge,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  planModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  planModalTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
  },
  planModalSub: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCardItem: {
    backgroundColor: '#FAF7F2',
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  planCardItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planCardTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
  },
  planCardCode: {
    color: '#7C6F62',
    fontSize: 10,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginVertical: 6,
  },
  planFinalPrice: {
    color: '#D96B14',
    fontSize: 22,
    fontWeight: Typography.fontWeight.bold,
  },
  planStruckPrice: {
    color: '#9CA3AF',
    fontSize: Typography.fontSize.body2,
    textDecorationLine: 'line-through',
  },
  planDays: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  planDescText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.body2,
    marginBottom: Spacing.md,
  },
  payBtn: {
    borderRadius: Spacing.borderRadius.sm,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  payBtnGradient: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.borderRadius.sm,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  /* SETTINGS HUB STYLES */
  settingsHubScroll: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    backgroundColor: '#FAF7F2',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
  },
  settingsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(224, 135, 38, 0.3)',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  settingsTitle: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
  },
  settingsSub: {
    color: '#5C4E3D',
    fontSize: 12,
    marginTop: 2,
  },
  settingsSectionHeading: {
    color: '#8C7A6B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  settingsTileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 12,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  settingsTileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(224, 135, 38, 0.25)',
  },
  settingsTileTitle: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '700',
  },
  settingsTileDesc: {
    color: '#5C4E3D',
    fontSize: 11,
    marginTop: 2,
  },
  connectedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F5EC',
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  connectedBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#17845A',
  },
  connectedBadgePillText: {
    color: '#17845A',
    fontSize: 9,
    fontWeight: '800',
  },
  managePlanBadge: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(224, 135, 38, 0.3)',
  },
  managePlanBadgeText: {
    color: '#D96B14',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 6,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    gap: 5,
  },
  themeOptionBtnActive: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#DE8626',
  },
  themeOptionText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
  },
  themeOptionTextActive: {
    color: '#D96B14',
    fontWeight: '800',
  },
  settingsLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  settingsLogoutText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  /* SUPERADMIN SETTINGS LUXURY STYLES */
  saSettingsProfileCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1.2,
    borderColor: '#DE8626',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  saSettingsProfileGradient: {
    padding: 16,
    borderRadius: 16,
  },
  saSettingsProfileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  saSettingsAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3D2F20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FEA619',
  },
  saSettingsBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  saSettingsMasterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 166, 25, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(254, 166, 25, 0.3)',
  },
  saSettingsMasterBadgeText: {
    color: '#FEA619',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  saSettingsLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  saSettingsLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#34D399',
  },
  saSettingsLiveText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
  },
  saSettingsProfileName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  saSettingsProfileMobile: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginTop: 1,
  },
  saSettingsTelemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  saSettingsTelemItem: {
    flex: 1,
  },
  saSettingsTelemLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  saSettingsTelemVal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  saSettingsTelemSub: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 9,
    marginTop: 1,
  },
  saSettingsTelemDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 8,
  },
  saActionPill: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(224, 135, 38, 0.3)',
  },
  saActionPillText: {
    color: '#D96B14',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  saSystemInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 8,
    marginBottom: 8,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  saSystemInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saSystemInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saSystemInfoLabel: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
  },
  saSystemInfoValue: {
    color: '#7C6F62',
    fontSize: 12,
    fontWeight: '600',
  },
  saSettingsLogoutBtn: {
    borderWidth: 1.5,
    borderColor: '#F87171',
    backgroundColor: '#FFF1F2',
  },
  viewOnlyPill: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
  },
  viewOnlyPillText: {
    color: '#DE8626',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ownerCommissionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.sm,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  ownerCommissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ownerCommissionLabel: {
    color: '#7C6F62',
    fontSize: 11,
  },
  ownerCommissionVal: {
    color: '#17845A',
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
  },
  ownerEntitlementsSection: {
    marginBottom: Spacing.md,
  },
  ownerEntitlementsTitle: {
    color: '#1F2937',
    fontSize: 9,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 1,
    marginBottom: 6,
  },
  ownerEntitlementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ownerEntitlementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ownerEntitlementAllowed: {
    backgroundColor: '#E4F5EC',
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.3)',
  },
  ownerEntitlementDisabled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ownerEntitlementText: {
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
  },
  ownerEntitlementTextAllowed: {
    color: '#1F2937',
  },
  ownerEntitlementTextDisabled: {
    color: '#9CA3AF',
  },
  ownerEntitlementAddonText: {
    color: '#17845A',
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
  },
  bonusWalletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4F5EC',
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    marginBottom: Spacing.xs,
    alignSelf: 'flex-start',
  },
  bonusWalletText: {
    color: '#17845A',
    fontSize: 11,
    fontWeight: '700',
  },
  lowWalletBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF3DC',
    borderWidth: 1,
    borderColor: 'rgba(254, 166, 25, 0.45)',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.md,
    gap: 10,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  lowWalletBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  lowWalletIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(254, 166, 25, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowWalletTitle: {
    color: '#A96300',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  lowWalletSubtitle: {
    color: '#5C4E3D',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  lowWalletRechargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DE8626',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  lowWalletRechargeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
