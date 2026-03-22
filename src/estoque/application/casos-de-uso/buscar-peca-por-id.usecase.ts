import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Estoque } from '../../domain/estoque.entity';
import { ESTOQUE_REPOSITORY } from '../../domain/estoque.repository';
import type { EstoqueRepository } from '../../domain/estoque.repository';

/**
 * Caso de uso que busca um registro de estoque (com dados da peça) pelo ID da peça.
 * Utilizado pelo endpoint GET /estoque/pecas/:pecaId.
 */
@Injectable()
export class BuscarPecaPorIdUseCase {
  constructor(
    @Inject(ESTOQUE_REPOSITORY)
    private readonly estoqueRepository: EstoqueRepository,
  ) {}

  async executar(pecaId: string): Promise<Estoque> {
    const estoque = await this.estoqueRepository.buscarPorId(pecaId);
    if (!estoque) throw new RecursoNaoEncontrado('Peça', pecaId);
    return estoque;
  }
}
