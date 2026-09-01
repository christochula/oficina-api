import { Inject, Injectable } from '@nestjs/common';
import { Estoque } from '../../domain/estoque.entity';
import { PecaId } from '../../domain/peca-id.value-object';
import { ESTOQUE_REPOSITORY } from '../../domain/estoque.repository';
import type { EstoqueRepository } from '../../domain/estoque.repository';

/**
 * Dados de entrada para o cadastro de uma nova peça no estoque.
 */
export interface RegistrarPecaInput {
  /** Código de identificação interno da peça (ex: código do fabricante). */
  codigo: string;
  /** Nome descritivo da peça. */
  nome: string;
  /** Descrição adicional da peça (opcional). */
  descricao?: string;
  /** Preço de venda da peça em reais. */
  precoVenda: number;
  /** Quantidade inicial a ser registrada em estoque (padrão: 0). */
  quantidadeInicial?: number;
  /** Quantidade mínima desejada para controle de estoque (padrão: 0). */
  quantidadeMinima?: number;
}

/**
 * Caso de uso responsável por registrar uma nova peça no sistema de estoque.
 * Cria a entidade Peça (interna ao aggregate Estoque) com um novo PecaId (ULID `pc_...`)
 * e inicializa o registro de estoque com a quantidade fornecida.
 * Acesso restrito ao ADMINISTRADOR.
 */
@Injectable()
export class RegistrarPecaUseCase {
  /** @param estoqueRepository - Repositório de estoque para persistência. */
  constructor(
    @Inject(ESTOQUE_REPOSITORY)
    private readonly estoqueRepository: EstoqueRepository,
  ) {}

  /**
   * Registra uma nova peça e seu saldo inicial no estoque.
   * @param input - Dados cadastrais da peça e quantidade inicial.
   * @returns O aggregate Estoque criado com a peça e o saldo inicial.
   */
  async executar(input: RegistrarPecaInput): Promise<Estoque> {
    const pecaId = PecaId.novo();
    const agora = new Date();

    const estoque = Estoque.criar({
      peca: {
        id: pecaId,
        codigo: input.codigo,
        nome: input.nome,
        descricao: input.descricao,
        precoVenda: input.precoVenda,
        ativo: true,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      quantidadeDisponivel: input.quantidadeInicial ?? 0,
      quantidadeMinima: input.quantidadeMinima ?? 0,
    });

    await this.estoqueRepository.salvar(estoque);
    return estoque;
  }
}
