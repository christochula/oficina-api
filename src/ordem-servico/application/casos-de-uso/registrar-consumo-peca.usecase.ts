import { Inject, Injectable } from '@nestjs/common';
import {
  DATABASE_TRANSACTION,
  type DatabaseTransactionManager,
} from '../../../shared/database/database-transaction';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { ESTOQUE_SERVICE } from '../../../estoque/domain/estoque.repository';
import type { EstoqueService } from '../../../estoque/domain/estoque.repository';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Dados de entrada para registrar o consumo de uma peca do estoque.
 */
export interface RegistrarConsumoPecaInput {
  /** ID da OS em execucao que esta consumindo a peca. */
  osId: string;
  /** ID da peca consumida no aggregate Estoque. */
  pecaId: string;
  /** Quantidade de unidades da peca consumidas. */
  quantidade: number;
  /** ID do mecanico responsavel que registrou o consumo. */
  mecanicoId: string;
}

/**
 * Caso de uso responsavel por registrar o consumo de uma peca durante a
 * execucao de uma OS.
 *
 * O consumo do estoque e a persistencia da OS precisam confirmar ou falhar
 * juntos para evitar divergencia entre aggregates.
 */
@Injectable()
export class RegistrarConsumoPecaUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
    @Inject(ESTOQUE_SERVICE)
    private readonly estoqueService: EstoqueService,
    @Inject(DATABASE_TRANSACTION)
    private readonly databaseTransaction: DatabaseTransactionManager,
  ) {}

  /**
   * Registra o consumo de uma peca na OS e realiza a baixa no estoque.
   */
  async executar(input: RegistrarConsumoPecaInput): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(input.osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Servico', input.osId);

    os.registrarConsumoPeca(input.pecaId, input.quantidade, input.mecanicoId);
    const eventos = [...os.eventos];

    await this.databaseTransaction.executar(async () => {
      for (const evento of eventos) {
        await this.estoqueService.processarConsumoPeca(evento.pecaId, evento.quantidade);
      }

      await this.osRepository.salvar(os);
    });

    os.limparEventos();
    return os;
  }
}
