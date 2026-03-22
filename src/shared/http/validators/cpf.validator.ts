import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { isValidCPF } from '../../utils/documento-validator';

/**
 * Constraint de validação de CPF para uso com o `class-validator`.
 *
 * Utiliza a biblioteca `cpf-cnpj-validator` para verificar se o valor fornecido
 * é um CPF matematicamente válido (dígitos verificadores corretos), aceitando
 * tanto o formato com pontuação (`000.000.000-00`) quanto apenas dígitos (`00000000000`).
 *
 * Registrado como constraint síncrona com nome `isValidCpf`.
 */
@ValidatorConstraint({ name: 'isValidCpf', async: false })
class CpfValido implements ValidatorConstraintInterface {
  /**
   * Verifica se o valor informado é um CPF válido.
   *
   * @param valor - String contendo o CPF a ser validado.
   * @returns `true` se o CPF for matematicamente válido; `false` caso contrário.
   */
  validate(valor: string): boolean {
    return isValidCPF(valor);
  }

  /**
   * Retorna a mensagem de erro padrão exibida quando a validação falha.
   *
   * @param _args - Argumentos de validação (não utilizados nesta implementação).
   * @returns Mensagem de erro em português brasileiro.
   */
  defaultMessage(_args: ValidationArguments): string {
    return 'CPF inválido';
  }
}

/**
 * Decorator de validação de CPF para propriedades de DTOs.
 *
 * Aplica a constraint `CpfValido` à propriedade decorada, integrando-se ao pipeline
 * do `class-validator`. Deve ser utilizado em conjunto com `@ValidateIf` quando
 * a propriedade só deve ser validada como CPF em determinadas condições
 * (ex: quando `tipoDoc === TipoDocumento.CPF`).
 *
 * @example
 * @ValidateIf(o => o.tipoDoc === TipoDocumento.CPF)
 * @IsValidCpf()
 * numeroDoc: string;
 */
export function IsValidCpf() {
  return function (objeto: object, propriedade: string) {
    registerDecorator({
      target: objeto.constructor,
      propertyName: propriedade,
      validator: CpfValido,
    });
  };
}
