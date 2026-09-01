export const JWT_ISSUER = process.env.JWT_ISSUER ?? 'oficina-auth-serverless';
export const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'oficina-api';

export function jwtSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (value) {
    if (Buffer.byteLength(value, 'utf8') < 32) {
      throw new Error(`${name} must have at least 32 bytes`);
    }
    const otherName =
      name === 'JWT_SECRET' ? 'JWT_REFRESH_SECRET' : 'JWT_SECRET';
    const otherValue = process.env[otherName];
    if (otherValue && otherValue === value) {
      throw new Error('JWT access and refresh secrets must be different');
    }
    return value;
  }
  if (process.env.NODE_ENV === 'test')
    return `test-only-${name.toLowerCase()}-32-characters`;
  throw new Error(`${name} é obrigatório`);
}
