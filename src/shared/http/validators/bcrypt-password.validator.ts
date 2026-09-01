import { ValidateBy, ValidationOptions } from 'class-validator';
import {
  BCRYPT_MAX_PASSWORD_BYTES,
  senhaCompativelComBcrypt,
} from '../../utils/bcrypt-password';

/** Valida o limite do bcrypt em bytes UTF-8, não apenas em caracteres. */
export function MaxBcryptPasswordBytes(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxBcryptPasswordBytes',
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && senhaCompativelComBcrypt(value);
        },
        defaultMessage(): string {
          return `senha deve ter no máximo ${BCRYPT_MAX_PASSWORD_BYTES} bytes em UTF-8`;
        },
      },
    },
    validationOptions,
  );
}
