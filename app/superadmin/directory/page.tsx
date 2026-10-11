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
  UserCheck,
  User,
  Power,
  Phone,
  MapPin,
  X,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SuperAdminRemoteDataSource } from '@shared/data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '@shared/data/repositories/SuperAdminRepositoryImpl';
import { RoleRemoteDataSource } from '@shared/data/datasources/RoleRemoteDataSource';
import { RoleRepositoryImpl } from '@shared/data/repositories/RoleRepositoryImpl';
import { RestaurantDetail } from '@shared/domain/models/Restaurant';
import { apiClient } from '@shared/core/network/apiClient';

const superAdminRepo = new SuperAdminRepositoryImpl(new SuperAdminRemoteDataSource());
const roleRepo = new RoleRepositoryImpl(new RoleRemoteDataSource());

export default function SuperAdminDirectoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<RestaurantDetail[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'active' | 'inactive'>('all');
  const [togglingStoreId, setTogglingStoreId] = useState<number | null>(null);

  // Assign Owner Modal State (Parity with F:\Menza)
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetStore, setTargetStore] = useState<RestaurantDetail | null>(null);
  const [ownerMobile, setOwnerMobile] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [mobileLookupLoading, setMobileLookupLoading] = useState(false);
  const [existingUserFound, setExistingUserFound] = useState<boolean | null>(null);

  const loadStores = useCallback(async () => {
    try {
      setLoading(true);
      const res = await superAdminRepo.getAllRestaurants(undefined, undefined, undefined, undefined, 1, 200);
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

  // Real-time user lookup when typing mobile in Assign Owner modal
  useEffect(() => {
    const clean = ownerMobile.replace(/\D/g, '');
    if (clean.length !== 10) {
      setExistingUserFound(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setMobileLookupLoading(true);
        const res = await apiClient.get(`/UserMaster/by-mobile/${clean}`);
        if (res.data && (res.data.id || res.data.Id || res.data.userId)) {
          setExistingUserFound(true);
          const foundName = res.data.name || res.data.Name || '';
          if (foundName && !ownerName.trim()) {
            setOwnerName(foundName);
          }
        } else {
          setExistingUserFound(false);
        }
      } catch {
        setExistingUserFound(false);
      } finally {
        setMobileLookupLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [ownerMobile]);

  // Toggle store active / inactive status
  const handleToggleStoreStatus = async (store: RestaurantDetail) => {
    const currentActive = store.isActive ?? true;
    const newStatus = !currentActive;
    try {
      setTogglingStoreId(store.restaurantId);
      const res = await superAdminRepo.toggleRestaurantStatus(store.restaurantId, newStatus);
      if (res) {
        setStores((prev) =>
          prev.map((s) => (s.restaurantId === store.restaurantId ? { ...s, isActive: newStatus } : s))
        );
      } else {
        alert('Could not update store status. Please try again.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error updating store status');
    } finally {
      setTogglingStoreId(null);
    }
  };

  // Open Assign Owner Modal
  const handleOpenAssignModal = (store: RestaurantDetail) => {
    setTargetStore(store);
    setOwnerMobile('');
    setOwnerName('');
    setExistingUserFound(null);
    setAssignModalOpen(true);
  };

  // Submit Assign Owner
  const handleSaveOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStore) return;
    const cleanMobile = ownerMobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!ownerName.trim()) {
      alert('Please enter the owner full name.');
      return;
    }

    try {
      setAssigningLoading(true);
      let userId = 0;

      // Check existing user
      try {
        const uRes = await apiClient.get(`/UserMaster/by-mobile/${cleanMobile}`);
        if (uRes.data) {
          userId = Number(uRes.data.id ?? uRes.data.Id ?? uRes.data.userId ?? 0);
        }
      } catch {
        // Not found
      }

      // Create user if missing
      if (!userId || userId <= 0) {
        const createRes = await apiClient.post('/UserMaster', {
          name: ownerName.trim(),
          mobile: cleanMobile,
          Name: ownerName.trim(),
          Mobile: cleanMobile,
        });
        const resData = createRes.data;
        if (typeof resData === 'number') {
          userId = resData;
        } else if (resData && typeof resData === 'object') {
          userId = Number(resData.id ?? resData.Id ?? resData.userId ?? 0);
        }
      }

      if (userId && userId > 0) {
        // Assign Owner Role (roleId: 2)
        await roleRepo.assignRole({
          userId,
          roleId: 2,
          restId: targetStore.restaurantId,
          restaurantId: targetStore.restaurantId,
          isDefault: true,
        });

        alert(`Successfully assigned ${ownerName} (${cleanMobile}) as Store Owner for ${targetStore.restaurantName}!`);
        setAssignModalOpen(false);
        await loadStores();
      } else {
        alert('Could not create or retrieve user ID for role assignment.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to assign store owner');
    } finally {
      setAssigningLoading(false);
    }
  };

  const filteredStores = stores.filter((s) => {
    // Tab filter
    if (activeFilterTab === 'active' && s.isActive === false) return false;
    if (activeFilterTab === 'inactive' && s.isActive !== false) return false;

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.restaurantName.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q)) ||
      String(s.restaurantId).includes(q)
    );
  });

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
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
                Central tenant directory of all registered restaurants, cafes, and multi-store hotel networks
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadStores}
                disabled={loading}
                className="flex items-center gap-2 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-4 py-2.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => router.push('/superadmin/onboard')}
                className="flex items-center gap-2 rounded-2xl bg-[#DE8626] px-5 py-2.5 text-xs font-black text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Onboard New Store</span>
              </button>
            </div>
          </div>

          {/* Controls Bar: Search & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by store name, ID, city, or address..."
                className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-10 pr-4 py-2.5 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
              />
            </div>

            {/* Filter Tabs (Parity with F:\Menza) */}
            <div className="flex items-center gap-1 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-1">
              <button
                onClick={() => setActiveFilterTab('all')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeFilterTab === 'all'
                    ? 'bg-[#DE8626] text-white shadow-xs'
                    : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                }`}
              >
                All ({stores.length})
              </button>
              <button
                onClick={() => setActiveFilterTab('active')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeFilterTab === 'active'
                    ? 'bg-[#DE8626] text-white shadow-xs'
                    : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                }`}
              >
                Active ({stores.filter((s) => s.isActive !== false).length})
              </button>
              <button
                onClick={() => setActiveFilterTab('inactive')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeFilterTab === 'inactive'
                    ? 'bg-[#DE8626] text-white shadow-xs'
                    : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                }`}
              >
                Inactive ({stores.filter((s) => s.isActive === false).length})
              </button>
            </div>
          </div>

          {/* Outlets Table */}
          <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-24 text-center text-xs text-[#667085] flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-[#DE8626]" />
                <span>Loading store directory...</span>
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="py-24 text-center text-xs text-[#667085]">
                No outlets found matching the search criteria. Click "Onboard New Store" to register a location.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">Store ID</th>
                      <th className="py-3.5 px-4 font-bold">Restaurant Outlet</th>
                      <th className="py-3.5 px-4 font-bold">Location & Address</th>
                      <th className="py-3.5 px-4 font-bold">Assigned Owner</th>
                      <th className="py-3.5 px-4 font-bold">Status</th>
                      <th className="py-3.5 px-4 font-bold text-right">Master Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {filteredStores.map((store) => {
                      const isActive = store.isActive ?? true;
                      const isToggling = togglingStoreId === store.restaurantId;

                      return (
                        <tr key={store.restaurantId} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4 font-extrabold text-[#DE8626]">
                            #{store.restaurantId}
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626] font-bold">
                                <Store className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                                  {store.restaurantName}
                                </p>
                                <span className="text-[10px] text-[#667085]">
                                  Role: {store.role || 'Owner'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-[#667085] dark:text-[#94A3B8]">
                            <p className="line-clamp-1">{store.address || 'Central Terminal'}</p>
                            <p className="text-[11px] font-semibold text-[#1E2930] dark:text-[#F3F4F6] mt-0.5">
                              {store.city || 'Bengaluru'}{store.state ? `, ${store.state}` : ''}
                            </p>
                          </td>

                          <td className="py-4 px-4">
                            {store.ownerMobile ? (
                              <div>
                                <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">{store.ownerName || 'Store Owner'}</p>
                                <p className="text-[11px] text-[#667085] font-mono">{store.ownerMobile}</p>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenAssignModal(store)}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-[#DE8626] hover:bg-amber-500/20"
                              >
                                <UserCheck className="h-3 w-3" />
                                <span>+ Assign Owner</span>
                              </button>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                isActive
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-red-500/15 text-red-600 dark:text-red-400'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                                }`}
                              />
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Assign / Change Owner */}
                              <button
                                onClick={() => handleOpenAssignModal(store)}
                                title="Assign or Change Store Owner"
                                className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-2.5 py-1 text-xs font-semibold text-[#667085] hover:text-[#DE8626] hover:border-[#DE8626] transition-colors"
                              >
                                Owner
                              </button>

                              {/* Activate / Deactivate Toggle */}
                              <button
                                onClick={() => handleToggleStoreStatus(store)}
                                disabled={isToggling}
                                title={isActive ? 'Deactivate Store' : 'Activate Store'}
                                className={`rounded-xl border px-2.5 py-1 text-xs font-bold transition-colors ${
                                  isActive
                                    ? 'border-red-500/30 text-red-600 hover:bg-red-500/10'
                                    : 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10'
                                }`}
                              >
                                {isToggling ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : isActive ? (
                                  'Deactivate'
                                ) : (
                                  'Activate'
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assign Store Owner Modal (Parity with F:\Menza) */}
          {assignModalOpen && targetStore && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      Assign Store Owner
                    </h3>
                    <p className="text-xs text-[#667085]">
                      {targetStore.restaurantName} (ID #{targetStore.restaurantId})
                    </p>
                  </div>
                  <button
                    onClick={() => setAssignModalOpen(false)}
                    className="rounded-xl p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveOwner} className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-[#667085] uppercase">
                        Owner Mobile Number (10 Digits) *
                      </label>
                      {mobileLookupLoading && (
                        <span className="text-[10px] text-[#DE8626] flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Checking...
                        </span>
                      )}
                      {existingUserFound === true && (
                        <span className="text-[10px] font-bold text-emerald-600">Existing User</span>
                      )}
                      {existingUserFound === false && (
                        <span className="text-[10px] font-bold text-amber-600">New User</span>
                      )}
                    </div>
                    <input
                      type="tel"
                      required
                      autoFocus
                      maxLength={10}
                      value={ownerMobile}
                      onChange={(e) => setOwnerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#667085] uppercase mb-1">
                      Owner Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>

                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-800 dark:text-amber-200">
                    Assigning will grant this user complete Owner privileges (roleId: 2) for this store location.
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignModalOpen(false)}
                      className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2 font-semibold text-[#667085]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={assigningLoading}
                      className="flex items-center gap-1.5 rounded-xl bg-[#DE8626] px-5 py-2 font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50"
                    >
                      {assigningLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Assigning...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Assign Owner</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
