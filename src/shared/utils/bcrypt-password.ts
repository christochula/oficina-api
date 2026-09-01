/** Limite efetivo de entrada processada pelo algoritmo bcrypt. */
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

/** Verifica o tamanho real UTF-8 para evitar truncamento silencioso do bcrypt. */
export function senhaCompativelComBcrypt(senha: string): boolean {
  return Buffer.byteLength(senha, 'utf8') <= BCRYPT_MAX_PASSWORD_BYTES;
}
