'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  ArrowLeft,
  Save,
  CreditCard,
  Check,
  Clock,
  Percent,
  MapPin,
  Upload,
  Image as ImageIcon,
  Camera,
  Sparkles,
  Loader2,
  Globe,
  Search,
  X,
  ChevronDown,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { MasterDataRemoteDataSource } from '@shared/data/datasources/MasterDataRemoteDataSource';
import { MasterDataRepositoryImpl } from '@shared/data/repositories/MasterDataRepositoryImpl';
import { StateMaster } from '@shared/domain/models/MasterData';
import { WebImageUploadService } from '@/services/imageUploadService';

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

export default function RestaurantConfigPage() {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingImages, setSavingImages] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('KA');
  const [imageUrl, setImageUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [fssaiNumber, setFssaiNumber] = useState('');
  const [cgstRate, setCgstRate] = useState('2.5');
  const [sgstRate, setSgstRate] = useState('2.5');
  const [serviceChargeRate, setServiceChargeRate] = useState('0');
  const [isOpen, setIsOpen] = useState(true);
  const [dineInPaymentMode, setDineInPaymentMode] = useState<'PREPAID' | 'POSTPAID'>('PREPAID');

  // States & Modals
  const [states, setStates] = useState<StateMaster[]>(FULL_STATE_MASTER_LIST);
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');

  // Image Picker Modal
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

  const loadConfig = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [cfg, op] = await Promise.allSettled([
        configDataSource.getConfig(currentRestId),
        configDataSource.getOperatingStatus(currentRestId),
      ]);

      if (cfg.status === 'fulfilled' && cfg.value) {
        const c = cfg.value;
        setName(c.restaurantName || activeRestaurant?.restaurantName || '');
        setPhone(c.contactNumber || '');
        setEmail(c.email || '');
        setAddress(c.address || activeRestaurant?.address || '');
        setCity(c.city || activeRestaurant?.city || '');
        const rawState = c.state || activeRestaurant?.state || 'KA';
        const matchedState = FULL_STATE_MASTER_LIST.find(
          (s) =>
            s.stateCode.toLowerCase() === rawState.toLowerCase() ||
            s.stateDesc.toLowerCase() === rawState.toLowerCase()
        );
        setState(matchedState ? matchedState.stateCode : rawState);
        setImageUrl(c.imageUrl || activeRestaurant?.imageUrl || '');
        setLogoUrl(c.logoUrl || activeRestaurant?.logoUrl || '');
        setGstNumber(c.gstNumber || '');
        setCgstRate(String(c.cgstPercentage ?? 2.5));
        setSgstRate(String(c.sgstPercentage ?? 2.5));
        setDineInPaymentMode(((c as any).dineInPaymentMode) || 'PREPAID');
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

  // Separate File Upload for Logo or Banner
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'logoUrl' | 'imageUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (target === 'logoUrl') setUploadingLogo(true);
      else setUploadingBanner(true);

      const uploadedUrl = await WebImageUploadService.uploadImage(file);
      const nextLogo = target === 'logoUrl' ? uploadedUrl : logoUrl;
      const nextBanner = target === 'imageUrl' ? uploadedUrl : imageUrl;

      if (target === 'logoUrl') setLogoUrl(uploadedUrl);
      else setImageUrl(uploadedUrl);

      // Immediately persist the updated image to the backend
      if (currentRestId) {
        await configDataSource.updateImagesOnly(
          currentRestId,
          { logoUrl: nextLogo, imageUrl: nextBanner },
          {
            restaurantName: name.trim() || activeRestaurant?.restaurantName || 'Menza Restaurant',
            address: address.trim(),
            city: city.trim(),
            state: state.trim(),
            contactNumber: phone.trim(),
            email: email.trim(),
            gstNumber: gstNumber.trim(),
            cgstPercentage: parseFloat(cgstRate) || 2.5,
            sgstPercentage: parseFloat(sgstRate) || 2.5,
          }
        );
        setSuccessMsg(
          `${target === 'logoUrl' ? 'Store Logo' : 'Store Banner'} uploaded and updated successfully!`
        );
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      alert(err?.message || 'Image upload failed. Please try a valid JPG or PNG file.');
    } finally {
      if (target === 'logoUrl') setUploadingLogo(false);
      else setUploadingBanner(false);
      e.target.value = '';
    }
  };

  // Save Images Separately Button Handler
  const handleSaveImagesSeparately = async () => {
    if (!currentRestId) return;
    try {
      setSavingImages(true);
      setSuccessMsg(null);
      const ok = await configDataSource.updateImagesOnly(
        currentRestId,
        { imageUrl, logoUrl },
        {
          restaurantName: name.trim() || activeRestaurant?.restaurantName || 'Menza Restaurant',
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          contactNumber: phone.trim(),
          email: email.trim(),
          gstNumber: gstNumber.trim(),
          cgstPercentage: parseFloat(cgstRate) || 2.5,
          sgstPercentage: parseFloat(sgstRate) || 2.5,
        }
      );
      if (ok) {
        setSuccessMsg('Store Logo and Banner images updated successfully!');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        alert('Failed to update restaurant images. Please try again.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update restaurant images');
    } finally {
      setSavingImages(false);
    }
  };

  const handleOpenImagePicker = (target: 'imageUrl' | 'logoUrl') => {
    setActiveUploadTarget(target);
    setCustomImageUrlInput(target === 'imageUrl' ? imageUrl : logoUrl);
    setImageModalVisible(true);
  };

  const handleApplyImageSelection = async (selectedUrl: string) => {
    const cleanUrl = selectedUrl.trim();
    const nextLogo = activeUploadTarget === 'logoUrl' ? cleanUrl : logoUrl;
    const nextBanner = activeUploadTarget === 'imageUrl' ? cleanUrl : imageUrl;

    if (activeUploadTarget === 'logoUrl') setLogoUrl(cleanUrl);
    else setImageUrl(cleanUrl);
    setImageModalVisible(false);

    if (currentRestId && cleanUrl) {
      setSavingImages(true);
      try {
        await configDataSource.updateImagesOnly(
          currentRestId,
          { logoUrl: nextLogo, imageUrl: nextBanner },
          {
            restaurantName: name.trim() || activeRestaurant?.restaurantName || 'Menza Restaurant',
            address: address.trim(),
            city: city.trim(),
            state: state.trim(),
            contactNumber: phone.trim(),
            email: email.trim(),
            gstNumber: gstNumber.trim(),
            cgstPercentage: parseFloat(cgstRate) || 2.5,
            sgstPercentage: parseFloat(sgstRate) || 2.5,
          }
        );
        setSuccessMsg(
          `${activeUploadTarget === 'logoUrl' ? 'Store Logo' : 'Store Banner'} updated successfully!`
        );
        setTimeout(() => setSuccessMsg(null), 4000);
      } finally {
        setSavingImages(false);
      }
    }
  };

  // Full Configuration Save
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRestId) return;

    try {
      setSaving(true);
      setSuccessMsg(null);

      const [cfgOk] = await Promise.all([
        configDataSource.updateConfig(currentRestId, {
          restaurantName: name.trim(),
          contactNumber: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          imageUrl: imageUrl.trim(),
          logoUrl: logoUrl.trim(),
          gstNumber: gstNumber.trim(),
          cgstPercentage: parseFloat(cgstRate) || 0,
          sgstPercentage: parseFloat(sgstRate) || 0,
        }),
        configDataSource.toggleOrdering(currentRestId, {
          isAccepting: isOpen,
        }),
      ]);

      if (!cfgOk) {
        alert('Failed to update restaurant configuration. Please verify the details.');
        return;
      }

      setSuccessMsg('Restaurant profile, images, and tax configuration updated successfully!');
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
              Restaurant Profile, Media & Tax Configuration
            </h1>
            <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
              Update store logo and banner images separately or configure GST rates, contact details, and operating status
            </p>
          </div>

          {successMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Store Brand Media (Separate Image Update Section) */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-2">
                  <Camera className="h-4 w-4 text-[#DE8626]" />
                  <span>Store Brand Images (Logo & Banner)</span>
                </h3>
                <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                  Upload or change your restaurant logo and cover banner independently at any time
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveImagesSeparately}
                disabled={savingImages || uploadingLogo || uploadingBanner}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3.5 py-2 text-xs font-bold text-[#DE8626] hover:bg-amber-500/25 disabled:opacity-50 transition-all self-start sm:self-auto"
              >
                {savingImages ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>{savingImages ? 'Updating Images...' : 'Save Images Only'}</span>
              </button>
            </div>

            {/* Hidden File Inputs */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, 'logoUrl')}
            />
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, 'imageUrl')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              {/* Store Logo Card */}
              <div className="sm:col-span-5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex flex-col justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 shrink-0 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] overflow-hidden flex items-center justify-center">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Store Logo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Store className="h-7 w-7 text-[#DE8626]" />
                    )}
                    {uploadingLogo && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      Store Logo
                    </p>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-2">
                      Displayed on digital menus, QR headers, and receipts
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#DE8626] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#C4721C] disabled:opacity-50 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenImagePicker('logoUrl')}
                    className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-[11px] font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] transition-colors"
                  >
                    URL / Preset
                  </button>
                </div>
              </div>

              {/* Store Banner Card */}
              <div className="sm:col-span-7 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex flex-col justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-28 shrink-0 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] overflow-hidden flex items-center justify-center">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="Store Banner"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-[#667085]" />
                    )}
                    {uploadingBanner && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      Store Cover Banner
                    </p>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-2">
                      Widescreen storefront cover shown to dine-in & online guests
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={uploadingBanner}
                    onClick={() => bannerInputRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#DE8626] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#C4721C] disabled:opacity-50 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingBanner ? 'Uploading...' : 'Upload Banner'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenImagePicker('imageUrl')}
                    className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-[11px] font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] transition-colors"
                  >
                    URL / Preset
                  </button>
                </div>
              </div>
            </div>
          </div>

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

            {/* Table QR Ordering & Billing Mode Card */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#DE8626]" />
                  <span>Table QR Ordering & Billing Mode</span>
                </h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-0.5">
                  Choose whether in-store table diners must pay upfront online before food prep or pay their consolidated bill at checkout.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* PREPAID OPTION (DEFAULT) */}
                <div
                  onClick={() => setDineInPaymentMode('PREPAID')}
                  className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
                    dineInPaymentMode === 'PREPAID'
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                      : 'border-[#E7E1DA] dark:border-[#2B3540] hover:border-emerald-400/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                        ⚡
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                            Prepaid (Pay & Order)
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                            Default / Recommended
                          </span>
                        </div>
                        <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-1 leading-relaxed">
                          Customers pay online (UPI / Cards) upfront. Auto-fires to KDS. Eliminates unpaid bills and ghost orders 100%.
                        </p>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      dineInPaymentMode === 'PREPAID' ? 'border-emerald-600 bg-emerald-600' : 'border-[#94A3B8]'
                    }`}>
                      {dineInPaymentMode === 'PREPAID' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>

                {/* POSTPAID OPTION */}
                <div
                  onClick={() => setDineInPaymentMode('POSTPAID')}
                  className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
                    dineInPaymentMode === 'POSTPAID'
                      ? 'border-[#DE8626] bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-[#DE8626]'
                      : 'border-[#E7E1DA] dark:border-[#2B3540] hover:border-amber-400/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-[#DE8626] flex items-center justify-center font-bold shrink-0 mt-0.5">
                        🍽️
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                            Postpaid (Pay Later)
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                            Multi-Round KOT
                          </span>
                        </div>
                        <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-1 leading-relaxed">
                          Diners order to a table tab. Cashier confirms & fires KOT. Multi-round KOT enabled. Settle consolidated bill at the counter.
                        </p>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      dineInPaymentMode === 'POSTPAID' ? 'border-[#DE8626] bg-[#DE8626]' : 'border-[#94A3B8]'
                    }`}>
                      {dineInPaymentMode === 'POSTPAID' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">State *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setStateSearchQuery('');
                      setStateModalVisible(true);
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] transition-colors"
                  >
                    <span className="truncate">{getSelectedStateDisplay(state)}</span>
                    <ChevronDown className="h-4 w-4 text-[#667085] shrink-0" />
                  </button>
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
                disabled={saving || loading}
                className="flex items-center gap-2 rounded-2xl bg-[#DE8626] px-6 py-3 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-all"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>

          {/* Searchable State Selection Modal */}
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
                      st.stateCode.toLowerCase() === (state || '').toLowerCase() ||
                      st.stateDesc.toLowerCase() === (state || '').toLowerCase();

                    return (
                      <button
                        key={st.stateCode}
                        type="button"
                        onClick={() => {
                          setState(st.stateCode);
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

          {/* Image URL & Preset Modal */}
          {imageModalVisible && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
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
        </div>
      </AppShell>
    </AuthGuard>
  );
}
