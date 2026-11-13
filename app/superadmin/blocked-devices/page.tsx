'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  RefreshCw,
  Search,
  Smartphone,
  Hash,
  AlertTriangle,
  Check,
  Unlock,
  Copy,
  Plus,
  X,
  Loader2,
  Calendar,
  Phone,
  Store,
  Info,
  Layers,
  Cpu,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { apiClient } from '@shared/core/network/apiClient';

interface BlockedDevice {
  deviceKey: string;
  deviceId?: string;
  hardwareFingerprint?: string;
  restaurantId: number;
  customerPhone?: string;
  reason?: string;
  unconfirmedCount: number;
  blockedAt: string;
}

export default function BlockedDevicesPage() {
  const [devices, setDevices] = useState<BlockedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [unblockingKey, setUnblockingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual Block Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualRestId, setManualRestId] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const fetchBlockedDevices = useCallback(async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      let res;
      try {
        res = await apiClient.get('/PublicDineIn/blocked-devices');
      } catch {
        res = await apiClient.get('/admin/devices/blocked');
      }
      const data = res?.data;
      if (Array.isArray(data)) {
        setDevices(data);
      } else {
        setDevices([]);
      }
    } catch (err: any) {
      console.error('Failed to load blocked devices:', err);
      setActionMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to fetch blocked devices ledger from backend.',
      });
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlockedDevices();
  }, [fetchBlockedDevices]);

  const handleCopy = (text: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleUnblock = async (device: BlockedDevice) => {
    if (!confirm(`Are you sure you want to unblock device "${device.deviceKey}"? This will reset ghost order tracking and allow this device to place orders again.`)) {
      return;
    }

    setUnblockingKey(device.deviceKey);
    setActionMessage(null);
    try {
      let res;
      try {
        res = await apiClient.post('/PublicDineIn/blocked-devices/unblock', {
          deviceKey: device.deviceKey,
          restaurantId: device.restaurantId > 0 ? device.restaurantId : undefined,
        });
      } catch {
        res = await apiClient.post('/admin/devices/unblock', {
          deviceKey: device.deviceKey,
          restaurantId: device.restaurantId > 0 ? device.restaurantId : undefined,
        });
      }

      if (res?.data?.success || res?.status === 200) {
        setActionMessage({
          type: 'success',
          text: `Device "${device.deviceKey.slice(0, 16)}..." unblocked successfully. Restrictions removed.`,
        });
        setDevices((prev) => prev.filter((d) => d.deviceKey !== device.deviceKey));
      } else {
        throw new Error(res?.data?.message || 'Unblock operation did not return success.');
      }
    } catch (err: any) {
      console.error('Failed to unblock device:', err);
      setActionMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to unblock device. Please verify your connection.',
      });
    } finally {
      setUnblockingKey(null);
    }
  };

  const handleManualBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualKey.trim()) {
      alert('Please enter a Device ID or Hardware Fingerprint.');
      return;
    }

    setManualSubmitting(true);
    setActionMessage(null);
    try {
      const restId = manualRestId ? parseInt(manualRestId, 10) : undefined;
      let res;
      try {
        res = await apiClient.post('/PublicDineIn/blocked-devices/block', {
          deviceKey: manualKey.trim(),
          customerPhone: manualPhone.trim() || undefined,
          reason: manualReason.trim() || 'Restricted manually by SuperAdmin.',
          restaurantId: restId,
        });
      } catch {
        res = await apiClient.post('/admin/devices/block', {
          deviceKey: manualKey.trim(),
          customerPhone: manualPhone.trim() || undefined,
          reason: manualReason.trim() || 'Restricted manually by SuperAdmin.',
          restaurantId: restId,
        });
      }

      if (res?.data?.success || res?.status === 200) {
        setActionMessage({
          type: 'success',
          text: `Device "${manualKey.slice(0, 16)}..." has been manually restricted.`,
        });
        setManualModalOpen(false);
        setManualKey('');
        setManualPhone('');
        setManualReason('');
        setManualRestId('');
        fetchBlockedDevices();
      } else {
        throw new Error(res?.data?.message || 'Block operation failed.');
      }
    } catch (err: any) {
      console.error('Failed to manually block device:', err);
      alert(err?.response?.data?.message || 'Failed to block device.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const filteredDevices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return devices;
    return devices.filter((d) => {
      const key = (d.deviceKey || '').toLowerCase();
      const hw = (d.hardwareFingerprint || '').toLowerCase();
      const dev = (d.deviceId || '').toLowerCase();
      const phone = (d.customerPhone || '').toLowerCase();
      const reason = (d.reason || '').toLowerCase();
      const rest = String(d.restaurantId || '');
      return (
        key.includes(q) ||
        hw.includes(q) ||
        dev.includes(q) ||
        phone.includes(q) ||
        reason.includes(q) ||
        rest.includes(q)
      );
    });
  }, [devices, searchQuery]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Cpu className="h-3.5 w-3.5" />
                  <span>Hardware Canvas Fingerprint Defense • Zero SMS Cost</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                  <ShieldAlert className="h-7 w-7 text-[#DE8626]" />
                  <span>Anti-Fraud & Blocked Devices</span>
                </h1>
                <p className="text-sm text-slate-400 max-w-2xl">
                  Automatically flags and restricts malicious devices placing &ge; 5 unconfirmed ghost orders.
                  Uses WebGL 3D shader, 2D canvas rasterization, and MurmurHash3 to block pranksters even across incognito modes.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={fetchBlockedDevices}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                  title="Refresh device blacklist"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-[#DE8626]' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => setManualModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DE8626] hover:bg-[#C4721C] text-white text-xs font-bold shadow-lg shadow-[#DE8626]/20 transition-all active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>Manual Restriction</span>
                </button>
              </div>
            </div>

            {/* Action Notification Alert */}
            {actionMessage && (
              <div
                className={`flex items-center justify-between p-4 rounded-xl border text-sm transition-all ${
                  actionMessage.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-800 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {actionMessage.type === 'success' ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                  )}
                  <span>{actionMessage.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionMessage(null)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium uppercase tracking-wider">Restricted Devices</span>
                  <ShieldX className="h-4 w-4 text-rose-400" />
                </div>
                <div className="text-2xl font-black text-white">{devices.length}</div>
                <div className="text-[11px] text-slate-400">Blocked across platform stores</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium uppercase tracking-wider">Trigger Threshold</span>
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400">&ge; 5 Ghost Orders</div>
                <div className="text-[11px] text-slate-400">Unconfirmed & unpaid threshold</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium uppercase tracking-wider">Detection Tech</span>
                  <Cpu className="h-4 w-4 text-[#DE8626]" />
                </div>
                <div className="text-lg font-bold text-white truncate">Hardware Canvas 2D/3D</div>
                <div className="text-[11px] text-emerald-400 font-medium">₹0 SMS Cost • MurmurHash3</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium uppercase tracking-wider">Blacklist TTL</span>
                  <Calendar className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-2xl font-black text-white">30 Days</div>
                <div className="text-[11px] text-slate-400">Auto-expires or SuperAdmin unblock</div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by device key, fingerprint, phone..."
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#DE8626] transition-colors"
                />
              </div>

              <div className="text-xs text-slate-400 font-medium self-end sm:self-center">
                Showing <span className="text-white font-bold">{filteredDevices.length}</span> of {devices.length} restricted records
              </div>
            </div>

            {/* Main Ledger Table / Cards */}
            {loading ? (
              <div className="flex flex-col items-center justify-center p-16 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                <Loader2 className="h-8 w-8 text-[#DE8626] animate-spin" />
                <p className="text-sm text-slate-400">Querying Redis blacklist registry & device audit log...</p>
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {searchQuery ? 'No matching blocked devices found' : 'No Devices Restricted • All Clear'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md">
                  {searchQuery
                    ? `No blacklisted devices match your search query "${searchQuery}".`
                    : 'The anti-fraud engine is actively monitoring all incoming customer orders. If any device attempts 5 or more unconfirmed orders, it will be automatically locked and listed here.'}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-[#DE8626] hover:underline font-semibold"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDevices.map((device) => {
                  const isUnblocking = unblockingKey === device.deviceKey;
                  const isCopied = copiedKey === device.deviceKey;

                  return (
                    <div
                      key={device.deviceKey}
                      className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      {/* Left: Device Info */}
                      <div className="space-y-2.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span>LOCKED</span>
                          </span>

                          {device.unconfirmedCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertTriangle className="h-3 w-3" />
                              <span>{device.unconfirmedCount} Ghost Orders</span>
                            </span>
                          )}

                          {device.restaurantId > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              <Store className="h-3 w-3 text-slate-400" />
                              <span>Store #{device.restaurantId}</span>
                            </span>
                          )}

                          {device.customerPhone && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span>+91 {device.customerPhone}</span>
                            </span>
                          )}
                        </div>

                        {/* Device Key & Hardware Fingerprint */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-400">Device Signature:</span>
                            <code className="text-xs font-mono text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 break-all">
                              {device.deviceKey}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopy(device.deviceKey)}
                              className="p-1 text-slate-400 hover:text-white transition-colors"
                              title="Copy signature"
                            >
                              {isCopied ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>

                          {device.reason && (
                            <p className="text-xs text-slate-300">
                              <span className="text-slate-400 font-medium">Reason:</span> {device.reason}
                            </p>
                          )}
                        </div>

                        {/* Blocked Date */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Restricted on {new Date(device.blockedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </span>
                        </div>
                      </div>

                      {/* Right: Unblock Action */}
                      <div className="shrink-0 flex items-center gap-2 self-start lg:self-center border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0">
                        <button
                          type="button"
                          disabled={isUnblocking}
                          onClick={() => handleUnblock(device)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-600 text-emerald-300 hover:text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isUnblocking ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                              <span>Unblocking...</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="h-4 w-4" />
                              <span>Unblock Device</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Info Footer Note */}
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
              <Info className="h-5 w-5 text-[#DE8626] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-300">How MenzaPOS Ghost Order Defense Works:</p>
                <p>
                  1. When customers open any QR menu, client-side WebGL shaders and 2D canvas rasterization render a unique hardware signature.
                  <br />
                  2. If a customer places an order without paying online or having it settled/confirmed by the cashier, it is marked as an active unconfirmed order.
                  <br />
                  3. If active unconfirmed orders from the exact same hardware fingerprint reach 5, the device signature is locked in Redis for 30 days and all future order attempts are rejected.
                  <br />
                  4. SuperAdmin can review and unblock verified diners at any time with one click.
                </p>
              </div>
            </div>
          </div>

          {/* Manual Block Modal */}
          {manualModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-white font-bold text-base">
                    <ShieldAlert className="h-5 w-5 text-[#DE8626]" />
                    <span>Restrict Device Manually</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleManualBlock} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Device ID or Hardware Fingerprint <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={manualKey}
                      onChange={(e) => setManualKey(e.target.value)}
                      placeholder="e.g. hwfp_8a72b6c1... or dev_..."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Customer Mobile (Optional)</label>
                    <input
                      type="text"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="10-digit Indian Mobile"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Restaurant ID (Optional)</label>
                    <input
                      type="number"
                      value={manualRestId}
                      onChange={(e) => setManualRestId(e.target.value)}
                      placeholder="Leave blank for global platform lock"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Reason for Restriction</label>
                    <textarea
                      value={manualReason}
                      onChange={(e) => setManualReason(e.target.value)}
                      placeholder="e.g. Suspected prankster / spam orders"
                      rows={2}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setManualModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={manualSubmitting}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors"
                    >
                      {manualSubmitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Restricting...</span>
                        </>
                      ) : (
                        <>
                          <ShieldX className="h-3.5 w-3.5" />
                          <span>Lock Device</span>
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
