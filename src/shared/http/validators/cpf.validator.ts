import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { isValidCPF } from '../../utils/documento-validator';

@ValidatorConstraint({ name: 'isValidCpf', async: false })
class CpfValido implements ValidatorConstraintInterface {
  validate(valor: string): boolean {
    return isValidCPF(valor);
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'CPF inválido';
  }
}

export function IsValidCpf() {
  return function (objeto: object, propriedade: string) {
    registerDecorator({
      target: objeto.constructor,
      propertyName: propriedade,
      validator: CpfValido,
    });
  };
}
