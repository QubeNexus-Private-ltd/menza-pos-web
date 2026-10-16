'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  Search,
  Plus,
  RefreshCw,
  UserCheck,
  X,
  Loader2,
  Edit2,
  Upload,
  Camera,
  Image as ImageIcon,
  Save,
  Check,
  Globe,
  MapPin,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SuperAdminRemoteDataSource } from '@shared/data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '@shared/data/repositories/SuperAdminRepositoryImpl';
import { RoleRemoteDataSource } from '@shared/data/datasources/RoleRemoteDataSource';
import { RoleRepositoryImpl } from '@shared/data/repositories/RoleRepositoryImpl';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { MasterDataRemoteDataSource } from '@shared/data/datasources/MasterDataRemoteDataSource';
import { MasterDataRepositoryImpl } from '@shared/data/repositories/MasterDataRepositoryImpl';
import { StateMaster } from '@shared/domain/models/MasterData';
import { RestaurantDetail } from '@shared/domain/models/Restaurant';
import { apiClient } from '@shared/core/network/apiClient';
import { WebImageUploadService } from '@/services/imageUploadService';

const superAdminRepo = new SuperAdminRepositoryImpl(new SuperAdminRemoteDataSource());
const roleRepo = new RoleRepositoryImpl(new RoleRemoteDataSource());
const configDataSource = new RestaurantConfigRemoteDataSource();
const masterDataRepository = new MasterDataRepositoryImpl(new MasterDataRemoteDataSource());

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

export default function SuperAdminDirectoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<RestaurantDetail[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'active' | 'inactive'>('all');
  const [togglingStoreId, setTogglingStoreId] = useState<number | null>(null);

  // Assign Owner Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetStore, setTargetStore] = useState<RestaurantDetail | null>(null);
  const [ownerMobile, setOwnerMobile] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [mobileLookupLoading, setMobileLookupLoading] = useState(false);
  const [existingUserFound, setExistingUserFound] = useState<boolean | null>(null);

  // Edit Store Config & Images Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<RestaurantDetail | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editSavingImages, setEditSavingImages] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Edit Form Fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('KA');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editGstNumber, setEditGstNumber] = useState('');
  const [editCgstRate, setEditCgstRate] = useState('2.5');
  const [editSgstRate, setEditSgstRate] = useState('2.5');

  // State Picker & URL Preset Picker inside Edit Modal
  const [states, setStates] = useState<StateMaster[]>(FULL_STATE_MASTER_LIST);
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [activeUploadTarget, setActiveUploadTarget] = useState<'imageUrl' | 'logoUrl'>('imageUrl');
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');

  useEffect(() => {
    masterDataRepository
      .getStates()
      .then((list) => {
        if (list && list.length > 0) setStates(list);
      })
      .catch(() => setStates(FULL_STATE_MASTER_LIST));
  }, []);

  const filteredStates = useMemo(() => {
    if (!stateSearchQuery.trim()) return states;
    const q = stateSearchQuery.toLowerCase().trim();
    return states.filter(
      (st) =>
        st.stateCode.toLowerCase().includes(q) ||
        st.stateDesc.toLowerCase().includes(q)
    );
  }, [states, stateSearchQuery]);

  const getSelectedStateDisplay = (val?: string) => {
    if (!val) return 'Select State';
    const matched = states.find(
      (s) =>
        s.stateCode.toLowerCase() === val.toLowerCase() ||
        s.stateDesc.toLowerCase() === val.toLowerCase()
    );
    return matched ? `${matched.stateDesc} (${matched.stateCode})` : val;
  };

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

  // Open Edit Store Config & Media Modal
  const handleOpenEditConfigModal = async (store: RestaurantDetail) => {
    setEditingStore(store);
    setEditSuccessMsg(null);
    setEditName(store.restaurantName || '');
    setEditAddress(store.address || '');
    setEditCity(store.city || '');
    const rawState = store.state || 'KA';
    const matchedState = FULL_STATE_MASTER_LIST.find(
      (s) =>
        s.stateCode.toLowerCase() === rawState.toLowerCase() ||
        s.stateDesc.toLowerCase() === rawState.toLowerCase()
    );
    setEditState(matchedState ? matchedState.stateCode : rawState);
    setEditImageUrl(store.imageUrl || '');
    setEditLogoUrl(store.logoUrl || '');
    setEditPhone(store.ownerMobile || '');
    setEditEmail('');
    setEditGstNumber('');
    setEditCgstRate('2.5');
    setEditSgstRate('2.5');
    setEditModalOpen(true);

    try {
      setEditLoading(true);
      const cfg = await configDataSource.getConfig(store.restaurantId);
      if (cfg) {
        setEditName(cfg.restaurantName || store.restaurantName || '');
        setEditAddress(cfg.address || store.address || '');
        setEditCity(cfg.city || store.city || '');
        const cfgState = cfg.state || store.state || 'KA';
        const mState = FULL_STATE_MASTER_LIST.find(
          (s) =>
            s.stateCode.toLowerCase() === cfgState.toLowerCase() ||
            s.stateDesc.toLowerCase() === cfgState.toLowerCase()
        );
        setEditState(mState ? mState.stateCode : cfgState);
        setEditImageUrl(cfg.imageUrl || store.imageUrl || '');
        setEditLogoUrl(cfg.logoUrl || store.logoUrl || '');
        setEditPhone(cfg.contactNumber || store.ownerMobile || '');
        setEditEmail(cfg.email || '');
        setEditGstNumber(cfg.gstNumber || '');
        setEditCgstRate(String(cfg.cgstPercentage ?? 2.5));
        setEditSgstRate(String(cfg.sgstPercentage ?? 2.5));
      }
    } catch (err) {
      console.warn('Failed to load store config for edit', err);
    } finally {
      setEditLoading(false);
    }
  };

  // Upload File for Logo or Banner in SuperAdmin Edit Modal
  const handleEditFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'logoUrl' | 'imageUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !editingStore) return;

    try {
      if (target === 'logoUrl') setUploadingLogo(true);
      else setUploadingBanner(true);

      const uploadedUrl = await WebImageUploadService.uploadImage(file);
      const nextLogo = target === 'logoUrl' ? uploadedUrl : editLogoUrl;
      const nextBanner = target === 'imageUrl' ? uploadedUrl : editImageUrl;

      if (target === 'logoUrl') setEditLogoUrl(uploadedUrl);
      else setEditImageUrl(uploadedUrl);

      // Immediately save updated image to backend
      const ok = await configDataSource.updateImagesOnly(
        editingStore.restaurantId,
        { logoUrl: nextLogo, imageUrl: nextBanner },
        {
          restaurantName: editName.trim() || editingStore.restaurantName,
          address: editAddress.trim(),
          city: editCity.trim(),
          state: editState.trim(),
          contactNumber: editPhone.trim(),
          email: editEmail.trim(),
          gstNumber: editGstNumber.trim(),
          cgstPercentage: parseFloat(editCgstRate) || 2.5,
          sgstPercentage: parseFloat(editSgstRate) || 2.5,
        }
      );

      if (ok) {
        setStores((prev) =>
          prev.map((s) =>
            s.restaurantId === editingStore.restaurantId
              ? { ...s, logoUrl: nextLogo, imageUrl: nextBanner }
              : s
          )
        );
        setEditSuccessMsg(
          `${target === 'logoUrl' ? 'Store Logo' : 'Store Banner'} uploaded & saved separately!`
        );
        setTimeout(() => setEditSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      alert(err?.message || 'Image upload failed. Please try a valid JPG or PNG file.');
    } finally {
      if (target === 'logoUrl') setUploadingLogo(false);
      else setUploadingBanner(false);
      e.target.value = '';
    }
  };

  // Save Images Separately in SuperAdmin Modal
  const handleSaveEditImagesOnly = async () => {
    if (!editingStore) return;
    try {
      setEditSavingImages(true);
      setEditSuccessMsg(null);
      const ok = await configDataSource.updateImagesOnly(
        editingStore.restaurantId,
        { logoUrl: editLogoUrl, imageUrl: editImageUrl },
        {
          restaurantName: editName.trim() || editingStore.restaurantName,
          address: editAddress.trim(),
          city: editCity.trim(),
          state: editState.trim(),
          contactNumber: editPhone.trim(),
          email: editEmail.trim(),
          gstNumber: editGstNumber.trim(),
          cgstPercentage: parseFloat(editCgstRate) || 2.5,
          sgstPercentage: parseFloat(editSgstRate) || 2.5,
        }
      );
      if (ok) {
        setStores((prev) =>
          prev.map((s) =>
            s.restaurantId === editingStore.restaurantId
              ? { ...s, logoUrl: editLogoUrl, imageUrl: editImageUrl }
              : s
          )
        );
        setEditSuccessMsg('Store Logo and Banner images updated successfully!');
        setTimeout(() => setEditSuccessMsg(null), 4000);
      } else {
        alert('Failed to update store images. Please try again.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update store images');
    } finally {
      setEditSavingImages(false);
    }
  };

  const handleOpenImagePicker = (target: 'imageUrl' | 'logoUrl') => {
    setActiveUploadTarget(target);
    setCustomImageUrlInput(target === 'imageUrl' ? editImageUrl : editLogoUrl);
    setImageModalVisible(true);
  };

  const handleApplyImageSelection = async (selectedUrl: string) => {
    const cleanUrl = selectedUrl.trim();
    const nextLogo = activeUploadTarget === 'logoUrl' ? cleanUrl : editLogoUrl;
    const nextBanner = activeUploadTarget === 'imageUrl' ? cleanUrl : editImageUrl;

    if (activeUploadTarget === 'logoUrl') setEditLogoUrl(cleanUrl);
    else setEditImageUrl(cleanUrl);
    setImageModalVisible(false);

    if (editingStore && cleanUrl) {
      setEditSavingImages(true);
      try {
        const ok = await configDataSource.updateImagesOnly(
          editingStore.restaurantId,
          { logoUrl: nextLogo, imageUrl: nextBanner },
          {
            restaurantName: editName.trim() || editingStore.restaurantName,
            address: editAddress.trim(),
            city: editCity.trim(),
            state: editState.trim(),
            contactNumber: editPhone.trim(),
            email: editEmail.trim(),
            gstNumber: editGstNumber.trim(),
            cgstPercentage: parseFloat(editCgstRate) || 2.5,
            sgstPercentage: parseFloat(editSgstRate) || 2.5,
          }
        );
        if (ok) {
          setStores((prev) =>
            prev.map((s) =>
              s.restaurantId === editingStore.restaurantId
                ? { ...s, logoUrl: nextLogo, imageUrl: nextBanner }
                : s
            )
          );
          setEditSuccessMsg(
            `${activeUploadTarget === 'logoUrl' ? 'Store Logo' : 'Store Banner'} updated successfully!`
          );
          setTimeout(() => setEditSuccessMsg(null), 4000);
        }
      } finally {
        setEditSavingImages(false);
      }
    }
  };

  // Save Full Store Configuration in SuperAdmin Modal
  const handleSaveEditConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    if (!editName.trim()) {
      alert('Restaurant Name is required.');
      return;
    }

    try {
      setEditSaving(true);
      setEditSuccessMsg(null);
      const ok = await configDataSource.updateConfig(editingStore.restaurantId, {
        restaurantName: editName.trim(),
        contactNumber: editPhone.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
        city: editCity.trim(),
        state: editState.trim(),
        imageUrl: editImageUrl.trim(),
        logoUrl: editLogoUrl.trim(),
        gstNumber: editGstNumber.trim(),
        cgstPercentage: parseFloat(editCgstRate) || 0,
        sgstPercentage: parseFloat(editSgstRate) || 0,
      });

      if (ok) {
        setStores((prev) =>
          prev.map((s) =>
            s.restaurantId === editingStore.restaurantId
              ? {
                  ...s,
                  restaurantName: editName.trim(),
                  address: editAddress.trim(),
                  city: editCity.trim(),
                  state: editState.trim(),
                  imageUrl: editImageUrl.trim(),
                  logoUrl: editLogoUrl.trim(),
                }
              : s
          )
        );
        setEditSuccessMsg('Store configuration and images saved successfully!');
        setTimeout(() => setEditSuccessMsg(null), 4000);
      } else {
        alert('Failed to update restaurant configuration. Please try again.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error updating restaurant configuration');
    } finally {
      setEditSaving(false);
    }
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

            {/* Filter Tabs */}
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
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626] font-bold overflow-hidden border border-[#E7E1DA] dark:border-[#2B3540]">
                                {store.logoUrl ? (
                                  <img
                                    src={store.logoUrl}
                                    alt={store.restaurantName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Store className="h-5 w-5" />
                                )}
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
                              {/* Edit Config & Images */}
                              <button
                                onClick={() => handleOpenEditConfigModal(store)}
                                title="Edit Store Config, Logo & Banner Images"
                                className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors"
                              >
                                <Edit2 className="h-3 w-3" />
                                <span>Edit Config</span>
                              </button>

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

          {/* EDIT STORE CONFIG & IMAGES MODAL (SuperAdmin) */}
          {editModalOpen && editingStore && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
              <div className="w-full max-w-2xl rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      Edit Restaurant Config & Brand Images
                    </h3>
                    <p className="text-xs text-[#667085]">
                      {editingStore.restaurantName} (Store ID #{editingStore.restaurantId})
                    </p>
                  </div>
                  <button
                    onClick={() => setEditModalOpen(false)}
                    className="rounded-xl p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {editSuccessMsg && (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>{editSuccessMsg}</span>
                  </div>
                )}

                {editLoading ? (
                  <div className="py-12 text-center text-xs text-[#667085] flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-[#DE8626]" />
                    <span>Loading store configuration...</span>
                  </div>
                ) : (
                  <>
                    {/* Section 1: Separate Image Update Card */}
                    <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-1.5">
                            <Camera className="h-3.5 w-3.5 text-[#DE8626]" />
                            <span>Brand Images (Update Separately)</span>
                          </h4>
                          <p className="text-[11px] text-[#667085]">
                            Upload a new logo or banner file to update images independently
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveEditImagesOnly}
                          disabled={editSavingImages || uploadingLogo || uploadingBanner}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-[11px] font-bold text-[#DE8626] hover:bg-amber-500/25 disabled:opacity-50 transition-all self-start sm:self-auto"
                        >
                          {editSavingImages ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          <span>{editSavingImages ? 'Saving Images...' : 'Save Images Only'}</span>
                        </button>
                      </div>

                      {/* Hidden File Inputs */}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleEditFileUpload(e, 'logoUrl')}
                      />
                      <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleEditFileUpload(e, 'imageUrl')}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Logo Box */}
                        <div className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3 flex flex-col justify-between gap-2.5">
                          <div className="flex items-center gap-3">
                            <div className="relative h-14 w-14 shrink-0 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] overflow-hidden flex items-center justify-center">
                              {editLogoUrl ? (
                                <img src={editLogoUrl} alt="Logo" className="h-full w-full object-cover" />
                              ) : (
                                <Store className="h-6 w-6 text-[#DE8626]" />
                              )}
                              {uploadingLogo && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Store Logo</p>
                              <p className="text-[10px] text-[#667085] truncate">
                                {editLogoUrl || 'No logo uploaded'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={uploadingLogo}
                              onClick={() => logoInputRef.current?.click()}
                              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#DE8626] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#C4721C] disabled:opacity-50"
                            >
                              <Upload className="h-3 w-3" />
                              <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenImagePicker('logoUrl')}
                              className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] px-2.5 py-1.5 text-[11px] font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]"
                            >
                              URL / Preset
                            </button>
                          </div>
                        </div>

                        {/* Banner Box */}
                        <div className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3 flex flex-col justify-between gap-2.5">
                          <div className="flex items-center gap-3">
                            <div className="relative h-14 w-24 shrink-0 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] overflow-hidden flex items-center justify-center">
                              {editImageUrl ? (
                                <img src={editImageUrl} alt="Banner" className="h-full w-full object-cover" />
                              ) : (
                                <ImageIcon className="h-6 w-6 text-[#667085]" />
                              )}
                              {uploadingBanner && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Store Banner</p>
                              <p className="text-[10px] text-[#667085] truncate">
                                {editImageUrl || 'No banner uploaded'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={uploadingBanner}
                              onClick={() => bannerInputRef.current?.click()}
                              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#DE8626] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#C4721C] disabled:opacity-50"
                            >
                              <Upload className="h-3 w-3" />
                              <span>{uploadingBanner ? 'Uploading...' : 'Upload Banner'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenImagePicker('imageUrl')}
                              className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] px-2.5 py-1.5 text-[11px] font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]"
                            >
                              URL / Preset
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Store Profile & Tax Form */}
                    <form onSubmit={handleSaveEditConfig} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block font-bold text-[#667085] uppercase mb-1">
                            Restaurant Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#667085] uppercase mb-1">
                            Contact Number
                          </label>
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#667085] uppercase mb-1">
                            Support Email
                          </label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block font-bold text-[#667085] uppercase mb-1">
                            Street Address
                          </label>
                          <input
                            type="text"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#667085] uppercase mb-1">
                            City
                          </label>
                          <input
                            type="text"
                            value={editCity}
                            onChange={(e) => setEditCity(e.target.value)}
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#667085] uppercase mb-1">
                            State *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setStateSearchQuery('');
                              setStateModalVisible(true);
                            }}
                            className="w-full flex items-center justify-between rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]"
                          >
                            <span className="truncate">{getSelectedStateDisplay(editState)}</span>
                            <ChevronDown className="h-4 w-4 text-[#667085] shrink-0" />
                          </button>
                        </div>

                        <div>
                          <label className="block font-bold text-[#667085] uppercase mb-1">
                            GSTIN Number
                          </label>
                          <input
                            type="text"
                            value={editGstNumber}
                            onChange={(e) => setEditGstNumber(e.target.value)}
                            placeholder="29AAAAA0000A1Z5"
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block font-bold text-[#667085] uppercase mb-1">
                              CGST (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={editCgstRate}
                              onChange={(e) => setEditCgstRate(e.target.value)}
                              className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-2.5 font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-[#667085] uppercase mb-1">
                              SGST (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={editSgstRate}
                              onChange={(e) => setEditSgstRate(e.target.value)}
                              className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-2.5 font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
                        <button
                          type="button"
                          onClick={() => setEditModalOpen(false)}
                          className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2.5 font-semibold text-[#667085]"
                        >
                          Close
                        </button>
                        <button
                          type="submit"
                          disabled={editSaving}
                          className="flex items-center gap-1.5 rounded-xl bg-[#DE8626] px-5 py-2.5 font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50"
                        >
                          {editSaving ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save className="h-3.5 w-3.5" />
                              <span>Save Configuration</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Searchable State Selection Modal for SuperAdmin Edit */}
          {stateModalVisible && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[#DE8626]" />
                    <h3 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      Select State
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStateModalVisible(false)}
                    className="rounded-xl p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search state by name or code..."
                    value={stateSearchQuery}
                    onChange={(e) => setStateSearchQuery(e.target.value)}
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-10 pr-4 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5 divide-y divide-[#E7E1DA]/40 dark:divide-[#2B3540]/40">
                  {filteredStates.map((st) => {
                    const isSelected =
                      st.stateCode.toLowerCase() === (editState || '').toLowerCase() ||
                      st.stateDesc.toLowerCase() === (editState || '').toLowerCase();

                    return (
                      <button
                        key={st.stateCode}
                        type="button"
                        onClick={() => {
                          setEditState(st.stateCode);
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
                          <span>{st.stateDesc} ({st.stateCode})</span>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-[#DE8626]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Image URL & Preset Modal for SuperAdmin Edit */}
          {imageModalVisible && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#DE8626]" />
                    <h3 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      Update {activeUploadTarget === 'imageUrl' ? 'Store Banner' : 'Store Logo'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageModalVisible(false)}
                    className="rounded-xl p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                    Direct Image URL
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
                      onClick={() => handleApplyImageSelection(customImageUrlInput)}
                      className="rounded-xl bg-[#DE8626] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#C4721C]"
                    >
                      Save & Apply
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[11px] font-bold text-[#667085] uppercase mb-2">
                    Or Choose Sample Preset:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {(activeUploadTarget === 'imageUrl' ? SAMPLE_BANNERS : SAMPLE_LOGOS).map((url, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleApplyImageSelection(url)}
                        className="group relative rounded-xl overflow-hidden border border-[#E7E1DA] dark:border-[#2B3540] cursor-pointer hover:border-[#DE8626] transition-all"
                      >
                        <img
                          src={url}
                          alt={`Preset ${idx + 1}`}
                          className="h-20 w-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded">
                            Apply
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Assign Store Owner Modal */}
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
