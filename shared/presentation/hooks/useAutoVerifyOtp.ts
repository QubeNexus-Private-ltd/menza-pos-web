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
import { useOtpVerification } from 'react-native-otp-auto-verify';
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

  const lastProcessedOtpRef = useRef<string | null>(null);

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
      if (!code || code.length !== numberOfDigits || code === lastProcessedOtpRef.current) {
        return;
      }
      lastProcessedOtpRef.current = code;
      setIsAutoDetected(true);
      setIsListeningState(false);
      logger.auth('SMS_OTP_AUTO_DETECTED', `Auto-detected OTP via ${source}: ${code}`, {
        source,
      });
      if (onOtpReceived) {
        onOtpReceived(code);
      }
    },
    [numberOfDigits, onOtpReceived]
  );

  // Check and request SMS permission on Android
  const checkSmsPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;
    try {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
      setHasSmsPermission(granted);
      return granted;
    } catch {
      return false;
    }
  }, []);

  const requestSmsPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        {
          title: 'Auto-Read OTP Verification',
          message: 'Menza needs SMS permission to automatically read your verification code without manual typing.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not Now',
        }
      );
      const isGranted = result === PermissionsAndroid.RESULTS.GRANTED;
      setHasSmsPermission(isGranted);
      if (isGranted && DirectSmsModule?.startListening) {
        try {
          await DirectSmsModule.startListening();
          logger.auth('SMS_RETRIEVER_STARTED', 'Direct SMS receiver active after permission grant');
        } catch {}
      }
      return isGranted;
    } catch {
      return false;
    }
  }, []);

  // Inspects clipboard for OTP code
  const inspectClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || typeof text !== 'string') return;
      const code = extractOtpFromSms(text);
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
      const code = extractOtpFromSms(text);
      if (code && code.length === numberOfDigits) {
        handleDetectedOtp(code, 'CLIPBOARD');
      }
    } catch {}
  }, [numberOfDigits, handleDetectedOtp]);

  const startListening = useCallback(async () => {
    lastProcessedOtpRef.current = null;
    setIsAutoDetected(false);
    setIsListeningState(true);

    // 1. Check clipboard immediately
    inspectClipboard();

    if (Platform.OS === 'android') {
      // 2. Direct Native SMS Receiver (Works for standard SMS without hash!)
      if (DirectSmsModule?.startListening) {
        try {
          const permGranted = await checkSmsPermission();
          if (permGranted) {
            await DirectSmsModule.startListening();
            logger.auth('SMS_RETRIEVER_STARTED', 'Direct SMS native listener started');
          } else {
            // Prompt once for seamless zero-click auto-read
            requestSmsPermission();
          }
        } catch (err: any) {
          logger.auth('SMS_RETRIEVER_START_FAILED', 'Direct SMS start failed', {
            error: err?.message,
          });
        }
      }

      // 3. Google SMS Retriever (Runs concurrently if SMS has hash)
      try {
        await startRetrieverListening();
      } catch {}
    }
  }, [inspectClipboard, checkSmsPermission, requestSmsPermission, startRetrieverListening]);

  const stopListening = useCallback(() => {
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

  // Handle enabled changes
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
      const detected = event?.otp || extractOtpFromSms(event?.message || '');
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
    let candidateOtp = retrieverOtp;
    if (!candidateOtp && retrieverSms) {
      candidateOtp = extractOtpFromSms(retrieverSms);
    }

    if (candidateOtp && candidateOtp.length === numberOfDigits) {
      handleDetectedOtp(candidateOtp, 'SMS_RETRIEVER');
    }
  }, [retrieverOtp, retrieverSms, numberOfDigits, handleDetectedOtp]);

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
    hashCode,
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
