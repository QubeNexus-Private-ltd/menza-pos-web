'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Phone,
  Mail,
  Check,
  X,
  RefreshCw,
  Sparkles,
  Lock,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { RoleRemoteDataSource } from '@shared/data/datasources/RoleRemoteDataSource';
import { StaffMember } from '@shared/domain/models/StaffMember';
import { RoleMaster } from '@shared/domain/models/Role';

const roleDataSource = new RoleRemoteDataSource();

export default function StaffPage() {
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<RoleMaster[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Staff Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<number>(4); // default Cashier
  const [employeeCode, setEmployeeCode] = useState('');
  const [savingStaff, setSavingStaff] = useState(false);

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

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || mobile.length !== 10) {
      alert('Please provide staff name and a valid 10-digit mobile number.');
      return;
    }

    try {
      setSavingStaff(true);
      await roleDataSource.registerStaffMember({
        restaurantId: currentRestId,
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        roleId: selectedRoleId,
        employeeCode: employeeCode.trim() || undefined,
      });

      await loadData();
      setName('');
      setMobile('');
      setEmail('');
      setEmployeeCode('');
      setAddModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to create staff member');
    } finally {
      setSavingStaff(false);
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
                  Staff Roles & Permissions
                </h1>
                <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-[#DE8626]">
                  {staffList.length} Team Members
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Control role-based access for Cashiers, Waiters, Kitchen Chefs, and Managers
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>

              <button
                onClick={() => setAddModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Staff Member</span>
              </button>
            </div>
          </div>

          {/* Staff Members List */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-xs text-[#667085]">Loading staff directory...</div>
            ) : staffList.length === 0 ? (
              <div className="py-20 text-center text-xs text-[#667085]">
                No staff members added yet. Click "Add Staff Member" to assign your first role.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Staff Member</th>
                      <th className="py-3.5 px-4 font-semibold">Mobile Phone</th>
                      <th className="py-3.5 px-4 font-semibold">Assigned Role</th>
                      <th className="py-3.5 px-4 font-semibold">Employee Code</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {staffList.map((member) => {
                      const roleDisplay = member.roleName || roles.find((r) => r.id === member.roleId)?.roleName || 'Staff';
                      return (
                        <tr key={member.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-xs font-bold text-[#DE8626]">
                                {member.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">{member.name}</p>
                                {member.email && (
                                  <p className="text-[10px] text-[#667085] dark:text-[#94A3B8]">{member.email}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-[#1E2930] dark:text-[#F3F4F6]">
                            +91 {member.mobile}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold uppercase ${
                                roleDisplay === 'Owner'
                                  ? 'bg-amber-500/10 text-[#DE8626]'
                                  : roleDisplay === 'Manager'
                                  ? 'bg-blue-500/10 text-blue-600'
                                  : roleDisplay === 'Cashier'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-purple-500/10 text-purple-600'
                              }`}
                            >
                              {roleDisplay}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[#667085]">
                            {member.employeeCode || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Add Staff Modal */}
        {addModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Add Staff Member</h3>
                <button onClick={() => setAddModalOpen(false)} className="rounded-lg p-1 text-[#667085]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Mobile Number (10 digits) *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                      Assigned Role *
                    </label>
                    <select
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.roleName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                      Employee Code (optional)
                    </label>
                    <input
                      type="text"
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      placeholder="e.g. EMP-01"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingStaff}
                    className="flex-1 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                  >
                    {savingStaff ? 'Saving...' : 'Add Member'}
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
