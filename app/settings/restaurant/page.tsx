'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  ArrowLeft,
  Save,
  Check,
  AlertCircle,
  Clock,
  Percent,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/stores/useAuthStore';
import { ConfigService } from '@/services/configService';
import { RestaurantConfig, StoreOperatingStatus } from '@/types/restaurant';

export default function RestaurantConfigPage() {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [fssaiNumber, setFssaiNumber] = useState('');
  const [cgstRate, setCgstRate] = useState('2.5');
  const [sgstRate, setSgstRate] = useState('2.5');
  const [serviceChargeRate, setServiceChargeRate] = useState('0');
  const [isOpen, setIsOpen] = useState(true);

  const loadConfig = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [cfg, op] = await Promise.allSettled([
        ConfigService.getRestaurantConfig(currentRestId),
        ConfigService.getOperatingStatus(currentRestId),
      ]);

      if (cfg.status === 'fulfilled' && cfg.value) {
        const c = cfg.value;
        setName(c.restaurantName || activeRestaurant?.restaurantName || '');
        setPhone(c.contactNumber || '');
        setEmail(c.email || '');
        setAddress(c.address || activeRestaurant?.address || '');
        setCity(c.city || '');
        setState(c.state || '');
        setGstNumber(c.gstNumber || '');
        setCgstRate(String(c.cgstPercentage ?? 2.5));
        setSgstRate(String(c.sgstPercentage ?? 2.5));
      }
      if (op.status === 'fulfilled' && op.value) {
        setIsOpen(op.value.isOpen);
      }
    } catch (err) {
      console.warn('Failed to load restaurant config', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId, activeRestaurant]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRestId) return;

    try {
      setSaving(true);
      setSuccessMsg(null);

      await Promise.all([
        ConfigService.updateRestaurantConfig(currentRestId, {
          restaurantName: name.trim(),
          contactNumber: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          gstNumber: gstNumber.trim(),
          cgstPercentage: parseFloat(cgstRate) || 0,
          sgstPercentage: parseFloat(sgstRate) || 0,
        }),
        ConfigService.toggleOrdering(currentRestId, {
          isOpen,
        }),
      ]);

      setSuccessMsg('Restaurant profile and tax configuration updated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to update restaurant configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/settings')}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Settings</span>
            </button>
          </div>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
              Restaurant Profile & Tax Configuration
            </h1>
            <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
              Configure GST rates, customer receipt headers, contact details, and operating status
            </p>
          </div>

          {successMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Store Operational Status Card */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                Shift Operating Status
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    Accept Orders & Dining Service
                  </p>
                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                    Toggle whether your store is currently open to receive counter orders and table billing
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(!isOpen)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    isOpen ? 'bg-[#DE8626]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isOpen ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Basic Store Info */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                Store Identity & Receipts
              </h3>

              <div>
                <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                  Restaurant Legal / Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Store Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Official Support Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                  Complete Street Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>
              </div>
            </div>

            {/* GST & Taxes Configuration */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                GST & Tax Configuration
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="e.g. 29AAAAA0000A1Z5"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    FSSAI License Number
                  </label>
                  <input
                    type="text"
                    value={fssaiNumber}
                    onChange={(e) => setFssaiNumber(e.target.value)}
                    placeholder="e.g. 11223344556677"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    CGST Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={cgstRate}
                    onChange={(e) => setCgstRate(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    SGST Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={sgstRate}
                    onChange={(e) => setSgstRate(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Service Charge (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={serviceChargeRate}
                    onChange={(e) => setServiceChargeRate(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-2xl bg-[#DE8626] px-6 py-3 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-all"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
