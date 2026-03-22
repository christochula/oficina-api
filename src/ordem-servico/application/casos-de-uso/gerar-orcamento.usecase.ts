import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';
import { GrupoOrcamentoInput } from '../../domain/value-objects/grupo-orcamento.vo';

/**
 * Dados de entrada para geração de orçamento de uma OS.
 */
export interface GerarOrcamentoInput {
  /** ID da OS para a qual o orçamento será gerado. */
  osId: string;
  /** ID do mecânico responsável que está gerando o orçamento. */
  mecanicoId: string;
  /** Grupos de itens do orçamento, cada um com título livre e linhas de serviço. */
  grupos: GrupoOrcamentoInput[];
  /** Notas internas do mecânico — não visíveis ao cliente. */
  notasInternas?: string;
  /** Notas enviadas ao cliente junto com o orçamento. */
  notasCliente?: string;
}

/**
 * Caso de uso responsável por gerar o orçamento de uma OS.
 * Avança o status da OS para AGUARDANDO_APROVACAO.
 * O orçamento é organizado em grupos temáticos (ex: "Retífica do Motor"),
 * cada um contendo linhas de MATERIAL e/ou SERVICO.
 */
@Injectable()
export class GerarOrcamentoUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  async executar(input: GerarOrcamentoInput): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(input.osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', input.osId);

    os.gerarOrcamento(input.grupos, input.mecanicoId, {
      notasInternas: input.notasInternas,
      notasCliente: input.notasCliente,
    });
    await this.osRepository.salvar(os);
    return os;
  }
}
