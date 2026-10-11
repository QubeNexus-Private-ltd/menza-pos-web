import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getHash, useOtpVerification } from 'react-native-otp-auto-verify';
import { extractOtpFromSms } from '../../core/utils/SmsHashGenerator';
import { logger } from '../../core/logging';

const { DirectSmsModule } = NativeModules;

export interface UseAutoVerifyOtpOptions {
  enabled?: boolean;
  numberOfDigits?: 4 | 5 | 6 | 7 | 8;
  onOtpReceived?: (otp: string) => void;
}

export interface UseAutoVerifyOtpResult {
  isListening: boolean;
  detectedOtp: string | null;
  hashCode: string;
  isAutoDetected: boolean;
  timeoutError: boolean;
  clipboardOtp: string | null;
  hasSmsPermission: boolean;
  requestSmsPermission: () => Promise<boolean>;
  pasteClipboardOtp: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

/**
 * Universal Auto-Verify OTP Hook for Menza OS
 * 
 * Supports:
 * 1. Direct Native Android SMS Interception (ZERO-CLICK, NO SMS HASH REQUIRED)
 * 2. Google SMS Retriever API (zero-click when SMS has 11-char hash)
 * 3. Real-time Clipboard Auto-Detection (Instant notification "Copy OTP" detection)
 * 4. AppState Resume Detection (checks clipboard when returning from SMS app)
 * 5. iOS Security Code AutoFill compatibility
 */
export function useAutoVerifyOtp({
  enabled = false,
  numberOfDigits = 6,
  onOtpReceived,
}: UseAutoVerifyOtpOptions = {}): UseAutoVerifyOtpResult {
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  const [isListeningState, setIsListeningState] = useState(false);
  const [clipboardOtp, setClipboardOtp] = useState<string | null>(null);
  const [hasSmsPermission, setHasSmsPermission] = useState(false);
  const [appHash, setAppHash] = useState<string>('');

  const lastProcessedOtpRef = useRef<string | null>(null);
  const onOtpReceivedRef = useRef(onOtpReceived);
  const isListeningRef = useRef(false);

  useEffect(() => {
    onOtpReceivedRef.current = onOtpReceived;
  }, [onOtpReceived]);

  // Dynamically retrieve the 11-char Android SMS Retriever App Hash
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let isMounted = true;
    const fetchAppHash = async () => {
      try {
        const hashes = await getHash();
        const primaryHash = hashes?.[0] || '';
        if (isMounted && primaryHash) {
          setAppHash(primaryHash);
        }
      } catch (err: any) {
        logger.auth('SMS_RETRIEVER_HASH_ERROR', 'Failed to retrieve SMS Retriever hash dynamically', {
          error: err?.message,
        });
      }
    };

    fetchAppHash();

    return () => {
      isMounted = false;
    };
  }, []);

  // Google SMS Retriever fallback hook
  const {
    otp: retrieverOtp,
    sms: retrieverSms,
    hashCode,
    timeoutError,
    startListening: startRetrieverListening,
    stopListening: stopRetrieverListening,
  } = useOtpVerification({ numberOfDigits });

  const handleDetectedOtp = useCallback(
    (code: string, source: 'DIRECT_SMS' | 'SMS_RETRIEVER' | 'CLIPBOARD') => {
      const cleanCode = (code || '').trim();
      if (!cleanCode || cleanCode.length !== numberOfDigits || cleanCode === lastProcessedOtpRef.current) {
        return;
      }
      lastProcessedOtpRef.current = cleanCode;
      setIsAutoDetected(true);
      setIsListeningState(false);
      logger.auth('SMS_OTP_AUTO_DETECTED', `Auto-detected OTP via ${source}: ${cleanCode}`, {
        source,
      });
      if (onOtpReceivedRef.current) {
        onOtpReceivedRef.current(cleanCode);
      }
    },
    [numberOfDigits]
  );

  // SMS permissions are not requested to comply with Google Play SMS policy.
  // Google SMS Retriever API and clipboard auto-detection are used without runtime permissions.
  const checkSmsPermission = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  const requestSmsPermission = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  // Inspects clipboard for OTP code
  const inspectClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || typeof text !== 'string') return;
      const code = extractOtpFromSms(text, numberOfDigits);
      if (code && code.length === numberOfDigits) {
        setClipboardOtp(code);
        if (code !== lastProcessedOtpRef.current) {
          handleDetectedOtp(code, 'CLIPBOARD');
        }
      }
    } catch {
      // non-fatal
    }
  }, [numberOfDigits, handleDetectedOtp]);

  const pasteClipboardOtp = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const code = extractOtpFromSms(text, numberOfDigits);
      if (code && code.length === numberOfDigits) {
        handleDetectedOtp(code, 'CLIPBOARD');
      }
    } catch {}
  }, [numberOfDigits, handleDetectedOtp]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (DirectSmsModule?.stopListening) {
      try {
        DirectSmsModule.stopListening();
      } catch {}
    }
    try {
      stopRetrieverListening();
    } catch {}
    setIsListeningState(false);
  }, [stopRetrieverListening]);

  const startListening = useCallback(async () => {
    // If already active, cleanly reset state before re-listening
    if (isListeningRef.current) {
      stopListening();
    }
    isListeningRef.current = true;
    lastProcessedOtpRef.current = null;
    setIsAutoDetected(false);
    setIsListeningState(true);

    // 1. Check clipboard immediately
    inspectClipboard();

    if (Platform.OS === 'android') {
      // 2. Direct Native SMS Receiver (if permission was already granted)
      if (DirectSmsModule?.startListening) {
        try {
          const permGranted = await checkSmsPermission();
          if (permGranted) {
            await DirectSmsModule.startListening();
            logger.auth('SMS_RETRIEVER_STARTED', 'Direct SMS native listener started');
          }
        } catch (err: any) {
          logger.auth('SMS_RETRIEVER_START_FAILED', 'Direct SMS start failed', {
            error: err?.message,
          });
        }
      }

      // 3. Google SMS Retriever (Zero user permissions required!)
      try {
        await startRetrieverListening();
      } catch (err: any) {
        logger.auth('SMS_RETRIEVER_START_FAILED', 'Google SMS Retriever start failed', {
          error: err?.message,
        });
      }
    }
  }, [appHash, hashCode, inspectClipboard, checkSmsPermission, startRetrieverListening, stopListening]);

  // Handle enabled changes cleanly without re-render cascades
  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [enabled, startListening, stopListening]);

  // 1. Direct SMS Native Listener Event
  useEffect(() => {
    if (!enabled) return;

    const sub = DeviceEventEmitter.addListener('onSmsReceived', (event: any) => {
      const detected = event?.otp || extractOtpFromSms(event?.message || '', numberOfDigits);
      if (detected && detected.length === numberOfDigits) {
        handleDetectedOtp(detected, 'DIRECT_SMS');
      }
    });

    return () => {
      sub.remove();
    };
  }, [enabled, numberOfDigits, handleDetectedOtp]);

  // 2. Google SMS Retriever Fallback
  useEffect(() => {
    if (!enabled) return;
    let candidateOtp = retrieverOtp;
    if (!candidateOtp && retrieverSms) {
      candidateOtp = extractOtpFromSms(retrieverSms, numberOfDigits);
    }

    if (candidateOtp && candidateOtp.length === numberOfDigits) {
      handleDetectedOtp(candidateOtp, 'SMS_RETRIEVER');
    }
  }, [enabled, retrieverOtp, retrieverSms, numberOfDigits, handleDetectedOtp]);

  // 3. Real-time Clipboard listener & AppState changes
  useEffect(() => {
    if (!enabled) return;

    let clipSub: { remove: () => void } | null = null;
    try {
      clipSub = Clipboard.addClipboardListener(() => {
        inspectClipboard();
      });
    } catch {}

    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        inspectClipboard();
      }
    });

    return () => {
      clipSub?.remove();
      appStateSub.remove();
    };
  }, [enabled, inspectClipboard]);

  return {
    isListening: isListeningState && !timeoutError,
    detectedOtp: retrieverOtp,
    hashCode: appHash || hashCode,
    isAutoDetected,
    timeoutError,
    clipboardOtp,
    hasSmsPermission,
    requestSmsPermission,
    pasteClipboardOtp,
    startListening,
    stopListening,
  };
}
