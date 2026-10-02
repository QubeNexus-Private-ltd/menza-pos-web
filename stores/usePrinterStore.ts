import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PaperWidth } from '@/types/printer';

interface PrinterState {
  paperWidth: PaperWidth;
  autoPrintReceipt: boolean;
  autoPrintKot: boolean;
  customFooter: string;
  printerIp?: string;
  printerPort?: number;

  setPaperWidth: (width: PaperWidth) => void;
  setAutoPrintReceipt: (enabled: boolean) => void;
  setAutoPrintKot: (enabled: boolean) => void;
  setCustomFooter: (footer: string) => void;
  setPrinterIp: (ip: string) => void;
  setPrinterPort: (port: number) => void;
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set) => ({
      paperWidth: '58mm',
      autoPrintReceipt: false,
      autoPrintKot: false,
      customFooter: 'Thank you for dining with us! Please visit again.',
      printerIp: '192.168.1.100',
      printerPort: 9100,

      setPaperWidth: (width: PaperWidth) => set({ paperWidth: width }),
      setAutoPrintReceipt: (enabled: boolean) => set({ autoPrintReceipt: enabled }),
      setAutoPrintKot: (enabled: boolean) => set({ autoPrintKot: enabled }),
      setCustomFooter: (footer: string) => set({ customFooter: footer }),
      setPrinterIp: (ip: string) => set({ printerIp: ip }),
      setPrinterPort: (port: number) => set({ printerPort: port }),
    }),
    {
      name: 'menza_printer_config',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : (null as any))),
    }
  )
);
