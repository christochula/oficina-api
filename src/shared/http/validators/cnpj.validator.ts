import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { isValidCNPJ } from '../../utils/documento-validator';

@ValidatorConstraint({ name: 'isValidCnpj', async: false })
class CnpjValido implements ValidatorConstraintInterface {
  validate(valor: string): boolean {
    return isValidCNPJ(valor);
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'CNPJ inválido';
  }
}

export function IsValidCnpj() {
  return function (objeto: object, propriedade: string) {
    registerDecorator({
      target: objeto.constructor,
      propertyName: propriedade,
      validator: CnpjValido,
    });
  };
}
