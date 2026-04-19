import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Valida placas brasileiras nos formatos antigo (ABC1234)
 * e Mercosul (ABC1D23), com ou sem separadores.
 */
@ValidatorConstraint({ name: 'isValidPlaca', async: false })
class PlacaValida implements ValidatorConstraintInterface {
  validate(valor: string): boolean {
    if (typeof valor !== 'string' || !valor.trim()) return false;

    const normalizada = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizada);
  }

  defaultMessage(): string {
    return 'Placa inválida';
  }
}

export function IsValidPlaca(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: PlacaValida,
    });
  };
}
