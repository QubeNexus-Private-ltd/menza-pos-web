'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building,
  UserCheck,
  Shield,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Check,
  MapPin,
  Search,
  Globe,
  Upload,
  Image as ImageIcon,
  Sparkles,
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Store,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { OnboardRestaurantRequest } from '@shared/domain/models/OnboardRestaurantRequest';
import { StateMaster } from '@shared/domain/models/MasterData';
import { RoleMaster } from '@shared/domain/models/Role';
import { SuperAdminRemoteDataSource } from '@shared/data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '@shared/data/repositories/SuperAdminRepositoryImpl';
import { MasterDataRemoteDataSource } from '@shared/data/datasources/MasterDataRemoteDataSource';
import { MasterDataRepositoryImpl } from '@shared/data/repositories/MasterDataRepositoryImpl';
import { RoleRemoteDataSource } from '@shared/data/datasources/RoleRemoteDataSource';
import { RoleRepositoryImpl } from '@shared/data/repositories/RoleRepositoryImpl';
import { apiClient } from '@shared/core/network/apiClient';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { isSalesPersonUser } from '@/lib/auth/permissions';

const superAdminRepository = new SuperAdminRepositoryImpl(new SuperAdminRemoteDataSource());
const masterDataRepository = new MasterDataRepositoryImpl(new MasterDataRemoteDataSource());
const roleRepository = new RoleRepositoryImpl(new RoleRemoteDataSource());

const FULL_STATE_MASTER_LIST: StateMaster[] = [
  { stateCode: 'AP', stateDesc: 'Andhra Pradesh' },
  { stateCode: 'AR', stateDesc: 'Arunachal Pradesh' },
  { stateCode: 'AS', stateDesc: 'Assam' },
  { stateCode: 'BR', stateDesc: 'Bihar' },
  { stateCode: 'CG', stateDesc: 'Chhattisgarh' },
  { stateCode: 'GA', stateDesc: 'Goa' },
  { stateCode: 'GJ', stateDesc: 'Gujarat' },
  { stateCode: 'HR', stateDesc: 'Haryana' },
  { stateCode: 'HP', stateDesc: 'Himachal Pradesh' },
  { stateCode: 'JH', stateDesc: 'Jharkhand' },
  { stateCode: 'KA', stateDesc: 'Karnataka' },
  { stateCode: 'KL', stateDesc: 'Kerala' },
  { stateCode: 'MP', stateDesc: 'Madhya Pradesh' },
  { stateCode: 'MH', stateDesc: 'Maharashtra' },
  { stateCode: 'MN', stateDesc: 'Manipur' },
  { stateCode: 'ML', stateDesc: 'Meghalaya' },
  { stateCode: 'MZ', stateDesc: 'Mizoram' },
  { stateCode: 'NL', stateDesc: 'Nagaland' },
  { stateCode: 'OD', stateDesc: 'Odisha' },
  { stateCode: 'PB', stateDesc: 'Punjab' },
  { stateCode: 'RJ', stateDesc: 'Rajasthan' },
  { stateCode: 'SK', stateDesc: 'Sikkim' },
  { stateCode: 'TN', stateDesc: 'Tamil Nadu' },
  { stateCode: 'TG', stateDesc: 'Telangana' },
  { stateCode: 'TR', stateDesc: 'Tripura' },
  { stateCode: 'UP', stateDesc: 'Uttar Pradesh' },
  { stateCode: 'UK', stateDesc: 'Uttarakhand' },
  { stateCode: 'WB', stateDesc: 'West Bengal' },
  { stateCode: 'DL', stateDesc: 'Delhi' },
];

const SAMPLE_BANNERS = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
];

const SAMPLE_LOGOS = [
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80',
];

const DEFAULT_ROLES: RoleMaster[] = [
  { id: 2, roleName: 'Owner', description: 'Full Restaurant Access & Store Control' },
  { id: 1, roleName: 'SuperAdmin', description: 'Global Multi-Tenant Platform Controller' },
  { id: 3, roleName: 'Admin', description: 'Store Manager & Menu Operations' },
  { id: 4, roleName: 'Cashier', description: 'Billing & POS Settlement' },
];

export default function SuperAdminOnboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSalesPerson = isSalesPersonUser(user?.roles);

  // Workflow Step State (1, 2, or 3)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State (Exact parity with F:\Menza OnboardRestaurantRequest)
  const [form, setForm] = useState<OnboardRestaurantRequest>({
    restaurantName: '',
    address: '',
    city: '',
    state: 'KA',
    contactNumber: '',
    gstNumber: '',
    imageUrl: '',
    logoUrl: '',
    ownerName: '',
    ownerMobile: '',
  });

  const [createdRestaurantId, setCreatedRestaurantId] = useState<number | null>(null);
  const [createdUserId, setCreatedUserId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number>(2); // Default: Owner (id: 2)
  const [isDefaultRole, setIsDefaultRole] = useState<boolean>(true);

  const [states, setStates] = useState<StateMaster[]>(FULL_STATE_MASTER_LIST);
  const [availableRoles, setAvailableRoles] = useState<RoleMaster[]>(DEFAULT_ROLES);

  // Modals & Search
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [activeUploadTarget, setActiveUploadTarget] = useState<'imageUrl' | 'logoUrl'>('imageUrl');
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');

  // Mobile User Lookup State (Exact parity with F:\Menza useUserLookupByMobile)
  const [ownerLookupLoading, setOwnerLookupLoading] = useState(false);
  const [existingOwner, setExistingOwner] = useState<{ id: number; name: string } | null>(null);

  // Submitting Spinner
  const [submitting, setSubmitting] = useState(false);

  // Success Modal
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [onboardedSummary, setOnboardedSummary] = useState<{
    storeName: string;
    storeId: number;
    ownerName: string;
    roleName: string;
  } | null>(null);

  // Load States & Roles from API on mount
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const stateList = await masterDataRepository.getStates();
        if (stateList && stateList.length > 0) {
          setStates(stateList);
          setForm((prev) => ({
            ...prev,
            state: prev.state || stateList[0].stateCode,
          }));
        }
      } catch {
        setStates(FULL_STATE_MASTER_LIST);
      }

      try {
        const roleList = await roleRepository.getAllRoles();
        if (roleList && roleList.length > 0) {
          setAvailableRoles(roleList);
        }
      } catch {
        setAvailableRoles(DEFAULT_ROLES);
      }
    };

    loadMasterData();
  }, []);

  // Filtered States
  const filteredStates = useMemo(() => {
    if (!stateSearchQuery.trim()) return states;
    const q = stateSearchQuery.toLowerCase().trim();
    return states.filter(
      (st) =>
        st.stateCode.toLowerCase().includes(q) ||
        st.stateDesc.toLowerCase().includes(q)
    );
  }, [states, stateSearchQuery]);

  const getSelectedStateFullName = (val?: string) => {
    if (!val) return 'Select State';
    const matched = states.find(
      (s) =>
        s.stateCode.toLowerCase() === val.toLowerCase() ||
        s.stateDesc.toLowerCase() === val.toLowerCase()
    );
    return matched ? matched.stateDesc : val;
  };

  // Real-time mobile lookup (parity with F:\Menza useUserLookupByMobile)
  useEffect(() => {
    const clean = form.ownerMobile.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      setExistingOwner(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setOwnerLookupLoading(true);
        const res = await apiClient.get(`/UserMaster/by-mobile/${clean}`);
        const data = res.data;
        if (data && (data.id || data.Id || data.userId)) {
          const id = Number(data.id ?? data.Id ?? data.userId ?? 0);
          const name = String(data.name ?? data.Name ?? data.fullName ?? data.FullName ?? '');
          setExistingOwner({ id, name });
          if (name) {
            setForm((prev) => ({ ...prev, ownerName: name }));
          }
        } else {
          setExistingOwner(null);
        }
      } catch {
        setExistingOwner(null);
      } finally {
        setOwnerLookupLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [form.ownerMobile]);

  // Image upload modal handlers
  const handleOpenImagePicker = (target: 'imageUrl' | 'logoUrl') => {
    setActiveUploadTarget(target);
    setCustomImageUrlInput(form[target] || '');
    setImageModalVisible(true);
  };

  const handleSelectPresetImage = (url: string) => {
    setForm((prev) => ({ ...prev, [activeUploadTarget]: url }));
    setImageModalVisible(false);
  };

  const handleApplyCustomImageUrl = () => {
    if (customImageUrlInput.trim()) {
      setForm((prev) => ({ ...prev, [activeUploadTarget]: customImageUrlInput.trim() }));
    }
    setImageModalVisible(false);
  };

  // Step 1 -> Step 2 (Exact parity with F:\Menza handleProceedToStep2)
  const handleProceedToStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    const resName = form.restaurantName.trim();
    if (!resName) {
      alert('Please enter Restaurant Name.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: OnboardRestaurantRequest = {
        ...form,
        restaurantName: resName,
        contactNumber: form.contactNumber.trim() || form.ownerMobile.trim() || '9999999999',
        ownerName: form.ownerName.trim() || `${resName} Owner`,
        ownerMobile: form.ownerMobile.trim() || '9999999999',
      };

      const result = await superAdminRepository.onboardRestaurant(payload);
      const restId = result.restaurantId;

      if (restId && restId > 0) {
        setCreatedRestaurantId(restId);
        setCurrentStep(2);
      } else {
        alert('Could not save restaurant configuration.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to create restaurant configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 -> Step 3 (Exact parity with F:\Menza handleProceedToStep3)
  const handleProceedToStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = form.ownerMobile.replace(/\D/g, '').slice(-10);
    const cleanName = form.ownerName.trim();

    if (!cleanMobile || cleanMobile.length < 10) {
      alert('Please enter a valid 10-digit owner registered mobile number.');
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      alert('Please enter a valid owner full name (at least 2 characters).');
      return;
    }

    try {
      setSubmitting(true);
      let userId = 0;

      // 1. Check existing user by mobile
      try {
        const userCheck = await apiClient.get(`/UserMaster/by-mobile/${cleanMobile}`);
        const data = userCheck.data;
        if (data) {
          userId = Number(data.id ?? data.Id ?? data.userId ?? 0);
        }
      } catch {
        // Not found
      }

      // 2. Create user if not found
      if (!userId || userId <= 0) {
        const createRes = await apiClient.post('/UserMaster', {
          name: cleanName,
          mobile: cleanMobile,
          Name: cleanName,
          Mobile: cleanMobile,
        });

        const resData = createRes.data;
        if (typeof resData === 'number') {
          userId = resData;
        } else if (resData && typeof resData === 'object') {
          userId = Number(resData.id ?? resData.Id ?? resData.userId ?? 0);
        }

        if (!userId || userId <= 0) {
          try {
            const createdCheck = await apiClient.get(`/UserMaster/by-mobile/${cleanMobile}`);
            userId = Number(createdCheck.data?.id ?? createdCheck.data?.Id ?? 0);
          } catch {
            // Fallback
          }
        }
      }

      if (userId && userId > 0) {
        setCreatedUserId(userId);
        setCurrentStep(3);
      } else {
        alert('User profile configured, proceeding to role assignment.');
        setCurrentStep(3);
      }
    } catch (err: any) {
      alert(err?.message || 'Could not create user profile.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3 Completion (Exact parity with F:\Menza handleCompleteAssignRole)
  const handleCompleteAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createdRestaurantId || createdRestaurantId <= 0) {
      alert('Invalid Restaurant ID. Please complete Step 1 first.');
      return;
    }

    try {
      setSubmitting(true);
      const restId = createdRestaurantId;
      const userId = createdUserId;

      if (userId && userId > 0) {
        await roleRepository.assignRole({
          userId,
          roleId: selectedRoleId,
          restId: restId,
          restaurantId: restId,
          isDefault: isDefaultRole,
        });
      }

      const selectedRoleObj = availableRoles.find((r) => r.id === selectedRoleId);
      setOnboardedSummary({
        storeName: form.restaurantName,
        storeId: restId,
        ownerName: form.ownerName,
        roleName: selectedRoleObj?.roleName || 'Owner',
      });
      setSuccessModalVisible(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to assign role.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form to onboard another outlet
  const handleResetForm = () => {
    setForm({
      restaurantName: '',
      address: '',
      city: '',
      state: states[0]?.stateCode || 'KA',
      contactNumber: '',
      gstNumber: '',
      imageUrl: '',
      logoUrl: '',
      ownerName: '',
      ownerMobile: '',
    });
    setCreatedRestaurantId(null);
    setCreatedUserId(null);
    setSelectedRoleId(2);
    setIsDefaultRole(true);
    setCurrentStep(1);
    setSuccessModalVisible(false);
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
          {/* Top Unified Header (Identical to F:\Menza) */}
          <div className="flex items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#DE8626] to-[#B7791F] text-white shadow-md shadow-[#DE8626]/20 font-black text-lg">
                M
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-extrabold text-[#1E2930] dark:text-[#F3F4F6] tracking-tight">
                  {isSalesPerson ? 'Partner Store Onboarding' : 'Menza Master'}
                </h1>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  {isSalesPerson ? 'Sales Partner • Onboard New Store' : 'Super Admin • Onboard New Store'}
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push(isSalesPerson ? '/sales/earnings' : '/superadmin/directory')}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title={isSalesPerson ? 'Close and return to Earnings' : 'Close and return to Directory'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 3-Stage Stepper Progress Bar (Exact parity with F:\Menza) */}
          <div className="flex items-center rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-1.5 shadow-xs">
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                currentStep === 1
                  ? 'bg-[#FFF0DE] text-[#D96B14] dark:bg-amber-950/40 dark:text-amber-300 shadow-xs'
                  : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
              }`}
            >
              <Building className="h-3.5 w-3.5" />
              <span>1. Store</span>
            </button>

            <button
              onClick={() => createdRestaurantId && setCurrentStep(2)}
              disabled={!createdRestaurantId}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-40 ${
                currentStep === 2
                  ? 'bg-[#FFF0DE] text-[#D96B14] dark:bg-amber-950/40 dark:text-amber-300 shadow-xs'
                  : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>2. Owner</span>
            </button>

            <button
              onClick={() => createdUserId && setCurrentStep(3)}
              disabled={!createdUserId}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-40 ${
                currentStep === 3
                  ? 'bg-[#FFF0DE] text-[#D96B14] dark:bg-amber-950/40 dark:text-amber-300 shadow-xs'
                  : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>3. Role</span>
            </button>
          </div>

          {/* STEP 1: RESTAURANT STORE DETAILS (Exact parity with F:\Menza) */}
          {currentStep === 1 && (
            <form onSubmit={handleProceedToStep2} className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-xs space-y-5">
              <div className="border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                <h2 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  Step 1: Restaurant Store Details
                </h2>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-0.5">
                  General outlet credentials, city location, GSTIN, and branding
                </p>
              </div>

              {/* RESTAURANT NAME * */}
              <div>
                <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Menza Bistro & Grill"
                  value={form.restaurantName}
                  onChange={(e) => setForm({ ...form, restaurantName: e.target.value })}
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                />
              </div>

              {/* CITY & STATE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                    State *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStateSearchQuery('');
                      setStateModalVisible(true);
                    }}
                    className="w-full flex items-center justify-between rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] transition-colors text-left"
                  >
                    <span className="truncate">{getSelectedStateFullName(form.state)}</span>
                    <ChevronDown className="h-4 w-4 text-[#DE8626] shrink-0" />
                  </button>
                </div>
              </div>

              {/* FULL ADDRESS */}
              <div>
                <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                  Full Address
                </label>
                <input
                  type="text"
                  placeholder="Street Address, Area"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                />
              </div>

              {/* GSTIN NUMBER */}
              <div>
                <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                  GSTIN Number
                </label>
                <input
                  type="text"
                  placeholder="22AAAAA0000A1Z5"
                  value={form.gstNumber}
                  onChange={(e) => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })}
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-mono font-semibold text-[#1E2930] dark:text-[#F3F4F6] uppercase outline-hidden focus:border-[#DE8626]"
                />
              </div>

              {/* BANNER IMAGE UPLOADER */}
              <div>
                <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                  Banner Image
                </label>
                {form.imageUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-[#E7E1DA] dark:border-[#2B3540] group">
                    <img
                      src={form.imageUrl}
                      alt="Store Banner"
                      className="h-36 w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-between p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenImagePicker('imageUrl')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-bold text-[#DE8626] shadow-sm hover:bg-white"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>Change Banner</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, imageUrl: '' })}
                        className="rounded-xl bg-red-600/90 p-1.5 text-white shadow-sm hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenImagePicker('imageUrl')}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] py-6 text-xs font-bold text-[#DE8626] hover:bg-amber-500/5 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Store Banner</span>
                  </button>
                )}
              </div>

              {/* STORE LOGO UPLOADER */}
              <div>
                <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                  Store Logo
                </label>
                {form.logoUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={form.logoUrl}
                      alt="Store Logo"
                      className="h-14 w-14 rounded-2xl object-cover border border-[#E7E1DA] dark:border-[#2B3540]"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenImagePicker('logoUrl')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-3 py-1.5 text-xs font-bold text-[#DE8626] hover:border-[#DE8626]"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>Change Logo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logoUrl: '' })}
                      className="rounded-xl p-1.5 text-red-500 hover:bg-red-500/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenImagePicker('logoUrl')}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] py-4 text-xs font-bold text-[#DE8626] hover:bg-amber-500/5 transition-colors"
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span>Upload Store Logo</span>
                  </button>
                )}
              </div>

              {/* Next Step CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#CB741B] py-3.5 text-xs font-extrabold text-white shadow-lg shadow-[#DE8626]/25 hover:from-[#C4721C] hover:to-[#B66415] transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Store...</span>
                    </>
                  ) : (
                    <>
                      <span>CONTINUE TO OWNER DETAILS</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: OWNER USER DETAILS (Exact parity with F:\Menza) */}
          {currentStep === 2 && (
            <form onSubmit={handleProceedToStep3} className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-xs space-y-5">
              <div className="flex items-center gap-2 border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                <UserCheck className="h-5 w-5 text-[#DE8626]" />
                <h2 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  Step 2: Owner User Details
                </h2>
              </div>

              {/* Store Summary Banner (Exact parity with F:\Menza) */}
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    {form.restaurantName || 'New Restaurant'}
                  </p>
                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                    Store ID: #{createdRestaurantId || 101} • {form.city ? `${form.city}, ` : ''}{getSelectedStateFullName(form.state)}
                  </p>
                </div>
              </div>

              {/* OWNER REGISTERED MOBILE * */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                    Owner Registered Mobile *
                  </label>
                  {ownerLookupLoading && (
                    <span className="text-[11px] text-[#DE8626] font-semibold flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking user...
                    </span>
                  )}
                </div>

                <div className="flex items-center rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] overflow-hidden focus-within:border-[#DE8626]">
                  <span className="px-3.5 py-3 text-xs font-bold text-[#667085] border-r border-[#E7E1DA] dark:border-[#2B3540] bg-black/5 dark:bg-white/5">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={form.ownerMobile}
                    onChange={(e) => setForm({ ...form, ownerMobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="flex-1 px-4 py-3 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] bg-transparent outline-hidden font-mono"
                  />
                  {existingOwner && (
                    <span className="pr-3 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  )}
                </div>

                {/* Auto-Fill Status Banner (Exact parity with F:\Menza) */}
                {existingOwner && (
                  <div className="mt-2.5 flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Existing Registered User Found</p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Name: "{existingOwner.name}" (ID: #{existingOwner.id}). Ownership will be linked to this account.
                      </p>
                    </div>
                  </div>
                )}

                {form.ownerMobile.length === 10 && !existingOwner && !ownerLookupLoading && (
                  <div className="mt-2.5 flex items-start gap-2.5 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-200">
                    <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-700 dark:text-blue-300">
                      New User: Account will be created automatically upon store completion.
                    </p>
                  </div>
                )}
              </div>

              {/* OWNER FULL NAME * */}
              <div>
                <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                  Owner Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                />
              </div>

              {/* Workflow Navigation Row */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-1.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] px-5 py-3 text-xs font-bold text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#CB741B] py-3.5 text-xs font-extrabold text-white shadow-lg shadow-[#DE8626]/25 hover:from-[#C4721C] hover:to-[#B66415] transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Validating User...</span>
                    </>
                  ) : (
                    <>
                      <span>CONTINUE TO ASSIGN ROLE</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: ASSIGN ROLE TO OWNER (Exact parity with F:\Menza) */}
          {currentStep === 3 && (
            <form onSubmit={handleCompleteAssignRole} className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-xs space-y-5">
              <div className="flex items-center gap-2 border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                <Shield className="h-5 w-5 text-[#DE8626]" />
                <h2 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  Step 3: Assign Role to Owner
                </h2>
              </div>

              {/* Workflow Summary Overview Box */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-[#1E2930] dark:text-[#F3F4F6]">
                  <Building className="h-4 w-4 text-[#DE8626]" />
                  <span>
                    <strong className="font-extrabold">Store:</strong> {form.restaurantName} {createdRestaurantId ? `(ID: #${createdRestaurantId})` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[#1E2930] dark:text-[#F3F4F6]">
                  <UserCheck className="h-4 w-4 text-[#DE8626]" />
                  <span>
                    <strong className="font-extrabold">Owner:</strong> {form.ownerName} (+91 {form.ownerMobile})
                  </span>
                </div>
              </div>

              {/* SELECT ROLE TO ASSIGN * */}
              <div>
                <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                  Select Role to Assign *
                </label>

                <div className="space-y-2.5">
                  {availableRoles
                    .filter((r) => !isSalesPerson || (r.id !== 1 && r.roleName.toLowerCase() !== 'superadmin'))
                    .map((roleObj) => {
                    const isSelected = roleObj.id === selectedRoleId;
                    return (
                      <div
                        key={roleObj.id}
                        onClick={() => setSelectedRoleId(roleObj.id)}
                        className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#DE8626] bg-[#FFF0DE]/40 dark:bg-amber-950/20 shadow-xs ring-1 ring-[#DE8626]'
                            : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-[#DE8626]/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                              isSelected
                                ? 'bg-[#DE8626] text-white'
                                : 'bg-amber-500/10 text-[#DE8626]'
                            }`}
                          >
                            <Shield className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                              {roleObj.roleName}
                            </p>
                            {roleObj.description && (
                              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                                {roleObj.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DE8626] text-white">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Default Active Role Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 text-xs">
                <div>
                  <p className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Set as Default Active Role
                  </p>
                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                    Injects role header into active REST sessions
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isDefaultRole}
                  onChange={(e) => setIsDefaultRole(e.target.checked)}
                  className="h-5 w-5 rounded-md border-gray-300 text-[#DE8626] focus:ring-[#DE8626] cursor-pointer"
                />
              </div>

              {/* Workflow Navigation Row */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-1.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] px-5 py-3 text-xs font-bold text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#CB741B] py-3.5 text-xs font-extrabold text-white shadow-lg shadow-[#DE8626]/25 hover:from-[#C4721C] hover:to-[#B66415] transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Provisioning Outlet...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>COMPLETE & LAUNCH</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* DYNAMIC SEARCHABLE STATE SELECTION MODAL (Exact parity with F:\Menza) */}
          {stateModalVisible && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[#DE8626]" />
                    <h3 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      Select State
                    </h3>
                  </div>
                  <button
                    onClick={() => setStateModalVisible(false)}
                    className="rounded-xl p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search state by name..."
                    value={stateSearchQuery}
                    onChange={(e) => setStateSearchQuery(e.target.value)}
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-10 pr-4 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  />
                </div>

                {/* States List */}
                <div className="max-h-72 overflow-y-auto space-y-1.5 divide-y divide-[#E7E1DA]/40 dark:divide-[#2B3540]/40">
                  {filteredStates.map((st) => {
                    const isSelected =
                      st.stateCode.toLowerCase() === (form.state || '').toLowerCase() ||
                      st.stateDesc.toLowerCase() === (form.state || '').toLowerCase();

                    return (
                      <button
                        key={st.stateCode}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, state: st.stateCode });
                          setStateModalVisible(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors ${
                          isSelected
                            ? 'bg-amber-500/15 font-bold text-[#DE8626]'
                            : 'text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <MapPin className={`h-4 w-4 ${isSelected ? 'text-[#DE8626]' : 'text-[#667085]'}`} />
                          <span>{st.stateDesc}</span>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-[#DE8626]" />}
                      </button>
                    );
                  })}
                  {filteredStates.length === 0 && (
                    <div className="py-6 text-center text-xs text-[#667085]">
                      No states found matching "{stateSearchQuery}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC IMAGE PICKER & PRESETS MODAL (Exact parity with F:\Menza) */}
          {imageModalVisible && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#DE8626]" />
                    <h3 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      Select {activeUploadTarget === 'imageUrl' ? 'Banner' : 'Logo'} Image
                    </h3>
                  </div>
                  <button
                    onClick={() => setImageModalVisible(false)}
                    className="rounded-xl p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Paste URL Input */}
                <div>
                  <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                    Image URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={customImageUrlInput}
                      onChange={(e) => setCustomImageUrlInput(e.target.value)}
                      className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-2 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomImageUrl}
                      className="rounded-xl bg-[#DE8626] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#C4721C]"
                    >
                      Set
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[11px] font-bold text-[#667085] uppercase mb-2">
                    Or Select Sample Preset:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {(activeUploadTarget === 'imageUrl' ? SAMPLE_BANNERS : SAMPLE_LOGOS).map((url, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectPresetImage(url)}
                        className="group relative rounded-xl overflow-hidden border border-[#E7E1DA] dark:border-[#2B3540] cursor-pointer hover:border-[#DE8626] transition-all"
                      >
                        <img
                          src={url}
                          alt={`Preset ${idx + 1}`}
                          className="h-20 w-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded">
                            Select
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setImageModalVisible(false)}
                    className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STORE ONBOARDED SUCCESS MODAL (Exact parity with F:\Menza) */}
          {successModalVisible && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-150">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-amber-500/15 text-[#DE8626] ring-4 ring-amber-500/10">
                  <Sparkles className="h-8 w-8 text-[#DE8626]" />
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#1E2930] dark:text-[#F3F4F6] tracking-tight">
                    STORE ONBOARDED 🎉
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                    Restaurant configuration & owner credentials set up successfully!
                  </p>
                </div>

                {onboardedSummary && (
                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 text-xs space-y-2 text-left">
                    <div className="flex justify-between">
                      <span className="text-[#667085] font-bold uppercase text-[10px]">STORE NAME</span>
                      <span className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">{onboardedSummary.storeName}</span>
                    </div>
                    <div className="h-px bg-[#E7E1DA]/60 dark:bg-[#2B3540]/60" />
                    <div className="flex justify-between">
                      <span className="text-[#667085] font-bold uppercase text-[10px]">STORE ID</span>
                      <span className="font-extrabold text-[#DE8626]">#{onboardedSummary.storeId}</span>
                    </div>
                    <div className="h-px bg-[#E7E1DA]/60 dark:bg-[#2B3540]/60" />
                    <div className="flex justify-between">
                      <span className="text-[#667085] font-bold uppercase text-[10px]">ASSIGNED OWNER</span>
                      <span className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">{onboardedSummary.ownerName}</span>
                    </div>
                    <div className="h-px bg-[#E7E1DA]/60 dark:bg-[#2B3540]/60" />
                    <div className="flex justify-between">
                      <span className="text-[#667085] font-bold uppercase text-[10px]">ACTIVE ROLE</span>
                      <span className="font-extrabold text-[#DE8626]">{onboardedSummary.roleName}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => router.push(isSalesPerson ? '/sales/restaurants' : '/superadmin/directory')}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#CB741B] py-3 text-xs font-extrabold text-white shadow-lg shadow-[#DE8626]/25 hover:from-[#C4721C] hover:to-[#B66415] transition-all"
                  >
                    <Store className="h-4 w-4" />
                    <span>{isSalesPerson ? 'VIEW MY STORES' : 'VIEW IN STORE DIRECTORY'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-bold text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    Onboard Another Outlet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
