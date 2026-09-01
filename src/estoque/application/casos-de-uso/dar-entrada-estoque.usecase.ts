import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Estoque } from '../../domain/estoque.entity';
import { PecaId } from '../../domain/peca-id.value-object';
import { ESTOQUE_REPOSITORY } from '../../domain/estoque.repository';
import type { EstoqueRepository } from '../../domain/estoque.repository';

/**
 * Caso de uso responsável por registrar a entrada de unidades de uma peça no estoque.
 * Utilizado para reposição de estoque após recebimento de mercadorias.
 * Chama `Estoque.darEntrada()` que valida e incrementa a quantidade disponível.
 * Acesso restrito ao ADMINISTRADOR.
 */
@Injectable()
export class DarEntradaEstoqueUseCase {
  /** @param estoqueRepository - Repositório de estoque para busca e persistência. */
  constructor(
    @Inject(ESTOQUE_REPOSITORY)
    private readonly estoqueRepository: EstoqueRepository,
  ) {}

  /**
   * Adiciona a quantidade informada ao saldo disponível da peça e persiste a atualização.
   * @param pecaId - ID da peça a ter entrada registrada.
   * @param quantidade - Número de unidades a adicionar (deve ser maior que zero).
   * @returns O aggregate Estoque atualizado com o novo saldo.
   * @throws RecursoNaoEncontrado se não houver registro de estoque para a peça.
   * @throws RegraDeNegocio se a quantidade for menor ou igual a zero.
   */
  async executar(pecaId: string, quantidade: number): Promise<Estoque> {
    const estoque = await this.estoqueRepository.buscarPorPecaId(
      PecaId.de(pecaId),
    );
    if (!estoque) throw new RecursoNaoEncontrado('Estoque para peça', pecaId);

    estoque.darEntrada(quantidade);
    await this.estoqueRepository.salvar(estoque);
    return estoque;
  }
}
