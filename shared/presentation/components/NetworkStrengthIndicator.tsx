import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  Wifi,
  WifiHigh,
  WifiLow,
  WifiZero,
  WifiOff,
} from 'lucide-react-native';
import axios from 'axios';
import { APP_CONSTANTS } from '../../core/constants/appConstants';

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

interface NetworkState {
  quality: NetworkQuality;
  latencyMs: number;
  lastChecked: Date;
  isChecking: boolean;
}

interface NetworkStrengthIndicatorProps {
  size?: number;
  showBadge?: boolean;
  showLatencyLabel?: boolean;
}

export const NetworkStrengthIndicator: React.FC<NetworkStrengthIndicatorProps> = ({
  size = 18,
  showBadge = false,
  showLatencyLabel = false,
}) => {
  const [network, setNetwork] = useState<NetworkState>({
    quality: 'excellent',
    latencyMs: 45,
    lastChecked: new Date(),
    isChecking: false,
  });

  const timerRef = useRef<any>(null);

  const checkNetworkLatency = useCallback(async () => {
    const startTime = Date.now();
    let success = false;
    let elapsed = 0;

    // List of ultra-reliable global zero-payload CDN connectivity endpoints (0 server cost)
    const endpoints = [
      `https://connectivitycheck.gstatic.com/generate_204?_t=${startTime}`,
      `https://www.google.com/generate_204?_t=${startTime}`,
      `https://1.1.1.1/cdn-cgi/trace?_t=${startTime}`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' },
        });

        clearTimeout(timeoutId);

        if (response.status >= 200 && response.status < 500) {
          elapsed = Date.now() - startTime;
          success = true;
          break;
        }
      } catch {
        // Try next endpoint in sequence
      }
    }

    if (success) {
      let quality: NetworkQuality = 'excellent';
      if (elapsed <= 180) {
        quality = 'excellent';
      } else if (elapsed <= 420) {
        quality = 'good';
      } else if (elapsed <= 900) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }

      setNetwork({
        quality,
        latencyMs: elapsed,
        lastChecked: new Date(),
        isChecking: false,
      });
    } else {
      setNetwork({
        quality: 'offline',
        latencyMs: -1,
        lastChecked: new Date(),
        isChecking: false,
      });
    }
  }, []);

  useEffect(() => {
    checkNetworkLatency();

    // Low-frequency heartbeat: check once every 60 seconds (or immediately on app resume)
    timerRef.current = setInterval(checkNetworkLatency, 60000);

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkNetworkLatency();
      }
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      subscription.remove();
    };
  }, [checkNetworkLatency]);

  const getQualityDetails = () => {
    switch (network.quality) {
      case 'excellent':
        return {
          icon: <Wifi size={size} color="#17845A" strokeWidth={2.4} />,
          color: '#17845A',
          bgColor: '#E4F5EC',
          borderColor: 'rgba(23, 132, 90, 0.3)',
          label: 'Excellent',
          desc: 'High speed cloud connection',
        };
      case 'good':
        return {
          icon: <WifiHigh size={size} color="#16A34A" strokeWidth={2.4} />,
          color: '#16A34A',
          bgColor: '#E8F8F0',
          borderColor: 'rgba(22, 163, 74, 0.3)',
          label: 'Good',
          desc: 'Stable cloud connection',
        };
      case 'fair':
        return {
          icon: <WifiLow size={size} color="#DE8626" strokeWidth={2.4} />,
          color: '#DE8626',
          bgColor: '#FFF7ED',
          borderColor: 'rgba(222, 134, 38, 0.3)',
          label: 'Moderate',
          desc: 'Average cloud response time',
        };
      case 'poor':
        return {
          icon: <WifiZero size={size} color="#DC2626" strokeWidth={2.4} />,
          color: '#DC2626',
          bgColor: '#FEF2F2',
          borderColor: 'rgba(220, 38, 38, 0.3)',
          label: 'Weak Signal',
          desc: 'High latency detected',
        };
      case 'offline':
      default:
        return {
          icon: <WifiOff size={size} color="#EF4444" strokeWidth={2.4} />,
          color: '#EF4444',
          bgColor: '#FEE2E2',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          label: 'Offline',
          desc: 'Cannot reach Menza Cloud',
        };
    }
  };

  const details = getQualityDetails();

  const handlePress = () => {
    checkNetworkLatency();
    const pingDisplay = network.latencyMs >= 0 ? `${network.latencyMs} ms` : 'Unreachable';
    Alert.alert(
      `Network Status: ${details.label} 📶`,
      `Connection: ${details.desc}\nCloud Latency: ${pingDisplay}\nLast Sync: ${network.lastChecked.toLocaleTimeString()}`,
      [{ text: 'Refresh', onPress: checkNetworkLatency }, { text: 'OK' }]
    );
  };

  if (showBadge) {
    return (
      <TouchableOpacity
        style={[
          styles.badgeContainer,
          { backgroundColor: details.bgColor, borderColor: details.borderColor },
        ]}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        {details.icon}
        <Text style={[styles.badgeText, { color: details.color }]}>
          {details.label}
          {showLatencyLabel && network.latencyMs >= 0 ? ` (${network.latencyMs}ms)` : ''}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.iconContainer,
        network.quality === 'offline' && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
      ]}
      onPress={handlePress}
      activeOpacity={0.75}
      accessibilityLabel={`Network Quality: ${details.label}`}
    >
      {details.icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E0D6',
    shadowColor: '#2B1A09',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 1,
    shadowColor: '#2B1A09',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
