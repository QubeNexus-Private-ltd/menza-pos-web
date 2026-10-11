'use client';

import React from 'react';
import { X, Play, Trash2, Clock, ShoppingBag, User, Table as TableIcon } from 'lucide-react';

export interface ParkedCart {
  id: string;
  parkedAt: Date;
  cart: any[];
  orderType: string;
  table: any | null;
  customerName: string;
  customerPhone: string;
  discountAmount: number;
  subtotal: number;
}

interface ParkedCartsModalProps {
  isOpen: boolean;
  parkedCarts: ParkedCart[];
  onClose: () => void;
  onResume: (cart: ParkedCart) => void;
  onDiscard: (cartId: string) => void;
}

export function ParkedCartsModal({
  isOpen,
  parkedCarts,
  onClose,
  onResume,
  onDiscard,
}: ParkedCartsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E7E1DA] dark:border-[#2B3540]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                Parked Orders (Hold Carts)
              </h3>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                {parkedCarts.length} held tickets awaiting resumption
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {parkedCarts.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#667085] space-y-2">
              <ShoppingBag className="h-8 w-8 mx-auto opacity-40 text-[#DE8626]" />
              <p>No held carts currently.</p>
              <p className="text-[11px] opacity-75">
                Use "Hold Order" in the POS cart to park bills while customers prepare payment.
              </p>
            </div>
          ) : (
            parkedCarts.map((item, index) => {
              const minutesAgo = Math.max(
                0,
                Math.round((Date.now() - new Date(item.parkedAt).getTime()) / 60000)
              );
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#DE8626]/60 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-[#DE8626] text-white px-2 py-0.5 text-[10px] font-extrabold uppercase">
                        #{index + 1} • {item.orderType}
                      </span>
                      {item.table && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                          <TableIcon className="h-3 w-3 text-[#DE8626]" />
                          Table {item.table.tableNumber}
                        </span>
                      )}
                      <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                        Held {minutesAgo === 0 ? 'just now' : `${minutesAgo}m ago`}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      {item.customerName || 'Walk-in Guest'}{' '}
                      {item.customerPhone ? `(${item.customerPhone})` : ''}
                    </p>

                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      {item.cart.length} item(s) • Total: ₹{item.subtotal}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => onDiscard(item.id)}
                      className="p-2.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-bold transition-colors"
                      title="Discard parked cart"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onResume(item)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#DE8626] text-white text-xs font-bold shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Resume Order</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
