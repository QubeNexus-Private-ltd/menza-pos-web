'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Store,
  CreditCard,
  Printer,
  Crown,
  ChevronRight,
  ShieldCheck,
  Building2,
  FileText,
  LogOut,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';

export default function SettingsHubPage() {
  const router = useRouter();
  const { user, activeRestaurant, logout } = useAuthStore();

  const settingsLinks = [
    {
      href: '/settings/restaurant',
      icon: Store,
      title: 'Restaurant Profile & Taxes',
      desc: 'Configure outlet name, address, GST rates, service charges, and store hours',
    },
    {
      href: '/settings/bank',
      icon: CreditCard,
      title: 'Bank Account & Settlement',
      desc: 'Payout bank account, IFSC verification, and gateway settlements',
    },
    {
      href: '/settings/printer',
      icon: Printer,
      title: 'Thermal Printer & KOT',
      desc: 'Receipt width (58mm/80mm), auto-print toggles, and custom footer messages',
    },
    {
      href: '/settings/billing',
      icon: Crown,
      title: 'Subscription & Billing',
      desc: 'Active plan tier, validity period, feature add-ons, and renewals',
    },
  ];

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
              Restaurant Settings
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
              Manage outlet profile, billing hardware, bank accounts, and subscription tiers
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settingsLinks.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="group cursor-pointer flex items-start gap-4 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm hover:border-[#DE8626] hover:shadow-md transition-all"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626] group-hover:scale-105 transition-transform">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] group-hover:text-[#DE8626] transition-colors">
                        {item.title}
                      </h3>
                      <ChevronRight className="h-4 w-4 text-[#667085] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1 line-clamp-2">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Account Overview Box */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">Session Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] p-3">
                <span className="text-[#667085]">Logged-in User</span>
                <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6] mt-0.5">
                  {user?.name || user?.mobile || 'Admin'}
                </p>
              </div>
              <div className="rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] p-3">
                <span className="text-[#667085]">Active Outlet ID</span>
                <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6] mt-0.5">
                  #{activeRestaurant?.restaurantId || 0}
                </p>
              </div>
              <div className="rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] p-3">
                <span className="text-[#667085]">Assigned Role</span>
                <p className="font-bold text-[#DE8626] mt-0.5 uppercase">
                  {user?.roles?.[0] || 'Owner'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out of Menza</span>
            </button>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
