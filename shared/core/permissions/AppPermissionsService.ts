import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import { logger } from '../logging';

export interface PermissionsStatus {
  bluetoothGranted: boolean;
  notificationsGranted: boolean;
  cameraGranted: boolean;
  locationGranted: boolean;
}

class AppPermissionsService {
  private static instance: AppPermissionsService;
  private hasPromptedInitial: boolean = false;

  private constructor() {}

  public static getInstance(): AppPermissionsService {
    if (!AppPermissionsService.instance) {
      AppPermissionsService.instance = new AppPermissionsService();
    }
    return AppPermissionsService.instance;
  }

  private getApiLevel(): number {
    return typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(String(Platform.Version), 10) || 0;
  }

  /**
   * Request Bluetooth permissions for thermal printers.
   * - Android 12+ (API 31+): BLUETOOTH_CONNECT, BLUETOOTH_SCAN
   * - Android <= 11 (API <= 30): ACCESS_FINE_LOCATION
   */
  public async requestBluetoothPermissions(showSettingsAlertOnDenial: boolean = true): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const apiLevel = this.getApiLevel();

      if (apiLevel >= 31) {
        const scan = PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN;
        const connect = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;

        const isScanGranted = await PermissionsAndroid.check(scan);
        const isConnectGranted = await PermissionsAndroid.check(connect);

        if (isScanGranted && isConnectGranted) {
          return true;
        }

        const result = await PermissionsAndroid.requestMultiple([scan, connect]);

        const granted =
          result[scan] === PermissionsAndroid.RESULTS.GRANTED &&
          result[connect] === PermissionsAndroid.RESULTS.GRANTED;

        if (!granted && showSettingsAlertOnDenial) {
          this.showPermissionAlert(
            'Bluetooth & Printer Permission Required',
            'Menza requires Nearby Devices / Bluetooth permission to search and connect to your Bluetooth thermal receipt printer. Please enable it in App Settings.'
          );
        }

        return granted;
      } else {
        const fineLocation = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const isLocationGranted = await PermissionsAndroid.check(fineLocation);

        if (isLocationGranted) return true;

        const status = await PermissionsAndroid.request(fineLocation, {
          title: 'Location & Bluetooth Permission',
          message: 'Menza requires Location access to discover nearby Bluetooth thermal printers on your Android version.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        });

        const granted = status === PermissionsAndroid.RESULTS.GRANTED;

        if (!granted && showSettingsAlertOnDenial) {
          this.showPermissionAlert(
            'Location Permission Required',
            'Location access is required by Android to discover nearby Bluetooth printers. Please enable it in App Settings.'
          );
        }

        return granted;
      }
    } catch (err: any) {
      logger.error('SYSTEM', 'BLUETOOTH_PERM_ERROR', err);
      return false;
    }
  }

  /**
   * Request Notification permissions on Android 13+ (API 33+).
   */
  public async requestNotificationPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const apiLevel = this.getApiLevel();
      if (apiLevel >= 33) {
        const postNotification = 'android.permission.POST_NOTIFICATIONS' as any;
        const hasPermission = await PermissionsAndroid.check(postNotification);

        if (hasPermission) return true;

        const status = await PermissionsAndroid.request(postNotification, {
          title: 'Order Notifications',
          message: 'Menza requires notification permissions to alert you when new dine-in or online orders arrive.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not Now',
        });

        return status === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } catch (err: any) {
      logger.warn('SYSTEM', 'NOTIFICATION_PERM_ERROR', err?.message);
      return false;
    }
  }

  /**
   * Request Camera permission for menu item & logo photo capture.
   */
  public async requestCameraPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const camera = PermissionsAndroid.PERMISSIONS.CAMERA;
      const hasPermission = await PermissionsAndroid.check(camera);

      if (hasPermission) return true;

      const status = await PermissionsAndroid.request(camera, {
        title: 'Camera Permission',
        message: 'Menza requires camera access to take dish photos and store logo pictures.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      });

      return status === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  /**
   * Proactively request essential runtime permissions on app launch.
   * Prompts user for Bluetooth/Nearby Devices and Notifications.
   */
  public async requestInitialPermissions(): Promise<void> {
    if (Platform.OS !== 'android') return;
    if (this.hasPromptedInitial) return;
    this.hasPromptedInitial = true;

    try {
      const apiLevel = this.getApiLevel();
      const permsToRequest: any[] = [];

      if (apiLevel >= 31) {
        const scan = PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN;
        const connect = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
        if (!(await PermissionsAndroid.check(scan))) permsToRequest.push(scan);
        if (!(await PermissionsAndroid.check(connect))) permsToRequest.push(connect);
      } else {
        const loc = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        if (!(await PermissionsAndroid.check(loc))) permsToRequest.push(loc);
      }

      if (apiLevel >= 33) {
        const notif = 'android.permission.POST_NOTIFICATIONS';
        if (!(await PermissionsAndroid.check(notif as any))) permsToRequest.push(notif);
      }

      if (permsToRequest.length > 0) {
        logger.info('SYSTEM', 'REQUESTING_INITIAL', `Requesting ${permsToRequest.length} permissions`);
        await PermissionsAndroid.requestMultiple(permsToRequest);
      }
    } catch (err: any) {
      logger.error('SYSTEM', 'INITIAL_PERMS_ERROR', err);
    }
  }

  /**
   * Show alert directing user to phone Settings if permission was permanently denied.
   */
  private showPermissionAlert(title: string, message: string): void {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          Linking.openSettings().catch(() => {});
        },
      },
    ]);
  }
}

export const appPermissions = AppPermissionsService.getInstance();
