import { Inject, Injectable } from '@nestjs/common';
import { RespostaPaginadaDto } from '../../../shared/http/dtos/resposta-paginada.dto';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

const STATUS_PRIORIZADOS_LISTAGEM: StatusOrdemServico[] = [
  StatusOrdemServico.EM_EXECUCAO,
  StatusOrdemServico.AGUARDANDO_APROVACAO,
  StatusOrdemServico.EM_DIAGNOSTICO,
  StatusOrdemServico.RECEBIDA,
];

/**
 * Dados de entrada para listagem paginada de ordens de serviço (usuários internos).
 */
export interface ListarOrdensServicoInput {
  /** Filtra por status (ex: 'RECEBIDA', 'EM_EXECUCAO'). */
  status?: string;
  /** Filtra por cliente específico. */
  clienteId?: string;
  /** Filtra por mecânico responsável. */
  mecanicoResponsavelId?: string;
  /** Número da página (padrão: 1). */
  pagina?: number;
  /** Quantidade de registros por página (padrão: 20). */
  porPagina?: number;
}

/**
 * Caso de uso responsável por listar Ordens de Serviço de forma paginada.
 * Destinado a usuários internos (ADMINISTRADOR, CONSULTOR_TECNICO, MECANICO)
 * com acesso irrestrito a todas as OS do sistema.
 * Para acesso do cliente às suas próprias OS, use {@link ListarMinhasOrdensServicoUseCase}.
 */
@Injectable()
export class ListarOrdensServicoUseCase {
  /** @param osRepository - Repositório de ordens de serviço. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Lista OS de forma paginada aplicando filtros opcionais.
   * @param input - Filtros de listagem e parâmetros de paginação.
   * @returns Resposta paginada com a lista de OS e metadados de paginação.
   */
  async executar(input: ListarOrdensServicoInput): Promise<RespostaPaginadaDto<OrdemServico>> {
    const pagina = input.pagina ?? 1;
    const porPagina = input.porPagina ?? 20;

    if (input.status) {
      if (!STATUS_PRIORIZADOS_LISTAGEM.includes(input.status as StatusOrdemServico)) {
        return new RespostaPaginadaDto([], 0, pagina, porPagina);
      }

      const { itens, total } = await this.osRepository.listar({
        ...input,
        pagina,
        porPagina,
        ordemCriacao: 'asc',
      });

      return new RespostaPaginadaDto(itens, total, pagina, porPagina);
    }

    const resultadosPorStatus = await Promise.all(
      STATUS_PRIORIZADOS_LISTAGEM.map((status) =>
        this.osRepository.listar({
          clienteId: input.clienteId,
          mecanicoResponsavelId: input.mecanicoResponsavelId,
          status,
          ordemCriacao: 'asc',
        }),
      ),
    );

    const total = resultadosPorStatus.reduce((acc, r) => acc + r.total, 0);
    const itensOrdenados = resultadosPorStatus.flatMap((r) => r.itens);
    const inicio = (pagina - 1) * porPagina;
    const fim = inicio + porPagina;
    const itens = itensOrdenados.slice(inicio, fim);

    return new RespostaPaginadaDto(itens, total, pagina, porPagina);
  }
}
