import { Inject, Injectable } from '@nestjs/common';
import { RegraDeNegocio, RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Estoque } from '../../domain/estoque.entity';
import { ESTOQUE_REPOSITORY } from '../../domain/estoque.repository';
import type { EstoqueRepository } from '../../domain/estoque.repository';

export interface AtualizarPecaInput {
  pecaId: string;
  nome?: string;
  descricao?: string | null;
  precoVenda?: number;
}

/**
 * Caso de uso que atualiza os dados cadastrais de uma peça (nome, descrição, preço de venda).
 * O código da peça é imutável e não pode ser alterado por este caso de uso.
 * Requer que ao menos um campo seja informado.
 */
@Injectable()
export class AtualizarPecaUseCase {
  constructor(
    @Inject(ESTOQUE_REPOSITORY)
    private readonly estoqueRepository: EstoqueRepository,
  ) {}

  async executar(input: AtualizarPecaInput): Promise<Estoque> {
    const { pecaId, ...dados } = input;

    const temAlgumCampo = dados.nome !== undefined ||
      Object.prototype.hasOwnProperty.call(dados, 'descricao') ||
      dados.precoVenda !== undefined;

    if (!temAlgumCampo) {
      throw new RegraDeNegocio('Ao menos um campo deve ser informado para atualização');
    }

    const estoque = await this.estoqueRepository.buscarPorId(pecaId);
    if (!estoque) throw new RecursoNaoEncontrado('Peça', pecaId);

    estoque.atualizarDadosPeca(dados);
    await this.estoqueRepository.salvar(estoque);
    return estoque;
  }
}
