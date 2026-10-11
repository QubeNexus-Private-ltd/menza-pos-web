export interface AppVersionCheckRequest {
  appType: string;
  platform: string;
  currentVersion: string;
  currentBuildNumber: number;
}

export interface AppVersionCheckResponse {
  appType: string;
  platform: string;
  latestVersion: string;
  latestBuildNumber: number;
  minSupportedVersion: string;
  minSupportedBuildNumber: number;
  isForceUpdateRequired: boolean;
  isSoftUpdateAvailable: boolean;
  isUpToDate: boolean;
  title: string;
  message: string;
  storeUrl?: string | null;
  releaseNotes: string[];
}
