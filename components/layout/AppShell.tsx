'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/navigation';
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
} from 'lucide-react';
import { StoreShiftModal } from '../common/StoreShiftModal';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { useNotificationStore } from '@shared/presentation/state/useNotificationStore';
import { useWebTheme } from '../theme/ThemeProvider';
import {
  startPosSignalRConnection,
  onPosOrderCreated,
  onPosOrderStatusChanged,
  onPosOrderSettled,
  onStoreOperatingStatusChanged,
} from '@shared/core/network/signalrService';
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
        <div className="border-t border-[#E7E1DA] dark:border-[#2B3540] p-3">
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
        </div>
      </aside>

      {/* 3. Main Workspace Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Restaurant Multi-Store Selector Dropdown */}
            {!isSuperAdmin && restaurants.length > 0 && (
              <div className="relative" ref={outletMenuRef}>
                <button
                  onClick={() => setOutletMenuOpen(!outletMenuOpen)}
                  className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-1.5 text-xs font-semibold hover:border-[#DE8626] transition-colors"
                >
                  <Store className="h-4 w-4 text-[#DE8626]" />
                  <span className="max-w-[140px] truncate sm:max-w-[200px]">
                    {activeRestaurant?.restaurantName || 'Select Outlet'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#667085]" />
                </button>

                {outletMenuOpen && (
                  <div className="absolute left-0 mt-2 w-64 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-1.5 shadow-xl z-50">
                    <p className="px-2.5 py-1 text-[11px] font-semibold text-[#667085] uppercase tracking-wider">
                      Switch Outlet ({restaurants.length})
                    </p>
                    {restaurants.map((r) => {
                      const isSelected = r.restaurantId === activeRestaurant?.restaurantId;
                      return (
                        <button
                          key={r.restaurantId}
                          onClick={() => handleSelectRestaurant(r)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                            isSelected
                              ? 'bg-amber-500/10 font-semibold text-[#DE8626]'
                              : 'text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="text-left truncate">
                            <p className="truncate font-medium">{r.restaurantName}</p>
                            <p className="text-[10px] text-[#667085] dark:text-[#94A3B8]">{r.address || 'Outlet'}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-[#DE8626]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Store Operating Status Badge */}
            {operatingStatus && !isSuperAdmin && (
              <button
                type="button"
                onClick={() => setShiftModalOpen(true)}
                title="Click to change store shift or operating timings"
                className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1 text-[11px] font-medium hover:border-[#DE8626] transition-colors cursor-pointer"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    operatingStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span>{operatingStatus.isOpen ? 'Store Open' : 'Store Closed'}</span>
              </button>
            )}
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick POS Terminal Button on Tablet/Desktop */}
            {!isSuperAdmin && (
              <button
                onClick={() => router.push('/pos')}
                className="hidden md:flex items-center gap-2 rounded-xl bg-[#DE8626] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-[#DE8626]/30 hover:bg-[#C4721C] transition-colors"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>New Sale (POS)</span>
              </button>
            )}

            {/* Today's Sales Pill */}
            {!isSuperAdmin && (
              <div className="hidden lg:flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-1 text-xs">
                <span className="text-[#667085] dark:text-[#94A3B8]">Today:</span>
                <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">₹{todaySales.revenue.toLocaleString('en-IN')}</span>
                <span className="text-[11px] text-[#667085]">({todaySales.orderCount} orders)</span>
              </div>
            )}

            {/* Real-time Order Notification Bell */}
            <div className="relative" ref={notifMenuRef}>
              <button
                onClick={() => setNotifDrawerOpen(!notifDrawerOpen)}
                className="relative rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-2 text-[#667085] dark:text-[#94A3B8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Order Alerts"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Drawer Popover */}
              {notifDrawerOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] px-4 py-3 bg-[#FAF7F2] dark:bg-[#151A20]">
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
                      notifications.slice(0, 15).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={`p-3 text-xs transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${
                            !n.isRead ? 'bg-amber-500/5' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                              #{n.orderId} • {n.tableName}
                            </span>
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-[#DE8626]">
                              {n.orderStatus}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-1">{n.itemsSummary}</p>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-[#667085]">
                            <span>₹{n.totalAmount} • {n.customerName}</span>
                            <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-2 text-[#667085] dark:text-[#94A3B8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Toggle Theme"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Global Floating Toast Alert for Incoming Real-Time Orders */}
        {latestIncomingOrder && (
          <div className="fixed top-20 right-4 z-50 flex w-80 sm:w-96 items-start gap-3 rounded-2xl border border-amber-400/40 bg-[#FFFFFF] dark:bg-[#1E1E1E] p-4 shadow-2xl shadow-amber-500/20 animate-bounce">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-[#DE8626]">
              <Sparkles className="h-5 w-5 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#DE8626] uppercase tracking-wider">New Incoming Order!</p>
                <button
                  onClick={dismissBanner}
                  className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                Order #{latestIncomingOrder.orderId} • {latestIncomingOrder.tableName}
              </p>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] line-clamp-1">
                {latestIncomingOrder.itemsSummary}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    dismissBanner();
                    router.push('/pos');
                  }}
                  className="rounded-lg bg-[#DE8626] px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#C4721C]"
                >
                  Open in POS
                </button>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{latestIncomingOrder.totalAmount}
                </span>
              </div>
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
};
