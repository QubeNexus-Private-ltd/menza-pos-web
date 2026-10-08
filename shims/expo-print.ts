/**
 * Web compatibility shim for expo-print
 * Enables printing HTML reports via browser print dialog.
 */

export async function printAsync(options: { html?: string; uri?: string; [key: string]: any }): Promise<void> {
  if (typeof window === 'undefined') return;

  if (options.html) {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(options.html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
      return;
    }
  }

  window.print();
}

export async function printToFileAsync(options: { html?: string; [key: string]: any }): Promise<{ uri: string; numberOfPages: number; [key: string]: any }> {
  await printAsync(options);
  return { uri: '', numberOfPages: 1 };
}

export default {
  printAsync,
  printToFileAsync,
};
