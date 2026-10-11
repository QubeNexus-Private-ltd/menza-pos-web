'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  MessageSquare,
  ChefHat,
  Wallet,
  Globe,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { extractUserRoles } from '@shared/core/auth/rolePermissions';
import { SuperAdminRemoteDataSource } from '@shared/data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '@shared/data/repositories/SuperAdminRepositoryImpl';
import { SubscriptionRemoteDataSource } from '@shared/data/datasources/SubscriptionRemoteDataSource';

export default function SettingsHubPage() {
  const router = useRouter();
  const { user, activeRestaurant, logout } = useAuthStore();

  const extractedRoles = extractUserRoles(user, activeRestaurant);
  const isSuperAdmin =
    extractedRoles.some((r) => r.includes('superadmin') || r.includes('super_admin')) ||
    user?.roles?.some((r) =>
      typeof r === 'string' &&
      ['SUPERADMIN', 'SUPER_ADMIN', 'SUPERADMINONLY'].includes(r.toUpperCase().replace(/[^A-Z]/g, ''))
    ) ||
    (typeof user?.roles?.[0] === 'string' && user.roles[0].toLowerCase().includes('superadmin'));

  const superAdminRepo = useMemo(() => new SuperAdminRepositoryImpl(new SuperAdminRemoteDataSource()), []);
  const subscriptionDs = useMemo(() => new SubscriptionRemoteDataSource(), []);

  const [totalStores, setTotalStores] = useState(0);
  const [mrrAmount, setMrrAmount] = useState(0);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const loadSuperAdminStats = async () => {
      try {
        const [storesRes, subList, planList] = await Promise.allSettled([
          superAdminRepo.getAllRestaurants(undefined, undefined, undefined, undefined, 1, 100),
          subscriptionDs.getAllRestaurantSubscriptions(),
          subscriptionDs.getPlans(),
        ]);

        let storesCount = 0;
        if (storesRes.status === 'fulfilled' && storesRes.value) {
          storesCount = storesRes.value.totalCount || storesRes.value.items?.length || 0;
          setTotalStores(storesCount);
        }

        let totalMrr = 0;
        if (subList.status === 'fulfilled' && Array.isArray(subList.value) && subList.value.length > 0) {
          subList.value.forEach((sub: any) => {
            const status = (sub.status || sub.Status || '').toUpperCase();
            if (status === 'ACTIVE' || status === 'SUCCESS' || status === 'PAID') {
              const price = Number(sub.finalPrice ?? sub.FinalPrice ?? sub.price ?? sub.Price ?? 0);
              const duration = Number(sub.durationInDays ?? sub.DurationInDays ?? 30);
              const cycle = (sub.billingCycle || sub.BillingCycle || '').toUpperCase();

              if (cycle === 'ANNUALLY' || duration >= 300) {
                totalMrr += price / 12;
              } else if (cycle === 'HALFYEARLY' || duration >= 150) {
                totalMrr += price / 6;
              } else if (cycle === 'QUARTERLY' || duration >= 75) {
                totalMrr += price / 3;
              } else {
                totalMrr += price;
              }
            }
          });
        }

        if (totalMrr === 0 && storesCount > 0 && planList.status === 'fulfilled' && Array.isArray(planList.value) && planList.value.length > 0) {
          const activePlans = planList.value.filter((p) => p.isActive);
          if (activePlans.length > 0) {
            const avgPlanPrice =
              activePlans.reduce(
                (sum, p) =>
                  sum +
                  (p.finalPrice || p.price || 0) /
                    (p.durationInDays === 365 ? 12 : p.durationInDays === 180 ? 6 : p.durationInDays === 90 ? 3 : 1),
                0
              ) / activePlans.length;
            totalMrr = Math.round(avgPlanPrice * storesCount);
          }
        }

        setMrrAmount(Math.round(totalMrr));
      } catch (err) {
        console.warn('Failed to load SuperAdmin stats', err);
      }
    };
    loadSuperAdminStats();
  }, [isSuperAdmin, superAdminRepo, subscriptionDs]);

  const superAdminActions = [
    {
      href: '/superadmin/onboard',
      icon: Globe,
      title: 'Onboard New Restaurant Outlet',
      desc: '3-Stage wizard to provision new restaurant tenants, owner credentials, and channel routing',
      badge: 'Onboarding',
      badgeColor: 'bg-amber-500/10 text-[#DE8626]',
    },
    {
      href: '/superadmin/directory',
      icon: Building2,
      title: 'Active Outlets Directory',
      desc: 'Manage store profiles, reassign store owners, inspect configs, and toggle active status',
      badge: `${totalStores} Outlets`,
      badgeColor: 'bg-blue-500/10 text-blue-600',
    },
    {
      href: '/superadmin/plans',
      icon: Sparkles,
      title: 'SaaS Subscription Plans',
      desc: 'Create and configure SaaS pricing tiers, feature entitlements (KDS, SMS, POS), and duration',
      badge: 'Plans & Pricing',
      badgeColor: 'bg-purple-500/10 text-purple-600',
    },
    {
      href: '/terms',
      icon: FileText,
      title: 'Rules & Regulations (Terms)',
      desc: 'Official 20-article compliance, SaaS service agreement, and platform obligations',
      badge: 'Legal',
      badgeColor: 'bg-stone-500/10 text-stone-600 dark:text-stone-300',
    },
    {
      href: '/privacy',
      icon: ShieldCheck,
      title: 'Privacy Policy & Data Protection',
      desc: 'Digital Personal Data Protection (DPDP) Act 2023 compliance & grievance redressal framework',
      badge: 'DPDP Act',
      badgeColor: 'bg-emerald-500/10 text-emerald-600',
    },
  ];

  const standardSettingsLinks = [
    {
      href: '/settings/restaurant',
      icon: Store,
      title: 'Restaurant Profile & Taxes',
      desc: 'Configure outlet name, address, GST rates, service charges, and store hours',
    },
    {
      href: '/settings/whatsapp',
      icon: MessageSquare,
      title: 'WhatsApp Messaging & Alerts',
      desc: 'Automated receipt dispatches, Gupshup templates, and custom customer chat previews',
    },
    {
      href: '/settings/printer',
      icon: Printer,
      title: 'Thermal Printer & KOT',
      desc: 'Receipt width (58mm/80mm), auto-print toggles, and custom footer messages',
    },
    {
      href: '/settings/bank',
      icon: CreditCard,
      title: 'Bank Account & Settlement',
      desc: 'Payout bank account, IFSC verification, and gateway settlements',
    },
    {
      href: '/settings/billing',
      icon: Crown,
      title: 'Subscription & Billing',
      desc: 'Active plan tier, validity period, feature add-ons, and renewals',
    },
    {
      href: '/kitchen',
      icon: ChefHat,
      title: 'Kitchen Stations & Routing',
      desc: 'KDS preparation counters, live tickets, and auto-initialization of kitchen routing',
    },
    {
      href: '/wallet',
      icon: Wallet,
      title: 'Prepaid Wallet & SMS Credits',
      desc: 'Top up SMS credits, commission balance, and payment gateway transactions',
    },
    {
      href: '/terms',
      icon: FileText,
      title: 'Terms & Conditions',
      desc: 'Review legal terms, customer consent, and partner restaurant agreements',
    },
    {
      href: '/privacy',
      icon: ShieldCheck,
      title: 'Privacy Policy',
      desc: 'Data protection policies, patron confidentiality, and DPDP Act compliance',
    },
  ];

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-[#DE8626]">
                  {isSuperAdmin ? <Crown className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                    {isSuperAdmin ? 'SuperAdmin Control Hub' : 'Restaurant Settings'}
                  </h1>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                    {isSuperAdmin
                      ? 'Platform master controls, multi-tenant governance, and root administration'
                      : 'Manage outlet profile, billing hardware, bank accounts, and subscription tiers'}
                  </p>
                </div>
              </div>
            </div>

            {isSuperAdmin && (
              <button
                onClick={() => {
                  logout();
                  router.replace('/login');
                }}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out of SuperAdmin</span>
              </button>
            )}
          </div>

          {/* SUPERADMIN VIEW (Direct parity with F:\Menza renderSettingsHub) */}
          {isSuperAdmin ? (
            <div className="space-y-6">
              {/* Master Profile Hero Card */}
              <div className="relative overflow-hidden rounded-3xl border border-amber-900/30 bg-gradient-to-br from-[#2D2319] via-[#3D2F20] to-[#1F1811] p-6 text-white shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FEA619]/20 text-[#FEA619] ring-2 ring-[#FEA619]/40 shadow-inner">
                      <Crown className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded-full bg-[#FEA619]/20 border border-[#FEA619]/40 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#FEA619] tracking-wider">
                          SUPERADMIN MASTER
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          API ACTIVE
                        </span>
                      </div>
                      <h2 className="text-xl font-black text-white">
                        {user?.name || 'Platform Administrator'}
                      </h2>
                      <p className="text-xs text-amber-200/70">
                        {user?.mobile ? `+91 ${user.mobile}` : 'Platform Root Administrator'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:border-l sm:border-amber-400/20 sm:pl-6">
                    <div>
                      <span className="text-[10px] font-bold text-amber-200/60 uppercase">Outlets</span>
                      <p className="text-xl font-extrabold text-white">{totalStores}</p>
                      <span className="text-[10px] text-emerald-400">Active Stores</span>
                    </div>
                    <div className="h-8 w-px bg-amber-400/20" />
                    <div>
                      <span className="text-[10px] font-bold text-amber-200/60 uppercase">SaaS MRR</span>
                      <p className="text-xl font-extrabold text-white">₹{mrrAmount.toLocaleString('en-IN')}</p>
                      <span className="text-[10px] text-amber-300">Recurring Rev</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform Master Actions Grid */}
              <div>
                <h3 className="text-xs font-extrabold tracking-wider text-[#667085] dark:text-[#94A3B8] uppercase mb-3">
                  Platform Operations & Master Controls
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {superAdminActions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group cursor-pointer flex items-start gap-4 rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs hover:border-[#DE8626] hover:shadow-lg transition-all block"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626] group-hover:scale-105 transition-transform">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6] group-hover:text-[#DE8626] transition-colors">
                              {item.title}
                            </h4>
                            <ChevronRight className="h-4 w-4 text-[#667085] group-hover:translate-x-0.5 group-hover:text-[#DE8626] transition-transform" />
                          </div>
                          <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1 line-clamp-2">
                            {item.desc}
                          </p>
                          <div className="mt-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* RESTAURANT OPERATOR VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {standardSettingsLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className="group cursor-pointer flex items-start gap-4 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs hover:border-[#DE8626] hover:shadow-md transition-all"
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
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
