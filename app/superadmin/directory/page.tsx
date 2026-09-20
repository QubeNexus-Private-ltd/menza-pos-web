'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Store,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SuperAdminRemoteDataSource } from '@shared/data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '@shared/data/repositories/SuperAdminRepositoryImpl';
import { RestaurantDetail } from '@shared/domain/models/Restaurant';

const superAdminRepo = new SuperAdminRepositoryImpl(new SuperAdminRemoteDataSource());

export default function SuperAdminDirectoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<RestaurantDetail[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadStores = useCallback(async () => {
    try {
      setLoading(true);
      const res = await superAdminRepo.getAllRestaurants(undefined, undefined, undefined, undefined, 1, 100);
      if (res?.items) {
        setStores(res.items);
      }
    } catch (err) {
      console.warn('SuperAdmin stores error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const filteredStores = stores.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.restaurantName.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q))
    );
  });

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Active Outlets Directory
                </h1>
                <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-[#DE8626]">
                  {stores.length} Outlets
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Central tenant directory of all registered restaurants, cafes, and hotels
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadStores}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold hover:bg-black/5"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => router.push('/superadmin/onboard')}
                className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#C4721C]"
              >
                <Plus className="h-4 w-4" />
                <span>Onboard New Store</span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by store name, address, or city..."
              className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-10 pr-4 py-2.5 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
            />
          </div>

          {/* Outlets Table */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-xs text-[#667085]">Loading store directory...</div>
            ) : filteredStores.length === 0 ? (
              <div className="py-20 text-center text-xs text-[#667085]">
                No outlets found. Click "Onboard New Store" to register an outlet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Store ID</th>
                      <th className="py-3.5 px-4 font-semibold">Restaurant Name</th>
                      <th className="py-3.5 px-4 font-semibold">Location</th>
                      <th className="py-3.5 px-4 font-semibold">Contact / Phone</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {filteredStores.map((store) => (
                      <tr key={store.restaurantId} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4 font-extrabold text-[#DE8626]">
                          #{store.restaurantId}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                            {store.restaurantName}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-[#667085] dark:text-[#94A3B8]">
                          {store.address || 'Address'} {store.city ? `• ${store.city}` : ''}
                        </td>
                        <td className="py-3.5 px-4 text-[#667085]">
                          {store.ownerMobile || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
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
