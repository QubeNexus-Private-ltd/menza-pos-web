'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Delete, ArrowRight, Calculator } from 'lucide-react';

interface QuickNumpadModalProps {
  isOpen: boolean;
  itemName: string;
  currentQuantity: number;
  onClose: () => void;
  onApply: (newQuantity: number) => void;
}

export function QuickNumpadModal({
  isOpen,
  itemName,
  currentQuantity,
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
    setVal((prev) => (prev.length <= 1 ? '' : prev.slice(0, -1)));
  };

  const handleClear = () => {
    setVal('');
  };

  const handleIncrement = (delta: number) => {
    const current = parseInt(val, 10) || 0;
    const next = Math.max(1, Math.min(999, current + delta));
    setVal(String(next));
  };

  const handleConfirm = () => {
    const num = parseInt(val, 10);
    const finalQty = isNaN(num) || num <= 0 ? 1 : num;
    onApply(finalQty);
    onClose();
  };

  const currentParsed = parseInt(val, 10) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xs rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-[#DE8626]" />
            <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
              Set Quantity
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Item Title & Value Screen */}
        <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3 text-center">
          <p className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] truncate mb-1">
            {itemName}
          </p>
          <div className="text-3xl font-extrabold text-[#DE8626] font-mono tracking-wider">
            {val || '0'}
          </div>
        </div>

        {/* Quick Increment Chips */}
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 5, 10, 25].map((delta) => (
            <button
              key={`add-${delta}`}
              type="button"
              onClick={() => handleIncrement(delta)}
              className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] py-1.5 text-xs font-extrabold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] hover:text-[#DE8626] transition-colors"
            >
              +{delta}
            </button>
          ))}
        </div>

        {/* 3x4 Numpad Grid */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="flex h-12 items-center justify-center rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-lg font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-[#FAF7F2] dark:hover:bg-[#151A20] active:scale-95 transition-all shadow-sm"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="flex h-12 items-center justify-center rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-xs font-extrabold text-red-600 hover:bg-red-100 transition-colors"
          >
            CLEAR
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="flex h-12 items-center justify-center rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-lg font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-[#FAF7F2] active:scale-95 transition-all shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="flex h-12 items-center justify-center rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:bg-[#FAF7F2] active:scale-95 transition-all shadow-sm"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {/* Confirm Action */}
        <button
          type="button"
          onClick={handleConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#DE8626] py-3 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
        >
          <Check className="h-4 w-4" />
          <span>Apply Quantity ({currentParsed || 1})</span>
        </button>
      </div>
    </div>
  );
}
