'use client';

import React from 'react';
import { Sparkles, AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';

export type AlertType = 'success' | 'danger' | 'warning' | 'info';

export interface GildedAlertConfig {
  visible: boolean;
  type?: AlertType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface GildedAlertModalProps extends GildedAlertConfig {
  onClose: () => void;
}

export const GildedAlertModal: React.FC<GildedAlertModalProps> = ({
  visible,
  type = 'success',
  title,
  message,
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onCancel,
  onClose,
}) => {
  if (!visible) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  const getBadgeIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertTriangle className="h-7 w-7 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-7 w-7 text-amber-500" />;
      case 'info':
        return <Info className="h-7 w-7 text-blue-600" />;
      case 'success':
      default:
        return <Sparkles className="h-7 w-7 text-[#DE8626]" />;
    }
  };

  const getBadgeBg = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-100 border-red-200';
      case 'warning':
        return 'bg-amber-100/80 border-amber-300';
      case 'info':
        return 'bg-blue-100/80 border-blue-300';
      case 'success':
      default:
        return 'bg-amber-100/60 border-amber-300/60';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-[#8C7A6B] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Badge Icon */}
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${getBadgeBg()} mb-3.5 shadow-sm`}
        >
          {getBadgeIcon()}
        </div>

        {/* Title & Message */}
        <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6] tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-xs text-[#667085] dark:text-[#94A3B8] whitespace-pre-line leading-relaxed">
          {message}
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex w-full items-center gap-2.5">
          {cancelText && (
            <button
              onClick={handleCancel}
              className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] py-2.5 text-xs font-bold text-[#667085] dark:text-[#94A3B8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              {cancelText}
            </button>
          )}

          <button
            onClick={handleConfirm}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white shadow-md transition-all ${
              !cancelText ? 'w-full' : 'flex-1'
            } ${
              type === 'danger'
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                : 'bg-gradient-to-r from-amber-500 via-[#DE8626] to-[#CB741B] hover:brightness-105 shadow-[#DE8626]/20'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
