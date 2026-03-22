import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { ESTOQUE_SERVICE } from '../../../estoque/domain/estoque.repository';
import type { EstoqueService } from '../../../estoque/domain/estoque.repository';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Dados de entrada para registrar o consumo de uma peça do estoque.
 */
export interface RegistrarConsumoPecaInput {
  /** ID da OS em execução que está consumindo a peça. */
  osId: string;
  /** ID da peça consumida no aggregate Estoque. */
  pecaId: string;
  /** Quantidade de unidades da peça consumidas (deve ser maior que zero). */
  quantidade: number;
  /** ID do mecânico responsável que registrou o consumo. */
  mecanicoId: string;
}

/**
 * Caso de uso responsável por registrar o consumo de uma peça durante a execução de uma OS.
 * Coordena dois aggregates: OrdemServico (registra o consumo e gera o evento)
 * e Estoque (processa a baixa na quantidade disponível).
 *
 * Fluxo de execução:
 * 1. Busca a OS e valida que está EM_EXECUCAO.
 * 2. Chama `os.registrarConsumoPeca()` que enfileira um {@link ConsumoPecaEvento}.
 * 3. Itera os eventos e delega ao EstoqueService a baixa no estoque.
 * 4. Limpa os eventos após processamento.
 * 5. Persiste a OS atualizada.
 */
@Injectable()
export class RegistrarConsumoPecaUseCase {
  /**
   * @param osRepository - Repositório de ordens de serviço.
   * @param estoqueService - Serviço de estoque para processar a baixa de peças.
   */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
    @Inject(ESTOQUE_SERVICE)
    private readonly estoqueService: EstoqueService,
  ) {}

  /**
   * Registra o consumo de uma peça na OS e realiza a baixa no estoque.
   * @param input - Dados do consumo: OS, peça, quantidade e mecânico.
   * @returns A OS atualizada com o consumo registrado.
   * @throws RecursoNaoEncontrado se a OS não existir.
   * @throws RegraDeNegocio se a OS não estiver no status EM_EXECUCAO.
   * @throws RegraDeNegocio se a quantidade for menor ou igual a zero.
   * @throws RecursoNaoEncontrado se não houver registro de estoque para a peça.
   * @throws RegraDeNegocio se o estoque disponível for insuficiente.
   */
  async executar(input: RegistrarConsumoPecaInput): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(input.osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', input.osId);

    os.registrarConsumoPeca(input.pecaId, input.quantidade, input.mecanicoId);

    // Processa eventos de domínio — dispara baixa no estoque
    for (const evento of os.eventos) {
      await this.estoqueService.processarConsumoPeca(evento.pecaId, evento.quantidade);
    }
    os.limparEventos();

    await this.osRepository.salvar(os);
    return os;
  }
}
