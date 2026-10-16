'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users2,
  Plus,
  Search,
  Sliders,
  CheckCircle2,
  XCircle,
  Percent,
  Coins,
  Gift,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Store,
  Wallet,
  Phone,
  Mail,
  Edit3,
  X,
  Loader2,
  Sparkles,
  RefreshCw,
  Calculator,
  ChevronRight,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { SalesService } from '@/services/salesService';
import {
  SalesPerson,
  SalesCommissionFormula,
  CreateSalesPersonRequest,
  SalesCommissionModel,
} from '@/types/sales';

export default function SuperAdminSalesPage() {
  const router = useRouter();

  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [globalFormula, setGlobalFormula] = useState<SalesCommissionFormula | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals state
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [targetAgentForFormula, setTargetAgentForFormula] = useState<SalesPerson | null>(null);

  // New Sales Person form state
  const [newAgentForm, setNewAgentForm] = useState<CreateSalesPersonRequest>({
    name: '',
    mobile: '',
    email: '',
    partnerCode: '',
    upiId: '',
    panNumber: '',
  });
  const [submittingAgent, setSubmittingAgent] = useState(false);

  // Formula editing state
  const [editingFormula, setEditingFormula] = useState<SalesCommissionFormula>({
    formulaName: '',
    commissionModel: 'HYBRID',
    rechargeCommissionPercent: 5.0,
    firstRechargeBonusAmount: 500,
    minRechargeThresholdForBonus: 2000,
    platformFeeSharePercent: 20.0,
    flatPerOrderBonus: 1.0,
    earningTenureMonths: 12,
    isActive: true,
  });
  const [submittingFormula, setSubmittingFormula] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [persons, formula] = await Promise.all([
        SalesService.getAllSalesPersons(),
        SalesService.getGlobalFormula(),
      ]);
      setSalesPersons(persons);
      setGlobalFormula(formula);
    } catch (err) {
      console.warn('Failed to load sales data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered salespersons
  const filteredPersons = useMemo(() => {
    return salesPersons.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mobile.includes(searchQuery) ||
        p.partnerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (activeFilterTab === 'active') return p.isActive;
      if (activeFilterTab === 'inactive') return !p.isActive;
      return true;
    });
  }, [salesPersons, searchQuery, activeFilterTab]);

  // Aggregate stats
  const metrics = useMemo(() => {
    const totalCount = salesPersons.length;
    const activeCount = salesPersons.filter((p) => p.isActive).length;
    const totalOutlets = salesPersons.reduce((sum, p) => sum + p.totalRestaurantsOnboarded, 0);
    const totalLifetimePaid = salesPersons.reduce((sum, p) => sum + p.lifetimeEarnings, 0);
    const totalUnpaid = salesPersons.reduce((sum, p) => sum + p.unpaidEarnings, 0);

    return { totalCount, activeCount, totalOutlets, totalLifetimePaid, totalUnpaid };
  }, [salesPersons]);

  // Toggle Sales Person Active Status
  const handleToggleStatus = async (agent: SalesPerson) => {
    const newStatus = !agent.isActive;
    try {
      await SalesService.updateSalesPersonStatus(agent.id, newStatus);
      setSalesPersons((prev) =>
        prev.map((p) => (p.id === agent.id ? { ...p, isActive: newStatus } : p))
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to update agent status');
    }
  };

  // Open Formula Modal (Global or Agent-specific)
  const handleOpenFormulaModal = (agent?: SalesPerson) => {
    if (agent) {
      setTargetAgentForFormula(agent);
      setEditingFormula(agent.formula || globalFormula || {
        formulaName: `${agent.name} Tier`,
        commissionModel: 'HYBRID',
        rechargeCommissionPercent: 5.0,
        firstRechargeBonusAmount: 500,
        minRechargeThresholdForBonus: 2000,
        platformFeeSharePercent: 20.0,
        flatPerOrderBonus: 1.0,
        earningTenureMonths: 12,
        isActive: true,
      });
    } else {
      setTargetAgentForFormula(null);
      setEditingFormula(globalFormula || {
        formulaName: 'Standard Sales Growth Formula',
        commissionModel: 'HYBRID',
        rechargeCommissionPercent: 5.0,
        firstRechargeBonusAmount: 500,
        minRechargeThresholdForBonus: 2000,
        platformFeeSharePercent: 20.0,
        flatPerOrderBonus: 1.0,
        earningTenureMonths: 12,
        isActive: true,
      });
    }
    setFormulaModalOpen(true);
  };

  // Save Formula
  const handleSaveFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingFormula(true);
      if (targetAgentForFormula) {
        await SalesService.updateSalesPersonFormula(targetAgentForFormula.id, editingFormula);
        setSalesPersons((prev) =>
          prev.map((p) =>
            p.id === targetAgentForFormula.id
              ? { ...p, formula: { ...editingFormula, salesPersonId: p.id } }
              : p
          )
        );
      } else {
        const updated = await SalesService.updateGlobalFormula(editingFormula);
        setGlobalFormula(updated);
      }
      setFormulaModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to save formula configuration');
    } finally {
      setSubmittingFormula(false);
    }
  };

  // Submit Onboard Sales Person
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = newAgentForm.mobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!newAgentForm.name.trim()) {
      alert('Please enter salesperson full name.');
      return;
    }

    try {
      setSubmittingAgent(true);
      const result = await SalesService.createSalesPerson(newAgentForm);
      if (!result.success) {
        throw new Error('Server did not confirm sales partner creation.');
      }
      await loadData();
      setOnboardModalOpen(false);
      setNewAgentForm({
        name: '',
        mobile: '',
        email: '',
        partnerCode: '',
        upiId: '',
        panNumber: '',
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to onboard sales partner.';
      alert(errorMsg);
    } finally {
      setSubmittingAgent(false);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#DE8626]/10 text-[#DE8626]">
                  <Users2 className="h-4 w-4" />
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] tracking-tight">
                  Sales Partner Governance
                </h1>
              </div>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                Onboard sales agents, configure commission formulas (recharges & platform fee share), and monitor payouts
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenFormulaModal()}
                className="flex items-center gap-1.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-4 py-2.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] transition-colors shadow-xs"
              >
                <Sliders className="h-4 w-4 text-[#DE8626]" />
                <span>Global Formula</span>
              </button>

              <button
                type="button"
                onClick={() => setOnboardModalOpen(true)}
                className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#CB741B] px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-[#DE8626]/20 hover:from-[#C4721C] hover:to-[#B66415] transition-all"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                <span>ONBOARD SALES PERSON</span>
              </button>
            </div>
          </div>

          {/* Metric KPI Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Agents */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                  Sales Agents
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Users2 className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                {metrics.totalCount}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                {metrics.activeCount} Active • {metrics.totalCount - metrics.activeCount} Inactive
              </p>
            </div>

            {/* Total Stores Onboarded */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                  Stores Acquired
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                  <Store className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                {metrics.totalOutlets}
              </p>
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] font-medium mt-1">
                Across all partner referrals
              </p>
            </div>

            {/* Lifetime Commission Accrued */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                  Lifetime Accrued
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Coins className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                ₹{metrics.totalLifetimePaid.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                Recharges + Platform fee cuts
              </p>
            </div>

            {/* Unpaid Payouts */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                  Unpaid Payouts
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                  <Wallet className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-[#DE8626]">
                ₹{metrics.totalUnpaid.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] font-medium mt-1">
                Available for withdrawal settlement
              </p>
            </div>
          </div>

          {/* Global Formula Summary Banner */}
          {globalFormula && (
            <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-transparent p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#DE8626]" />
                  <span className="text-xs font-black uppercase tracking-wider text-[#DE8626]">
                    Active Global Formula
                  </span>
                  <span className="rounded-full bg-[#DE8626] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                    {globalFormula.commissionModel}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  {globalFormula.formulaName}
                </h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  • <strong>{globalFormula.rechargeCommissionPercent}%</strong> of wallet top-ups &nbsp;|&nbsp;
                  • <strong>{globalFormula.platformFeeSharePercent}%</strong> share of order platform fees &nbsp;|&nbsp;
                  • <strong>₹{globalFormula.firstRechargeBonusAmount}</strong> bonus on 1st top-up &nbsp;|&nbsp;
                  • Tenure: <strong>{globalFormula.earningTenureMonths === 0 ? 'Lifetime' : `${globalFormula.earningTenureMonths} Months`}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenFormulaModal()}
                className="shrink-0 rounded-2xl bg-white dark:bg-[#1B2127] border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2 text-xs font-bold text-[#DE8626] hover:border-[#DE8626] shadow-xs"
              >
                Edit Parameters
              </button>
            </div>
          )}

          {/* Directory Filter & Search Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
              <input
                type="text"
                placeholder="Search by agent name, partner code, or mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-10 pr-4 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-1">
              {(['all', 'active', 'inactive'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveFilterTab(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                    activeFilterTab === tab
                      ? 'bg-[#DE8626] text-white shadow-xs'
                      : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Sales Person Directory Table */}
          <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-xs text-[#667085] flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-[#DE8626]" />
                <span>Loading sales partner directory...</span>
              </div>
            ) : filteredPersons.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#667085] space-y-2">
                <Users2 className="h-10 w-10 text-[#667085]/40 mx-auto" />
                <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">No sales partners found</p>
                <p className="text-xs text-[#667085]">Click "Onboard Sales Person" above to add your first sales agent.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[10px] font-black uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="py-3.5 px-5">Agent & Partner Code</th>
                      <th className="py-3.5 px-4">Contact & Payout</th>
                      <th className="py-3.5 px-4">Stores Onboarded</th>
                      <th className="py-3.5 px-4">Commission Formula</th>
                      <th className="py-3.5 px-4">Earnings (Lifetime / Unpaid)</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {filteredPersons.map((agent) => {
                      const hasCustomFormula = !!agent.formula;
                      const activeFormula = agent.formula || globalFormula;

                      return (
                        <tr
                          key={agent.id}
                          className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                        >
                          {/* Agent Name & Code */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-[#DE8626] font-extrabold text-sm">
                                {agent.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                                  {agent.name}
                                </p>
                                <span className="inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#151A20] text-[#DE8626] border border-[#E7E1DA] dark:border-[#2B3540]">
                                  {agent.partnerCode}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Contact Info */}
                          <td className="py-4 px-4 text-[#667085] dark:text-[#94A3B8]">
                            <div className="space-y-0.5">
                              <p className="flex items-center gap-1 font-mono font-semibold text-[#1E2930] dark:text-[#F3F4F6]">
                                <Phone className="h-3 w-3 text-[#DE8626]" />
                                +91 {agent.mobile}
                              </p>
                              {agent.upiId && (
                                <p className="text-[11px] truncate max-w-[140px]" title={agent.upiId}>
                                  UPI: {agent.upiId}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Stores Count */}
                          <td className="py-4 px-4">
                            <div>
                              <span className="font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                                {agent.totalRestaurantsOnboarded}
                              </span>
                              <span className="text-[11px] text-[#667085] dark:text-[#94A3B8] ml-1">
                                stores
                              </span>
                              <p className="text-[10px] text-emerald-600 font-semibold">
                                {agent.activeRestaurantsCount} active
                              </p>
                            </div>
                          </td>

                          {/* Formula Tier */}
                          <td className="py-4 px-4">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                    hasCustomFormula
                                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                                      : 'bg-amber-500/10 text-[#DE8626] border border-amber-500/20'
                                  }`}
                                >
                                  {hasCustomFormula ? 'Custom Tier' : 'Global Default'}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-1">
                                {activeFormula?.rechargeCommissionPercent}% RCG • {activeFormula?.platformFeeSharePercent}% Fee
                              </p>
                            </div>
                          </td>

                          {/* Earnings */}
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-black text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                                ₹{agent.lifetimeEarnings.toLocaleString('en-IN')}
                              </p>
                              <p className="text-[11px] font-semibold text-[#DE8626]">
                                ₹{agent.unpaidEarnings.toLocaleString('en-IN')} pending
                              </p>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(agent)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer transition-all ${
                                agent.isActive
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${agent.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              <span>{agent.isActive ? 'Active' : 'Inactive'}</span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenFormulaModal(agent)}
                                className="flex items-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-2.5 py-1.5 text-[11px] font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] transition-colors"
                                title="Configure Custom Formula"
                              >
                                <Sliders className="h-3.5 w-3.5 text-[#DE8626]" />
                                <span>Formula</span>
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

          {/* MODAL 1: ONBOARD SALES PERSON */}
          {onboardModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-[#DE8626]">
                      <Users2 className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                        Onboard New Sales Person
                      </h3>
                      <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                        Creates partner account with unique acquisition code
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setOnboardModalOpen(false)}
                    className="rounded-xl p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateAgent} className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter sales person name"
                      value={newAgentForm.name}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, name: e.target.value })}
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>

                  {/* Mobile & Partner Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="9876543210"
                        value={newAgentForm.mobile}
                        onChange={(e) =>
                          setNewAgentForm({
                            ...newAgentForm,
                            mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                          })
                        }
                        className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-mono font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                        Partner Attribution Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SP01 (Auto-generated if blank)"
                        value={newAgentForm.partnerCode}
                        onChange={(e) =>
                          setNewAgentForm({ ...newAgentForm, partnerCode: e.target.value.toUpperCase() })
                        }
                        className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-mono font-semibold uppercase text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="agent@example.com"
                      value={newAgentForm.email}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, email: e.target.value })}
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>

                  {/* Payout UPI ID & PAN */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                        Payout UPI ID
                      </label>
                      <input
                        type="text"
                        placeholder="agent@upi"
                        value={newAgentForm.upiId}
                        onChange={(e) => setNewAgentForm({ ...newAgentForm, upiId: e.target.value })}
                        className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-mono font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                        PAN Card Number
                      </label>
                      <input
                        type="text"
                        placeholder="ABCDE1234F"
                        value={newAgentForm.panNumber}
                        onChange={(e) =>
                          setNewAgentForm({ ...newAgentForm, panNumber: e.target.value.toUpperCase() })
                        }
                        className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-mono font-semibold uppercase text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                      />
                    </div>
                  </div>

                  {/* Info banner */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                      The agent will receive OTP login access and can immediately begin onboarding stores. Commission will be calculated automatically based on the active formula.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setOnboardModalOpen(false)}
                      className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2.5 text-xs font-semibold text-[#667085]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingAgent}
                      className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#CB741B] px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-[#DE8626]/20 disabled:opacity-50"
                    >
                      {submittingAgent ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Creating Partner...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>CONFIRM & ONBOARD</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL 2: COMMISSION FORMULA CONFIGURATION */}
          {formulaModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-[#DE8626]">
                      <Sliders className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                        {targetAgentForFormula
                          ? `Commission Formula: ${targetAgentForFormula.name}`
                          : 'Configure Global Commission Formula'}
                      </h3>
                      <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                        Define percentage share on wallet recharges and order platform fees
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFormulaModalOpen(false)}
                    className="rounded-xl p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveFormula} className="space-y-4">
                  {/* Formula Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                      Formula Title / Tier Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editingFormula.formulaName}
                      onChange={(e) => setEditingFormula({ ...editingFormula, formulaName: e.target.value })}
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                    />
                  </div>

                  {/* Commission Model Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1.5">
                      Earning Formula Basis
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'HYBRID', label: 'Hybrid Take', desc: 'Recharge + Order Fee' },
                        { id: 'RECHARGE_PERCENT', label: 'Recharge Only', desc: '% of Top-up' },
                        { id: 'PLATFORM_FEE_SHARE', label: 'Usage Share', desc: '% of Platform Fee' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setEditingFormula({
                              ...editingFormula,
                              commissionModel: item.id as SalesCommissionModel,
                            })
                          }
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            editingFormula.commissionModel === item.id
                              ? 'border-[#DE8626] bg-[#DE8626]/10 text-[#DE8626] ring-1 ring-[#DE8626]'
                              : 'border-[#E7E1DA] dark:border-[#2B3540] hover:border-[#DE8626]/50'
                          }`}
                        >
                          <p className="font-extrabold text-xs">{item.label}</p>
                          <p className="text-[10px] text-[#667085] mt-0.5">{item.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section A: Recharge Commission */}
                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 p-4 space-y-3">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#DE8626]">
                      <Coins className="h-4 w-4" />
                      <span>Component A: Wallet Recharge Commission</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#667085] mb-1">
                          Recharge Take-Rate (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            value={editingFormula.rechargeCommissionPercent}
                            onChange={(e) =>
                              setEditingFormula({
                                ...editingFormula,
                                rechargeCommissionPercent: e.target.value === '' ? 0 : parseFloat(e.target.value),
                              })
                            }
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-3 pr-8 py-2 text-xs font-mono font-bold outline-hidden focus:border-[#DE8626]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                            %
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#667085] mb-1">
                          First Recharge Milestone Bonus (₹)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={editingFormula.firstRechargeBonusAmount}
                            onChange={(e) =>
                              setEditingFormula({
                                ...editingFormula,
                                firstRechargeBonusAmount: e.target.value === '' ? 0 : parseFloat(e.target.value),
                              })
                            }
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-7 pr-3 py-2 text-xs font-mono font-bold outline-hidden focus:border-[#DE8626]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Order Platform Fee Share */}
                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 p-4 space-y-3">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-blue-600 dark:text-blue-400">
                      <Percent className="h-4 w-4" />
                      <span>Component B: Menza Order Platform Fee Share</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#667085] mb-1">
                          Share of Platform Fee (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            placeholder="e.g. 0.1, 0.2, 1, 20"
                            value={editingFormula.platformFeeSharePercent}
                            onChange={(e) =>
                              setEditingFormula({
                                ...editingFormula,
                                platformFeeSharePercent: e.target.value === '' ? 0 : parseFloat(e.target.value),
                              })
                            }
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-3 pr-8 py-2 text-xs font-mono font-bold outline-hidden focus:border-[#DE8626]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                            %
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#667085] mb-1">
                          Flat Incentive Per Order (₹)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={editingFormula.flatPerOrderBonus}
                            onChange={(e) =>
                              setEditingFormula({
                                ...editingFormula,
                                flatPerOrderBonus: e.target.value === '' ? 0 : parseFloat(e.target.value),
                              })
                            }
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-7 pr-3 py-2 text-xs font-mono font-bold outline-hidden focus:border-[#DE8626]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section C: Policy & Tenure */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                        Earning Tenure (Months)
                      </label>
                      <select
                        value={editingFormula.earningTenureMonths}
                        onChange={(e) =>
                          setEditingFormula({
                            ...editingFormula,
                            earningTenureMonths: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                      >
                        <option value={0}>Lifetime (No expiry)</option>
                        <option value={6}>6 Months from store onboarding</option>
                        <option value={12}>12 Months (1 Year)</option>
                        <option value={24}>24 Months (2 Years)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#667085] uppercase mb-1">
                        Monthly Payout Cap (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="Optional cap (e.g. 50000)"
                        value={editingFormula.maxCommissionCapPerMonth || ''}
                        onChange={(e) =>
                          setEditingFormula({
                            ...editingFormula,
                            maxCommissionCapPerMonth: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs font-mono font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-hidden focus:border-[#DE8626]"
                      />
                    </div>
                  </div>

                  {/* Live Simulation Preview */}
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-[#DE8626]">
                      <Calculator className="h-4 w-4" />
                      <span>Live Commission Simulation:</span>
                    </div>
                    <ul className="space-y-1 text-[#667085] dark:text-[#94A3B8] text-[11px]">
                      <li>
                        • If a store recharges ₹10,000 wallet: Agent earns{' '}
                        <strong className="text-[#DE8626]">
                          ₹{((10000 * editingFormula.rechargeCommissionPercent) / 100).toFixed(2)}
                        </strong>
                      </li>
                      <li>
                        • If a store completes an order generating ₹30 platform fee: Agent earns{' '}
                        <strong className="text-[#DE8626]">
                          ₹{(
                            (30 * editingFormula.platformFeeSharePercent) / 100 +
                            editingFormula.flatPerOrderBonus
                          ).toFixed(2)}
                        </strong>
                      </li>
                    </ul>
                  </div>

                  {/* Action buttons */}
                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFormulaModalOpen(false)}
                      className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2.5 text-xs font-semibold text-[#667085]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingFormula}
                      className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#CB741B] px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-[#DE8626]/20 disabled:opacity-50"
                    >
                      {submittingFormula ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving Formula...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>SAVE & APPLY FORMULA</span>
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
