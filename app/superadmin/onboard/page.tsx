'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Phone,
  MapPin,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { SuperAdminRemoteDataSource } from '@shared/data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '@shared/data/repositories/SuperAdminRepositoryImpl';

const superAdminRepo = new SuperAdminRepositoryImpl(new SuperAdminRemoteDataSource());

export default function SuperAdminOnboardPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerMobile, setOwnerMobile] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('KA');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim() || ownerMobile.length !== 10) {
      alert('Please fill in restaurant name and a 10-digit owner mobile number.');
      return;
    }

    try {
      setSaving(true);
      const res = await superAdminRepo.onboardRestaurant({
        restaurantName: restaurantName.trim(),
        ownerName: ownerName.trim() || `${restaurantName.trim()} Owner`,
        ownerMobile: ownerMobile.trim(),
        contactNumber: ownerMobile.trim(),
        address: address.trim() || 'Central',
        city: city.trim() || 'Bengaluru',
        state: state.trim() || 'KA',
      });

      if (res && res.success) {
        alert(`Restaurant "${restaurantName}" onboarded successfully with ID #${res.restaurantId}!`);
        router.push('/superadmin/directory');
      } else {
        alert('Failed to onboard restaurant. Please check the details and try again.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error during restaurant onboarding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
          <button
            onClick={() => router.push('/superadmin/directory')}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Directory</span>
          </button>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
              Onboard New Restaurant
            </h1>
            <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
              Register a new restaurant tenant, assign primary owner credentials, and provision tenant database records
            </p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-sm space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                Restaurant Brand Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="e.g. Royal Cafe & Biryani"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                Owner Full Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                Owner Mobile Number (10 digits) *
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                value={ownerMobile}
                onChange={(e) => setOwnerMobile(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="9876543210"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
              <p className="mt-1 text-[11px] text-[#667085]">
                The owner will receive an SMS OTP to sign into this newly provisioned store.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                Street Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 100 Feet Road, Indiranagar"
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
                  placeholder="Bengaluru"
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">State Code</label>
                <input
                  type="text"
                  maxLength={10}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="KA"
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-2xl bg-[#DE8626] px-6 py-3 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-all"
              >
                <span>{saving ? 'Provisioning Store...' : 'Complete Onboarding'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
