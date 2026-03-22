import { Inject, Injectable } from '@nestjs/common';
import { RegraDeNegocio, RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { ServicoOficina } from '../../domain/servico-oficina.entity';
import { ServicoOficinaId } from '../../domain/servico-oficina-id.value-object';
import { SERVICO_OFICINA_REPOSITORY } from '../../domain/servico-oficina.repository';
import type { ServicoOficinaRepository } from '../../domain/servico-oficina.repository';

export interface AtualizarServicoOficinaInput {
  id: string;
  nome?: string;
  descricao?: string | null;
  categoria?: string | null;
}

/**
 * Caso de uso que atualiza os dados de um serviço do catálogo.
 * Ao menos um campo deve ser informado.
 * Apenas ADMINISTRADOR pode executar este caso de uso.
 */
@Injectable()
export class AtualizarServicoOficinaUseCase {
  constructor(
    @Inject(SERVICO_OFICINA_REPOSITORY)
    private readonly servicoRepository: ServicoOficinaRepository,
  ) {}

  async executar(input: AtualizarServicoOficinaInput): Promise<ServicoOficina> {
    const { id, ...dados } = input;

    const temAlgumCampo =
      dados.nome !== undefined ||
      Object.prototype.hasOwnProperty.call(dados, 'descricao') ||
      Object.prototype.hasOwnProperty.call(dados, 'categoria');

    if (!temAlgumCampo) {
      throw new RegraDeNegocio('Ao menos um campo deve ser informado para atualização');
    }

    const servico = await this.servicoRepository.buscarPorId(ServicoOficinaId.de(id));
    if (!servico) throw new RecursoNaoEncontrado('Serviço', id);

    servico.atualizar(dados);
    await this.servicoRepository.salvar(servico);
    return servico;
  }
}
