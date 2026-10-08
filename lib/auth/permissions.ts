export function normalizeRole(role: string): string {
  return role.toUpperCase().replace(/[^A-Z]/g, '');
}

export function isOwnerUser(roles?: string[]): boolean {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return false;
  return roles.some((r) => {
    const norm = normalizeRole(r);
    return norm === 'OWNER' || norm === 'SUPERADMIN' || norm === 'ADMIN';
  });
}

export function isCashierUser(roles?: string[]): boolean {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return false;
  return roles.some((r) => {
    const norm = normalizeRole(r);
    return norm === 'CASHIER' || norm === 'OWNER' || norm === 'ADMIN' || norm === 'SUPERADMIN';
  });
}

export function isSuperAdminUser(roles?: string[]): boolean {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return false;
  return roles.some((r) => {
    const norm = normalizeRole(r);
    return norm === 'SUPERADMIN' || norm === 'SUPERADMINONLY';
  });
}

export function hasRole(roles: string[] | undefined, targetRole: string): boolean {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return false;
  const target = normalizeRole(targetRole);
  return roles.some((r) => normalizeRole(r) === target);
}
