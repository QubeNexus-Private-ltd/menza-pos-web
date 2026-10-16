'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Building2,
  FileText,
  CreditCard,
  Receipt,
  Wallet,
  IndianRupee,
  Lock,
  Award,
  AlertOctagon,
  Activity,
  RotateCcw,
  UserX,
  ShieldAlert,
  Shield,
  FileEdit,
  Scale,
  Headphones,
  CheckSquare,
  Sparkles,
  UserCheck,
  Info,
  Search,
  ArrowLeft,
  ArrowRight,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  LogOut,
  Calendar,
  MapPin,
  Mail,
  Phone,
} from 'lucide-react';
import {
  MENZA_LEGAL_METADATA,
  MENZA_LEGAL_CATEGORIES,
  MENZA_LEGAL_SECTIONS,
  LegalSection,
} from '@shared/core/constants/legalTermsData';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { isOwnerUser } from '@shared/core/auth/rolePermissions';
import { isSalesPersonUser } from '@/lib/auth/permissions';

const ICON_MAP: Record<string, React.ElementType> = {
  Info: Info,
  UserCheck: UserCheck,
  Sparkles: Sparkles,
  CreditCard: CreditCard,
  Receipt: Receipt,
  IndianRupee: IndianRupee,
  Wallet: Wallet,
  ShieldCheck: ShieldCheck,
  Lock: Lock,
  Award: Award,
  AlertOctagon: AlertOctagon,
  Activity: Activity,
  RotateCcw: RotateCcw,
  UserX: UserX,
  ShieldAlert: ShieldAlert,
  Shield: Shield,
  FileEdit: FileEdit,
  Scale: Scale,
  Headphones: Headphones,
  CheckSquare: CheckSquare,
  Building2: Building2,
};

export default function TermsPage() {
  const router = useRouter();
  const { user, activeRestaurant, isAuthenticated, hasAcceptedTerms, isHydrating, acceptTerms, logout } =
    useAuthStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwner = isOwnerUser(user, activeRestaurant);
  const requiresAcceptance = isAuthenticated && isOwner && !hasAcceptedTerms;

  const filteredSections = useMemo(() => {
    return MENZA_LEGAL_SECTIONS.filter((section) => {
      const matchesCategory =
        selectedCategory === 'all' || section.category === selectedCategory;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;

      const matchesSearch =
        section.title.toLowerCase().includes(q) ||
        section.summary.toLowerCase().includes(q) ||
        section.content.some((c) => c.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const getReturnRoute = () => {
    if (!isAuthenticated) return '/login';
    if (isSalesPersonUser(user?.roles)) return '/sales/earnings';
    return '/dashboard';
  };

  const handleAccept = async () => {
    if (!isChecked || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await acceptTerms();
      router.replace(getReturnRoute());
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Unable to record your acceptance. Please check your network connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out from Menza?')) {
      logout();
      router.replace('/login');
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#111418] text-[#1E2930] dark:text-[#F3F4F6] transition-colors">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E7E1DA] dark:border-[#2B3540] bg-white/90 dark:bg-[#1B2127]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(getReturnRoute())}
              className="p-2 rounded-xl text-[#667085] hover:text-[#1E2930] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Return"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#DE8626] to-[#B7791F] text-white shadow-md shadow-[#DE8626]/20 font-bold text-base">
                M
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Menza
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs font-semibold text-[#DE8626] bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Terms & Conditions
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/privacy"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#667085] dark:text-[#94A3B8] hover:text-[#DE8626] hover:bg-amber-500/10 transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Privacy Policy</span>
            </Link>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#667085] dark:text-[#94A3B8] hover:text-[#1E2930] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Print Document"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[#DE8626] hover:bg-[#C9751D] shadow-xs transition-colors"
              >
                <span>Dashboard</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[#DE8626] hover:bg-[#C9751D] shadow-xs transition-colors"
              >
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Hero Banner Card */}
        <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-xl shadow-amber-950/5 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-[#DE8626] text-xs font-bold tracking-wider">
                <ShieldCheck className="h-4 w-4" />
                <span>MERCHANT & USER AGREEMENT</span>
              </div>

              {isAuthenticated && hasAcceptedTerms && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Agreement Active on Your Account</span>
                </div>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
              {MENZA_LEGAL_METADATA.title}
            </h1>

            <p className="text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8] leading-relaxed max-w-3xl">
              Welcome to Menza. These Terms & Conditions, Rules and Regulations govern the use of the
              Menza platform, POS systems, table management, online menus, digital wallets, and related
              restaurant automation services operated by{' '}
              <strong className="text-[#1E2930] dark:text-white">
                {MENZA_LEGAL_METADATA.operatedBy}
              </strong>
              .
            </p>

            {/* Metadata Pills */}
            <div className="pt-3 border-t border-[#E7E1DA] dark:border-[#2B3540] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#667085] dark:text-[#94A3B8]">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#DE8626] shrink-0" />
                <span>
                  Effective Date:{' '}
                  <strong className="text-[#1E2930] dark:text-white">{MENZA_LEGAL_METADATA.effectiveDate}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#DE8626] shrink-0" />
                <span>
                  Operator:{' '}
                  <strong className="text-[#1E2930] dark:text-white">Qubenexus Technologies</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#DE8626] shrink-0" />
                <span>
                  Jurisdiction:{' '}
                  <strong className="text-[#1E2930] dark:text-white">{MENZA_LEGAL_METADATA.jurisdiction}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mandatory Acceptance Callout (for unconsented owners) */}
        {requiresAcceptance && (
          <div className="rounded-3xl border-2 border-[#DE8626] bg-amber-500/5 dark:bg-amber-950/20 p-6 sm:p-8 space-y-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DE8626] text-white">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Action Required: Review & Accept Terms
                  </h2>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                    Welcome, <strong className="text-[#1E2930] dark:text-white">{user?.name || 'Partner'}</strong>. Acceptance of these Terms is required before activating your POS terminal and restaurant suite.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-3.5 text-xs text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{errorMsg}</p>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-amber-200 dark:border-amber-900/40">
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="h-4 w-4 rounded-md border-gray-300 text-[#DE8626] focus:ring-[#DE8626] cursor-pointer"
                />
                <span className="text-xs sm:text-sm font-semibold text-[#1E2930] dark:text-[#F3F4F6]">
                  I confirm I have read, understood, and accept the{' '}
                  <span className="text-[#DE8626]">Menza Terms & Conditions</span> and{' '}
                  <Link href="/privacy" className="text-[#DE8626] underline hover:text-[#C9751D]">
                    Privacy Policy
                  </Link>{' '}
                  on behalf of my restaurant entity.
                </span>
              </label>

              <button
                type="button"
                onClick={handleAccept}
                disabled={!isChecked || isSubmitting}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white transition-all shadow-md shrink-0 ${
                  isChecked && !isSubmitting
                    ? 'bg-[#DE8626] hover:bg-[#C9751D] shadow-amber-900/20 cursor-pointer'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Recording Acceptance...</span>
                  </>
                ) : (
                  <>
                    <span>Accept & Enter Suite</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Search & Category Filter Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085] dark:text-[#94A3B8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles (e.g. FSSAI, billing, wallet, Cashfree, liability, Bhopal)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-xs sm:text-sm text-[#1E2930] dark:text-[#F3F4F6] focus:border-[#DE8626] focus:outline-none focus:ring-1 focus:ring-[#DE8626] transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#667085] hover:text-[#1E2930]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {MENZA_LEGAL_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-[#DE8626] text-white shadow-sm shadow-[#DE8626]/20'
                      : 'bg-white dark:bg-[#1B2127] border border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legal Articles List */}
        <div className="space-y-5">
          {filteredSections.length === 0 ? (
            <div className="text-center py-12 rounded-3xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] bg-white/40 dark:bg-[#1B2127]/40">
              <Search className="h-8 w-8 text-[#667085] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                No matching legal articles found
              </p>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                Try searching for other terms or reset the filter
              </p>
            </div>
          ) : (
            filteredSections.map((section) => {
              const SectionIcon = ICON_MAP[section.icon] || FileText;
              return (
                <article
                  key={section.id}
                  id={`article-${section.id}`}
                  className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 sm:p-7 shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626] shrink-0 mt-0.5">
                      <SectionIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                        {section.title}
                      </h2>
                      <p className="text-xs text-[#DE8626] font-medium mt-0.5">
                        {section.summary}
                      </p>
                    </div>
                  </div>

                  <div className="pl-0 sm:pl-[54px] space-y-2.5 pt-2">
                    {section.content.map((paragraph, idx) => (
                      <p
                        key={idx}
                        className="text-xs sm:text-sm text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Contact & Support Notice */}
        <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DE8626] text-white">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                Official Legal & Corporate Support
              </h3>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                Registered operational headquarters and partner relations
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="flex items-center gap-2.5 rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] p-3 border border-[#E7E1DA] dark:border-[#2B3540]">
              <Mail className="h-4 w-4 text-[#DE8626] shrink-0" />
              <div className="min-w-0">
                <span className="block text-[10px] text-[#667085] uppercase">Support Email</span>
                <a
                  href={`mailto:${MENZA_LEGAL_METADATA.supportEmail}`}
                  className="font-semibold text-[#1E2930] dark:text-white truncate block hover:text-[#DE8626]"
                >
                  {MENZA_LEGAL_METADATA.supportEmail}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] p-3 border border-[#E7E1DA] dark:border-[#2B3540]">
              <Phone className="h-4 w-4 text-[#DE8626] shrink-0" />
              <div className="min-w-0">
                <span className="block text-[10px] text-[#667085] uppercase">Phone</span>
                <a
                  href={`tel:${MENZA_LEGAL_METADATA.supportPhone}`}
                  className="font-semibold text-[#1E2930] dark:text-white truncate block hover:text-[#DE8626]"
                >
                  {MENZA_LEGAL_METADATA.supportPhone}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] p-3 border border-[#E7E1DA] dark:border-[#2B3540]">
              <MapPin className="h-4 w-4 text-[#DE8626] shrink-0" />
              <div className="min-w-0">
                <span className="block text-[10px] text-[#667085] uppercase">Registered Office</span>
                <span className="font-semibold text-[#1E2930] dark:text-white truncate block">
                  {MENZA_LEGAL_METADATA.address}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-6 border-t border-[#E7E1DA] dark:border-[#2B3540] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#667085] dark:text-[#94A3B8]">
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[#DE8626] font-medium text-[#DE8626]">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-[#DE8626] font-medium">
              Privacy Policy
            </Link>
            <span>•</span>
            <a
              href="https://www.menza.in"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#DE8626] font-medium inline-flex items-center gap-1"
            >
              <span>menza.in</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p>
            &copy; {new Date().getFullYear()} {MENZA_LEGAL_METADATA.operatedBy}. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
