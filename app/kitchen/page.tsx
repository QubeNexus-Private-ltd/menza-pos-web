'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChefHat,
  Plus,
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power,
  Pause,
  Play,
  Settings,
  X,
  Trash2,
  UtensilsCrossed,
  Sparkles,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { WebKitchenService, KitchenStationDTO, CreateKitchenStationModel } from '@/services/kitchenService';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { OrderMaster } from '@shared/domain/models/Order';

const orderDataSource = new OrderRemoteDataSource();

export default function KitchenKdsPage() {
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [stations, setStations] = useState<KitchenStationDTO[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<number | 'ALL'>('ALL');

  // Add Station Modal
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [stationCode, setStationCode] = useState('');
  const [stationName, setStationName] = useState('');
  const [description, setDescription] = useState('');
  const [colorHex, setColorHex] = useState('#DE8626');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [stList, ordList] = await Promise.allSettled([
        WebKitchenService.getStations(currentRestId),
        orderDataSource.getTodayOrders(currentRestId, 'ALL', 1, 50),
      ]);

      if (stList.status === 'fulfilled') {
        setStations(stList.value);
      }
      if (ordList.status === 'fulfilled' && ordList.value?.items) {
        // Show orders that are actively in progress / in kitchen
        const kitchenOrders = ordList.value.items.filter(
          (o) => o.status !== 'SETTLED' && o.status !== 'CANCELLED'
        );
        setActiveOrders(kitchenOrders);
      }
    } catch (err) {
      console.warn('Failed to load kitchen data', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationName.trim() || !stationCode.trim()) {
      alert('Please fill in Station Name and Code.');
      return;
    }

    try {
      setIsSubmitting(true);
      const model: CreateKitchenStationModel = {
        restaurantId: currentRestId,
        stationCode: stationCode.trim().toUpperCase(),
        stationName: stationName.trim(),
        description: description.trim() || undefined,
        colorHex,
        isKdsEnabled: true,
      };

      await WebKitchenService.createStation(model);
      await loadData();
      setStationCode('');
      setStationName('');
      setDescription('');
      setStationModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to create kitchen station');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitDefaults = async () => {
    if (confirm('Initialize standard kitchen stations (Main Kitchen, Tandoor & Grill, Bakery, Bar, Pantry)?')) {
      try {
        setLoading(true);
        await WebKitchenService.initializeDefaults(currentRestId);
        await loadData();
      } catch (err: any) {
        alert(err?.message || 'Failed to initialize default stations');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleStatus = async (station: KitchenStationDTO) => {
    try {
      const newActive = !station.isActive;
      await WebKitchenService.toggleStationStatus(station.id, newActive);
      setStations((prev) =>
        prev.map((s) => (s.id === station.id ? { ...s, isActive: newActive } : s))
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle station');
    }
  };

  const handleDeleteStation = async (id: number) => {
    if (confirm('Are you sure you want to delete this kitchen station?')) {
      try {
        await WebKitchenService.deleteStation(id);
        setStations((prev) => prev.filter((s) => s.id !== id));
      } catch (err: any) {
        alert(err?.message || 'Failed to delete station');
      }
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Kitchen Display & Stations (KDS)
                </h1>
                <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-[#DE8626]">
                  {activeOrders.length} Active Tickets • {stations.length} Stations
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Real-time kitchen order tickets (KOT), item preparation routing, and station rush management
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              {stations.length === 0 && (
                <button
                  onClick={handleInitDefaults}
                  className="flex items-center gap-2 rounded-xl border border-[#DE8626] bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Init Default Stations</span>
                </button>
              )}

              <button
                onClick={() => setStationModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>New Station</span>
              </button>
            </div>
          </div>

          {/* Kitchen Stations Status Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {stations.map((st) => (
              <div
                key={st.id}
                className={`rounded-2xl border p-3 shadow-sm transition-all ${
                  st.isActive
                    ? 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127]'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#151A20] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: st.colorHex || '#DE8626' }}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(st)}
                      title={st.isActive ? 'Pause Station' : 'Activate Station'}
                      className="p-1 rounded text-[#667085] hover:text-[#1E2930]"
                    >
                      <Power className={`h-3 w-3 ${st.isActive ? 'text-emerald-500' : 'text-gray-400'}`} />
                    </button>
                    <button
                      onClick={() => handleDeleteStation(st.id)}
                      className="p-1 rounded text-[#667085] hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <h4 className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] truncate">
                  {st.stationName}
                </h4>
                <p className="text-[10px] text-[#667085] uppercase tracking-wider font-mono">
                  {st.stationCode}
                </p>
              </div>
            ))}
          </div>

          {/* Live Kitchen Order Tickets Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-[#DE8626]" />
                <span>Live Kitchen Tickets ({activeOrders.length})</span>
              </h2>
            </div>

            {activeOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] p-12 text-center">
                <ChefHat className="h-10 w-10 text-[#667085] mx-auto mb-3 opacity-40" />
                <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">Kitchen is all clear!</h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  No orders currently waiting in the kitchen queue. New orders from POS or QR will appear instantly.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeOrders.map((order) => {
                  const items = Array.isArray(order.items) ? order.items : [];
                  const timeFormatted = order.createdAt
                    ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-amber-500/30 bg-white dark:bg-[#1B2127] shadow-md overflow-hidden flex flex-col justify-between"
                    >
                      {/* Ticket Header */}
                      <div className="bg-gradient-to-r from-[#DE8626] to-[#B7791F] text-white p-3 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-90">
                            {order.tableName || order.orderTypeName || 'Counter'}
                          </span>
                          <h3 className="text-base font-extrabold">Order #{order.id}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeFormatted}
                          </span>
                          <span className="text-[10px] uppercase font-bold bg-white/20 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            {order.status}
                          </span>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="p-3 space-y-2 flex-1 divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 text-xs">
                        {items.map((it, idx) => (
                          <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <span className="font-extrabold text-[#DE8626] text-sm min-w-5">
                                {it.quantity}x
                              </span>
                              <div>
                                <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                                  {it.itemName}
                                </p>
                                {it.cookingInstruction && (
                                  <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                                    Note: {it.cookingInstruction}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="p-3 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] flex items-center justify-between text-xs">
                        <span className="text-[#667085]">Guest: {order.customerName || 'Guest'}</span>
                        <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                          ₹{order.totalAmount}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Add Station Modal */}
        {stationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                    <ChefHat className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    New Kitchen Station
                  </h3>
                </div>
                <button
                  onClick={() => setStationModalOpen(false)}
                  className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStation} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Station Code (e.g. TAN, BAR, CURRY) *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={stationCode}
                    onChange={(e) => setStationCode(e.target.value.toUpperCase())}
                    placeholder="TAN"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 font-mono uppercase font-bold outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Station Name *</label>
                  <input
                    type="text"
                    required
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                    placeholder="e.g. Tandoor & Grill Station"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Handles rotis, kebabs, tandoori starters"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Color Theme</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="h-10 w-14 rounded-lg cursor-pointer border border-[#E7E1DA]"
                    />
                    <span className="text-xs font-mono font-semibold">{colorHex}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                  <button
                    type="button"
                    onClick={() => setStationModalOpen(false)}
                    className="rounded-xl border border-[#E7E1DA] px-4 py-2 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Station'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
