/**
 * Web compatibility shim for expo-sharing
 * Uses Web Share API or falls back to file download / clipboard.
 */

export async function isAvailableAsync(): Promise<boolean> {
  return typeof navigator !== 'undefined' && Boolean(navigator.share);
}

export async function shareAsync(url: string, options?: { dialogTitle?: string; mimeType?: string }): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: options?.dialogTitle || 'Share Document',
        url,
      });
      return;
    } catch {
      // User cancelled or share failed
    }
  }

  // Fallback: Trigger standard browser download
  if (typeof window !== 'undefined' && url) {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'menza-report.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export default {
  isAvailableAsync,
  shareAsync,
};
