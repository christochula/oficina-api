import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { ServicoOficina } from '../../domain/servico-oficina.entity';
import { ServicoOficinaId } from '../../domain/servico-oficina-id.value-object';
import { SERVICO_OFICINA_REPOSITORY } from '../../domain/servico-oficina.repository';
import type { ServicoOficinaRepository } from '../../domain/servico-oficina.repository';

/**
 * Caso de uso que busca um serviço do catálogo pelo ID.
 */
@Injectable()
export class BuscarServicoOficinaPorIdUseCase {
  constructor(
    @Inject(SERVICO_OFICINA_REPOSITORY)
    private readonly servicoRepository: ServicoOficinaRepository,
  ) {}

  async executar(id: string): Promise<ServicoOficina> {
    const servico = await this.servicoRepository.buscarPorId(ServicoOficinaId.de(id));
    if (!servico) throw new RecursoNaoEncontrado('Serviço', id);
    return servico;
  }
}
