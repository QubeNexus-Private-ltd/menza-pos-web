'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  Database,
  Cpu,
  Scale,
  Share2,
  Clock,
  UserCheck,
  Cookie,
  Headphones,
  Search,
  ArrowLeft,
  Printer,
  ExternalLink,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import {
  MENZA_PRIVACY_METADATA,
  MENZA_PRIVACY_CATEGORIES,
  MENZA_PRIVACY_SECTIONS,
  PrivacySection,
} from '@/lib/constants/privacyPolicyData';
import { useAuthStore } from '@/stores/useAuthStore';

const ICON_MAP: Record<string, React.ElementType> = {
  Shield: ShieldCheck,
  Database: Database,
  Cpu: Cpu,
  Scale: Scale,
  Share2: Share2,
  Lock: Lock,
  Clock: Clock,
  UserCheck: UserCheck,
  Cookie: Cookie,
  Headphones: Headphones,
};

export default function PrivacyPolicyPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredSections = useMemo(() => {
    return MENZA_PRIVACY_SECTIONS.filter((section) => {
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
              onClick={() => router.push(isAuthenticated ? '/dashboard' : '/login')}
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
                  Privacy & Data Protection
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/terms"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#667085] dark:text-[#94A3B8] hover:text-[#DE8626] hover:bg-amber-500/10 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Terms of Service</span>
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
            <button
              type="button"
              onClick={() => router.push(isAuthenticated ? '/dashboard' : '/login')}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[#DE8626] hover:bg-[#C9751D] shadow-xs transition-colors"
            >
              <span>{isAuthenticated ? 'Dashboard' : 'Sign In'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Hero Banner Card */}
        <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-xl shadow-amber-950/5 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>DPDP ACT 2023 & IT ACT 2000 COMPLIANT</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
              {MENZA_PRIVACY_METADATA.title}
            </h1>

            <p className="text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8] leading-relaxed max-w-3xl">
              This Privacy Policy details how{' '}
              <strong className="text-[#1E2930] dark:text-white">
                {MENZA_PRIVACY_METADATA.operatedBy}
              </strong>{' '}
              safeguards merchant and diner information collected through the Menza Cloud POS, online
              catalogs, table-top QR ordering, and payment automation suites.
            </p>

            {/* Metadata Pills Grid */}
            <div className="pt-3 border-t border-[#E7E1DA] dark:border-[#2B3540] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#667085] dark:text-[#94A3B8]">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#DE8626] shrink-0" />
                <span>
                  Effective: <strong className="text-[#1E2930] dark:text-white">{MENZA_PRIVACY_METADATA.effectiveDate}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#DE8626] shrink-0" />
                <span>
                  Entity: <strong className="text-[#1E2930] dark:text-white">Qubenexus Technologies</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#DE8626] shrink-0" />
                <span>
                  Jurisdiction: <strong className="text-[#1E2930] dark:text-white">{MENZA_PRIVACY_METADATA.jurisdiction}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085] dark:text-[#94A3B8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search privacy clauses (e.g. Cashfree, DPDP, retention, e-bills)..."
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
            {MENZA_PRIVACY_CATEGORIES.map((cat) => {
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

        {/* Privacy Sections List */}
        <div className="space-y-5">
          {filteredSections.length === 0 ? (
            <div className="text-center py-12 rounded-3xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] bg-white/40 dark:bg-[#1B2127]/40">
              <Search className="h-8 w-8 text-[#667085] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                No matching privacy clauses found
              </p>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                Try searching for other terms or reset the filter
              </p>
            </div>
          ) : (
            filteredSections.map((section) => {
              const SectionIcon = ICON_MAP[section.icon] || ShieldCheck;
              return (
                <article
                  key={section.id}
                  id={`section-${section.id}`}
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

        {/* Grievance Redressal Officer Card */}
        <div className="rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-500/5 via-white to-amber-500/10 dark:from-amber-950/20 dark:via-[#1B2127] dark:to-amber-950/30 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DE8626] text-white">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                Data Protection & Grievance Redressal
              </h3>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                Designated Grievance Officer pursuant to DPDP Act 2023 & IT Act 2000
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
            If you have questions, complaints, or wish to exercise your Data Principal rights
            regarding personal data processed on Menza, please submit a written communication to our
            Grievance Officer:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="flex items-center gap-2.5 rounded-2xl bg-white dark:bg-[#151A20] p-3 border border-[#E7E1DA] dark:border-[#2B3540]">
              <Mail className="h-4 w-4 text-[#DE8626] shrink-0" />
              <div className="min-w-0">
                <span className="block text-[10px] text-[#667085] uppercase">Grievance Email</span>
                <a
                  href={`mailto:${MENZA_PRIVACY_METADATA.supportEmail}`}
                  className="font-semibold text-[#1E2930] dark:text-white truncate block hover:text-[#DE8626]"
                >
                  {MENZA_PRIVACY_METADATA.supportEmail}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl bg-white dark:bg-[#151A20] p-3 border border-[#E7E1DA] dark:border-[#2B3540]">
              <Phone className="h-4 w-4 text-[#DE8626] shrink-0" />
              <div className="min-w-0">
                <span className="block text-[10px] text-[#667085] uppercase">Helpline</span>
                <a
                  href={`tel:${MENZA_PRIVACY_METADATA.supportPhone}`}
                  className="font-semibold text-[#1E2930] dark:text-white truncate block hover:text-[#DE8626]"
                >
                  {MENZA_PRIVACY_METADATA.supportPhone}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl bg-white dark:bg-[#151A20] p-3 border border-[#E7E1DA] dark:border-[#2B3540]">
              <MapPin className="h-4 w-4 text-[#DE8626] shrink-0" />
              <div className="min-w-0">
                <span className="block text-[10px] text-[#667085] uppercase">Location</span>
                <span className="font-semibold text-[#1E2930] dark:text-white truncate block">
                  {MENZA_PRIVACY_METADATA.jurisdiction}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-6 border-t border-[#E7E1DA] dark:border-[#2B3540] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#667085] dark:text-[#94A3B8]">
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[#DE8626] font-medium">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-[#DE8626] font-medium text-[#DE8626]">
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
            &copy; {new Date().getFullYear()} {MENZA_PRIVACY_METADATA.operatedBy}. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
