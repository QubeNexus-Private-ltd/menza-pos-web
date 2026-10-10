'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Table,
  BarChart3,
  Users,
  Settings,
  Building2,
  Store,
  Crown,
  Bell,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Wallet,
  QrCode,
  Clock,
  Radio,
  Sparkles,
  Check,
  AlertCircle,
  ChefHat,
  CalendarDays,
  Receipt,
  Printer,
  TrendingUp,
} from 'lucide-react';
import { StoreShiftModal } from '../common/StoreShiftModal';
import { WalletBalanceWidget } from '../common/WalletBalanceWidget';
import { WalletRechargeModal } from '../common/WalletRechargeModal';
import { SubscriptionGraceBanner } from '../subscription/SubscriptionGraceBanner';
import { SubscriptionBlockerModal } from '../subscription/SubscriptionBlockerModal';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { useNotificationStore } from '@shared/presentation/state/useNotificationStore';
import { useWebTheme } from '../theme/ThemeProvider';
import {
  startPosSignalRConnection,
  onPosOrderCreated,
  onPosOrderStatusChanged,
  onPosOrderSettled,
  onStoreOperatingStatusChanged,
  onServiceRequestCreated,
  onServiceRequestResolved,
  onSignalRReconnected,
} from '@/lib/signalr/signalrService';
import { RestaurantDetail } from '@shared/domain/models/Restaurant';
import { playOrderNotificationSound } from '@shared/core/utils/notificationSound';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { StoreOperatingStatus } from '@shared/domain/models/RestaurantConfig';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { WalletRemoteDataSource } from '@shared/data/datasources/WalletRemoteDataSource';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeRestaurant, restaurants, setActiveRestaurant, logout } = useAuthStore();
  const { theme, toggleTheme, isDark } = useWebTheme();
  const {
    subscription,
    isExpired,
    lifecycleState,
    daysRemaining,
    isInGracePeriod,
    openRenewalModal,
  } = useSubscriptionStore();
  const {
    unreadCount,
    notifications,
    latestIncomingOrder,
    dismissBanner,
    markAsRead,
    markAllAsRead,
    handleOrderStatusChanged,
    processIncomingOrders,
  } = useNotificationStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [outletMenuOpen, setOutletMenuOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [operatingStatus, setOperatingStatus] = useState<StoreOperatingStatus | null>(null);
  const [todaySales, setTodaySales] = useState<{ revenue: number; orderCount: number }>({ revenue: 0, orderCount: 0 });
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const outletMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const roleName = user?.roles?.[0] || 'Owner';
  const isSuperAdmin =
    user?.roles?.some((r) =>
      ['SUPERADMIN', 'SUPER_ADMIN', 'SUPERADMINONLY'].includes(r.toUpperCase().replace(/[^A-Z]/g, ''))
    ) || Boolean(roleName && roleName.toLowerCase().includes('superadmin'));

  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  // Close popups on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (outletMenuRef.current && !outletMenuRef.current.contains(e.target as Node)) {
        setOutletMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setNotifDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch telemetry & initialize SignalR connection
  useEffect(() => {
    if (!currentRestId || isSuperAdmin) return;

    const orderDs = new OrderRemoteDataSource();
    const configDs = new RestaurantConfigRemoteDataSource();
    const walletDs = new WalletRemoteDataSource();

    const loadData = async () => {
      try {
        const [rev, op, wal] = await Promise.allSettled([
          orderDs.getTodayRevenue(currentRestId),
          configDs.getOperatingStatus(currentRestId),
          walletDs.getWallet(currentRestId),
        ]);

        if (rev.status === 'fulfilled' && rev.value) {
          setTodaySales({
            revenue: Number(rev.value.todayRevenue || 0),
            orderCount: Number(rev.value.todayOrdersCount || 0),
          });
        }
        if (op.status === 'fulfilled' && op.value) {
          setOperatingStatus(op.value);
        }
        if (wal.status === 'fulfilled' && wal.value) {
          setWalletBalance(Number(wal.value.balance || 0));
        }

        // Check active restaurant subscription lifecycle state
        useSubscriptionStore.getState().fetchSubscriptionStatus(currentRestId);
      } catch (err) {
        console.warn('Failed to load restaurant telemetry', err);
      }
    };

    loadData();

    // Start SignalR
    let isMounted = true;
    startPosSignalRConnection(currentRestId)
      .then(() => {
        if (isMounted) setIsLiveConnected(true);
      })
      .catch(() => {
        if (isMounted) setIsLiveConnected(false);
      });

    const unsubCreated = onPosOrderCreated((order) => {
      handleOrderStatusChanged(order);
      loadData();
    });

    const unsubStatus = onPosOrderStatusChanged((event) => {
      handleOrderStatusChanged(event);
      loadData();
    });

    const unsubSettled = onPosOrderSettled((order) => {
      handleOrderStatusChanged(order);
      loadData();
    });

    const unsubOp = onStoreOperatingStatusChanged((status) => {
      setOperatingStatus(status);
    });

    const unsubServiceCreated = onServiceRequestCreated((req) => {
      useNotificationStore.getState().handleServiceRequest(req);
    });

    const unsubServiceResolved = onServiceRequestResolved((res) => {
      useNotificationStore.getState().handleServiceRequestResolved(res);
    });

    const unsubReconnected = onSignalRReconnected(() => {
      loadData();
    });

    // Poll fallback every 45s
    const pollInterval = setInterval(() => {
      orderDs
        .getTodayOrders(currentRestId, 'ALL', 1, 20)
        .then((res) => {
          if (res?.items) processIncomingOrders(res.items);
        })
        .catch(() => {});
    }, 45000);

    return () => {
      isMounted = false;
      unsubCreated();
      unsubStatus();
      unsubSettled();
      unsubOp();
      unsubServiceCreated();
      unsubServiceResolved();
      unsubReconnected();
      clearInterval(pollInterval);
    };
  }, [currentRestId, isSuperAdmin, handleOrderStatusChanged, processIncomingOrders]);

  const navItems = isSuperAdmin
    ? [
        { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
        { href: '/superadmin/directory', label: 'Outlets', icon: Building2 },
        { href: '/superadmin/onboard', label: 'Onboard Store', icon: Store },
        { href: '/superadmin/plans', label: 'Plans & Pricing', icon: Crown },
        { href: '/settings', label: 'Settings', icon: Settings },
      ]
    : [
        { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
        { href: '/pos', label: 'POS Terminal', icon: ShoppingBag, highlight: true },
        { href: '/orders', label: 'Orders & History', icon: Receipt },
        { href: '/kitchen', label: 'Kitchen & KDS', icon: ChefHat },
        { href: '/reservations', label: 'Reservations', icon: CalendarDays },
        { href: '/tables', label: 'Floor Tables', icon: Table },
        { href: '/menu', label: 'Menu Catalog', icon: UtensilsCrossed },
        { href: '/wallet', label: 'Prepaid Wallet', icon: Wallet },
        { href: '/reports', label: 'Analytics', icon: BarChart3 },
        { href: '/staff', label: 'Staff & Roles', icon: Users },
        { href: '/settings', label: 'Settings', icon: Settings },
      ];

  const mobileNavItems = isSuperAdmin
    ? navItems
    : [
        { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
        { href: '/pos', label: 'POS', icon: ShoppingBag },
        { href: '/orders', label: 'Orders', icon: Receipt },
        { href: '/tables', label: 'Tables', icon: Table },
        { href: '/settings', label: 'Settings', icon: Settings },
      ];

  const handleSelectRestaurant = (rest: RestaurantDetail) => {
    setActiveRestaurant(rest);
    setOutletMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FAF7F2] dark:bg-[#111418] text-[#1E2930] dark:text-[#F3F4F6]">
      {/* 1. Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 2. Desktop & Tablet Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-[#E7E1DA] dark:border-[#2B3540]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#DE8626] to-[#B7791F] text-white shadow-md shadow-[#DE8626]/20">
              <span className="font-extrabold text-lg tracking-wider">M</span>
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">Menza</span>
              <span className="block text-[10px] font-semibold tracking-wider text-[#DE8626] uppercase">Restaurant Suite</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Active Outlet Summary Card */}
        {!isSuperAdmin && activeRestaurant && (
          <div className="px-4 py-3 border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 bg-[#FAF7F2]/60 dark:bg-[#151A20]/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-[#667085] dark:text-[#94A3B8]">Active Outlet</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] truncate">
              {activeRestaurant.restaurantName}
            </p>
            <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] truncate">
              {activeRestaurant.address || 'Central Terminal'}
            </p>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  setSidebarOpen(false);
                }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#DE8626] text-white shadow-sm shadow-[#DE8626]/30 font-semibold'
                    : item.highlight
                    ? 'text-[#DE8626] bg-[#DE8626]/10 hover:bg-[#DE8626]/20 font-semibold'
                    : 'text-[#667085] dark:text-[#94A3B8] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                }`}
              >
                <Icon
                  className={`h-5 w-5 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-white' : item.highlight ? 'text-[#DE8626]' : 'text-current'
                  }`}
                />
                <span>{item.label}</span>
                {item.highlight && !isActive && (
                  <span className="ml-auto rounded-full bg-[#DE8626] px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                    Sale
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="border-t border-[#E7E1DA] dark:border-[#2B3540] p-3 space-y-1.5">
          <div className="flex items-center gap-3 rounded-xl p-2 bg-[#FAF7F2] dark:bg-[#151A20]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-xs font-bold text-[#DE8626]">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'ME'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] truncate">
                {user?.name || user?.mobile || 'Admin'}
              </p>
              <p className="text-[10px] text-[#667085] dark:text-[#94A3B8] uppercase tracking-wide">
                {roleName}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="rounded-lg p-1.5 text-[#667085] hover:bg-red-500/10 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2.5 px-2 text-[10px] text-[#667085] dark:text-[#94A3B8]">
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[#DE8626] transition-colors">
              Terms
            </a>
            <span>•</span>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[#DE8626] transition-colors">
              Privacy
            </a>
            <span>•</span>
            <span>Menza Suite</span>
          </div>
        </div>
      </aside>

      {/* 3. Main Workspace Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] bg-white/95 dark:bg-[#1B2127]/95 backdrop-blur-md px-3 sm:px-5 lg:px-6 transition-colors">
          {/* LEFT: Mobile Toggle + Outlet Switcher + Operating Shift + Live Cloud */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-full p-2 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors lg:hidden"
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Restaurant Outlet Selector Pill */}
            {!isSuperAdmin && restaurants.length > 0 && (
              <div className="relative" ref={outletMenuRef}>
                <button
                  type="button"
                  onClick={() => setOutletMenuOpen(!outletMenuOpen)}
                  className="group inline-flex h-[36px] items-center gap-2 rounded-full border border-[#E7E0D6] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-2 pr-3 text-xs font-bold transition-all shadow-xs hover:border-[#DE8626] hover:bg-white dark:hover:bg-[#1B2127]"
                  title="Switch Active Restaurant Outlet"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[#DE8626]">
                    <Store className="h-3 w-3" />
                  </div>
                  <span className="truncate max-w-[110px] sm:max-w-[180px] font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    {activeRestaurant?.restaurantName || 'Select Outlet'}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-[#667085] group-hover:text-[#DE8626] transition-colors" />
                </button>

                {outletMenuOpen && (
                  <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 mb-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#667085]">
                        Switch Outlet ({restaurants.length})
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                      </span>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {restaurants.map((r) => {
                        const isSelected = r.restaurantId === activeRestaurant?.restaurantId;
                        return (
                          <button
                            key={r.restaurantId}
                            onClick={() => handleSelectRestaurant(r)}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors text-left ${
                              isSelected
                                ? 'bg-amber-500/10 font-bold text-[#DE8626]'
                                : 'text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            <div className="truncate min-w-0 pr-2">
                              <p className="truncate font-bold">{r.restaurantName}</p>
                              <p className="text-[10px] text-[#667085] truncate">{r.address || r.city || 'Outlet'}</p>
                            </div>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-[#DE8626]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Store Operating Shift Indicator Pill */}
            {operatingStatus && !isSuperAdmin && (
              <button
                type="button"
                onClick={() => setShiftModalOpen(true)}
                title="Store Operating Status • Click to Open Shift / Edit Timings"
                className={`hidden sm:inline-flex h-[36px] items-center gap-1.5 rounded-full border px-3 text-[11px] font-extrabold transition-all shadow-xs cursor-pointer ${
                  operatingStatus.isOpen
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15'
                    : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/15'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    operatingStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span>{operatingStatus.isOpen ? 'Store Open' : 'Store Closed'}</span>
              </button>
            )}

            {/* SignalR Cloud Live Sync Badge (Desktop) */}
            <div
              title={isLiveConnected ? 'Connected to Menza Live Real-Time Gateway' : 'Connecting to Live Gateway...'}
              className="hidden 2xl:flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Cloud</span>
            </div>
          </div>

          {/* RIGHT: Telemetry + Plans + Wallet + Printer + Bell + Theme + New Sale */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Today's Sales Telemetry Pill */}
            {!isSuperAdmin && (
              <div
                title={`Today's Revenue: ₹${todaySales.revenue.toLocaleString('en-IN')} across ${todaySales.orderCount} orders`}
                className="hidden xl:inline-flex h-[36px] items-center gap-2 rounded-full border border-[#E7E0D6] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 text-xs shadow-xs"
              >
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[#667085] dark:text-[#94A3B8]">Today:</span>
                <strong className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{todaySales.revenue.toLocaleString('en-IN')}
                </strong>
                <span className="rounded-full bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-[#667085]">
                  {todaySales.orderCount}
                </span>
              </div>
            )}

            {/* 1. Subscription & Licensing Pill (Renew or Explore Other Plans) */}
            {!isSuperAdmin && currentRestId > 0 && (
              <button
                type="button"
                onClick={() => openRenewalModal(undefined, 'renew')}
                title="Subscription & Licensing • Click to Renew or Explore Other Plans"
                className={`group inline-flex h-[36px] items-center gap-2 rounded-full border pl-2.5 pr-1.5 text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-[0.98] ${
                  isExpired || lifecycleState === 'EXPIRED'
                    ? 'border-red-500/40 bg-red-500/10 text-red-600 ring-1 ring-red-500/30 animate-pulse'
                    : isInGracePeriod || (daysRemaining > 0 && daysRemaining <= 3)
                    ? 'border-amber-400 bg-[#FFF7EE] dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 ring-1 ring-amber-400/30'
                    : 'border-[#E7E0D6] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#1C1917] dark:text-[#F3F4F6] hover:border-[#DE8626] hover:shadow-sm'
                }`}
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[#DE8626]">
                  <Crown className="h-3 w-3" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="truncate max-w-[85px] sm:max-w-[130px] font-extrabold">
                    {subscription?.planName || 'Store Plan'}
                  </span>
                  {daysRemaining > 0 && (
                    <span className="text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                      ({daysRemaining}d)
                    </span>
                  )}
                </div>
                <span className="rounded-full bg-amber-500/15 group-hover:bg-[#DE8626] group-hover:text-white px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#DE8626] transition-colors tracking-tight">
                  Renew / Plans
                </span>
              </button>
            )}

            {/* 2. Prepaid Platform Fee Wallet Pill (Identical UX to F:\Menza) */}
            {!isSuperAdmin && currentRestId > 0 && (
              <WalletBalanceWidget
                restaurantId={currentRestId}
                variant="pill"
                onPress={() => setWalletModalOpen(true)}
              />
            )}

            {/* 3. Quick Bluetooth / Thermal Printer Status Action (parity with F:\Menza) */}
            {!isSuperAdmin && (
              <button
                type="button"
                onClick={() => router.push('/settings/printer')}
                title="Printer Setup & ESC/POS Status • Click to Configure"
                className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-full border border-[#E7E0D6] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:border-[#DE8626] hover:text-[#DE8626] transition-all relative shadow-xs"
              >
                <Printer className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1B2127]" />
              </button>
            )}

            {/* 4. Real-time Order Alerts Notification Bell */}
            <div className="relative" ref={notifMenuRef}>
              <button
                type="button"
                onClick={() => setNotifDrawerOpen(!notifDrawerOpen)}
                className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-full border border-[#E7E0D6] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:border-[#DE8626] hover:text-[#DE8626] transition-all relative shadow-xs"
                title="Live Order Alerts"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white shadow-sm animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Drawer Popover */}
              {notifDrawerOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] px-4 py-3.5 bg-[#FAF7F2] dark:bg-[#151A20]">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[#DE8626]" />
                      <span className="text-xs font-bold uppercase tracking-wider">Live Order Alerts</span>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-semibold text-[#DE8626] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#667085] dark:text-[#94A3B8]">
                        No active order alerts
                      </div>
                    ) : (
                      notifications.slice(0, 15).map((n) => {
                        const isBill = n.eventType === 'REQUEST_BILL' || n.orderStatus === 'BILL_REQUESTED';
                        const isWater = n.eventType === 'REQUEST_WATER';
                        const isWaiter = n.eventType === 'CALL_WAITER' || n.orderStatus === 'WAITER_CALLED';

                        return (
                          <div
                            key={n.id}
                            onClick={() => {
                              markAsRead(n.id);
                              if (isBill || isWaiter || isWater) {
                                router.push('/tables');
                              } else {
                                router.push('/orders');
                              }
                            }}
                            className={`p-3 text-xs transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${
                              !n.isRead ? (isBill ? 'bg-rose-500/5' : isWater ? 'bg-sky-500/5' : 'bg-amber-500/5') : ''
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                                {n.orderId > 0 ? `#${n.orderId} • ` : ''}{n.tableName}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  isBill
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                    : isWater
                                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                                    : isWaiter
                                    ? 'bg-amber-500/15 text-[#DE8626] border border-amber-500/20'
                                    : 'bg-amber-500/10 text-[#DE8626]'
                                }`}
                              >
                                {isBill ? 'Pre-Bill' : isWater ? 'Water' : isWaiter ? 'Waiter Call' : n.orderStatus}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-1">{n.itemsSummary}</p>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-[#667085]">
                              <span>{n.totalAmount > 0 ? `₹${n.totalAmount} • ` : ''}{n.customerName}</span>
                              <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-full border border-[#E7E0D6] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:border-[#DE8626] hover:text-[#DE8626] transition-all shadow-xs"
              title="Toggle Day / Night Mode"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* 6. Quick POS Terminal Button (when not on POS page) */}
            {!isSuperAdmin && pathname !== '/pos' && (
              <button
                type="button"
                onClick={() => router.push('/pos')}
                className="hidden sm:inline-flex h-[36px] items-center gap-1.5 rounded-full bg-gradient-to-r from-[#DE8626] to-[#CB741B] px-3.5 text-xs font-extrabold text-white shadow-md shadow-[#DE8626]/20 hover:from-[#C4721C] hover:to-[#B66415] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>New Sale</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Floating Toast Alert for Incoming Real-Time Orders & Service Requests */}
        {latestIncomingOrder && (() => {
          const isBillRequest = latestIncomingOrder.eventType === 'REQUEST_BILL' || latestIncomingOrder.orderStatus === 'BILL_REQUESTED';
          const isWaiterCall = latestIncomingOrder.eventType === 'CALL_WAITER' || latestIncomingOrder.orderStatus === 'WAITER_CALLED';
          const isWaterRequest = latestIncomingOrder.eventType === 'REQUEST_WATER';
          const isServiceCall = isBillRequest || isWaiterCall || isWaterRequest;

          return (
            <div
              className={`fixed top-20 right-4 z-50 flex w-80 sm:w-96 items-start gap-3 rounded-2xl border p-4 shadow-2xl transition-all ${
                isBillRequest
                  ? 'border-rose-500/50 bg-[#FFFFFF] dark:bg-[#1C1417] shadow-rose-500/20'
                  : isWaterRequest
                  ? 'border-sky-500/50 bg-[#FFFFFF] dark:bg-[#111922] shadow-sky-500/20'
                  : isWaiterCall
                  ? 'border-amber-500/50 bg-[#FFFFFF] dark:bg-[#1F1812] shadow-amber-500/20'
                  : 'border-amber-400/40 bg-[#FFFFFF] dark:bg-[#1E1E1E] shadow-amber-500/20'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isBillRequest
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                    : isWaterRequest
                    ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                    : isWaiterCall
                    ? 'bg-amber-500/20 text-[#DE8626]'
                    : 'bg-amber-500/20 text-[#DE8626]'
                }`}
              >
                {isBillRequest ? (
                  <Receipt className="h-5 w-5 animate-pulse" />
                ) : isWaterRequest ? (
                  <Sparkles className="h-5 w-5 text-sky-500" />
                ) : isWaiterCall ? (
                  <Bell className="h-5 w-5 animate-bounce" />
                ) : (
                  <Sparkles className="h-5 w-5 animate-spin" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isBillRequest
                        ? 'text-rose-600 dark:text-rose-400'
                        : isWaterRequest
                        ? 'text-sky-600 dark:text-sky-400'
                        : 'text-[#DE8626]'
                    }`}
                  >
                    {isBillRequest
                      ? 'Pre-Bill Requested!'
                      : isWaterRequest
                      ? 'Water Refill Requested!'
                      : isWaiterCall
                      ? 'Guest Calling Waiter!'
                      : 'New Incoming Order!'}
                  </p>
                  <button
                    onClick={dismissBanner}
                    className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  {latestIncomingOrder.tableName || 'Counter'} {latestIncomingOrder.orderId > 0 ? `• Order #${latestIncomingOrder.orderId}` : ''}
                </p>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] line-clamp-1">
                  {latestIncomingOrder.itemsSummary}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {isBillRequest ? (
                    <>
                      <button
                        onClick={() => {
                          dismissBanner();
                          router.push('/tables');
                        }}
                        className="rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1 text-xs font-bold text-white shadow-sm"
                      >
                        Settle Bill
                      </button>
                      <button
                        onClick={() => {
                          dismissBanner();
                          router.push('/pos');
                        }}
                        className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] px-3 py-1 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5"
                      >
                        Open POS
                      </button>
                    </>
                  ) : isServiceCall ? (
                    <>
                      <button
                        onClick={() => {
                          dismissBanner();
                          router.push('/tables');
                        }}
                        className="rounded-lg bg-[#DE8626] hover:bg-[#C4721C] px-3 py-1 text-xs font-bold text-white shadow-sm"
                      >
                        View Table
                      </button>
                      <button
                        onClick={dismissBanner}
                        className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] px-3 py-1 text-xs font-semibold text-[#667085] hover:bg-black/5"
                      >
                        Acknowledge
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          dismissBanner();
                          router.push('/pos');
                        }}
                        className="rounded-lg bg-[#DE8626] px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#C4721C]"
                      >
                        Open in POS
                      </button>
                      {latestIncomingOrder.totalAmount > 0 && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{latestIncomingOrder.totalAmount}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Sticky Subscription Grace Period / Expiration Notice */}
        <SubscriptionGraceBanner />

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {children}
        </main>

        {/* 4. Mobile Bottom Navigation Bar (< 768px) */}
        <div className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] px-2 lg:hidden">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
                  isActive ? 'text-[#DE8626]' : 'text-[#667085] dark:text-[#94A3B8]'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Store Shift / Operating Timings Modal */}
        {shiftModalOpen && (
          <StoreShiftModal
            isOpen={shiftModalOpen}
            onClose={() => setShiftModalOpen(false)}
            restaurantId={currentRestId}
            restaurantName={activeRestaurant?.restaurantName || 'Restaurant'}
            currentStatus={operatingStatus}
            onStatusUpdated={(newStatus) => setOperatingStatus(newStatus)}
          />
        )}

        {/* Subscription Expiration / Renewal Paywall Blocker */}
        <SubscriptionBlockerModal />

        {/* Prepaid Platform Fee Wallet Recharge Modal */}
        {walletModalOpen && (
          <WalletRechargeModal
            isOpen={walletModalOpen}
            onClose={() => setWalletModalOpen(false)}
            restaurantId={currentRestId}
          />
        )}
      </div>
    </div>
  );
};
