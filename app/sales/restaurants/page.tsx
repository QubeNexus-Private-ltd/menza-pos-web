'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Phone,
  MapPin,
  Wallet,
  TrendingUp,
  ReceiptIndianRupee as Receipt,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Building2,
  Calendar,
  UtensilsCrossed,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SalesService } from '@/services/salesService';
import { SalesRestaurantListItem } from '@/types/sales';

export default function SalesRestaurantsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [restaurants, setRestaurants] = useState<SalesRestaurantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'active' | 'low_wallet'>('all');

  useEffect(() => {
    const salesPersonId = (user as any)?.salesPersonId || (user as any)?.id || (user as any)?.userId || 0;
    SalesService.getMyRestaurants(salesPersonId)
      .then(setRestaurants)
      .catch((err) => console.warn('Failed to load acquired restaurants', err))
      .finally(() => setLoading(false));
  }, [(user as any)?.salesPersonId, (user as any)?.id, (user as any)?.userId]);

  // Filtered
  const filteredStores = useMemo(() => {
    return restaurants.filter((store) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        store.restaurantName.toLowerCase().includes(q) ||
        store.city.toLowerCase().includes(q) ||
        store.ownerName.toLowerCase().includes(q) ||
        store.ownerMobile.includes(q) ||
        String(store.restaurantId).includes(q);

      if (!matchesSearch) return false;
      if (activeFilterTab === 'active') return store.isActive;
      if (activeFilterTab === 'low_wallet') return store.walletBalance < 200;
      return true;
    });
  }, [restaurants, searchQuery, activeFilterTab]);

  // Aggregates
  const totals = useMemo(() => {
    const totalCount = restaurants.length;
    const activeCount = restaurants.filter((r) => r.isActive).length;
    const totalRecharged = restaurants.reduce((sum, r) => sum + r.totalRecharged, 0);
    const totalCommission = restaurants.reduce((sum, r) => sum + r.commissionGeneratedTotal, 0);
    const totalOrders = restaurants.reduce((sum, r) => sum + r.totalOrdersCount, 0);

    return { totalCount, activeCount, totalRecharged, totalCommission, totalOrders };
  }, [restaurants]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Store className="h-4 w-4" />
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] tracking-tight">
                  My Acquired Outlets
                </h1>
              </div>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                Restaurants linked to your partner referral code and generating active earnings
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push('/superadmin/onboard')}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-800 transition-all"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>ONBOARD NEW STORE</span>
            </button>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Stores */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                Acquired Stores
              </span>
              <p className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] mt-2">
                {totals.totalCount}
              </p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                {totals.activeCount} active & operating
              </p>
            </div>

            {/* Total Top-ups Recharged */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                Total Store Top-ups
              </span>
              <p className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] mt-2">
                ₹{totals.totalRecharged.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] font-medium mt-1">
                Prepaid wallet recharges
              </p>
            </div>

            {/* Total Orders Punched */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                Total Orders
              </span>
              <p className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] mt-2">
                {totals.totalOrders.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] font-medium mt-1">
                Platform fee generating orders
              </p>
            </div>

            {/* Total Commission Earned */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                Commission Generated
              </span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                ₹{totals.totalCommission.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                Credited to your earnings
              </p>
            </div>
          </div>

          {/* Search & Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
              <input
                type="text"
                placeholder="Search stores by name, city, ID, or owner mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-10 pr-4 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center gap-1 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-1">
              {[
                { id: 'all', label: 'All Stores' },
                { id: 'active', label: 'Active' },
                { id: 'low_wallet', label: 'Low Wallet' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilterTab(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                    activeFilterTab === tab.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-[#667085] hover:text-[#1E2930]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stores Table */}
          <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-xs text-[#667085] flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <span>Loading your stores...</span>
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#667085] space-y-2">
                <Store className="h-10 w-10 text-[#667085]/40 mx-auto" />
                <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">No acquired stores found</p>
                <p className="text-xs text-[#667085]">Start onboarding restaurants to build your passive commission stream.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[10px] font-black uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="py-3.5 px-5">Restaurant & Location</th>
                      <th className="py-3.5 px-4">Owner Contact</th>
                      <th className="py-3.5 px-4">Prepaid Wallet</th>
                      <th className="py-3.5 px-4">Lifetime Top-ups</th>
                      <th className="py-3.5 px-4">Orders Processed</th>
                      <th className="py-3.5 px-4">Commission Earned</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Menu Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {filteredStores.map((store) => (
                      <tr
                        key={store.restaurantId}
                        className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Store & Location */}
                        <td className="py-4 px-5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                                {store.restaurantName}
                              </p>
                              <span className="font-mono text-[10px] text-[#667085]">
                                #{store.restaurantId}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                              <span>{store.city}, {store.state}</span>
                            </p>
                          </div>
                        </td>

                        {/* Owner Contact */}
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">
                              {store.ownerName}
                            </p>
                            <p className="text-[11px] font-mono text-[#667085]">
                              +91 {store.ownerMobile}
                            </p>
                          </div>
                        </td>

                        {/* Wallet Balance */}
                        <td className="py-4 px-4">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                                ₹{store.walletBalance.toLocaleString('en-IN')}
                              </span>
                              {store.walletBalance < 200 && (
                                <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Low
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Lifetime Topups */}
                        <td className="py-4 px-4">
                          <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                            ₹{store.totalRecharged.toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* Orders Processed */}
                        <td className="py-4 px-4">
                          <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                            {store.totalOrdersCount} orders
                          </span>
                        </td>

                        {/* Commission Earned */}
                        <td className="py-4 px-4">
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                            +₹{store.commissionGeneratedTotal.toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              store.isActive
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${store.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span>{store.isActive ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>

                        {/* Manage Menu Action */}
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => router.push(`/menu?restaurantId=${store.restaurantId}`)}
                            title="Manage Menu Catalog for this outlet"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors shadow-xs"
                          >
                            <UtensilsCrossed className="h-3.5 w-3.5" />
                            <span>Manage Menu</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
