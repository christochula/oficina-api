import { Inject, Injectable } from '@nestjs/common';
import {
  RegraDeNegocio,
  RecursoNaoEncontrado,
} from '../../../shared/excecoes/dominio.exception';
import { ServicoOficina } from '../../domain/servico-oficina.entity';
import { ServicoOficinaId } from '../../domain/servico-oficina-id.value-object';
import { SERVICO_OFICINA_REPOSITORY } from '../../domain/servico-oficina.repository';
import type { ServicoOficinaRepository } from '../../domain/servico-oficina.repository';

/**
 * Caso de uso que desativa um serviço do catálogo.
 * Serviços desativados deixam de aparecer na listagem e não podem ser selecionados em novas OS.
 * Apenas ADMINISTRADOR pode executar este caso de uso.
 */
@Injectable()
export class DesativarServicoOficinaUseCase {
  constructor(
    @Inject(SERVICO_OFICINA_REPOSITORY)
    private readonly servicoRepository: ServicoOficinaRepository,
  ) {}

  async executar(id: string): Promise<ServicoOficina> {
    const servico = await this.servicoRepository.buscarPorId(
      ServicoOficinaId.de(id),
    );
    if (!servico) throw new RecursoNaoEncontrado('Serviço', id);

    if (!servico.ativo) {
      throw new RegraDeNegocio('Serviço já está desativado');
    }

    servico.desativar();
    await this.servicoRepository.salvar(servico);
    return servico;
  }
}
