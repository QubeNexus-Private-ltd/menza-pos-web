'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Delete, Calculator, CheckCircle2 } from 'lucide-react';

interface QuickNumpadModalProps {
  isOpen: boolean;
  itemName: string;
  currentQuantity: number;
  unitPrice?: number;
  description?: string;
  onClose: () => void;
  onApply: (newQuantity: number) => void;
}

export function QuickNumpadModal({
  isOpen,
  itemName,
  currentQuantity,
  unitPrice = 0,
  description,
  onClose,
  onApply,
}: QuickNumpadModalProps) {
  const [val, setVal] = useState<string>('1');

  useEffect(() => {
    if (isOpen) {
      setVal(String(currentQuantity > 0 ? currentQuantity : 1));
    }
  }, [isOpen, currentQuantity]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    setVal((prev) => {
      if (prev === '0' || prev === '') return digit;
      if (prev.length >= 3) return prev; // max 999
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    setVal((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  const handleClear = () => {
    setVal('0');
  };

  const handleSetExact = (num: number) => {
    setVal(String(num));
  };

  const handleConfirm = () => {
    const num = parseInt(val, 10);
    const finalQty = isNaN(num) || num < 0 ? 0 : num;
    onApply(finalQty);
    onClose();
  };

  const currentParsed = parseInt(val, 10) || 0;
  const lineTotal = currentParsed * unitPrice;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl p-5 space-y-3.5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-2 min-w-0">
            <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] break-words">
              {itemName}
            </h3>
            {description && (
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-1 mt-0.5">
                {description}
              </p>
            )}
            <p className="text-[11px] font-semibold text-[#DE8626] mt-0.5">
              ₹{unitPrice} per item • Current: {currentQuantity} in cart
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1 text-[#8C7A6B] hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quantity Screen */}
        <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3 text-center">
          <span className="text-[10px] font-extrabold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
            SET QUANTITY
          </span>
          <div className="text-3xl font-extrabold text-[#DE8626] font-mono tracking-wider my-0.5">
            {val || '0'}
          </div>
          {unitPrice > 0 && (
            <span className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
              Line Total: ₹{lineTotal.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Quick Select Presets Matching Menza [1, 2, 3, 5, 10, 15, 20] */}
        <div>
          <span className="text-[10px] font-extrabold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider block mb-1">
            QUICK SELECT
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 5, 10, 15, 20].map((preset) => (
              <button
                key={`preset-${preset}`}
                type="button"
                onClick={() => handleSetExact(preset)}
                className={`flex-1 min-w-[36px] py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  val === String(preset)
                    ? 'border-[#DE8626] bg-[#DE8626] text-white shadow-sm'
                    : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* 3x4 Numpad Grid */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="flex h-11 items-center justify-center rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-base font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-[#FAF7F2] dark:hover:bg-[#151A20] active:scale-95 transition-all shadow-sm"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="flex h-11 items-center justify-center rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-xs font-extrabold text-red-600 hover:bg-red-100 transition-colors"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="flex h-11 items-center justify-center rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-base font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-[#FAF7F2] active:scale-95 transition-all shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="flex h-11 items-center justify-center rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:bg-[#FAF7F2] active:scale-95 transition-all shadow-sm"
          >
            <Delete className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] text-xs font-bold text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-[2] flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-[#DE8626] to-[#CB741B] py-2.5 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:brightness-105 transition-all"
          >
            <Check className="h-4 w-4" />
            <span>Set {val || '0'} in Cart</span>
          </button>
        </div>
      </div>
    </div>
  );
}
