import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react-native';

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
        return <AlertTriangle size={28} color="#DC2626" />;
      case 'warning':
        return <AlertCircle size={28} color="#FEA619" />;
      case 'info':
        return <Info size={28} color="#346CB0" />;
      case 'success':
      default:
        return <Sparkles size={28} color="#DE8626" />;
    }
  };

  const getBadgeBg = () => {
    switch (type) {
      case 'danger':
        return { backgroundColor: '#FEE2E2', borderColor: '#FECACA' };
      case 'warning':
        return { backgroundColor: '#FFF3DC', borderColor: 'rgba(254, 166, 25, 0.45)' };
      case 'info':
        return { backgroundColor: '#EBF5FF', borderColor: 'rgba(52, 108, 176, 0.3)' };
      case 'success':
      default:
        return { backgroundColor: '#FFF0DE', borderColor: 'rgba(222, 134, 38, 0.3)' };
    }
  };

  const badgeStyle = getBadgeBg();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCard}>
              {/* Close Cross */}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color="#8C7A6B" />
              </TouchableOpacity>

              {/* Icon Badge */}
              <View style={[styles.badgeCircle, { backgroundColor: badgeStyle.backgroundColor, borderColor: badgeStyle.borderColor }]}>
                {getBadgeIcon()}
              </View>

              {/* Content */}
              <Text style={styles.titleText}>{title}</Text>
              <Text style={styles.messageText}>{message}</Text>

              {/* Action Buttons */}
              <View style={styles.btnRow}>
                {cancelText && (
                  <TouchableOpacity activeOpacity={0.8} style={styles.cancelBtn} onPress={handleCancel}>
                    <Text style={styles.cancelBtnText}>{cancelText}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity activeOpacity={0.88} style={[styles.confirmBtnWrapper, !cancelText && { width: '100%' }]} onPress={handleConfirm}>
                  <LinearGradient
                    colors={
                      type === 'danger'
                        ? ['#ef4444', '#dc2626']
                        : ['#F59E0B', '#E58B24', '#DE8626', '#CB741B']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.confirmBtnGradient}
                  >
                    <CheckCircle2 size={16} color="#FFFFFF" />
                    <Text style={styles.confirmBtnText}>
                      {confirmText}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 20, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  titleText: {
    color: '#1F2937',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  messageText: {
    color: '#5C4E3D',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  confirmBtnWrapper: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  confirmBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
