import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { isValidCNPJ } from '../../utils/documento-validator';

/**
 * Constraint de validação de CNPJ para uso com o `class-validator`.
 *
 * Utiliza a biblioteca `cpf-cnpj-validator` para verificar se o valor fornecido
 * é um CNPJ matematicamente válido (dígitos verificadores corretos), aceitando
 * tanto o formato com pontuação (`00.000.000/0000-00`) quanto apenas dígitos (`00000000000000`).
 *
 * Registrado como constraint síncrona com nome `isValidCnpj`.
 */
@ValidatorConstraint({ name: 'isValidCnpj', async: false })
class CnpjValido implements ValidatorConstraintInterface {
  /**
   * Verifica se o valor informado é um CNPJ válido.
   *
   * @param valor - String contendo o CNPJ a ser validado.
   * @returns `true` se o CNPJ for matematicamente válido; `false` caso contrário.
   */
  validate(valor: string): boolean {
    return isValidCNPJ(valor);
  }

  /**
   * Retorna a mensagem de erro padrão exibida quando a validação falha.
   *
   * @param _args - Argumentos de validação (não utilizados nesta implementação).
   * @returns Mensagem de erro em português brasileiro.
   */
  defaultMessage(_args: ValidationArguments): string {
    return 'CNPJ inválido';
  }
}

/**
 * Decorator de validação de CNPJ para propriedades de DTOs.
 *
 * Aplica a constraint `CnpjValido` à propriedade decorada, integrando-se ao pipeline
 * do `class-validator`. Deve ser utilizado em conjunto com `@ValidateIf` quando
 * a propriedade só deve ser validada como CNPJ em determinadas condições
 * (ex: quando `tipoDoc === TipoDocumento.CNPJ`).
 *
 * @example
 * @ValidateIf(o => o.tipoDoc === TipoDocumento.CNPJ)
 * @IsValidCnpj()
 * numeroDoc: string;
 */
export function IsValidCnpj() {
  return function (objeto: object, propriedade: string) {
    registerDecorator({
      target: objeto.constructor,
      propertyName: propriedade,
      validator: CnpjValido,
    });
  };
}
