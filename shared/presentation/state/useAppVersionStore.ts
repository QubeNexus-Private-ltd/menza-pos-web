import { create } from 'zustand';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONSTANTS } from '../../core/constants/appConstants';
import { logger } from '../../core/logging';
import { AppVersionCheckResponse } from '../../domain/models/AppVersion';
import { AppVersionRemoteDataSource } from '../../data/datasources/AppVersionRemoteDataSource';
import { AppVersionRepositoryImpl } from '../../data/repositories/AppVersionRepositoryImpl';

const STORAGE_KEYS = {
  DISMISSED_VERSION: '@menza_dismissed_soft_update_version',
  LAST_CHECK_TIMESTAMP: '@menza_last_version_check_ts',
};

const repository = new AppVersionRepositoryImpl(new AppVersionRemoteDataSource());

export interface AppVersionState {
  updateInfo: AppVersionCheckResponse | null;
  isChecking: boolean;
  isModalVisible: boolean;
  dismissedVersion: string | null;
  lastCheckedAt: number | null;
  checkError: string | null;

  // Actions
  init: () => Promise<void>;
  checkAppVersion: (isManualCheck?: boolean) => Promise<AppVersionCheckResponse | null>;
  dismissSoftUpdate: () => Promise<void>;
  showUpdateModal: () => void;
  hideUpdateModal: () => void;
  openStoreUrl: () => Promise<boolean>;
}

export const useAppVersionStore = create<AppVersionState>((set, get) => ({
  updateInfo: null,
  isChecking: false,
  isModalVisible: false,
  dismissedVersion: null,
  lastCheckedAt: null,
  checkError: null,

  init: async () => {
    try {
      const [savedDismissed, savedTs] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.DISMISSED_VERSION),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_CHECK_TIMESTAMP),
      ]);

      set({
        dismissedVersion: savedDismissed,
        lastCheckedAt: savedTs ? parseInt(savedTs, 10) : null,
      });
    } catch {
      // non-fatal
    }
  },

  checkAppVersion: async (isManualCheck = false) => {
    if (get().isChecking) return get().updateInfo;

    try {
      set({ isChecking: true, checkError: null });
      logger.info('SYSTEM', 'CHECKING_APP_VERSION', 'Querying backend for app version update requirements', {
        currentVersion: APP_CONSTANTS.APP_VERSION,
        currentBuild: APP_CONSTANTS.APP_BUILD_NUMBER,
        isManualCheck,
      });

      const response = await repository.checkVersion({
        currentVersion: APP_CONSTANTS.APP_VERSION,
        currentBuildNumber: APP_CONSTANTS.APP_BUILD_NUMBER,
      });

      const now = Date.now();
      const dismissed = get().dismissedVersion;

      // Determine modal visibility
      let shouldShowModal = false;
      if (response.isForceUpdateRequired) {
        // Hard update: Always display and enforce blocking modal
        shouldShowModal = true;
      } else if (response.isSoftUpdateAvailable) {
        // Soft update: Show if manually requested OR if this version hasn't been dismissed yet
        if (isManualCheck) {
          shouldShowModal = true;
        } else if (response.latestVersion !== dismissed) {
          shouldShowModal = true;
        }
      }

      set({
        updateInfo: response,
        isModalVisible: shouldShowModal,
        lastCheckedAt: now,
        isChecking: false,
      });

      try {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECK_TIMESTAMP, now.toString());
      } catch {}

      return response;
    } catch (err: any) {
      logger.error('SYSTEM', 'CHECKING_APP_VERSION_FAILED', err, {
        error: err?.message,
      });
      set({ isChecking: false, checkError: err?.message || 'Check failed' });
      return null;
    }
  },

  dismissSoftUpdate: async () => {
    const { updateInfo } = get();
    // Never allow dismissing a hard update
    if (updateInfo?.isForceUpdateRequired) return;

    const latest = updateInfo?.latestVersion || null;
    set({ isModalVisible: false, dismissedVersion: latest });

    if (latest) {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.DISMISSED_VERSION, latest);
      } catch {}
    }
  },

  showUpdateModal: () => {
    if (get().updateInfo) {
      set({ isModalVisible: true });
    }
  },

  hideUpdateModal: () => {
    if (get().updateInfo?.isForceUpdateRequired) return;
    set({ isModalVisible: false });
  },

  openStoreUrl: async () => {
    const { updateInfo } = get();
    const targetUrl =
      updateInfo?.storeUrl ||
      APP_CONSTANTS.DEFAULT_STORE_URL ||
      'https://play.google.com/store/apps/details?id=com.anonymous.MenzaAdmin';

    try {
      logger.info('SYSTEM', 'OPENING_STORE_URL', `Opening update URL: ${targetUrl}`);
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (canOpen) {
        await Linking.openURL(targetUrl);
        return true;
      } else {
        // Fallback to generic browser search if custom scheme fails
        await Linking.openURL('https://play.google.com/store/apps/details?id=com.anonymous.MenzaAdmin');
        return true;
      }
    } catch (err: any) {
      logger.error('SYSTEM', 'OPENING_STORE_URL_FAILED', err, {
        error: err?.message,
        targetUrl,
      });
      return false;
    }
  },
}));
