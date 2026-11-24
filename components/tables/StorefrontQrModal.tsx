'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  Download,
  Store,
  Copy,
  Check,
  Sparkles,
  QrCode,
  Camera,
  UtensilsCrossed,
  Smartphone,
  Sliders,
} from 'lucide-react';
import QRCode from 'qrcode';
import { WebTableQrService, RestaurantQrResponseDTO } from '@/services/tableQrService';
import { APP_CONSTANTS } from '@shared/core/constants/appConstants';

// Standard Acrylic Standee Size Specifications (Calibrated at 300 DPI)
export type StandeeSizeKey = 'a5' | '4x6' | 'a4';

interface StandeeDimensionSpec {
  key: StandeeSizeKey;
  name: string;
  shortLabel: string;
  dimensionsMm: string;
  widthMm: number;
  heightMm: number;
  canvasWidth: number;
  canvasHeight: number;
  description: string;
}

const STANDEE_SIZES: Record<StandeeSizeKey, StandeeDimensionSpec> = {
  a5: {
    key: 'a5',
    name: 'A5 Acrylic Tabletop',
    shortLabel: 'A5 (148 × 210 mm)',
    dimensionsMm: '148 × 210 mm',
    widthMm: 148,
    heightMm: 210,
    canvasWidth: 1748, // 148 mm at 300 DPI
    canvasHeight: 2480, // 210 mm at 300 DPI
    description: 'Standard restaurant dining table acrylic standee (ISO A5)',
  },
  '4x6': {
    key: '4x6',
    name: '4" × 6" Photo Standee',
    shortLabel: '4" × 6" (102 × 152 mm)',
    dimensionsMm: '102 × 152 mm',
    widthMm: 101.6,
    heightMm: 152.4,
    canvasWidth: 1200, // 4 inches at 300 DPI
    canvasHeight: 1800, // 6 inches at 300 DPI
    description: 'Compact table tent / acrylic photo frame standee',
  },
  a4: {
    key: 'a4',
    name: 'A4 Counter Standee',
    shortLabel: 'A4 (210 × 297 mm)',
    dimensionsMm: '210 × 297 mm',
    widthMm: 210,
    heightMm: 297,
    canvasWidth: 2480, // 210 mm at 300 DPI
    canvasHeight: 3508, // 297 mm at 300 DPI
    description: 'Front billing counter / host reception desk standee (ISO A4)',
  },
};

// CRC32 Table for PNG Metadata Chunk Insertion
const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array, offset: number, length: number): number {
  let crc = 0xffffffff;
  for (let i = offset; i < offset + length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Embeds the official PNG 'pHYs' chunk (300 DPI = 11811 pixels/meter) so printer drivers recognize exact physical mm size
function embedPngDpiMetadata(dataUrl: string, dpi = 300): string {
  try {
    const parts = dataUrl.split(',');
    if (parts.length !== 2) return dataUrl;

    const binaryString = atob(parts[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // PNG signature: 8 bytes. IHDR starts at offset 8.
    const ihdrLength =
      (bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11];
    const insertPos = 8 + 4 + 4 + ihdrLength + 4; // byte position immediately after IHDR chunk

    // 300 DPI in pixels per meter: 300 / 0.0254 = ~11811
    const ppm = Math.round(dpi / 0.0254);

    // Build pHYs chunk: length (4 bytes) + 'pHYs' (4 bytes) + data (9 bytes: X ppm, Y ppm, unit) + CRC (4 bytes) = 21 bytes
    const physChunk = new Uint8Array(21);
    const view = new DataView(physChunk.buffer);

    view.setUint32(0, 9); // Data length: 9 bytes
    physChunk[4] = 0x70; // 'p'
    physChunk[5] = 0x48; // 'H'
    physChunk[6] = 0x59; // 'Y'
    physChunk[7] = 0x73; // 's'
    view.setUint32(8, ppm); // X pixels per meter
    view.setUint32(12, ppm); // Y pixels per meter
    physChunk[16] = 1; // Unit specifier: 1 = meter

    // CRC of 'pHYs' + 9 bytes data (offset 4 to 17)
    const chunkCrc = crc32(physChunk, 4, 13);
    view.setUint32(17, chunkCrc);

    // Merge into new Uint8Array
    const output = new Uint8Array(bytes.length + 21);
    output.set(bytes.subarray(0, insertPos), 0);
    output.set(physChunk, insertPos);
    output.set(bytes.subarray(insertPos), insertPos + 21);

    // Encode back to base64
    let outBinary = '';
    const chunkStep = 8192;
    for (let i = 0; i < output.length; i += chunkStep) {
      outBinary += String.fromCharCode.apply(
        null,
        Array.from(output.subarray(i, Math.min(i + chunkStep, output.length)))
      );
    }

    return `${parts[0]},${btoa(outBinary)}`;
  } catch (err) {
    console.warn('Could not embed PNG DPI metadata:', err);
    return dataUrl;
  }
}

interface StorefrontQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: number;
  restaurantName: string;
}

export function StorefrontQrModal({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
}: StorefrontQrModalProps) {
  const [qrData, setQrData] = useState<RestaurantQrResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isGeneratingDownload, setIsGeneratingDownload] = useState(false);
  const [brandedQrDataUrl, setBrandedQrDataUrl] = useState<string | null>(null);
  const [selectedStandeeSize, setSelectedStandeeSize] = useState<StandeeSizeKey>('a5');

  // Preserve restaurant identity
  const effectiveRestaurantName = restaurantName || 'Menza prod test';

  // Fetch storefront QR details from server
  useEffect(() => {
    if (!isOpen || !restaurantId) return;

    let mounted = true;
    setLoading(true);
    WebTableQrService.getStorefrontQr(restaurantId)
      .then((data) => {
        if (mounted) setQrData(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, restaurantId]);

  // Fallback ordering URL host
  const configuredHost =
    process.env.NEXT_PUBLIC_CUSTOMER_ORDERING_BASE_URL ||
    APP_CONSTANTS?.CUSTOMER_ORDERING_BASE_URL ||
    'https://menza-order-web.vercel.app';

  // Strict preservation of original QR destination URL
  const customerUrl = React.useMemo(() => {
    const rawUrl = qrData?.qrUrl;
    const cleanHost = configuredHost.replace(/\/+$/, '');
    if (!rawUrl) {
      return `${cleanHost}?restId=${restaurantId}`;
    }
    try {
      const parsed = new URL(rawUrl);
      const confUrl = new URL(cleanHost);
      if (parsed.origin !== confUrl.origin) {
        return `${cleanHost}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return rawUrl;
    } catch {
      return `${cleanHost}?restId=${restaurantId}`;
    }
  }, [qrData?.qrUrl, configuredHost, restaurantId]);

  // Generate high-contrast, optical-grade QR code (Level 'H' error correction + perfectly fitted small panda emblem)
  useEffect(() => {
    if (!isOpen || !customerUrl) return;

    let isCancelled = false;

    const generateBrandedQr = async () => {
      try {
        // Pure #000000 on #FFFFFF ensures maximum optical thresholding under all restaurant lighting conditions
        const rawQrDataUrl = await QRCode.toDataURL(customerUrl, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 800,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        if (isCancelled) return;

        // Composite the well-proportioned center panda badge with pure white isolation buffer
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setBrandedQrDataUrl(rawQrDataUrl);
          return;
        }

        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';
        qrImg.onload = () => {
          if (isCancelled) return;
          ctx.drawImage(qrImg, 0, 0, 800, 800);

          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          logoImg.onload = () => {
            if (isCancelled) return;
            const center = 400;
            const radius = 70; // 140px diameter (17.5% ratio - maintains 100% scannability and finder pattern clearance)

            // Protective pure-white halo ring to prevent module-edge bleed
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Refined amber accent ring
            ctx.strokeStyle = '#DE8626';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Perfectly fitted panda mascot
            const iconSize = 90;
            ctx.drawImage(
              logoImg,
              center - iconSize / 2,
              center - iconSize / 2,
              iconSize,
              iconSize
            );

            setBrandedQrDataUrl(canvas.toDataURL('image/png'));
          };
          logoImg.onerror = () => {
            if (!isCancelled) setBrandedQrDataUrl(rawQrDataUrl);
          };
          logoImg.src = '/brand/panda_chef_clean.png';
        };
        qrImg.onerror = () => {
          if (!isCancelled) setBrandedQrDataUrl(rawQrDataUrl);
        };
        qrImg.src = rawQrDataUrl;
      } catch (err) {
        console.warn('Could not generate client-side QR:', err);
      }
    };

    generateBrandedQr();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, customerUrl]);

  if (!isOpen) return null;

  // Primary QR display image source
  const baseQrSrc =
    qrData?.qrCodeBase64
      ? qrData.qrCodeBase64.startsWith('data:')
        ? qrData.qrCodeBase64
        : `data:image/png;base64,${qrData.qrCodeBase64}`
      : `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(customerUrl)}&color=000000&bgcolor=FFFFFF`;

  const displayQrSrc = brandedQrDataUrl || baseQrSrc;

  // Copy Link Handler
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(customerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`Storefront URL:\n${customerUrl}`);
    }
  };

  // Helper to load image for canvas operations
  const loadImage = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  // High-Resolution 300 DPI Canvas Standee Generator (Exact Physical Sizing + Embedded 300 DPI Metadata)
  const handleDownloadStandee = async () => {
    try {
      setIsGeneratingDownload(true);

      const spec = STANDEE_SIZES[selectedStandeeSize] || STANDEE_SIZES.a5;

      const canvas = document.createElement('canvas');
      canvas.width = spec.canvasWidth;
      canvas.height = spec.canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = spec.canvasWidth;
      const H = spec.canvasHeight;

      const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      // 1. High-Luminance Card Surface (Anti-glare, calibrated for acrylic standee slots)
      const margin = Math.round(W * 0.035);
      const cardW = W - margin * 2;
      const cardH = H - margin * 2;
      const cardRadius = Math.round(W * 0.04);

      ctx.fillStyle = '#FFFFFF';
      drawRoundRect(margin, margin, cardW, cardH, cardRadius);
      ctx.fill();

      // Card Boundary Frame
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = Math.round(W * 0.0035);
      drawRoundRect(margin, margin, cardW, cardH, cardRadius);
      ctx.stroke();

      // Subtle Inner Amber Accent Line
      const innerMargin = margin + Math.round(W * 0.012);
      ctx.strokeStyle = 'rgba(222, 134, 38, 0.4)';
      ctx.lineWidth = Math.max(1.5, Math.round(W * 0.0015));
      drawRoundRect(innerMargin, innerMargin, W - innerMargin * 2, H - innerMargin * 2, cardRadius - 8);
      ctx.stroke();

      // 2. Hierarchy #1: RESTAURANT NAME (Large, authoritative, immediate recognition)
      ctx.fillStyle = '#0B1320';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      const maxRestWidth = W * 0.84;
      let restFontSize = Math.round(W * 0.05);
      ctx.font = `900 ${restFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      while (ctx.measureText(effectiveRestaurantName).width > maxRestWidth && restFontSize > 28) {
        restFontSize -= 2;
        ctx.font = `900 ${restFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      }
      ctx.fillText(effectiveRestaurantName, W / 2, H * 0.095);

      // Tagline under Restaurant Name
      ctx.fillStyle = '#B45309';
      ctx.font = `bold ${Math.round(W * 0.02)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText('Scan. Explore. Order. Enjoy!', W / 2, H * 0.125);

      // 3. Hierarchy #2: Large QR Code Container with subtle repeating Menza watermark pattern
      const frameSize = Math.round(W * 0.58);
      const frameX = (W - frameSize) / 2;
      const frameY = Math.round(H * 0.155);

      // Card Backing Shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
      ctx.shadowBlur = Math.round(W * 0.02);
      ctx.shadowOffsetY = Math.round(W * 0.006);
      ctx.fillStyle = '#FFFFFF';
      drawRoundRect(frameX, frameY, frameSize, frameSize, Math.round(W * 0.03));
      ctx.fill();
      ctx.restore();

      // Subtle Repeated Menza Watermark Pattern across the entire QR container
      const patternCanvas = document.createElement('canvas');
      patternCanvas.width = 96;
      patternCanvas.height = 96;
      const pCtx = patternCanvas.getContext('2d');
      if (pCtx) {
        pCtx.save();
        pCtx.translate(48, 48);
        pCtx.rotate(-Math.PI / 6);
        pCtx.font = '900 11px sans-serif';
        pCtx.fillStyle = 'rgba(222, 134, 38, 0.05)';
        pCtx.textAlign = 'center';
        pCtx.textBaseline = 'middle';
        pCtx.fillText('MENZA', 0, 0);
        pCtx.restore();
        const pattern = ctx.createPattern(patternCanvas, 'repeat');
        if (pattern) {
          ctx.save();
          drawRoundRect(frameX, frameY, frameSize, frameSize, Math.round(W * 0.03));
          ctx.clip();
          ctx.fillStyle = pattern;
          ctx.fillRect(frameX, frameY, frameSize, frameSize);
          ctx.restore();
        }
      }

      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = Math.round(W * 0.0025);
      drawRoundRect(frameX, frameY, frameSize, frameSize, Math.round(W * 0.03));
      ctx.stroke();

      // Draw Exact Pure-Black QR Code
      const qrImg = await loadImage(displayQrSrc);
      if (qrImg) {
        const qrDrawSize = Math.round(frameSize * 0.84);
        const qrX = (W - qrDrawSize) / 2;
        const qrY = frameY + (frameSize - qrDrawSize) / 2;
        ctx.drawImage(qrImg, qrX, qrY, qrDrawSize, qrDrawSize);
      }

      // Draw Center Small, Perfectly Fitted Circular Panda Emblem
      const pandaImg = await loadImage('/brand/panda_chef_clean.png');
      if (pandaImg) {
        const qrCenterY = frameY + frameSize / 2;
        const emblemRadius = Math.round(frameSize * 0.082); // ~18% ratio - optimal optical scan clearance

        // Pure white protective isolation ring
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(W / 2, qrCenterY, emblemRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Subtle amber rim
        ctx.strokeStyle = '#DE8626';
        ctx.lineWidth = Math.round(W * 0.003);
        ctx.beginPath();
        ctx.arc(W / 2, qrCenterY, emblemRadius, 0, Math.PI * 2);
        ctx.stroke();

        const pSize = Math.round(emblemRadius * 1.3);
        ctx.drawImage(pandaImg, W / 2 - pSize / 2, qrCenterY - pSize / 2, pSize, pSize);
      }

      // 4. Hierarchy #3: Scan-to-Order Call-to-Action
      const ctaY = frameY + frameSize + Math.round(H * 0.045);
      ctx.fillStyle = '#0B1320';
      ctx.font = `900 ${Math.round(W * 0.024)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('SCAN TO EXPLORE OUR MENU', W / 2, ctaY);

      ctx.fillStyle = '#334155';
      ctx.font = `600 ${Math.round(W * 0.0165)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText('Browse delicious dishes and order directly from your phone.', W / 2, ctaY + Math.round(H * 0.025));

      // 5. Hierarchy #4: Three-Step Ordering Visual Cards
      const stepWidth = Math.round(W * 0.26);
      const stepHeight = Math.round(H * 0.065);
      const stepGap = Math.round(W * 0.02);
      const totalStepsWidth = stepWidth * 3 + stepGap * 2;
      const stepStartX = (W - totalStepsWidth) / 2;
      const stepY = ctaY + Math.round(H * 0.05);

      const stepsData = [
        { num: '1', title: 'Scan QR Code', sub: 'Open phone camera' },
        { num: '2', title: 'Explore Our Menu', sub: 'Browse live items' },
        { num: '3', title: 'Place Your Order', sub: 'Order directly' },
      ];

      stepsData.forEach((st, i) => {
        const sx = stepStartX + i * (stepWidth + stepGap);

        ctx.fillStyle = '#F8FAFC';
        drawRoundRect(sx, stepY, stepWidth, stepHeight, Math.round(W * 0.015));
        ctx.fill();

        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1.5;
        drawRoundRect(sx, stepY, stepWidth, stepHeight, Math.round(W * 0.015));
        ctx.stroke();

        const badgeW = Math.round(W * 0.026);
        ctx.fillStyle = '#FEF3C7';
        drawRoundRect(sx + Math.round(W * 0.012), stepY + (stepHeight - badgeW) / 2, badgeW, badgeW, 6);
        ctx.fill();

        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1;
        drawRoundRect(sx + Math.round(W * 0.012), stepY + (stepHeight - badgeW) / 2, badgeW, badgeW, 6);
        ctx.stroke();

        ctx.fillStyle = '#B45309';
        ctx.font = `900 ${Math.round(W * 0.014)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(st.num, sx + Math.round(W * 0.012) + badgeW / 2, stepY + stepHeight / 2);

        ctx.fillStyle = '#0B1320';
        ctx.font = `bold ${Math.round(W * 0.0145)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(st.title, sx + Math.round(W * 0.046), stepY + stepHeight * 0.44);

        ctx.fillStyle = '#64748B';
        ctx.font = `500 ${Math.round(W * 0.012)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillText(st.sub, sx + Math.round(W * 0.046), stepY + stepHeight * 0.72);
      });

      // 6. Hierarchy #5: Premium Brand Divider & Endorsement Footer (with Acrylic Base Clearance buffer)
      const divY = H - Math.round(H * 0.16);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W * 0.18, divY);
      ctx.lineTo(W * 0.82, divY);
      ctx.stroke();

      ctx.fillStyle = '#DE8626';
      ctx.save();
      ctx.translate(W / 2, divY);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();

      const menzaLogo = await loadImage('/brand/menza_logo_clean.png');
      const logoSize = Math.round(W * 0.035);
      if (menzaLogo) {
        ctx.drawImage(menzaLogo, W / 2 - logoSize / 2, divY + Math.round(H * 0.018), logoSize, logoSize);
      }

      const prefix = 'Powered by ';
      const brand = 'Menza';
      ctx.font = `600 ${Math.round(W * 0.019)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const prefixWidth = ctx.measureText(prefix).width;
      ctx.font = `900 ${Math.round(W * 0.019)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const brandWidth = ctx.measureText(brand).width;
      const totalWidth = prefixWidth + brandWidth;
      const startX = (W - totalWidth) / 2;

      ctx.fillStyle = '#475569';
      ctx.font = `600 ${Math.round(W * 0.019)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(prefix, startX, divY + Math.round(H * 0.065));

      ctx.fillStyle = '#DE8626';
      ctx.font = `900 ${Math.round(W * 0.019)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(brand, startX + prefixWidth, divY + Math.round(H * 0.065));

      ctx.fillStyle = '#334155';
      ctx.font = `bold ${Math.round(W * 0.015)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Smart Dining. Seamless Ordering.', W / 2, divY + Math.round(H * 0.09));

      ctx.fillStyle = '#64748B';
      ctx.font = `600 ${Math.round(W * 0.0125)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText('Contactless Dining Experience', W / 2, divY + Math.round(H * 0.11));

      // Embed official 300 DPI metadata chunk into PNG
      const rawDataUrl = canvas.toDataURL('image/png');
      const printReadyDataUrl = embedPngDpiMetadata(rawDataUrl, 300);

      const a = document.createElement('a');
      a.href = printReadyDataUrl;
      a.download = `${effectiveRestaurantName.replace(/\s+/g, '_')}_Standee_${spec.key.toUpperCase()}_${spec.dimensionsMm.replace(/\s+/g, '')}_300DPI.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error generating standee image:', err);
      handleDownloadQrOnly();
    } finally {
      setIsGeneratingDownload(false);
    }
  };

  // Download QR Code Only
  const handleDownloadQrOnly = () => {
    const a = document.createElement('a');
    a.href = brandedQrDataUrl || displayQrSrc;
    a.download = `${effectiveRestaurantName.replace(/\s+/g, '_')}_Storefront_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Dedicated Print Standee Function (Calibrated for Selected Physical Standee Dimensions)
  const handlePrint = () => {
    const spec = STANDEE_SIZES[selectedStandeeSize] || STANDEE_SIZES.a5;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${effectiveRestaurantName} - ${spec.name} (${spec.dimensionsMm})</title>
        <style>
          @page {
            size: ${spec.widthMm}mm ${spec.heightMm}mm;
            margin: 0;
          }
          @media print {
            html, body {
              width: ${spec.widthMm}mm !important;
              height: ${spec.heightMm}mm !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .standee-card {
              box-shadow: none !important;
              page-break-inside: avoid;
            }
          }
          body {
            margin: 0;
            padding: 0;
            background: #FAF7F2;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: #0B1320;
          }
          .standee-card {
            width: ${spec.widthMm}mm;
            height: ${spec.heightMm}mm;
            background: #FFFFFF;
            border: 2px solid #CBD5E1;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            text-align: center;
            padding: 16mm 12mm 18mm 12mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .rest-name {
            font-size: 26px;
            font-weight: 900;
            color: #0B1320;
            margin: 0 0 4px 0;
            line-height: 1.15;
            letter-spacing: -0.3px;
          }
          .rest-tagline {
            font-size: 13px;
            font-weight: 700;
            color: #B45309;
            margin: 0;
          }
          .qr-frame {
            display: inline-block;
            background: #FFFFFF;
            background-image: radial-gradient(rgba(222, 134, 38, 0.08) 1.5px, transparent 1.5px);
            background-size: 16px 16px;
            padding: 12px;
            border-radius: 20px;
            border: 2.5px solid #CBD5E1;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
            position: relative;
            margin: 8px auto;
          }
          .qr-img {
            width: 190px;
            height: 190px;
            display: block;
          }
          .center-emblem {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: #FFFFFF;
            border: 2px solid #DE8626;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            padding: 3px;
            box-sizing: border-box;
          }
          .center-emblem img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .cta-title {
            font-size: 14px;
            font-weight: 900;
            color: #0B1320;
            margin-bottom: 3px;
            letter-spacing: 0.3px;
          }
          .cta-sub {
            font-size: 11px;
            color: #334155;
            font-weight: 500;
            margin-bottom: 8px;
          }
          .steps-row {
            display: flex;
            justify-content: space-between;
            gap: 6px;
            margin-bottom: 8px;
          }
          .step-box {
            flex: 1;
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 8px 4px;
            text-align: center;
          }
          .step-badge {
            display: inline-block;
            width: 20px;
            height: 20px;
            line-height: 20px;
            background: #FEF3C7;
            color: #92400E;
            border: 1px solid #F59E0B;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 900;
            margin-bottom: 4px;
          }
          .step-label {
            font-size: 9.5px;
            font-weight: 700;
            color: #0B1320;
          }
          .footer-divider {
            border-top: 1.5px solid #CBD5E1;
            margin: 8px 20px;
            position: relative;
          }
          .footer-divider::after {
            content: '◆';
            position: absolute;
            top: -8px;
            left: 50%;
            transform: translateX(-50%);
            background: #FFFFFF;
            padding: 0 6px;
            font-size: 8px;
            color: #DE8626;
          }
          .footer-powered {
            font-size: 11.5px;
            font-weight: 600;
            color: #475569;
          }
          .footer-powered strong {
            color: #DE8626;
            font-weight: 900;
          }
          .footer-tagline {
            font-size: 10px;
            font-weight: 700;
            color: #334155;
            margin-top: 2px;
          }
          .footer-sub {
            font-size: 9px;
            color: #64748B;
            margin-top: 1px;
          }
        </style>
      </head>
      <body>
        <div class="standee-card">
          <div>
            <div class="rest-name">${effectiveRestaurantName}</div>
            <div class="rest-tagline">Scan. Explore. Order. Enjoy!</div>
          </div>
          <div>
            <div class="qr-frame">
              <img src="${displayQrSrc}" class="qr-img" alt="QR Code" />
              <div class="center-emblem">
                <img src="/brand/panda_chef_clean.png" alt="Panda" />
              </div>
            </div>
          </div>
          <div>
            <div class="cta-title">SCAN TO EXPLORE OUR MENU</div>
            <div class="cta-sub">Browse delicious dishes and order directly from your phone.</div>
            <div class="steps-row">
              <div class="step-box">
                <div class="step-badge">1</div>
                <div class="step-label">Scan QR Code</div>
              </div>
              <div class="step-box">
                <div class="step-badge">2</div>
                <div class="step-label">Explore Our Menu</div>
              </div>
              <div class="step-box">
                <div class="step-badge">3</div>
                <div class="step-label">Place Your Order</div>
              </div>
            </div>
          </div>
          <div>
            <div class="footer-divider"></div>
            <div class="footer-powered">Powered by <strong>Menza</strong></div>
            <div class="footer-tagline">Smart Dining. Seamless Ordering.</div>
            <div class="footer-sub">Contactless Dining Experience</div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const activeSpec = STANDEE_SIZES[selectedStandeeSize] || STANDEE_SIZES.a5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-sm rounded-3xl border border-[#CBD5E1] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-2xl space-y-3.5 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DE8626]/10 text-[#DE8626]">
              <Store className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0B1320] dark:text-[#F3F4F6] leading-tight">
                Storefront Menu Standee
              </h3>
              <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                Physical Acrylic QR Tabletop Standee
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Physical Standee Size Selector Tabs */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-[#0B1320] dark:text-[#F3F4F6] flex items-center gap-1">
              <Sliders className="h-3 w-3 text-[#DE8626]" />
              <span>Acrylic Standee Size:</span>
            </span>
            <span className="font-mono text-[10px] text-[#DE8626] font-bold">
              300 DPI Print-Ready
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] p-1 border border-[#E7E1DA] dark:border-[#2B3540]">
            {(Object.keys(STANDEE_SIZES) as StandeeSizeKey[]).map((key) => {
              const item = STANDEE_SIZES[key];
              const isSelected = selectedStandeeSize === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedStandeeSize(key)}
                  className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-[#242C35] text-[#DE8626] font-extrabold shadow-xs border border-[#E7E1DA]/80 dark:border-[#384350]'
                      : 'text-[#64748B] hover:text-[#0B1320] dark:hover:text-[#F3F4F6] font-medium'
                  }`}
                >
                  <div className="text-[11px] leading-tight">{key.toUpperCase()}</div>
                  <div className="text-[8.5px] opacity-80 leading-tight">{item.dimensionsMm.split(' ')[0]}</div>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] px-0.5">
            📌 Calibrated for: <strong>{activeSpec.name} ({activeSpec.dimensionsMm})</strong>. Slides flush into acrylic slots.
          </p>
        </div>

        {/* =========================================================================
            PRODUCE PRODUCTION-QUALITY ACRYLIC STANDEE CARD (5-LEVEL VISUAL HIERARCHY)
           ========================================================================= */}
        <div
          id="printable-store-qr"
          className="rounded-2xl border-2 border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#161D26] p-5 text-center shadow-md space-y-3"
        >
          {/* HIERARCHY #1: Restaurant Name & Primary Tagline */}
          <div className="space-y-0.5">
            <h3 className="text-2xl font-black text-[#0B1320] dark:text-[#FFFFFF] tracking-tight leading-snug">
              {effectiveRestaurantName}
            </h3>
            <p className="text-xs font-bold text-[#B45309] dark:text-[#FDE68A] tracking-wide">
              Scan. Explore. Order. Enjoy!
            </p>
          </div>

          {/* HIERARCHY #2: QR Code Container with subtle repeating Menza brand watermark & center emblem */}
          <div
            className="relative mx-auto w-fit p-3.5 bg-white rounded-2xl shadow-xs border-2 border-[#CBD5E1] overflow-hidden"
            style={{
              backgroundImage: 'radial-gradient(rgba(222, 134, 38, 0.08) 1.5px, transparent 1.5px)',
              backgroundSize: '16px 16px',
            }}
          >
            <div className="relative flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayQrSrc}
                alt={`${effectiveRestaurantName} Storefront QR`}
                className={`h-44 w-44 object-contain ${loading ? 'opacity-40 animate-pulse' : ''}`}
              />

              {/* Small, perfectly fitted circular Panda emblem with white halo ring (18% ratio) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-white border-2 border-[#DE8626] shadow-sm p-1 pointer-events-none ring-4 ring-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/panda_chef_clean.png"
                  alt="Panda"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>

          {/* HIERARCHY #3: Scan-to-Order Call to Action */}
          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm font-black text-[#0B1320] dark:text-[#FFFFFF] tracking-wide">
              SCAN TO EXPLORE OUR MENU
            </p>
            <p className="text-[11px] font-medium text-[#334155] dark:text-[#CBD5E1]">
              Browse delicious dishes and order directly from your phone.
            </p>
          </div>

          {/* HIERARCHY #4: Three-Step Ordering Instructions */}
          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
            <div className="flex flex-col items-center justify-center rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-2 text-center">
              <Camera className="h-4 w-4 text-[#DE8626] mb-1" />
              <span className="text-[10px] font-bold text-[#0B1320] dark:text-[#F3F4F6] leading-tight">
                1. Scan QR Code
              </span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-2 text-center">
              <UtensilsCrossed className="h-4 w-4 text-[#DE8626] mb-1" />
              <span className="text-[10px] font-bold text-[#0B1320] dark:text-[#F3F4F6] leading-tight">
                2. Explore Menu
              </span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-2 text-center">
              <Smartphone className="h-4 w-4 text-[#DE8626] mb-1" />
              <span className="text-[10px] font-bold text-[#0B1320] dark:text-[#F3F4F6] leading-tight">
                3. Place Order
              </span>
            </div>
          </div>

          {/* HIERARCHY #5: Impressive Endorsement Footer */}
          <div className="pt-2 border-t border-[#CBD5E1] dark:border-[#334155] flex flex-col items-center justify-center gap-0.5">
            <div className="flex items-center gap-1.5 text-xs text-[#475569] dark:text-[#CBD5E1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/menza_logo_clean.png"
                alt="Menza"
                className="h-3.5 w-3.5 object-contain"
              />
              <span>Powered by <strong className="font-black text-[#DE8626]">Menza</strong></span>
            </div>
            <p className="text-[10px] font-bold text-[#334155] dark:text-[#CBD5E1]">
              Smart Dining. Seamless Ordering.
            </p>
            <p className="text-[9px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Contactless Dining Experience
            </p>
          </div>
        </div>

        {/* Quick Share Link */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-1.5 text-xs">
          <input
            type="text"
            readOnly
            value={customerUrl}
            className="flex-1 bg-transparent text-[10.5px] font-mono font-medium text-[#334155] dark:text-[#CBD5E1] outline-none truncate px-1"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1 rounded-lg bg-white dark:bg-[#1B2127] border border-[#CBD5E1] dark:border-[#2B3540] px-2.5 py-1 text-[10.5px] font-bold text-[#DE8626] hover:bg-black/5 dark:hover:bg-white/5 shrink-0 transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Modal Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Download Standee Button */}
          <button
            type="button"
            onClick={handleDownloadStandee}
            disabled={isGeneratingDownload}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DE8626]/40 bg-[#FFF7ED] dark:bg-[#2A1E11] py-2.5 text-xs font-bold text-[#C25E00] dark:text-[#F59E0B] hover:bg-[#FFEDD5] dark:hover:bg-[#382613] transition-colors shadow-xs"
            title={`Download ${activeSpec.name} (${activeSpec.dimensionsMm}) at 300 DPI`}
          >
            <Download className={`h-4 w-4 ${isGeneratingDownload ? 'animate-bounce' : ''}`} />
            <span>{isGeneratingDownload ? 'Rendering...' : `Download ${activeSpec.shortLabel.split(' ')[0]} Standee`}</span>
          </button>

          {/* Download QR Only */}
          <button
            type="button"
            onClick={handleDownloadQrOnly}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[#CBD5E1] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] py-2.5 text-xs font-bold text-[#0B1320] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Download Branded QR Code PNG"
          >
            <QrCode className="h-4 w-4 text-[#DE8626]" />
            <span>QR Code Only</span>
          </button>

          {/* Print Standee Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] active:scale-[0.98] transition-all"
          >
            <Printer className="h-4 w-4" />
            <span>Print Standee Card ({activeSpec.dimensionsMm})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
