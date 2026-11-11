export const normalizeUsername = (u: string) => u.trim().toLowerCase();
export const isValidUsername = (u: string) => /^[a-z0-9._-]{3,32}$/.test(normalizeUsername(u));
export const usernameToEmail = (u: string) => `${normalizeUsername(u)}@users.90plus.local`;
