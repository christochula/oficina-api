import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Estoque } from '../../domain/estoque.entity';
import { ESTOQUE_REPOSITORY } from '../../domain/estoque.repository';
import type { EstoqueRepository } from '../../domain/estoque.repository';

@Injectable()
export class DesativarPecaUseCase {
  constructor(
    @Inject(ESTOQUE_REPOSITORY)
    private readonly estoqueRepository: EstoqueRepository,
  ) {}

  async executar(pecaId: string): Promise<Estoque> {
    const estoque = await this.estoqueRepository.buscarPorId(pecaId);
    if (!estoque) throw new RecursoNaoEncontrado('Peça', pecaId);

    estoque.desativarPeca();
    await this.estoqueRepository.salvar(estoque);
    return estoque;
  }
}
