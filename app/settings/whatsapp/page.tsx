'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  FileCheck2,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { WebWhatsAppService } from '@/services/whatsAppService';
import { useAuthStore } from '@/stores/useAuthStore';

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const { activeRestaurant, user } = useAuthStore();

  const [testPhone, setTestPhone] = useState(user?.mobile || '');
  const [customerName, setCustomerName] = useState(user?.name || 'Valued Guest');
  const [customMessage, setCustomMessage] = useState('Greetings from Menza! Your dining order has been received.');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone || testPhone.length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      setIsSending(true);
      setSendResult(null);
      const res = await WebWhatsAppService.sendTestMessage(
        testPhone,
        customerName,
        customMessage
      );
      setSendResult(res);
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err?.message || 'Error executing test message dispatch',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenDirectChat = () => {
    if (!testPhone || testPhone.length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    const url = WebWhatsAppService.getWhatsAppReceiptUrl(testPhone, {
      restaurantName: activeRestaurant?.restaurantName || 'Menza Restaurant',
      orderId: 'TEST-101',
      customerName,
      items: [
        { itemName: 'Paneer Butter Masala', quantity: 1, price: 240 },
        { itemName: 'Butter Naan', quantity: 2, price: 50 },
        { itemName: 'Cold Beverage', quantity: 2, price: 60 },
      ],
      grandTotal: 460,
      paymentMode: 'UPI (Paid)',
    });

    window.open(url, '_blank');
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/settings')}
              className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-2 hover:bg-black/5"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                WhatsApp Messaging & Alerts
              </h1>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                Configure real-time automated receipt dispatches and test customer WhatsApp notifications
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Interactive Dispatch Testing */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      Test WhatsApp Notification Dispatch
                    </h2>
                    <p className="text-[11px] text-[#667085]">
                      Sends a real-time message via the Menza Gupshup Enterprise WhatsApp Gateway
                    </p>
                  </div>
                </div>

                {sendResult && (
                  <div
                    className={`rounded-2xl border p-4 flex items-start gap-3 ${
                      sendResult.success
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                        : 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300'
                    }`}
                  >
                    {sendResult.success ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                    )}
                    <div className="text-xs">
                      <p className="font-bold">{sendResult.success ? 'Message Dispatched!' : 'Dispatch Failed'}</p>
                      <p className="mt-0.5">{sendResult.message}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendTestMessage} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                        Recipient Mobile (10 digits) *
                      </label>
                      <input
                        type="tel"
                        required
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                        placeholder="e.g. 9876543210"
                        className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                      Message Content / Note
                    </label>
                    <textarea
                      rows={3}
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={isSending}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all"
                    >
                      <Send className="h-4 w-4" />
                      <span>{isSending ? 'Sending Message...' : 'Send WhatsApp Alert'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenDirectChat}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DE8626] bg-amber-500/10 px-4 py-3 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-all"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Preview Click-to-Chat</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right 1 Col: Features & Supported Templates */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2930] dark:text-[#F3F4F6]">
                    Configured Templates
                  </h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] p-3">
                    <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">order_status_update</p>
                    <p className="text-[11px] text-[#667085] mt-0.5">
                      Sends real-time updates when an order is Confirmed, Preparing, or Ready.
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] p-3">
                    <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">bill_receipt_shared</p>
                    <p className="text-[11px] text-[#667085] mt-0.5">
                      Shares itemized digital bills with grand total, tax breakdown, and payment mode.
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] p-3">
                    <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">table_reservation_confirmed</p>
                    <p className="text-[11px] text-[#667085] mt-0.5">
                      Confirms table reservations with guest count, slot timing, and outlet address.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Smartphone className="h-5 w-5" />
                  <h4 className="text-xs font-bold uppercase">Zero-Setup Web POS</h4>
                </div>
                <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                  Even if Gupshup SMS credits run out, cashiers can always click "Share on WhatsApp" in POS checkout to instantly send preformatted digital bills directly via WhatsApp Web.
                </p>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
