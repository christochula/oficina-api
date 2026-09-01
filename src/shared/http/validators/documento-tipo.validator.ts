import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { TipoDocumento } from '../../../cliente/domain/cliente.entity';
import { isValidCNPJ, isValidCPF } from '../../utils/documento-validator';

interface DocumentoComTipo {
  tipoDoc?: TipoDocumento;
}

@ValidatorConstraint({ name: 'isValidDocumentForType', async: false })
class DocumentoDoTipoValido implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;
    const { tipoDoc } = args.object as DocumentoComTipo;
    if (tipoDoc === TipoDocumento.CPF) return isValidCPF(value);
    if (tipoDoc === TipoDocumento.CNPJ) return isValidCNPJ(value);
    return false;
  }

  defaultMessage(args: ValidationArguments): string {
    const { tipoDoc } = args.object as DocumentoComTipo;
    return tipoDoc === TipoDocumento.CNPJ ? 'CNPJ invalido' : 'CPF invalido';
  }
}

/**
 * Valida numeroDoc com uma unica condicao baseada em tipoDoc.
 * Evita que multiplos ValidateIf facam o class-validator ignorar o campo.
 */
export function IsValidDocumentForType() {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName,
      validator: DocumentoDoTipoValido,
    });
  };
}
