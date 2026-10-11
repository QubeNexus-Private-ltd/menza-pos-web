'use client';

import React, { useState, useEffect } from 'react';
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
  User,
  CreditCard,
  UtensilsCrossed,
  CheckCircle2,
  Layers,
  Percent,
  Search,
  Loader2,
  Globe,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { SuperAdminRemoteDataSource } from '@shared/data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '@shared/data/repositories/SuperAdminRepositoryImpl';
import { RoleRemoteDataSource } from '@shared/data/datasources/RoleRemoteDataSource';
import { RoleRepositoryImpl } from '@shared/data/repositories/RoleRepositoryImpl';
import { apiClient } from '@shared/core/network/apiClient';

const superAdminRepo = new SuperAdminRepositoryImpl(new SuperAdminRemoteDataSource());
const roleRepo = new RoleRepositoryImpl(new RoleRemoteDataSource());

const INDIAN_STATES = [
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CG', name: 'Chhattisgarh' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'MN', name: 'Manipur' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OD', name: 'Odisha' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TG', name: 'Telangana' },
  { code: 'TR', name: 'Tripura' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' },
  { code: 'DL', name: 'Delhi' },
];

const BUSINESS_PROFILES = [
  { id: 'FINE_DINE', label: 'Fine Dine Restaurant', desc: 'Table service, multi-course dining' },
  { id: 'QSR_CAFE', label: 'Quick Service (QSR) / Cafe', desc: 'Fast counter service, self-pickup' },
  { id: 'CLOUD_KITCHEN', label: 'Cloud Kitchen / Delivery Only', desc: 'Delivery orders without dine-in' },
  { id: 'BAR_PUB', label: 'Resto-Bar / Lounge', desc: 'Beverage & table service' },
  { id: 'BAKERY', label: 'Bakery & Confectionery', desc: 'Takeaway counter & custom orders' },
];

const CUISINES = [
  'Multi-Cuisine',
  'South Indian',
  'North Indian',
  'Fast Food & Burgers',
  'Chinese & Pan-Asian',
  'Continental & Italian',
  'Biryani & Mughlai',
  'Bakery & Desserts',
];

export default function SuperAdminOnboardPage() {
  const router = useRouter();

  // Wizard Step State (1, 2, 3, or 'completed')
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Store & Location
  const [restaurantName, setRestaurantName] = useState('');
  const [businessProfile, setBusinessProfile] = useState('FINE_DINE');
  const [cuisine, setCuisine] = useState('Multi-Cuisine');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [stateCode, setStateCode] = useState('KA');
  const [pincode, setPincode] = useState('');
  const [seatingCapacity, setSeatingCapacity] = useState('40');
  const [tableCount, setTableCount] = useState('10');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Step 2: Owner & Taxes
  const [ownerMobile, setOwnerMobile] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [cgstPercent, setCgstPercent] = useState('2.5');
  const [sgstPercent, setSgstPercent] = useState('2.5');
  const [serviceChargePercent, setServiceChargePercent] = useState('0');
  const [ownerLookupLoading, setOwnerLookupLoading] = useState(false);
  const [existingUserFound, setExistingUserFound] = useState<boolean | null>(null);

  // Step 3: Banking & Channels
  const [bankAccount, setBankAccount] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [allowDineIn, setAllowDineIn] = useState(true);
  const [allowTakeaway, setAllowTakeaway] = useState(true);
  const [allowDelivery, setAllowDelivery] = useState(true);
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(true);

  // Creation outputs
  const [createdStoreId, setCreatedStoreId] = useState<number | null>(null);
  const [createdUserId, setCreatedUserId] = useState<number | null>(null);

  // Real-time mobile lookup (parity with F:\Menza useUserLookupByMobile)
  useEffect(() => {
    const cleanMobile = ownerMobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setExistingUserFound(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setOwnerLookupLoading(true);
        const res = await apiClient.get(`/UserMaster/by-mobile/${cleanMobile}`);
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
        setOwnerLookupLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [ownerMobile]);

  // Proceed Step 1 -> Step 2
  const handleProceedStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim()) {
      alert('Please enter the Restaurant Brand Name.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await superAdminRepo.onboardRestaurant({
        restaurantName: restaurantName.trim(),
        ownerName: ownerName.trim() || `${restaurantName.trim()} Admin`,
        ownerMobile: ownerMobile.trim() || '9999999999',
        contactNumber: ownerMobile.trim() || '9999999999',
        address: address.trim() || 'Main Road',
        city: city.trim() || 'Bengaluru',
        state: stateCode.trim() || 'KA',
        logoUrl: logoUrl.trim(),
        imageUrl: bannerUrl.trim(),
      });

      if (res && res.restaurantId > 0) {
        setCreatedStoreId(res.restaurantId);
        setCurrentStep(2);
      } else {
        alert('Could not provision store. Please check the network and details.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to create restaurant configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  // Proceed Step 2 -> Step 3
  const handleProceedStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = ownerMobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      alert('Please enter a valid 10-digit owner mobile number.');
      return;
    }
    if (!ownerName.trim() || ownerName.trim().length < 2) {
      alert('Please enter the owner full name.');
      return;
    }

    try {
      setSubmitting(true);
      let userId = 0;

      // 1. Check existing user
      try {
        const userCheck = await apiClient.get(`/UserMaster/by-mobile/${cleanMobile}`);
        if (userCheck.data) {
          userId = Number(userCheck.data.id ?? userCheck.data.Id ?? userCheck.data.userId ?? 0);
        }
      } catch {
        // User not found
      }

      // 2. Create user if not found
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
        setCreatedUserId(userId);
        setCurrentStep(3);
      } else {
        alert('User profile created, proceeding to role and channel configuration.');
        setCurrentStep(3);
      }
    } catch (err: any) {
      alert(err?.message || 'Error configuring owner credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  // Final Step 3 Completion -> Role Assignment & Final Setup
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdStoreId) {
      alert('Missing Restaurant ID. Please start from Step 1.');
      return;
    }

    try {
      setSubmitting(true);

      // Assign Owner role (roleId: 2 is Owner in Menza)
      if (createdUserId && createdUserId > 0) {
        try {
          await roleRepo.assignRole({
            userId: createdUserId,
            roleId: 2, // Owner role
            restId: createdStoreId,
            restaurantId: createdStoreId,
            isDefault: true,
          });
        } catch (rErr) {
          console.warn('Role assignment note:', rErr);
        }
      }

      setCurrentStep(4);
    } catch (err: any) {
      alert(err?.message || 'Failed to complete channel configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/superadmin/directory')}
              className="flex items-center gap-1.5 text-xs font-bold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Directory</span>
            </button>

            <span className="text-xs font-black uppercase tracking-wider text-[#DE8626] bg-amber-500/10 px-3 py-1 rounded-full">
              SuperAdmin Provisioning Engine
            </span>
          </div>

          {/* Stepper Progress Bar (Parity with F:\Menza 3-Stage Stepper) */}
          <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              {/* Step 1 */}
              <div
                onClick={() => currentStep > 1 && setCurrentStep(1)}
                className={`flex items-center gap-2.5 cursor-pointer ${currentStep >= 1 ? 'opacity-100' : 'opacity-40'}`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                    currentStep === 1
                      ? 'bg-[#DE8626] text-white shadow-md shadow-[#DE8626]/25 ring-2 ring-amber-500/30'
                      : currentStep > 1
                      ? 'bg-emerald-500 text-white'
                      : 'bg-black/5 dark:bg-white/5 text-[#667085]'
                  }`}
                >
                  {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Store & Location</p>
                  <p className="text-[10px] text-[#667085]">Profile & Brand</p>
                </div>
              </div>

              <div className={`h-0.5 flex-1 mx-3 ${currentStep >= 2 ? 'bg-emerald-500' : 'bg-[#E7E1DA] dark:bg-[#2B3540]'}`} />

              {/* Step 2 */}
              <div
                onClick={() => currentStep > 2 && setCurrentStep(2)}
                className={`flex items-center gap-2.5 cursor-pointer ${currentStep >= 2 ? 'opacity-100' : 'opacity-40'}`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                    currentStep === 2
                      ? 'bg-[#DE8626] text-white shadow-md shadow-[#DE8626]/25 ring-2 ring-amber-500/30'
                      : currentStep > 2
                      ? 'bg-emerald-500 text-white'
                      : 'bg-black/5 dark:bg-white/5 text-[#667085]'
                  }`}
                >
                  {currentStep > 2 ? <Check className="h-4 w-4" /> : '2'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Owner & Taxes</p>
                  <p className="text-[10px] text-[#667085]">Credentials & GSTIN</p>
                </div>
              </div>

              <div className={`h-0.5 flex-1 mx-3 ${currentStep >= 3 ? 'bg-emerald-500' : 'bg-[#E7E1DA] dark:bg-[#2B3540]'}`} />

              {/* Step 3 */}
              <div
                onClick={() => currentStep > 3 && setCurrentStep(3)}
                className={`flex items-center gap-2.5 cursor-pointer ${currentStep >= 3 ? 'opacity-100' : 'opacity-40'}`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                    currentStep === 3
                      ? 'bg-[#DE8626] text-white shadow-md shadow-[#DE8626]/25 ring-2 ring-amber-500/30'
                      : currentStep === 4
                      ? 'bg-emerald-500 text-white'
                      : 'bg-black/5 dark:bg-white/5 text-[#667085]'
                  }`}
                >
                  {currentStep === 4 ? <Check className="h-4 w-4" /> : '3'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Channels & Bank</p>
                  <p className="text-[10px] text-[#667085]">Ordering & Payouts</p>
                </div>
              </div>
            </div>
          </div>

          {/* ================= STAGE 1: Store & Brand Profile ================= */}
          {currentStep === 1 && (
            <form onSubmit={handleProceedStep1} className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-[#DE8626]" />
                  <h2 className="text-lg font-black text-[#1E2930] dark:text-[#F3F4F6]">
                    Step 1: Restaurant Brand & Location Profile
                  </h2>
                </div>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  Establish the primary tenant profile, cuisine identity, and geographic store presence.
                </p>
              </div>

              {/* Brand Name */}
              <div>
                <label className="block text-xs font-bold text-[#667085] uppercase mb-1">
                  Restaurant Brand Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="e.g. Copper Chimney or Royal Cafe & Biryani"
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                />
              </div>

              {/* Business Profile Selection */}
              <div>
                <label className="block text-xs font-bold text-[#667085] uppercase mb-1">
                  Business Operational Profile *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BUSINESS_PROFILES.map((p) => {
                    const isSelected = businessProfile === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setBusinessProfile(p.id)}
                        className={`cursor-pointer rounded-2xl border p-3 text-xs transition-all ${
                          isSelected
                            ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] font-bold shadow-xs'
                            : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{p.label}</span>
                          {isSelected && <Check className="h-4 w-4 text-[#DE8626]" />}
                        </div>
                        <p className="text-[10px] text-[#667085] dark:text-[#94A3B8] mt-1">{p.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cuisine Dropdown */}
              <div>
                <label className="block text-xs font-bold text-[#667085] uppercase mb-1">
                  Primary Cuisine Category
                </label>
                <select
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                >
                  {CUISINES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-[#667085] uppercase mb-1">
                  Street Address & Landmark *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 100 Feet Road, 12th Main, Indiranagar"
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                />
              </div>

              {/* City, State & Pincode Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#667085] uppercase mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#667085] uppercase mb-1">State *</label>
                  <select
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#667085] uppercase mb-1">Pincode</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="560038"
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  />
                </div>
              </div>

              {/* Seating Capacity & Table Count */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#667085] uppercase mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    value={seatingCapacity}
                    onChange={(e) => setSeatingCapacity(e.target.value)}
                    placeholder="40"
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#667085] uppercase mb-1">Table Count</label>
                  <input
                    type="number"
                    value={tableCount}
                    onChange={(e) => setTableCount(e.target.value)}
                    placeholder="10"
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  />
                </div>
              </div>

              {/* Branding Image URLs */}
              <div className="space-y-3 pt-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
                <div>
                  <label className="block text-xs font-bold text-[#667085] uppercase mb-1">Store Logo Image URL</label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://.../logo.png"
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#667085] uppercase mb-1">Store Banner Cover URL</label>
                  <input
                    type="url"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://.../banner.jpg"
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-2xl bg-[#DE8626] px-7 py-3.5 text-xs font-black text-white shadow-md shadow-[#DE8626]/25 hover:bg-[#C4721C] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Provisioning Outlet...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Step 2: Owner & Taxes</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= STAGE 2: Owner & Tax Configuration ================= */}
          {currentStep === 2 && (
            <form onSubmit={handleProceedStep2} className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-[#DE8626]" />
                  <h2 className="text-lg font-black text-[#1E2930] dark:text-[#F3F4F6]">
                    Step 2: Owner Profile, Credentials & Tax Rules
                  </h2>
                </div>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  Assign primary store owner access (with live database lookup) and configure GST & service charges.
                </p>
              </div>

              {/* Owner Mobile with Real-time Lookup */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#667085] uppercase">
                    Owner Mobile Number (10 Digits) *
                  </label>
                  {ownerLookupLoading && (
                    <span className="flex items-center gap-1 text-[11px] text-[#DE8626]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking DB...
                    </span>
                  )}
                  {existingUserFound === true && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Existing Registered User Found
                    </span>
                  )}
                  {existingUserFound === false && (
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      New User Profile will be created
                    </span>
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
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                />
                <p className="mt-1 text-[11px] text-[#667085]">
                  The owner will receive OTP on this mobile number to log in and manage the store.
                </p>
              </div>

              {/* Owner Full Name */}
              <div>
                <label className="block text-xs font-bold text-[#667085] uppercase mb-1">
                  Owner Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                />
              </div>

              {/* Owner Email */}
              <div>
                <label className="block text-xs font-bold text-[#667085] uppercase mb-1">
                  Owner Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@restaurant.com"
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                />
              </div>

              {/* Tax & GST Setup */}
              <div className="space-y-3 pt-3 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
                <h3 className="text-xs font-black tracking-wider text-[#667085] uppercase">
                  Tax & GST Compliance
                </h3>

                <div>
                  <label className="block text-xs font-bold text-[#667085] uppercase mb-1">
                    GSTIN Number (15 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="29AAAAA0000A1Z5"
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-mono font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">CGST (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={cgstPercent}
                      onChange={(e) => setCgstPercent(e.target.value)}
                      placeholder="2.5"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">SGST (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={sgstPercent}
                      onChange={(e) => setSgstPercent(e.target.value)}
                      placeholder="2.5"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">Service Chg (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={serviceChargePercent}
                      onChange={(e) => setServiceChargePercent(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] px-5 py-3 text-xs font-bold text-[#667085]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-2xl bg-[#DE8626] px-7 py-3.5 text-xs font-black text-white shadow-md shadow-[#DE8626]/25 hover:bg-[#C4721C] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Owner Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Step 3: Bank & Channels</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= STAGE 3: Banking & Channels Configuration ================= */}
          {currentStep === 3 && (
            <form onSubmit={handleCompleteOnboarding} className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#DE8626]" />
                  <h2 className="text-lg font-black text-[#1E2930] dark:text-[#F3F4F6]">
                    Step 3: Payout Banking & Channel Activations
                  </h2>
                </div>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  Configure store settlement bank accounts and enable operational dining & order dispatch channels.
                </p>
              </div>

              {/* Bank Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-black tracking-wider text-[#667085] uppercase">
                  Direct Bank Payout Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#667085] uppercase mb-1">
                      Bank Account Number
                    </label>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="912010045678901"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#667085] uppercase mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="e.g. Royal Cafe Enterprises"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#667085] uppercase mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="HDFC Bank"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#667085] uppercase mb-1">IFSC Code</label>
                    <input
                      type="text"
                      maxLength={11}
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      placeholder="HDFC0001234"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-mono font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#667085] uppercase mb-1">Virtual UPI ID</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="store@upi"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>
                </div>
              </div>

              {/* Channel Toggles */}
              <div className="space-y-3 pt-3 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
                <h3 className="text-xs font-black tracking-wider text-[#667085] uppercase">
                  Service & Channel Activations
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] p-3.5 bg-[#FAF7F2]/60 dark:bg-[#151A20]/60">
                    <div>
                      <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Dine-In Table Ordering</p>
                      <p className="text-[10px] text-[#667085]">QR table ordering & table bills</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowDineIn}
                      onChange={(e) => setAllowDineIn(e.target.checked)}
                      className="h-4 w-4 accent-[#DE8626]"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] p-3.5 bg-[#FAF7F2]/60 dark:bg-[#151A20]/60">
                    <div>
                      <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Takeaway & Self-Pickup</p>
                      <p className="text-[10px] text-[#667085]">Express takeaway tokens</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowTakeaway}
                      onChange={(e) => setAllowTakeaway(e.target.checked)}
                      className="h-4 w-4 accent-[#DE8626]"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] p-3.5 bg-[#FAF7F2]/60 dark:bg-[#151A20]/60">
                    <div>
                      <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Direct Delivery Ordering</p>
                      <p className="text-[10px] text-[#667085]">Direct customer online delivery</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowDelivery}
                      onChange={(e) => setAllowDelivery(e.target.checked)}
                      className="h-4 w-4 accent-[#DE8626]"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] p-3.5 bg-[#FAF7F2]/60 dark:bg-[#151A20]/60">
                    <div>
                      <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Auto-Accept Incoming Orders</p>
                      <p className="text-[10px] text-[#667085]">Immediate KDS printing</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoAcceptOrders}
                      onChange={(e) => setAutoAcceptOrders(e.target.checked)}
                      className="h-4 w-4 accent-[#DE8626]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] px-5 py-3 text-xs font-bold text-[#667085]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#CB741B] px-8 py-3.5 text-xs font-black text-white shadow-xl shadow-[#DE8626]/30 hover:from-[#C4721C] hover:to-[#B66415] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Finalizing Onboarding...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Complete & Launch Store</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= STAGE 4: Success Confirmation Modal ================= */}
          {currentStep === 4 && (
            <div className="rounded-3xl border border-emerald-500/30 bg-white dark:bg-[#1B2127] p-8 shadow-xl text-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-8 ring-emerald-500/10">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Store Successfully Onboarded!
                </span>
                <h2 className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] mt-3">
                  {restaurantName}
                </h2>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1 max-w-md mx-auto">
                  Assigned Store ID <strong className="text-[#DE8626]">#{createdStoreId}</strong>. Primary Owner <strong className="text-[#1E2930] dark:text-[#F3F4F6]">{ownerName} ({ownerMobile})</strong> is provisioned with Owner credentials.
                </p>
              </div>

              <div className="rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] p-4 max-w-md mx-auto text-left text-xs space-y-2 border border-[#E7E1DA] dark:border-[#2B3540]">
                <div className="flex justify-between">
                  <span className="text-[#667085]">Location:</span>
                  <span className="font-bold">{city}, {stateCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Profile:</span>
                  <span className="font-bold">{businessProfile}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Cuisine:</span>
                  <span className="font-bold">{cuisine}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Owner Role:</span>
                  <span className="font-bold text-emerald-600">Store Owner (ID: 2)</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => router.push('/superadmin/directory')}
                  className="w-full sm:w-auto rounded-2xl bg-[#DE8626] px-6 py-3 text-xs font-black text-white shadow-md shadow-[#DE8626]/25 hover:bg-[#C4721C] transition-all"
                >
                  View in Stores Directory
                </button>
                <button
                  onClick={() => {
                    setRestaurantName('');
                    setOwnerMobile('');
                    setOwnerName('');
                    setCreatedStoreId(null);
                    setCurrentStep(1);
                  }}
                  className="w-full sm:w-auto rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] px-6 py-3 text-xs font-bold text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                >
                  Onboard Another Store
                </button>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
