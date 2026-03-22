import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { ClienteId } from '../../../cliente/domain/cliente-id.value-object';
import { CLIENTE_REPOSITORY } from '../../../cliente/domain/cliente.repository';
import type { ClienteRepository } from '../../../cliente/domain/cliente.repository';
import { VeiculoId } from '../../../veiculo/domain/veiculo-id.value-object';
import { VEICULO_REPOSITORY } from '../../../veiculo/domain/veiculo.repository';
import type { VeiculoRepository } from '../../../veiculo/domain/veiculo.repository';
import { SERVICO_OFICINA_REPOSITORY } from '../../../servico-oficina/domain/servico-oficina.repository';
import type { ServicoOficinaRepository } from '../../../servico-oficina/domain/servico-oficina.repository';
import { ServicoOficinaId } from '../../../servico-oficina/domain/servico-oficina-id.value-object';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Item de serviço solicitado ao abrir a OS.
 */
export interface ServicoSolicitadoInput {
  /** ID do serviço no catálogo da oficina. */
  servicoId: string;
  /** Contexto adicional fornecido pelo cliente (ex: "última troca há 10.000 km"). */
  observacao?: string;
}

/**
 * Dados de entrada para abertura de uma nova Ordem de Serviço.
 */
export interface AbrirOrdemServicoInput {
  clienteId: string;
  veiculoId: string;
  problemasRelatados?: { descricao: string }[];
  /** Serviços do catálogo da oficina selecionados pelo cliente. */
  servicosSolicitados?: ServicoSolicitadoInput[];
  notasInternas?: string;
  notasCliente?: string;
  usuarioId?: string;
}

/**
 * Caso de uso responsável por abrir uma nova Ordem de Serviço.
 * Valida a existência do cliente, do veículo e de cada serviço do catálogo.
 * Captura o snapshot do nome de cada serviço no momento da abertura.
 */
@Injectable()
export class AbrirOrdemServicoUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
    @Inject(VEICULO_REPOSITORY)
    private readonly veiculoRepository: VeiculoRepository,
    @Inject(SERVICO_OFICINA_REPOSITORY)
    private readonly servicoRepository: ServicoOficinaRepository,
  ) {}

  async executar(input: AbrirOrdemServicoInput): Promise<OrdemServico> {
    const cliente = await this.clienteRepository.buscarPorId(ClienteId.de(input.clienteId));
    if (!cliente) throw new RecursoNaoEncontrado('Cliente', input.clienteId);

    const veiculo = await this.veiculoRepository.buscarPorId(VeiculoId.de(input.veiculoId));
    if (!veiculo) throw new RecursoNaoEncontrado('Veículo', input.veiculoId);

    // Valida e enriquece os serviços solicitados com snapshot do nome do catálogo
    const servicosSolicitados = await Promise.all(
      (input.servicosSolicitados ?? []).map(async (s) => {
        const servico = await this.servicoRepository.buscarPorId(ServicoOficinaId.de(s.servicoId));
        if (!servico) throw new RecursoNaoEncontrado('Serviço do catálogo', s.servicoId);
        return {
          servicoId: s.servicoId,
          nomeServico: servico.nome,
          observacao: s.observacao ?? null,
        };
      }),
    );

    const os = OrdemServico.abrir({
      clienteId: input.clienteId,
      veiculoId: input.veiculoId,
      problemasRelatados: input.problemasRelatados,
      servicosSolicitados,
      notasInternas: input.notasInternas,
      notasCliente: input.notasCliente,
      usuarioId: input.usuarioId,
    });

    await this.osRepository.salvar(os);
    return os;
  }
}
