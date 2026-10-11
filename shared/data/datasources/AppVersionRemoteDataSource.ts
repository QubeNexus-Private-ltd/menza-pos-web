import { Platform } from 'react-native';
import { apiClient } from '../../core/network/apiClient';
import { APP_CONSTANTS } from '../../core/constants/appConstants';
import { logger } from '../../core/logging';
import { AppVersionCheckRequest, AppVersionCheckResponse } from '../../domain/models/AppVersion';

export class AppVersionRemoteDataSource {
  async checkVersion(request?: Partial<AppVersionCheckRequest>): Promise<AppVersionCheckResponse> {
    const platform =
      request?.platform ||
      (Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android');

    const appType = request?.appType || APP_CONSTANTS.APP_TYPE || 'POS_ADMIN';
    const currentVersion = request?.currentVersion || APP_CONSTANTS.APP_VERSION || '1.0.0';
    const currentBuildNumber = request?.currentBuildNumber ?? APP_CONSTANTS.APP_BUILD_NUMBER ?? 1;

    try {
      logger.api(
        'API_REQUEST',
        `Checking App Version: ${appType} on ${platform} (v${currentVersion}, build ${currentBuildNumber})`
      );

      const response = await apiClient.get('/AppVersion/Check', {
        params: {
          appType,
          platform,
          currentVersion,
          currentBuildNumber,
        },
      });

      const raw = response.data?.data ?? response.data ?? {};

      // Parse release notes safely
      let notes: string[] = [];
      if (Array.isArray(raw.releaseNotes)) {
        notes = raw.releaseNotes;
      } else if (typeof raw.releaseNotes === 'string' && raw.releaseNotes.trim()) {
        notes = raw.releaseNotes
          .split(/[\r\n;]+/)
          .map((n: string) => n.trim())
          .filter(Boolean);
      }

      const latestVersion = String(raw.latestVersion || raw.LatestVersion || currentVersion);
      const latestBuildNumber = Number(raw.latestBuildNumber || raw.LatestBuildNumber || currentBuildNumber);
      const minSupportedVersion = String(raw.minSupportedVersion || raw.MinSupportedVersion || currentVersion);
      const minSupportedBuildNumber = Number(raw.minSupportedBuildNumber || raw.MinSupportedBuildNumber || currentBuildNumber);

      const isForceUpdateRequired = Boolean(
        raw.isForceUpdateRequired ??
        raw.IsForceUpdateRequired ??
        (currentBuildNumber < minSupportedBuildNumber)
      );

      const isSoftUpdateAvailable = Boolean(
        raw.isSoftUpdateAvailable ??
        raw.IsSoftUpdateAvailable ??
        (!isForceUpdateRequired && currentBuildNumber < latestBuildNumber)
      );

      const isUpToDate = Boolean(
        raw.isUpToDate ??
        raw.IsUpToDate ??
        (currentBuildNumber >= latestBuildNumber)
      );

      const result: AppVersionCheckResponse = {
        appType: raw.appType || raw.AppType || appType,
        platform: raw.platform || raw.Platform || platform,
        latestVersion,
        latestBuildNumber,
        minSupportedVersion,
        minSupportedBuildNumber,
        isForceUpdateRequired,
        isSoftUpdateAvailable,
        isUpToDate,
        title: raw.title || raw.Title || (isForceUpdateRequired ? 'Critical Update Required' : 'Update Available'),
        message:
          raw.message ||
          raw.Message ||
          (isForceUpdateRequired
            ? 'A mandatory update is required to continue using Menza.'
            : 'A new update is available with performance enhancements.'),
        storeUrl: raw.storeUrl || raw.StoreUrl || APP_CONSTANTS.DEFAULT_STORE_URL,
        releaseNotes: notes,
      };

      logger.api('API_RESPONSE', `App Version Check Result: isForce=${isForceUpdateRequired}, isSoft=${isSoftUpdateAvailable}, isUpToDate=${isUpToDate}`);
      return result;
    } catch (err: any) {
      logger.api('API_ERROR', 'App Version Check failed, falling back to current version info', {
        error: err?.message,
      });

      // Safe offline fallback (allows app to keep functioning without false lockouts)
      return {
        appType,
        platform,
        latestVersion: currentVersion,
        latestBuildNumber: currentBuildNumber,
        minSupportedVersion: currentVersion,
        minSupportedBuildNumber: currentBuildNumber,
        isForceUpdateRequired: false,
        isSoftUpdateAvailable: false,
        isUpToDate: true,
        title: 'App is Up-to-Date',
        message: 'You are running the latest version.',
        storeUrl: APP_CONSTANTS.DEFAULT_STORE_URL,
        releaseNotes: [],
      };
    }
  }
}
