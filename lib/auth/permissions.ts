export function normalizeRole(role: string): string {
  return role.toUpperCase().replace(/[^A-Z]/g, '');
}

export function isOwnerUser(roles?: string[]): boolean {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return false;
  if (isSuperAdminUser(roles)) return false;
  return roles.some((r) => {
    const norm = normalizeRole(r);
    return norm === 'OWNER' || norm === 'ADMIN';
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

export function isSalesPersonUser(roles?: any[]): boolean {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return false;
  return roles.some((r) => {
    if (typeof r === 'number') return r === 8;
    if (typeof r === 'string') {
      const norm = normalizeRole(r);
      return norm === 'SALESPERSON' || norm === 'SALES' || norm === 'SALESPARTNER' || norm === 'PARTNER' || norm === 'SALESMANAGER';
    }
    if (typeof r === 'object' && r !== null) {
      const name = (r as any).roleName || (r as any).name || (r as any).role;
      if (typeof name === 'string') {
        const norm = normalizeRole(name);
        return norm === 'SALESPERSON' || norm === 'SALES' || norm === 'SALESPARTNER' || norm === 'PARTNER' || norm === 'SALESMANAGER';
      }
      if ((r as any).roleId === 8 || (r as any).id === 8) return true;
    }
    return false;
  });
}

export function hasRole(roles: string[] | undefined, targetRole: string): boolean {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return false;
  const target = normalizeRole(targetRole);
  return roles.some((r) => normalizeRole(r) === target);
}
