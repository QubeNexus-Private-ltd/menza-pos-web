/**
 * Menza URL & Identifier Encryption Helper
 * Provides URL-safe reversible encryption for Restaurant IDs and Table IDs.
 */

// Simple lightweight reversible URL-safe obfuscator/encryptor for client-side fallback
export function encryptIdentifier(id: number | string): string {
  if (!id) return '';
  const str = String(id);
  const prefix = 'mza_';
  // Reversible bitwise XOR cipher with secret salt
  const key = 0x5a;
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) ^ key);
  }
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}${hex}`;
}

export function decryptIdentifier(token: string): string {
  if (!token || !token.startsWith('mza_')) return token;
  const hex = token.slice(4);
  const key = 0x5a;
  let res = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    res += String.fromCharCode(byte ^ key);
  }
  return res;
}
