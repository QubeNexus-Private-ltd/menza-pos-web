'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Phone,
  Mail,
  Check,
  X,
  RefreshCw,
  Sparkles,
  Lock,
  Edit2,
  Trash2,
  KeyRound,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  IdCard,
  Crown,
  Briefcase,
  BadgePercent,
  ChefHat,
  AlertTriangle,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { StaffListSkeleton } from '@/components/common/Skeleton';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { RoleRemoteDataSource } from '@shared/data/datasources/RoleRemoteDataSource';
import { AuthRemoteDataSource } from '@shared/data/datasources/AuthRemoteDataSource';
import { StaffMember } from '@shared/domain/models/StaffMember';
import { RoleMaster } from '@shared/domain/models/Role';
import { canManageStaff } from '@shared/core/auth/rolePermissions';
import { useUserLookupByMobile } from '@shared/presentation/hooks/useUserLookupByMobile';
import { cleanMobile } from '@shared/core/utils/formatters';

const roleDataSource = new RoleRemoteDataSource();
const authRemoteDataSource = new AuthRemoteDataSource();

const getRoleVisualConfig = (roleName: string) => {
  const name = (roleName || '').toLowerCase();
  if (name.includes('owner') || name.includes('admin')) {
    return {
      icon: Crown,
      color: '#D97706',
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-300 dark:border-amber-700/50',
    };
  }
  if (name.includes('manager')) {
    return {
      icon: Briefcase,
      color: '#3B82F6',
      bg: 'bg-blue-500/10 dark:bg-blue-500/20',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-300 dark:border-blue-700/50',
    };
  }
  if (name.includes('cashier')) {
    return {
      icon: BadgePercent,
      color: '#10B981',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-300 dark:border-emerald-700/50',
    };
  }
  if (name.includes('waiter') || name.includes('captain') || name.includes('server')) {
    return {
      icon: Users,
      color: '#DE8626',
      bg: 'bg-orange-500/10 dark:bg-orange-500/20',
      text: 'text-orange-700 dark:text-orange-400',
      border: 'border-orange-300 dark:border-orange-700/50',
    };
  }
  if (name.includes('chef') || name.includes('cook') || name.includes('kitchen')) {
    return {
      icon: ChefHat,
      color: '#EF4444',
      bg: 'bg-rose-500/10 dark:bg-rose-500/20',
      text: 'text-rose-700 dark:text-rose-400',
      border: 'border-rose-300 dark:border-rose-700/50',
    };
  }
  return {
    icon: ShieldCheck,
    color: '#8C7A6B',
    bg: 'bg-neutral-500/10 dark:bg-neutral-500/20',
    text: 'text-neutral-700 dark:text-neutral-300',
    border: 'border-neutral-300 dark:border-neutral-700/50',
  };
};

export default function StaffPage() {
  const { activeRestaurant, restaurants, user } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);
  const canManage = canManageStaff(user, activeRestaurant || null);

  const [activeTab, setActiveTab] = useState<'directory' | 'roles'>('directory');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<RoleMaster[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Add / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRoleId, setFormRoleId] = useState<number>(4);
  const [formEmployeeCode, setFormEmployeeCode] = useState('');
  const [formShift, setFormShift] = useState('');
  const [formPin, setFormPin] = useState('');

  // Quick PIN Modal State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [targetStaffForPin, setTargetStaffForPin] = useState<StaffMember | null>(null);
  const [staffNewPin, setStaffNewPin] = useState('');
  const [savingStaffPin, setSavingStaffPin] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetStaffForDelete, setTargetStaffForDelete] = useState<StaffMember | null>(null);
  const [deletingStaff, setDeletingStaff] = useState(false);

  // Feedback Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Mobile Lookup for existing user autofill
  const {
    loading: staffLookupLoading,
    handleMobileChange: triggerStaffMobileLookup,
    reset: resetStaffLookup,
  } = useUserLookupByMobile();

  const handleStaffMobileChange = (txt: string) => {
    const sanitized = cleanMobile(txt);
    setFormMobile(sanitized);
    triggerStaffMobileLookup(sanitized, (foundUser) => {
      if (foundUser.name && !isEditing) {
        setFormName(foundUser.name);
      }
    });
  };

  // Clean slate upon restaurant switch
  useEffect(() => {
    setStaffList([]);
    setLoading(true);
  }, [currentRestId]);

  const loadData = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [staffRes, rolesRes] = await Promise.allSettled([
        roleDataSource.getStaffMembers(currentRestId),
        roleDataSource.getAllRoles(),
      ]);

      if (staffRes.status === 'fulfilled' && Array.isArray(staffRes.value)) {
        setStaffList(staffRes.value);
      }
      if (rolesRes.status === 'fulfilled' && Array.isArray(rolesRes.value)) {
        setRoles(rolesRes.value);
      }
    } catch (err) {
      console.warn('Failed to load staff roles', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Register Modal
  const handleOpenAddModal = (preselectedRoleId?: number) => {
    if (!canManage) {
      showToast('Only the restaurant Owner or Admin can register new staff members.', 'danger');
      return;
    }
    const defaultRoleId = preselectedRoleId || (roles.length > 0 ? roles[0].id : 4);
    setIsEditing(false);
    setEditingStaffId(null);
    setFormName('');
    setFormMobile('');
    setFormEmail('');
    setFormRoleId(defaultRoleId);
    setFormEmployeeCode('');
    setFormShift('');
    setFormPin('');
    resetStaffLookup();
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (staff: StaffMember) => {
    if (!canManage) {
      showToast('Only the restaurant Owner or Admin can edit staff details.', 'danger');
      return;
    }
    setIsEditing(true);
    setEditingStaffId(staff.id);
    setFormName(staff.name || '');
    setFormMobile(staff.mobile || '');
    setFormEmail(staff.email || '');
    setFormRoleId(staff.roleId || 4);
    setFormEmployeeCode(staff.employeeCode || '');
    setFormShift(staff.shift || '');
    setFormPin('');
    setModalOpen(true);
  };

  // Save Staff (Add or Edit)
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      showToast('Permission Denied: Only Owner or Admin can modify staff members.', 'danger');
      return;
    }
    if (!formName.trim() || formMobile.trim().length !== 10) {
      showToast('Please enter full name and a valid 10-digit mobile number.', 'danger');
      return;
    }

    try {
      setSavingStaff(true);
      const cleanEmployeeCode = formEmployeeCode.trim() || undefined;
      const cleanShift = formShift.trim() || undefined;
      const cleanEmail = formEmail.trim() || undefined;

      if (isEditing && editingStaffId) {
        const currentStaff = staffList.find((s) => s.id === editingStaffId || s.userId === editingStaffId);
        await roleDataSource.updateStaffMember(editingStaffId, {
          name: formName.trim(),
          mobile: formMobile.trim(),
          email: cleanEmail,
          roleId: formRoleId,
          restaurantId: currentRestId,
          userId: currentStaff?.userId,
          employeeCode: cleanEmployeeCode,
          shift: cleanShift,
        });

        if (formPin && /^\d{4}$/.test(formPin)) {
          const targetUserId = currentStaff?.userId || currentStaff?.id || editingStaffId;
          try {
            await authRemoteDataSource.setStaffPin(targetUserId, formPin);
          } catch (pinErr) {
            console.warn('Could not sync staff PIN on edit:', pinErr);
          }
        }

        showToast(`Staff details for ${formName} updated successfully.`, 'success');
        setModalOpen(false);
        await loadData();
      } else {
        const newStaff = await roleDataSource.registerStaffMember({
          restaurantId: currentRestId,
          name: formName.trim(),
          mobile: formMobile.trim(),
          email: cleanEmail,
          roleId: formRoleId,
          employeeCode: cleanEmployeeCode,
          shift: cleanShift,
        });

        const targetUserId = newStaff?.userId || newStaff?.id;
        if (targetUserId) {
          const initialPin = formPin && /^\d{4}$/.test(formPin) ? formPin : '1234';
          try {
            await authRemoteDataSource.setStaffPin(targetUserId, initialPin);
          } catch (pinErr) {
            console.warn('Could not sync initial staff PIN:', pinErr);
          }
        }

        showToast(`New staff member ${formName} registered successfully.`, 'success');
        setModalOpen(false);
        await loadData();
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save staff record.', 'danger');
    } finally {
      setSavingStaff(false);
    }
  };

  // Toggle Active/Inactive Status with Optimistic UI & Rollback
  const handleToggleStatus = async (staff: StaffMember) => {
    if (!canManage) {
      showToast('Permission Denied: Only the restaurant Owner or Admin can modify staff active status.', 'danger');
      return;
    }
    const previousStatus = staff.isActive;
    const newStatus = !previousStatus;

    // Optimistic UI update
    setStaffList((prev) => prev.map((s) => (s.id === staff.id ? { ...s, isActive: newStatus } : s)));

    try {
      const success = await roleDataSource.toggleRoleStatus(staff.id, newStatus, currentRestId, staff.userId);
      if (!success) {
        throw new Error('Failed to update staff status.');
      }
      showToast(`${staff.name} is now ${newStatus ? 'Active' : 'Inactive'}.`, 'success');
      await loadData();
    } catch (err: any) {
      // Revert optimistic update
      setStaffList((prev) => prev.map((s) => (s.id === staff.id ? { ...s, isActive: previousStatus } : s)));
      showToast(err?.message || 'Could not update staff status on server.', 'danger');
    }
  };

  // Open Quick PIN Modal
  const handleOpenPinModal = (staff: StaffMember) => {
    if (!canManage) {
      showToast('Only the restaurant Owner or Admin can modify staff PIN.', 'danger');
      return;
    }
    setTargetStaffForPin(staff);
    setStaffNewPin('');
    setPinModalOpen(true);
  };

  // Save Quick PIN
  const handleSaveStaffPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(staffNewPin)) {
      showToast('Staff PIN must be exactly 4 numeric digits (e.g. 1234).', 'danger');
      return;
    }
    if (!targetStaffForPin) return;

    try {
      setSavingStaffPin(true);
      const targetId = targetStaffForPin.userId || targetStaffForPin.id;
      await authRemoteDataSource.setStaffPin(targetId, staffNewPin);
      showToast(`4-digit PIN for ${targetStaffForPin.name} updated successfully.`, 'success');
      setPinModalOpen(false);
      setStaffNewPin('');
      setTargetStaffForPin(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update staff PIN.', 'danger');
    } finally {
      setSavingStaffPin(false);
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (staff: StaffMember) => {
    if (!canManage) {
      showToast('Only the restaurant Owner or Admin can delete staff members.', 'danger');
      return;
    }
    setTargetStaffForDelete(staff);
    setDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!targetStaffForDelete) return;
    try {
      setDeletingStaff(true);
      await roleDataSource.deleteStaffMember(targetStaffForDelete.id, currentRestId, targetStaffForDelete.userId);
      setStaffList((prev) => prev.filter((s) => s.id !== targetStaffForDelete.id && s.userId !== targetStaffForDelete.id));
      showToast(`${targetStaffForDelete.name} has been removed from this outlet.`, 'success');
      setDeleteModalOpen(false);
      setTargetStaffForDelete(null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Could not remove staff member.', 'danger');
    } finally {
      setDeletingStaff(false);
    }
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchRole =
        roleFilter === 'all' || s.roleName?.toLowerCase() === roleFilter.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.mobile && s.mobile.includes(q)) ||
        (s.employeeCode && s.employeeCode.toLowerCase().includes(q));
      return matchRole && matchQuery;
    });
  }, [staffList, searchQuery, roleFilter]);

  const dynamicRoleFilterOptions = useMemo(() => {
    const roleNames = Array.from(
      new Set(
        [
          ...roles.map((r) => r.roleName),
          ...staffList.map((s) => s.roleName),
        ].filter(Boolean)
      )
    );
    return ['all', ...roleNames];
  }, [roles, staffList]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Toast Notification */}
          {toast && (
            <div
              className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-xl text-xs font-semibold backdrop-blur-md border animate-in fade-in slide-in-from-top-2 duration-200 ${
                toast.type === 'danger'
                  ? 'bg-rose-50/95 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                  : 'bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {toast.type === 'danger' ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Staff Roles & Permissions
                </h1>
                <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-[#DE8626]">
                  {staffList.length} Team Members
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Control role-based access for Owners, Managers, Cashiers, Waiters, and Kitchen Chefs
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>

              {canManage ? (
                <button
                  onClick={() => handleOpenAddModal()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#DE8626] to-[#CB741B] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:brightness-105 transition-all"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>+ Add Staff</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-500/10 px-3 py-2 text-xs font-bold text-[#DE8626]">
                  <Lock className="h-3.5 w-3.5" />
                  <span>VIEW ONLY</span>
                </div>
              )}
            </div>
          </div>

          {/* Cashier View-Only Warning Banner */}
          {!canManage && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/20 p-4">
              <div className="rounded-xl bg-[#DE8626] p-2 text-white">
                <Lock className="h-4 w-4" />
              </div>
              <div className="flex-1 text-xs">
                <h4 className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">Owner & Admin Staff Directory</h4>
                <p className="mt-0.5 text-[#667085] dark:text-[#94A3B8]">
                  You have view-only access. Registering, editing, and managing staff active status is strictly restricted to the Restaurant Owner or Admin of this outlet.
                </p>
              </div>
            </div>
          )}

          {/* Tab Switcher: Staff Directory vs Roles Hierarchy */}
          <div className="flex items-center gap-2 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-2">
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'directory'
                  ? 'bg-[#DE8626] text-white shadow-sm'
                  : 'text-[#667085] dark:text-[#94A3B8] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Staff Directory</span>
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  activeTab === 'directory' ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-[#667085]'
                }`}
              >
                {staffList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'roles'
                  ? 'bg-[#DE8626] text-white shadow-sm'
                  : 'text-[#667085] dark:text-[#94A3B8] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Roles & Permissions Hierarchy</span>
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  activeTab === 'roles' ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-[#667085]'
                }`}
              >
                {roles.length}
              </span>
            </button>
          </div>

          {activeTab === 'directory' ? (
            <>
              {/* Bento Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-4 shadow-sm">
                  <div className="flex items-center justify-between text-[#667085] dark:text-[#94A3B8] mb-1">
                    <span className="text-xs font-bold uppercase">Total Team</span>
                    <Users className="h-4 w-4 text-[#DE8626]" />
                  </div>
                  <div className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">{staffList.length}</div>
                </div>

                <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-4 shadow-sm">
                  <div className="flex items-center justify-between text-[#667085] dark:text-[#94A3B8] mb-1">
                    <span className="text-xs font-bold uppercase">Active Staff</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {staffList.filter((s) => s.isActive).length}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-4 shadow-sm">
                  <div className="flex items-center justify-between text-[#667085] dark:text-[#94A3B8] mb-1">
                    <span className="text-xs font-bold uppercase">Inactive Staff</span>
                    <span className="h-2 w-2 rounded-full bg-neutral-400" />
                  </div>
                  <div className="text-2xl font-black text-[#667085]">
                    {staffList.filter((s) => !s.isActive).length}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-4 shadow-sm">
                  <div className="flex items-center justify-between text-[#667085] dark:text-[#94A3B8] mb-1">
                    <span className="text-xs font-bold uppercase">Role Types</span>
                    <ShieldCheck className="h-4 w-4 text-[#DE8626]" />
                  </div>
                  <div className="text-2xl font-black text-[#DE8626]">{roles.length}</div>
                </div>
              </div>

              {/* Search & Role Filter Pills */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#DE8626]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search staff by name, mobile, code..."
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] pl-10 pr-9 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#1E2930]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {dynamicRoleFilterOptions.map((rf) => {
                    const isSel = roleFilter.toLowerCase() === rf.toLowerCase();
                    return (
                      <button
                        key={`rf-${rf}`}
                        onClick={() => setRoleFilter(rf)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                          isSel
                            ? 'bg-[#DE8626] text-white shadow-sm'
                            : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] text-[#667085] dark:text-[#94A3B8] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        {rf === 'all' ? 'All Roles' : rf}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Staff Members Table */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-sm overflow-hidden">
                {loading && staffList.length === 0 ? (
                  <StaffListSkeleton count={5} />
                ) : filteredStaff.length === 0 ? (
                  <div className="py-20 text-center text-xs text-[#667085] flex flex-col items-center justify-center gap-2">
                    <Users className="h-10 w-10 text-[#667085]/40" />
                    <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">No Staff Members Found</p>
                    <p className="text-xs text-[#667085] max-w-sm">
                      {searchQuery || roleFilter !== 'all'
                        ? 'No staff members match the current search query or role filter.'
                        : 'Register team members to grant POS, KDS, & Manager access credentials.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8]">
                        <tr>
                          <th className="py-3.5 px-4 font-semibold">Staff Member</th>
                          <th className="py-3.5 px-4 font-semibold">Mobile Phone</th>
                          <th className="py-3.5 px-4 font-semibold">Assigned Role</th>
                          <th className="py-3.5 px-4 font-semibold">Shift & Code</th>
                          <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                          <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                        {filteredStaff.map((member) => {
                          const roleDisplay =
                            member.roleName || roles.find((r) => r.id === member.roleId)?.roleName || 'Staff';
                          const visual = getRoleVisualConfig(roleDisplay);
                          const RoleIcon = visual.icon;

                          return (
                            <tr
                              key={member.id}
                              className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                                !member.isActive ? 'opacity-70 bg-black/[0.02] dark:bg-white/[0.02]' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs border ${visual.bg} ${visual.text} ${visual.border}`}
                                  >
                                    {member.name ? member.name.slice(0, 2).toUpperCase() : 'ST'}
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-1.5">
                                      {member.name}
                                    </p>
                                    {member.email && (
                                      <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] flex items-center gap-1 mt-0.5">
                                        <Mail className="h-3 w-3 shrink-0" />
                                        <span>{member.email}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-medium text-[#1E2930] dark:text-[#F3F4F6]">
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <Phone className="h-3 w-3 text-[#667085]" />
                                  <span>+91 {member.mobile}</span>
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-extrabold uppercase border ${visual.bg} ${visual.text} ${visual.border}`}
                                >
                                  <RoleIcon className="h-3.5 w-3.5" />
                                  <span>{roleDisplay}</span>
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="flex flex-col gap-1">
                                  {member.employeeCode ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                                      <IdCard className="h-3 w-3" />
                                      <span>{member.employeeCode}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-[#667085]/60">—</span>
                                  )}
                                  {member.shift && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md w-fit">
                                      <Clock className="h-2.5 w-2.5" />
                                      <span>{member.shift}</span>
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Active / Inactive Status Switch */}
                              <td className="py-3.5 px-4 text-center">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => handleToggleStatus(member)}
                                    disabled={!canManage}
                                    title={
                                      !canManage
                                        ? 'Only Owner or Admin can toggle status'
                                        : member.isActive
                                        ? 'Click to Deactivate'
                                        : 'Click to Activate'
                                    }
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      member.isActive ? 'bg-[#DE8626]' : 'bg-neutral-300 dark:bg-neutral-700'
                                    } ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                        member.isActive ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                  <span
                                    className={`text-[11px] font-bold ${
                                      member.isActive
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-neutral-500 dark:text-neutral-400'
                                    }`}
                                  >
                                    {member.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              </td>

                              {/* Action Buttons */}
                              <td className="py-3.5 px-4 text-right">
                                {canManage ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleOpenPinModal(member)}
                                      title="Set 4-Digit PIN"
                                      className="rounded-lg p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                    >
                                      <KeyRound className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditModal(member)}
                                      title="Edit Details"
                                      className="rounded-lg p-1.5 text-[#DE8626] hover:bg-[#DE8626]/10 transition-colors"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenDeleteModal(member)}
                                      title="Remove Staff"
                                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-500/10 transition-colors"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-[#667085] italic">Locked</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Roles & Permissions Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    Access Roles & Permissions Hierarchy
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                    Overview of all system role tiers and active staff member count
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((r) => {
                  const assignedCount = staffList.filter((s) => s.roleId === r.id).length;
                  const visual = getRoleVisualConfig(r.roleName);
                  const IconComp = visual.icon;

                  return (
                    <div
                      key={`role-card-${r.id}`}
                      className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${visual.bg} ${visual.text} ${visual.border}`}
                        >
                          <IconComp className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">{r.roleName}</h4>
                          <span className="text-[11px] font-semibold text-[#DE8626]">
                            {assignedCount} {assignedCount === 1 ? 'member' : 'members'} assigned
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[#667085] dark:text-[#94A3B8] leading-relaxed">
                        {r.description || 'Standard access tier for restaurant floor and kitchen staff.'}
                      </p>

                      {canManage && (
                        <div className="pt-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 flex justify-end">
                          <button
                            onClick={() => handleOpenAddModal(r.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#DE8626] hover:text-[#C4721C]"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>+ Assign {r.roleName}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Add / Edit Staff Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl my-8">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E7E1DA] dark:border-[#2B3540]">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DE8626]/10 text-[#DE8626]">
                    {isEditing ? <Edit2 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      {isEditing ? 'Edit Staff Member' : 'Register New Staff Member'}
                    </h3>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      {isEditing
                        ? 'Update staff profile, assigned role tier, or PIN'
                        : 'Grant POS, KDS, & floor credentials to a new teammate'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  disabled={savingStaff}
                  className="rounded-lg p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase mb-1">
                    Mobile Number (10 digits) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#667085]">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={formMobile}
                      onChange={(e) => handleStaffMobileChange(e.target.value)}
                      placeholder="9876543210"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-12 pr-10 py-2.5 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                    {staffLookupLoading && (
                      <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-[#DE8626]" />
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-[#667085]">
                    Entering an existing user mobile number will automatically link their profile.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase mb-1">
                    Staff Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase mb-1">
                      Assigned Role Tier *
                    </label>
                    <select
                      value={formRoleId}
                      onChange={(e) => setFormRoleId(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.roleName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase mb-1">
                      Employee Code (optional)
                    </label>
                    <input
                      type="text"
                      value={formEmployeeCode}
                      onChange={(e) => setFormEmployeeCode(e.target.value)}
                      placeholder="e.g. EMP-101"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase mb-1">
                      Email Address (optional)
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="staff@restaurant.com"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase mb-1">
                      Shift Timing (optional)
                    </label>
                    <input
                      type="text"
                      value={formShift}
                      onChange={(e) => setFormShift(e.target.value)}
                      placeholder="e.g. Morning (9AM - 5PM)"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase mb-1">
                    {isEditing ? 'Update 4-Digit PIN (optional)' : 'Initial 4-Digit Unlock PIN (optional)'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder={isEditing ? 'Leave blank to preserve existing PIN' : 'e.g. 1234 (default is 1234)'}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="pt-3 flex items-center gap-2.5 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={savingStaff}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 font-semibold text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingStaff}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#DE8626] to-[#CB741B] py-2.5 font-bold text-white shadow-md shadow-[#DE8626]/20 hover:brightness-105 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {savingStaff ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>{isEditing ? 'Save Changes' : 'Register Teammate'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Quick Staff PIN Modal */}
        {pinModalOpen && targetStaffForPin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Set Staff PIN</h3>
                </div>
                <button
                  onClick={() => setPinModalOpen(false)}
                  disabled={savingStaffPin}
                  className="rounded-lg p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mb-4">
                Set a 4-digit POS unlock PIN for{' '}
                <strong className="text-[#1E2930] dark:text-[#F3F4F6]">{targetStaffForPin.name}</strong> (
                {targetStaffForPin.roleName}).
              </p>

              <form onSubmit={handleSaveStaffPin} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase mb-1.5 text-center">
                    New 4-Digit Numeric PIN
                  </label>
                  <input
                    type="password"
                    autoFocus
                    required
                    maxLength={4}
                    value={staffNewPin}
                    onChange={(e) => setStaffNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full text-center text-2xl tracking-[0.5em] rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] py-3 font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPinModalOpen(false)}
                    disabled={savingStaffPin}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingStaffPin || staffNewPin.length !== 4}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#DE8626] to-[#CB741B] py-2.5 font-bold text-white shadow-md shadow-[#DE8626]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {savingStaffPin ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Save PIN</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && targetStaffForDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl border border-rose-200 dark:border-rose-800 bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Remove Staff Member?</h3>
                  <p className="text-[11px] text-[#667085]">This action revokes all POS and floor access</p>
                </div>
              </div>

              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mb-5">
                Are you sure you want to remove{' '}
                <strong className="text-rose-600 dark:text-rose-400">{targetStaffForDelete.name}</strong> from{' '}
                {activeRestaurant?.restaurantName || 'this outlet'}?
              </p>

              <div className="flex items-center gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deletingStaff}
                  className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 font-semibold text-[#667085]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deletingStaff}
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {deletingStaff ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Removing...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Yes, Remove</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
