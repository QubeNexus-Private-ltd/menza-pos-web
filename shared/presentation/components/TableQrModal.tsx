import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Share,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import {
  QrCode,
  Printer,
  X,
  Share2,
  Copy,
  Check,
  Clock,
  RotateCw,
  Sparkles,
  FileDown,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { TableRemoteDataSource } from '../../data/datasources/TableRemoteDataSource';
import { TableQrResponseDTO } from '../../domain/models/Table';
import { APP_CONSTANTS } from '../../core/constants/appConstants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const tableDataSource = new TableRemoteDataSource();

export interface TableQrModalProps {
  visible: boolean;
  onClose: () => void;
  tableId: number;
  tableNumber: string | number;
  restaurantName: string;
  restaurantId: number;
  sectionName?: string;
}

export const TableQrModal: React.FC<TableQrModalProps> = ({
  visible,
  onClose,
  tableId,
  tableNumber,
  restaurantName,
  restaurantId,
  sectionName,
}) => {
  const [mode, setMode] = useState<'rolling' | 'sticker'>('rolling');
  const [qrData, setQrData] = useState<TableQrResponseDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 mins default
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);

  // Spin animation for the refresh button
  const spinValue = useRef(new Animated.Value(0)).current;

  const startSpin = () => {
    spinValue.setValue(0);
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 700,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const configuredHost = useMemo(() => {
    return (
      APP_CONSTANTS.CUSTOMER_ORDERING_BASE_URL ||
      'https://menza-order-web.vercel.app'
    ).replace(/\/+$/, '');
  }, []);

  const loadQr = useCallback(async () => {
    if (!tableId || !visible) return;
    setLoading(true);
    startSpin();
    try {
      if (mode === 'rolling') {
        const data = await tableDataSource.getRollingTableQr(tableId, 15, configuredHost);
        setQrData(data);
        setTimeLeft(data?.ttlSeconds ?? 900);
      } else {
        const data = await tableDataSource.getTableQr(tableId, restaurantId, configuredHost);
        setQrData(data);
        setTimeLeft(0);
      }
    } catch (err: any) {
      console.warn('TableQrModal: Failed to fetch QR', err);
    } finally {
      setLoading(false);
    }
  }, [tableId, restaurantId, mode, visible, configuredHost]);

  // Load when modal opens or mode changes
  useEffect(() => {
    if (!visible || !tableId) return;
    loadQr();
  }, [visible, tableId, mode, loadQr]);

  // Rolling countdown timer
  useEffect(() => {
    if (!visible || mode !== 'rolling' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          loadQr();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, mode, timeLeft, loadQr]);

  if (!visible) return null;

  const fallbackCustomerUrl = `${configuredHost}?restId=${restaurantId}&table=${tableNumber}`;
  const customerUrl = qrData?.qrUrl || fallbackCustomerUrl;

  const qrImageSrc = qrData?.qrCodeBase64
    ? qrData.qrCodeBase64.startsWith('data:')
      ? qrData.qrCodeBase64
      : `data:image/png;base64,${qrData.qrCodeBase64}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(customerUrl)}&color=1F2937&bgcolor=FFFFFF&margin=1`;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(customerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Customer Ordering Link', customerUrl);
    }
  };

  const handleShare = async () => {
    try {
      const modeDesc =
        mode === 'rolling'
          ? 'Live Dynamic Table QR (15m Claim Window)'
          : 'Permanent Table Standee';
      const shareMsg = `🍽️ *${restaurantName}* — Table #${tableNumber}${
        sectionName ? ` (${sectionName})` : ''
      }\n✨ *${modeDesc}*\n\n📲 *Scan or Tap to Order Instantly:*\n👉 ${customerUrl}\n\n⚡ _Contactless Dining Powered by Menza Suite_`;

      await Share.share({
        title: `${restaurantName} - Table #${tableNumber} Order Link`,
        message: shareMsg,
        url: customerUrl,
      });
    } catch (err: any) {
      Alert.alert('Share Note', err?.message || 'Could not launch share dialog.');
    }
  };

  const buildStickerHtml = () => {
    const isRolling = mode === 'rolling';
    const secTag = sectionName ? ` • ${sectionName.toUpperCase()}` : '';
    const validityNote = isRolling
      ? 'Valid until current dining bill is settled'
      : 'Permanent Table Standee • Scan to Order';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${restaurantName} - Table ${tableNumber} QR</title>
        <style>
          @page { size: A5 portrait; margin: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #FAF7F2;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: #1E2930;
          }
          .sticker-card {
            width: 380px;
            background: #FFFFFF;
            border-radius: 24px;
            border: 2px dashed #DE8626;
            box-shadow: 0 10px 25px rgba(222, 134, 38, 0.12);
            text-align: center;
            padding: 32px 24px;
            margin: 20px auto;
            box-sizing: border-box;
          }
          .brand-name {
            font-size: 13px;
            font-weight: 800;
            color: #DE8626;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 4px;
          }
          .table-title {
            font-size: 32px;
            font-weight: 900;
            color: #1E2930;
            margin: 0;
            letter-spacing: -0.5px;
          }
          .section-tag {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            background: #FFF0DE;
            color: #D96B14;
            border: 1px solid #FED7AA;
            border-radius: 12px;
            padding: 3px 12px;
            margin-top: 6px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .qr-box {
            background: #FFFFFF;
            border-radius: 20px;
            border: 2px solid #E7E1DA;
            padding: 16px;
            display: inline-block;
            margin: 22px 0 16px 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.04);
          }
          .qr-img {
            width: 230px;
            height: 230px;
            display: block;
          }
          .instructions {
            font-size: 15px;
            font-weight: 800;
            color: #1E2930;
            margin-bottom: 4px;
          }
          .sub-text {
            font-size: 12px;
            color: #667085;
            font-weight: 500;
            margin-bottom: 12px;
          }
          .url-box {
            font-size: 10px;
            font-family: monospace;
            color: #DE8626;
            background: #FAF7F2;
            border: 1px solid #E7E1DA;
            border-radius: 8px;
            padding: 6px 10px;
            word-break: break-all;
          }
          .footer {
            margin-top: 20px;
            font-size: 10px;
            color: #9CA3AF;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
        </style>
      </head>
      <body>
        <div class="sticker-card">
          <div class="brand-name">${restaurantName}</div>
          <h1 class="table-title">TABLE #${tableNumber}</h1>
          ${sectionName ? `<div class="section-tag">${sectionName.toUpperCase()}</div>` : ''}

          <div class="qr-box">
            <img src="${qrImageSrc}" class="qr-img" alt="Table QR" />
          </div>

          <div class="instructions">Scan to View Menu & Order</div>
          <div class="sub-text">${validityNote}</div>
          <div class="url-box">${customerUrl}</div>
          <div class="footer">⚡ Contactless Dining • Powered by Menza Suite</div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    const htmlContent = buildStickerHtml();
    try {
      setGeneratingPdf(true);
      await Print.printAsync({ html: htmlContent });
    } catch (err: any) {
      console.warn('Direct print failed, trying PDF share fallback', err);
      try {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `${restaurantName} Table #${tableNumber} QR Sticker`,
        });
      } catch (innerErr: any) {
        Alert.alert('Print Error', innerErr?.message || 'Could not print QR sticker.');
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setGeneratingPdf(true);
      const htmlContent = buildStickerHtml();
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `${restaurantName} Table #${tableNumber} QR Standee`,
      });
    } catch (err: any) {
      Alert.alert('Download Error', err?.message || 'Could not export standee PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.headerIconCircle}>
                <QrCode size={18} color="#DE8626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Table #{tableNumber} QR</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {restaurantName}
                  {sectionName ? ` • ${sectionName}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={16} color="#667085" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Mode Switcher Tabs */}
            <View style={styles.modeTabsRow}>
              <TouchableOpacity
                onPress={() => setMode('rolling')}
                style={[styles.modeTabBtn, mode === 'rolling' && styles.modeTabBtnActive]}
                activeOpacity={0.8}
              >
                <Clock size={13} color={mode === 'rolling' ? '#DE8626' : '#667085'} />
                <Text style={[styles.modeTabText, mode === 'rolling' && styles.modeTabTextActive]}>
                  Dynamic (15m TTL)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMode('sticker')}
                style={[styles.modeTabBtn, mode === 'sticker' && styles.modeTabBtnActive]}
                activeOpacity={0.8}
              >
                <Printer size={13} color={mode === 'sticker' ? '#DE8626' : '#667085'} />
                <Text style={[styles.modeTabText, mode === 'sticker' && styles.modeTabTextActive]}>
                  Print Sticker
                </Text>
              </TouchableOpacity>
            </View>

            {/* Expiry Banner / Info */}
            {mode === 'rolling' ? (
              <View style={styles.rollingBanner}>
                <View style={styles.rollingBannerLeft}>
                  <Clock size={14} color="#B45309" />
                  <Text style={styles.rollingBannerText}>Valid for order claim:</Text>
                </View>
                <View style={styles.rollingBannerRight}>
                  <Text style={styles.countdownDigit}>{formatCountdown(timeLeft)}</Text>
                  <TouchableOpacity
                    onPress={loadQr}
                    style={styles.refreshBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                      <RotateCw size={13} color="#B45309" />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.stickerBanner}>
                <Text style={styles.stickerBannerText}>
                  📌 <Text style={{ fontWeight: '700' }}>Physical Sticker QR:</Text> Valid for 15 minutes upon initial guest scan; automatically stays active once order is confirmed until the bill is settled or cancelled.
                </Text>
              </View>
            )}

            {/* Standee / Sticker Preview Card */}
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewRestName}>{restaurantName}</Text>
                <Text style={styles.previewTableNum}>TABLE #{tableNumber}</Text>
                {sectionName && (
                  <View style={styles.previewSectionBadge}>
                    <Text style={styles.previewSectionBadgeText}>{sectionName.toUpperCase()}</Text>
                  </View>
                )}
              </View>

              {/* QR Image Box */}
              <View style={styles.qrImageBox}>
                {loading ? (
                  <View style={styles.qrLoaderBox}>
                    <ActivityIndicator size="large" color="#DE8626" />
                    <Text style={styles.qrLoaderText}>Generating Dynamic QR...</Text>
                  </View>
                ) : (
                  <Image source={{ uri: qrImageSrc }} style={styles.qrImage} resizeMode="contain" />
                )}
              </View>

              <View style={styles.previewFooter}>
                <Text style={styles.previewInstruction}>Scan to View Menu & Order</Text>
                <Text style={styles.previewSubInstruction}>
                  {mode === 'rolling' ? 'Valid until bill settlement' : 'Contactless Digital Dining'}
                </Text>
              </View>
            </View>

            {/* Quick Share Link Row */}
            <View style={styles.urlShareRow}>
              <Text style={styles.urlText} numberOfLines={1}>
                {customerUrl}
              </Text>
              <TouchableOpacity onPress={handleCopyLink} style={styles.copyBtn} activeOpacity={0.7}>
                {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} color="#DE8626" />}
                <Text style={[styles.copyBtnText, copied && { color: '#10B981' }]}>
                  {copied ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Actions Grid */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={handleDownloadPdf}
                style={styles.actionBtnSecondary}
                activeOpacity={0.8}
                disabled={generatingPdf}
              >
                {generatingPdf ? (
                  <ActivityIndicator size="small" color="#DE8626" />
                ) : (
                  <>
                    <FileDown size={14} color="#DE8626" />
                    <Text style={styles.actionBtnSecondaryText}>PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                style={styles.actionBtnSecondary}
                activeOpacity={0.8}
              >
                <Share2 size={14} color="#DE8626" />
                <Text style={styles.actionBtnSecondaryText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePrint}
                style={styles.actionBtnPrimary}
                activeOpacity={0.85}
                disabled={generatingPdf}
              >
                <Printer size={15} color="#FFFFFF" />
                <Text style={styles.actionBtnPrimaryText}>
                  Print {mode === 'sticker' ? 'Sticker' : 'QR'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE4',
    backgroundColor: '#FAF7F2',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E2930',
  },
  modalSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#667085',
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 22,
    gap: 12,
  },

  // MODE TABS
  modeTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667085',
  },
  modeTabTextActive: {
    color: '#DE8626',
    fontWeight: '800',
  },

  // BANNERS
  rollingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  rollingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rollingBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
  },
  rollingBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdownDigit: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  refreshBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
  },
  stickerBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  stickerBannerText: {
    fontSize: 11,
    color: '#065F46',
    lineHeight: 16,
  },

  // PREVIEW CARD
  previewCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#FED7AA',
    padding: 18,
    alignItems: 'center',
    gap: 12,
  },
  previewHeader: {
    alignItems: 'center',
  },
  previewRestName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DE8626',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  previewTableNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E2930',
    marginTop: 2,
  },
  previewSectionBadge: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  previewSectionBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#D96B14',
    letterSpacing: 0.5,
  },
  qrImageBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  qrImage: {
    width: 170,
    height: 170,
  },
  qrLoaderBox: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrLoaderText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#667085',
  },
  previewFooter: {
    alignItems: 'center',
  },
  previewInstruction: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E2930',
  },
  previewSubInstruction: {
    fontSize: 10.5,
    color: '#667085',
    marginTop: 2,
  },

  // QUICK URL SHARE
  urlShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  urlText: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 10.5,
    color: '#667085',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
  },
  copyBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DE8626',
  },

  // ACTIONS
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E2930',
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DE8626',
    borderRadius: 12,
    paddingVertical: 10,
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnPrimaryText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
