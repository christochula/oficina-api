// TODO: em fases futuras, desacoplar das exceções do NestJS para manter o domínio
// independente de frameworks. Por ora, herdar de HttpException simplifica o tratamento
// global de erros sem introduzir complexidade desnecessária no MVP.
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Exceção lançada quando um recurso solicitado não existe na base de dados.
 *
 * Mapeia para HTTP 404 (Not Found). Utilizada pelos casos de uso quando uma entidade
 * buscada por ID, documento ou outro identificador não é localizada no repositório.
 *
 * @example
 * throw new RecursoNaoEncontrado('Cliente', clienteId.valor);
 * // mensagem: "Cliente com identificador 'cl01234...' não encontrado"
 */
export class RecursoNaoEncontrado extends NotFoundException {
  /**
   * @param recurso - Nome da entidade ou recurso que não foi encontrado (ex: 'Cliente', 'OrdemServico').
   * @param identificador - Valor do identificador utilizado na busca; omitido produz mensagem genérica.
   */
  constructor(recurso: string, identificador?: string) {
    const mensagem = identificador
      ? `${recurso} com identificador '${identificador}' não encontrado`
      : `${recurso} não encontrado`;
    super(mensagem);
  }
}

/**
 * Exceção lançada quando uma operação viola uma regra de negócio do domínio.
 *
 * Mapeia para HTTP 422 (Unprocessable Entity). Deve ser utilizada pelos aggregates
 * e casos de uso para sinalizar transições de estado inválidas, restrições de negócio
 * não satisfeitas ou qualquer condição que impeça a execução da operação solicitada.
 *
 * @example
 * throw new RegraDeNegocio('Orçamento só pode ser aprovado no estado Aguardando Aprovação.');
 */
export class RegraDeNegocio extends HttpException {
  /**
   * @param mensagem - Descrição da regra de negócio violada, em linguagem ubíqua.
   */
  constructor(mensagem: string) {
    super(mensagem, 422);
  }
}

/**
 * Exceção lançada quando um usuário autenticado tenta realizar uma operação
 * para a qual não possui permissão.
 *
 * Mapeia para HTTP 403 (Forbidden). Utilizada pelos guards de papéis e pelos
 * casos de uso que implementam verificações de autorização no nível de domínio.
 *
 * @example
 * throw new AcessoNegado('Apenas o mecânico responsável pode registrar diagnóstico.');
 */
export class AcessoNegado extends ForbiddenException {
  /**
   * @param mensagem - Descrição do motivo da negação de acesso. Padrão: 'Acesso negado'.
   */
  constructor(mensagem = 'Acesso negado') {
    super(mensagem);
  }
}

/**
 * Exceção lançada quando uma operação de criação viola uma restrição de unicidade.
 *
 * Mapeia para HTTP 409 (Conflict). Utilizada pelos casos de uso que verificam
 * duplicidade antes de persistir uma nova entidade — por exemplo, ao tentar cadastrar
 * um cliente com CPF/CNPJ já existente na base.
 *
 * @example
 * throw new ConflitoDeRecurso(`Cliente com CPF '${dto.numeroDoc}' já cadastrado.`);
 */
export class ConflitoDeRecurso extends ConflictException {
  /**
   * @param mensagem - Descrição do conflito identificado, indicando o recurso e o valor duplicado.
   */
  constructor(mensagem: string) {
    super(mensagem);
  }
}
