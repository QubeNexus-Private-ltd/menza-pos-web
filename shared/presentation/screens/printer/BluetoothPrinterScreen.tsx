import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Image,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Printer,
  Bluetooth,
  BluetoothOff,
  BluetoothSearching,
  RefreshCw,
  Check,
  AlertCircle,
  Power,
  FileText,
  Sliders,
  X,
  ChevronRight,
  Info,
} from 'lucide-react-native';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { usePrinterStore } from '../../state/usePrinterStore';
import { useAuthStore } from '../../state/useAuthStore';
import { BluetoothPrinterService, BluetoothDevice } from '../../../data/datasources/BluetoothPrinterService';
import { logger } from '../../../core/logging';
import { appPermissions } from '../../../core/permissions/AppPermissionsService';

interface BluetoothPrinterScreenProps {
  onClose: () => void;
}

export const BluetoothPrinterScreen: React.FC<BluetoothPrinterScreenProps> = ({ onClose }) => {
  const { activeRestaurant } = useAuthStore();
  const {
    connectedDevice,
    pairedDevices,
    discoveredDevices,
    isBluetoothEnabled,
    isScanning,
    isConnecting,
    isPrinting,
    paperWidth,
    autoPrintReceipt,
    autoPrintKot,
    customFooter,
    init,
    checkStatus,
    enableBluetooth,
    openBluetoothSettings,
    scanDevices,
    connectDevice,
    disconnectDevice,
    setPaperWidth,
    setAutoPrintReceipt,
    setAutoPrintKot,
    setCustomFooter,
    printTestReceipt,
    printTestKot,
  } = usePrinterStore();

  const [localFooter, setLocalFooter] = useState(customFooter);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);

  useEffect(() => {
    logger.navigation('BluetoothPrinterScreen');

    const setup = async () => {
      // 1. Proactively request Bluetooth permissions first so Android 12+ allows reading Bluetooth state
      await appPermissions.requestBluetoothPermissions(false);
      await init();
      await checkStatus();
    };

    setup();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkStatus();
      }
    });

    // Gently poll Bluetooth state every 2.5s while this screen is mounted
    // so turning on Bluetooth in notification shade or quick settings is instantly reflected.
    const interval = setInterval(() => {
      checkStatus();
    }, 2500);

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [init, checkStatus]);

  useEffect(() => {
    setLocalFooter(customFooter);
  }, [customFooter]);

  const handleTurnOnBluetooth = async () => {
    try {
      const granted = await appPermissions.requestBluetoothPermissions(true);
      if (!granted) {
        return;
      }

      await checkStatus();
      if (usePrinterStore.getState().isBluetoothEnabled) {
        return;
      }

      await enableBluetooth();
      setTimeout(async () => {
        await checkStatus();
      }, 1500);
    } catch {
      Alert.alert(
        'Turn On Bluetooth',
        'Could not automatically enable Bluetooth. Please turn on Bluetooth in Phone Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => openBluetoothSettings() },
        ]
      );
    }
  };

  const handleScan = async () => {
    const granted = await appPermissions.requestBluetoothPermissions(true);
    if (!granted) {
      return;
    }

    await checkStatus();
    const isEnabled = usePrinterStore.getState().isBluetoothEnabled;
    if (!isEnabled) {
      Alert.alert(
        'Bluetooth is Turned Off',
        'Please turn on your Bluetooth to scan and connect with your thermal printer.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Turn On Bluetooth', onPress: handleTurnOnBluetooth },
        ]
      );
      return;
    }

    try {
      await scanDevices();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Bluetooth is turned off')) {
        Alert.alert(
          'Bluetooth is Turned Off',
          'Please turn on your Bluetooth to scan and connect with your thermal printer.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Turn On Bluetooth', onPress: handleTurnOnBluetooth },
          ]
        );
      } else {
        Alert.alert(
          'Scan Notice',
          msg || 'Please ensure Bluetooth and Location permissions are enabled on your device.'
        );
      }
    }
  };

  const handleConnect = async (device: BluetoothDevice) => {
    const printerService = BluetoothPrinterService.getInstance();
    const hasPerm = await printerService.hasPermissions();
    if (!hasPerm) {
      await printerService.requestPermissions();
    }
    await checkStatus();
    const isEnabled = usePrinterStore.getState().isBluetoothEnabled;
    if (!isEnabled) {
      Alert.alert(
        'Bluetooth is Turned Off',
        'Please turn on your Bluetooth before connecting to the printer.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Turn On Bluetooth', onPress: handleTurnOnBluetooth },
        ]
      );
      return;
    }

    try {
      setConnectingAddress(device.address);
      const success = await connectDevice(device);
      if (success) {
        Alert.alert(
          'Printer Connected! 🖨️',
          `Successfully connected with "${device.name || 'Thermal Printer'}". Ready for receipt & KOT printing.`
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Connection Failed',
        err?.message || 'Could not establish connection to the printer. Please make sure it is turned on and in range.'
      );
    } finally {
      setConnectingAddress(null);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Printer',
      `Are you sure you want to disconnect from ${connectedDevice?.name || 'this printer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnectDevice();
          },
        },
      ]
    );
  };

  const handleTestPrint = async () => {
    if (!connectedDevice) {
      Alert.alert('No Printer Connected', 'Please select and connect a printer from the list below first.');
      return;
    }

    try {
      const ok = await printTestReceipt(activeRestaurant?.restaurantName || 'Menza Bistro');
      if (ok) {
        Alert.alert('Receipt Printed! ✅', 'Test customer receipt was successfully sent to the thermal printer.');
      }
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Failed to print test receipt. Check if paper roll is loaded.');
    }
  };

  const handleTestKot = async () => {
    if (!connectedDevice) {
      Alert.alert('No Printer Connected', 'Please select and connect a printer from the list below first.');
      return;
    }

    try {
      const ok = await printTestKot(activeRestaurant?.restaurantName || 'Menza Bistro');
      if (ok) {
        Alert.alert('KOT Ticket Printed! 🖨️', 'Test Kitchen Order Ticket (KOT) was successfully sent to the printer.');
      }
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Failed to print test KOT ticket. Check printer connection.');
    }
  };

  const handleSaveFooter = async () => {
    await setCustomFooter(localFooter.trim());
    Alert.alert('Saved', 'Receipt footer message updated.');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />
      <View style={styles.container}>
      {/* TOP STREAMLINED UNIFIED HEADER (Identical to HomePage) */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <Image
            source={
              activeRestaurant?.logoUrl && activeRestaurant.logoUrl.trim().length > 0
                ? { uri: activeRestaurant.logoUrl.trim() }
                : (activeRestaurant as any)?.logo && (activeRestaurant as any).logo.trim().length > 0
                ? { uri: (activeRestaurant as any).logo.trim() }
                : require('../../../../assets/menza-logo.png')
            }
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.headerOutletTitle} numberOfLines={1}>
              {activeRestaurant?.restaurantName || 'Menza Bistro'}
            </Text>
            <Text style={styles.headerOutletSubtitle} numberOfLines={1}>
              Thermal Receipt Printer • Bluetooth
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.75}>
          <X size={16} color="#8C7A6B" />
        </TouchableOpacity>
      </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* BLUETOOTH OFF ALERT BANNER */}
          {!isBluetoothEnabled && (
            <View style={styles.bluetoothOffCard}>
              <View style={styles.bluetoothOffTopRow}>
                <View style={styles.bluetoothOffIconBox}>
                  <BluetoothOff size={22} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bluetoothOffTitle}>Bluetooth is Turned Off</Text>
                  <Text style={styles.bluetoothOffDesc}>
                    Please turn on Bluetooth to discover and connect with your mobile thermal printer.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.turnOnBtBtn}
                onPress={handleTurnOnBluetooth}
                activeOpacity={0.85}
              >
                <Bluetooth size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.turnOnBtBtnText}>Turn On Bluetooth</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 1. CONNECTION STATUS CARD */}
          {connectedDevice ? (
            <View style={styles.connectedCard}>
              <LinearGradient
                colors={['#E4F5EC', '#FFFFFF']}
                style={styles.connectedCardGradient}
              >
                <View style={styles.connectedTopRow}>
                  <View style={styles.connectedBadgeRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.connectedBadgeText}>PRINTER CONNECTED & READY</Text>
                  </View>
                  <View style={styles.paperBadge}>
                    <Text style={styles.paperBadgeText}>{paperWidth.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.printerDeviceInfoRow}>
                  <View style={styles.printerIconCircle}>
                    <Printer size={26} color="#17845A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.printerDeviceName}>
                      {connectedDevice.name || 'Mobile Thermal Printer'}
                    </Text>
                    <Text style={styles.printerDeviceAddress}>
                      MAC: {connectedDevice.address}
                    </Text>
                  </View>
                </View>

                <View style={styles.connectedActionsRow}>
                  <TouchableOpacity
                    style={styles.testPrintBtn}
                    onPress={handleTestPrint}
                    disabled={isPrinting}
                    activeOpacity={0.85}
                  >
                    {isPrinting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <FileText size={15} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.testPrintBtnText}>Test Receipt</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.testKotBtn}
                    onPress={handleTestKot}
                    disabled={isPrinting}
                    activeOpacity={0.85}
                  >
                    {isPrinting ? (
                      <ActivityIndicator size="small" color="#DE8626" />
                    ) : (
                      <>
                        <Printer size={15} color="#DE8626" strokeWidth={2.2} />
                        <Text style={styles.testKotBtnText}>Test KOT</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.disconnectBtn}
                    onPress={handleDisconnect}
                    activeOpacity={0.8}
                  >
                    <Power size={15} color="#DC2626" />
                    <Text style={styles.disconnectBtnText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.disconnectedCard}>
              <View style={styles.disconnectedTopRow}>
                <View style={styles.offlineDot} />
                <Text style={styles.disconnectedBadgeText}>NO PRINTER CONNECTED</Text>
              </View>
              <Text style={styles.disconnectedTitle}>Connect a Mobile Thermal Printer</Text>
              <Text style={styles.disconnectedDesc}>
                Pair with any 58mm or 80mm Bluetooth ESC/POS receipt printer to automatically print order bills and kitchen KOT tickets.
              </Text>
            </View>
          )}

          {/* 2. SCAN & DISCOVER PRINTERS */}
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Bluetooth size={16} color="#DE8626" />
              <Text style={styles.sectionHeading}>NEARBY BLUETOOTH DEVICES</Text>
            </View>
            <TouchableOpacity
              style={[styles.scanBtn, isScanning && styles.scanBtnDisabled]}
              onPress={handleScan}
              disabled={isScanning}
              activeOpacity={0.85}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color="#DE8626" />
              ) : (
                <>
                  <RefreshCw size={13} color="#D96B14" />
                  <Text style={styles.scanBtnText}>Scan Devices</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* DISCOVERED DEVICES LIST */}
          <View style={styles.devicesContainer}>
            {!isBluetoothEnabled ? (
              <View style={styles.bluetoothOffListBox}>
                <View style={styles.bluetoothOffCircle}>
                  <BluetoothOff size={32} color="#DC2626" />
                </View>
                <Text style={styles.bluetoothOffListTitle}>Bluetooth is Turned Off</Text>
                <Text style={styles.bluetoothOffListDesc}>
                  Please turn on your phone's Bluetooth to discover and connect with thermal printers.
                </Text>
                <TouchableOpacity
                  style={styles.turnOnBtListBtn}
                  onPress={handleTurnOnBluetooth}
                  activeOpacity={0.85}
                >
                  <Bluetooth size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.turnOnBtListBtnText}>Turn On Bluetooth</Text>
                </TouchableOpacity>
              </View>
            ) : isScanning && discoveredDevices.length === 0 ? (
              <View style={styles.scanningBox}>
                <ActivityIndicator size="large" color="#DE8626" />
                <Text style={styles.scanningText}>Searching for nearby Bluetooth printers...</Text>
                <Text style={styles.scanningSub}>Make sure your printer is powered ON and in pairing mode.</Text>
              </View>
            ) : discoveredDevices.length === 0 ? (
              <View style={styles.emptyDevicesBox}>
                <BluetoothSearching size={36} color="#9CA3AF" />
                <Text style={styles.emptyDevicesTitle}>No Bluetooth Printers Found Yet</Text>
                <Text style={styles.emptyDevicesDesc}>
                  Tap "Scan Devices" above to discover nearby thermal printers, or pair your printer in phone Bluetooth settings first.
                </Text>
              </View>
            ) : (
              discoveredDevices.map((device, index) => {
                const isThisConnected = connectedDevice?.address === device.address;
                const isThisConnecting = connectingAddress === device.address;

                return (
                  <TouchableOpacity
                    key={`${device.address}-${index}`}
                    style={[
                      styles.deviceCard,
                      isThisConnected && styles.deviceCardConnected,
                    ]}
                    onPress={() => handleConnect(device)}
                    disabled={isThisConnecting || isThisConnected}
                    activeOpacity={0.8}
                  >
                    <View style={styles.deviceCardLeft}>
                      <View
                        style={[
                          styles.deviceCardIcon,
                          isThisConnected && styles.deviceCardIconActive,
                        ]}
                      >
                        <Printer
                          size={18}
                          color={isThisConnected ? '#17845A' : '#7C6F62'}
                        />
                      </View>
                      <View>
                        <Text style={styles.deviceNameText}>
                          {device.name || 'Unnamed Bluetooth Device'}
                        </Text>
                        <Text style={styles.deviceAddressText}>
                          {device.address} {device.isPaired ? '• Paired' : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.deviceCardRight}>
                      {isThisConnecting ? (
                        <ActivityIndicator size="small" color="#DE8626" />
                      ) : isThisConnected ? (
                        <View style={styles.connectedPill}>
                          <Check size={12} color="#17845A" />
                          <Text style={styles.connectedPillText}>CONNECTED</Text>
                        </View>
                      ) : (
                        <View style={styles.connectPill}>
                          <Text style={styles.connectPillText}>CONNECT</Text>
                          <ChevronRight size={14} color="#DE8626" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* 3. RECEIPT & PAPER SETTINGS */}
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Sliders size={16} color="#DE8626" />
              <Text style={styles.sectionHeading}>RECEIPT & PAPER SETTINGS</Text>
            </View>
          </View>

          <View style={styles.settingsBox}>
            {/* Paper Width Selection */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Thermal Paper Width</Text>
                <Text style={styles.settingDesc}>
                  Select 58mm (2-inch mobile) or 80mm (3-inch wide desktop)
                </Text>
              </View>
              <View style={styles.paperWidthToggleGroup}>
                <TouchableOpacity
                  style={[
                    styles.paperToggleBtn,
                    paperWidth === '58mm' && styles.paperToggleBtnActive,
                  ]}
                  onPress={() => setPaperWidth('58mm')}
                >
                  <Text
                    style={[
                      styles.paperToggleBtnText,
                      paperWidth === '58mm' && styles.paperToggleBtnTextActive,
                    ]}
                  >
                    58mm (2")
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.paperToggleBtn,
                    paperWidth === '80mm' && styles.paperToggleBtnActive,
                  ]}
                  onPress={() => setPaperWidth('80mm')}
                >
                  <Text
                    style={[
                      styles.paperToggleBtnText,
                      paperWidth === '80mm' && styles.paperToggleBtnTextActive,
                    ]}
                  >
                    80mm (3")
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Auto Print Receipt Toggle */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingTitle}>Auto-Print Customer Receipt</Text>
                <Text style={styles.settingDesc}>
                  Automatically send receipt to printer upon placing order in POS
                </Text>
              </View>
              <Switch
                value={autoPrintReceipt}
                onValueChange={(val) => setAutoPrintReceipt(val)}
                trackColor={{ false: '#E7E1DA', true: '#DE8626' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Auto Print KOT Toggle */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.settingTitle}>Auto-Print Kitchen Slip (KOT)</Text>
                  {autoPrintKot ? (
                    <View style={styles.paperBadge}>
                      <Text style={styles.paperBadgeText}>ENABLED</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.settingDesc}>
                  Automatically print a bifurcated KOT ticket with paper cut for kitchen staff on POS checkout
                </Text>
              </View>
              <Switch
                value={autoPrintKot}
                onValueChange={(val) => setAutoPrintKot(val)}
                trackColor={{ false: '#E7E1DA', true: '#17845A' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Custom Footer Message Input */}
            <View style={[styles.settingRow, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'stretch' }]}>
              <Text style={styles.settingTitle}>Custom Receipt Footer Note</Text>
              <Text style={styles.settingDesc}>
                Printed at the bottom of customer receipts (e.g. WiFi password, thank you message)
              </Text>
              <View style={styles.footerInputRow}>
                <TextInput
                  style={styles.footerInput}
                  value={localFooter}
                  onChangeText={setLocalFooter}
                  placeholder="Thank you for dining with us! Please visit again."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={2}
                />
                <TouchableOpacity
                  style={styles.saveFooterBtn}
                  onPress={handleSaveFooter}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveFooterBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 4. SETUP & PAIRING GUIDE */}
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeaderRow}>
              <Info size={16} color="#DE8626" />
              <Text style={styles.tipsHeaderTitle}>Printer Setup & Pairing Guide</Text>
            </View>
            <Text style={styles.tipsBullet}>
              • Thermal printers can only be connected to <Text style={{ fontWeight: 'bold' }}>1 phone at a time</Text>. If connected to another phone, disconnect it first.
            </Text>
            <Text style={styles.tipsBullet}>
              • On older Android phones, pair the printer in <Text style={{ fontWeight: 'bold' }}>Phone Settings → Bluetooth</Text> first (PIN: <Text style={{ color: '#DE8626', fontWeight: 'bold' }}>0000</Text> or <Text style={{ color: '#DE8626', fontWeight: 'bold' }}>1234</Text>).
            </Text>
            <Text style={styles.tipsBullet}>
              • If connection times out, turn the printer power OFF, wait 3 seconds, turn ON and tap Connect again.
            </Text>
            <Text style={styles.tipsBullet}>
              • Once connected, Menza remembers your printer and reconnects automatically.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1.2,
    borderBottomColor: '#E7E1DA',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  headerOutletTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerOutletSubtitle: {
    color: '#78716C',
    fontSize: 11,
    fontWeight: '500',
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
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  bluetoothOffCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    borderWidth: 1.2,
    borderColor: '#FCA5A5',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 4,
  },
  bluetoothOffTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  bluetoothOffIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bluetoothOffTitle: {
    color: '#991B1B',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bluetoothOffDesc: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  turnOnBtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  turnOnBtBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bluetoothOffListBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    borderWidth: 1.2,
    borderColor: '#FECACA',
  },
  bluetoothOffCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  bluetoothOffListTitle: {
    color: '#991B1B',
    fontSize: Typography.fontSize.body1,
    fontWeight: '800',
    marginBottom: 6,
  },
  bluetoothOffListDesc: {
    color: '#7F1D1D',
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 16,
  },
  turnOnBtListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  turnOnBtListBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  connectedCard: {
    borderRadius: Spacing.borderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.35)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  connectedCardGradient: {
    padding: Spacing.md,
  },
  connectedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  connectedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#17845A',
  },
  connectedBadgeText: {
    color: '#17845A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  paperBadge: {
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.4)',
  },
  paperBadgeText: {
    color: '#17845A',
    fontSize: 10,
    fontWeight: '800',
  },
  printerDeviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  printerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E4F5EC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.3)',
  },
  printerDeviceName: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h3,
    fontWeight: '700',
  },
  printerDeviceAddress: {
    color: '#5C4E3D',
    fontSize: 12,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  connectedActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  testPrintBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DE8626',
    height: 40,
    borderRadius: 8,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  testPrintBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  testKotBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF0DE',
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
  },
  testKotBtnText: {
    color: '#DE8626',
    fontSize: 12,
    fontWeight: '700',
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  disconnectBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  disconnectedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  disconnectedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  disconnectedBadgeText: {
    color: '#7C6F62',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disconnectedTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body1,
    fontWeight: '700',
    marginBottom: 4,
  },
  disconnectedDesc: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  sectionHeading: {
    color: '#7C6F62',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  scanBtnDisabled: {
    opacity: 0.5,
  },
  scanBtnText: {
    color: '#D96B14',
    fontSize: 11,
    fontWeight: '700',
  },
  devicesContainer: {
    gap: 8,
  },
  scanningBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 10,
  },
  scanningText: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body2,
    fontWeight: '700',
    textAlign: 'center',
  },
  scanningSub: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
  },
  emptyDevicesBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 8,
  },
  emptyDevicesTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body2,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyDevicesDesc: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    borderRadius: Spacing.borderRadius.card,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  deviceCardConnected: {
    borderColor: 'rgba(23, 132, 90, 0.4)',
    backgroundColor: '#E4F5EC',
  },
  deviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  deviceCardIconActive: {
    backgroundColor: '#E4F5EC',
    borderColor: 'rgba(23, 132, 90, 0.3)',
  },
  deviceNameText: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body2,
    fontWeight: '700',
  },
  deviceAddressText: {
    color: '#7C6F62',
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  deviceCardRight: {
    paddingLeft: 8,
  },
  connectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  connectPillText: {
    color: '#D96B14',
    fontSize: 11,
    fontWeight: '800',
  },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.3)',
  },
  connectedPillText: {
    color: '#17845A',
    fontSize: 10,
    fontWeight: '800',
  },
  settingsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    overflow: 'hidden',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
  },
  settingTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body2,
    fontWeight: '700',
  },
  settingDesc: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  paperWidthToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F2',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  paperToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  paperToggleBtnActive: {
    backgroundColor: '#FFF0DE',
  },
  paperToggleBtnText: {
    color: '#7C6F62',
    fontSize: 11,
    fontWeight: '700',
  },
  paperToggleBtnTextActive: {
    color: '#D96B14',
    fontWeight: '800',
  },
  footerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  footerInput: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderRadius: Spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    color: '#1F2937',
    fontSize: Typography.fontSize.body2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  saveFooterBtn: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    borderRadius: Spacing.borderRadius.md,
    height: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveFooterBtnText: {
    color: '#D96B14',
    fontSize: 12,
    fontWeight: '700',
  },
  tipsCard: {
    backgroundColor: '#FFF0DE',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  tipsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  tipsHeaderTitle: {
    color: '#D96B14',
    fontSize: Typography.fontSize.body2,
    fontWeight: '700',
  },
  tipsBullet: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
    marginBottom: 4,
  },
});
