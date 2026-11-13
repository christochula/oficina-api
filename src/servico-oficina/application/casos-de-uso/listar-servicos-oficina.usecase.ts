import { Inject, Injectable } from '@nestjs/common';
import { ServicoOficina } from '../../domain/servico-oficina.entity';
import { SERVICO_OFICINA_REPOSITORY } from '../../domain/servico-oficina.repository';
import type {
  ServicoOficinaRepository,
  ServicoListFilters,
} from '../../domain/servico-oficina.repository';

/**
 * Caso de uso que lista os serviços ativos do catálogo da oficina de forma paginada.
 */
@Injectable()
export class ListarServicosOficinaUseCase {
  constructor(
    @Inject(SERVICO_OFICINA_REPOSITORY)
    private readonly servicoRepository: ServicoOficinaRepository,
  ) {}

  async executar(
    pagina: number,
    porPagina: number,
    filtros?: ServicoListFilters,
  ): Promise<{ itens: ServicoOficina[]; total: number }> {
    return filtros
      ? this.servicoRepository.listar(pagina, porPagina, filtros)
      : this.servicoRepository.listar(pagina, porPagina);
  }
}
