import { APP_CONSTANTS } from '@/lib/constants';

/**
 * Normalizes and resolves a dish image URL to an absolute accessible URL.
 * Handles relative backend paths, external CDNs, protocol-relative URLs,
 * Windows backslash separators, and empty/placeholder states.
 */
export function resolveDishImageUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }

  // Strip leading/trailing quotes and whitespace
  const trimmed = rawUrl.replace(/^["']|["']$/g, '').trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed.toLowerCase() === 'none' ||
    trimmed === '[object Object]'
  ) {
    return null;
  }

  // Base64 Data URL or Blob URL
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Protocol-relative URL
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  // Already an absolute HTTP / HTTPS URL
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Relative path (e.g. "/uploads/items/1.jpg" or "uploads\items\1.jpg")
  const normalizedPath = trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
  const apiHost = APP_CONSTANTS.API_BASE_URL.replace(/\/api\/?$/i, '').replace(/\/+$/, '');

  return `${apiHost}/${normalizedPath}`;
}