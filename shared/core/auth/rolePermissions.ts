import { User } from '../../domain/models/User';
import { RestaurantDetail } from '../../domain/models/Restaurant';

/**
 * Normalizes and extracts all role identifiers from user and activeRestaurant.
 */
export const extractUserRoles = (
  user: User | null,
  activeRestaurant: RestaurantDetail | null
): string[] => {
  const rolesSet = new Set<string>();

  if (user) {
    if (Array.isArray(user.roles)) {
      for (const r of user.roles) {
        if (typeof r === 'string' && r.trim()) {
          rolesSet.add(r.trim().toLowerCase());
        } else if (typeof r === 'number') {
          if (r === 1) rolesSet.add('superadmin');
          if (r === 2) rolesSet.add('owner');
          if (r === 3) rolesSet.add('manager');
          if (r === 4) rolesSet.add('cashier');
          if (r === 5) rolesSet.add('waiter');
          if (r === 6) rolesSet.add('chef');
        } else if (typeof r === 'object' && r !== null) {
          const name = (r as any).roleName || (r as any).name || (r as any).role;
          if (typeof name === 'string' && name.trim()) {
            rolesSet.add(name.trim().toLowerCase());
          }
        }
      }
    } else if (typeof (user as any).roles === 'string' && (user as any).roles.trim()) {
      rolesSet.add((user as any).roles.trim().toLowerCase());
    }

    if (typeof (user as any).role === 'string' && (user as any).role.trim()) {
      rolesSet.add((user as any).role.trim().toLowerCase());
    }
    if (typeof (user as any).roleName === 'string' && (user as any).roleName.trim()) {
      rolesSet.add((user as any).roleName.trim().toLowerCase());
    }
    if (typeof (user as any).roleId === 'number') {
      const id = (user as any).roleId;
      if (id === 1) rolesSet.add('superadmin');
      if (id === 2) rolesSet.add('owner');
      if (id === 3) rolesSet.add('manager');
      if (id === 4) rolesSet.add('cashier');
      if (id === 5) rolesSet.add('waiter');
      if (id === 6) rolesSet.add('chef');
    }
  }

  if (activeRestaurant) {
    if (typeof activeRestaurant.role === 'string' && activeRestaurant.role.trim()) {
      rolesSet.add(activeRestaurant.role.trim().toLowerCase());
    }
    if (typeof (activeRestaurant as any).roleName === 'string' && (activeRestaurant as any).roleName.trim()) {
      rolesSet.add((activeRestaurant as any).roleName.trim().toLowerCase());
    }
    if (typeof (activeRestaurant as any).roleId === 'number') {
      const id = (activeRestaurant as any).roleId;
      if (id === 1) rolesSet.add('superadmin');
      if (id === 2) rolesSet.add('owner');
      if (id === 3) rolesSet.add('manager');
      if (id === 4) rolesSet.add('cashier');
      if (id === 5) rolesSet.add('waiter');
      if (id === 6) rolesSet.add('chef');
    }
  }

  return Array.from(rolesSet);
};

/**
 * Checks if the logged in user has Cashier or non-administrative role.
 * Cashiers have view-only access to Store Configuration and Staff Roles.
 */
export const isCashierOnly = (
  user: User | null,
  activeRestaurant: RestaurantDetail | null
): boolean => {
  if (!user) return false;

  const roles = extractUserRoles(user, activeRestaurant);

  // If user has explicit cashier role, they are treated as cashier
  const hasCashier = roles.some((r) => r.includes('cashier') || r.includes('billing') || r.includes('pos'));
  if (hasCashier) {
    // If they have superadmin/owner privilege along with cashier, they are not cashier-only
    const hasSuperAdmin = roles.some((r) => r.includes('superadmin') || r.includes('super_admin'));
    const hasOwner = roles.some((r) => r === 'owner' || r.includes('owner') || r.includes('tenant_admin'));
    if (hasSuperAdmin || hasOwner) {
      return false;
    }
    return true;
  }

  // If user has administrative privileges, they are not cashier-only
  const isSuperAdmin = roles.some((r) => r.includes('superadmin') || r.includes('super_admin'));
  const isOwner = roles.some((r) => r === 'owner' || r.includes('owner') || r.includes('tenant_admin'));
  const isManager = roles.some((r) => r === 'manager' || r.includes('manager'));
  const isAdmin = roles.some((r) => r === 'admin' || r.includes('admin'));

  if (isSuperAdmin || isOwner || isManager || isAdmin) {
    return false;
  }

  // Non-administrative users default to view-only / cashier restrictions
  return true;
};

/**
 * Checks if the user has the Owner role.
 * Terms & Conditions consent is strictly required only for Owners.
 */
export const isOwnerUser = (
  user: User | null,
  activeRestaurant?: RestaurantDetail | null
): boolean => {
  if (!user) return false;
  const roles = extractUserRoles(user, activeRestaurant || null);
  return roles.some((r) => r === 'owner' || r.includes('owner') || r.includes('tenant_admin'));
};

/** 
 * Check if user has permission to edit store configuration.
 * Only Store Owners, Admins, and SuperAdmins can modify store configuration.
 * Cashiers and other staff can ONLY view these details.
 */
export const canEditStoreConfig = (
  user: User | null,
  activeRestaurant: RestaurantDetail | null
): boolean => {
  if (!user) return false;
  return !isCashierOnly(user, activeRestaurant);
};

/** Check if user has permission to add, edit, or delete staff members & permissions */
export const canManageStaff = (
  user: User | null,
  activeRestaurant: RestaurantDetail | null
): boolean => {
  if (!user) return false;
  return !isCashierOnly(user, activeRestaurant);
};

/**
 * Check if user has permission to configure kitchen stations and route dishes.
 * Configurable from Owner, Cashier, and Manager end.
 */
export const canConfigureKitchenStations = (
  user: User | null,
  activeRestaurant: RestaurantDetail | null
): boolean => {
  if (!user && !activeRestaurant) return true;
  const roles = extractUserRoles(user, activeRestaurant);
  // If no roles specified, allow by default
  if (roles.length === 0) return true;
  // Configurable from owner, cashier, and manager end
  return roles.some((r) =>
    r.includes('owner') ||
    r.includes('manager') ||
    r.includes('cashier') ||
    r.includes('billing') ||
    r.includes('pos') ||
    r.includes('admin') ||
    r.includes('superadmin') ||
    r.includes('chef')
  );
};


