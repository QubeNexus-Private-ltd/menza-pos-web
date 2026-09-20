import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Table,
  Settings,
  Building2,
  Store,
  Crown,
} from 'lucide-react-native';
import { useTheme } from '../../core/theme/ThemeContext';

export type NavTabKey =
  | 'dashboard'
  | 'catalog'
  | 'pos'
  | 'tables'
  | 'more'
  | 'roles'
  | 'config'
  | 'directory'
  | 'superadmin'
  | 'planCreator'
  | 'reports'
  | 'printer'
  | 'bankAccount';

interface BottomNavigationBarProps {
  activeTab: NavTabKey;
  onTabChange: (tab: NavTabKey) => void;
  isSuperAdmin?: boolean;
  isTableOrderingAllowed?: boolean;
}

export const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  activeTab,
  onTabChange,
  isSuperAdmin = false,
  isTableOrderingAllowed = true,
}) => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const standardTabs = [
    { key: 'dashboard' as NavTabKey, label: 'Home', icon: LayoutDashboard },
    { key: 'catalog' as NavTabKey, label: 'Menu', icon: UtensilsCrossed },
    { key: 'pos' as NavTabKey, label: 'POS Terminal', icon: ShoppingBag },
    ...(isTableOrderingAllowed ? [{ key: 'tables' as NavTabKey, label: 'Tables', icon: Table }] : []),
    { key: 'more' as NavTabKey, label: 'Settings', icon: Settings },
  ];

  const tabs = isSuperAdmin
    ? [
        { key: 'dashboard' as NavTabKey, label: 'Overview', icon: LayoutDashboard },
        { key: 'directory' as NavTabKey, label: 'Outlets', icon: Building2 },
        { key: 'superadmin' as NavTabKey, label: 'Onboard', icon: Store },
        { key: 'planCreator' as NavTabKey, label: 'Plans', icon: Crown },
        { key: 'more' as NavTabKey, label: 'Settings', icon: Settings },
      ]
    : standardTabs;

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);

  return (
    <View
      style={[
        styles.navContainer,
        {
          backgroundColor: theme.dockBg,
          borderTopColor: theme.border,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const isActive =
            activeTab === tab.key ||
            (tab.key === 'more' && ['roles', 'config', 'reports', 'printer'].includes(activeTab));
          const IconComponent = tab.icon;

          return (
            <TouchableOpacity
              key={`nav-${tab.key}`}
              style={styles.tabItem}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.iconWrapper,
                  isActive && {
                    backgroundColor: theme.activeTabBg,
                    shadowColor: theme.gold,
                  },
                ]}
              >
                <IconComponent
                  size={20}
                  color={isActive ? theme.activeTabIcon : theme.inactiveTabIcon}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? theme.gold : theme.inactiveTabIcon },
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    borderTopWidth: 1,
    paddingTop: 8,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  iconWrapper: {
    width: 38,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontWeight: '800',
  },
});
