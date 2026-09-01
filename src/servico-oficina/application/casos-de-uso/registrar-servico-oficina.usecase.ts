import { Inject, Injectable } from '@nestjs/common';
import { ServicoOficina } from '../../domain/servico-oficina.entity';
import { SERVICO_OFICINA_REPOSITORY } from '../../domain/servico-oficina.repository';
import type { ServicoOficinaRepository } from '../../domain/servico-oficina.repository';

export interface RegistrarServicoOficinaInput {
  nome: string;
  descricao?: string;
  categoria?: string;
}

/**
 * Caso de uso que registra um novo serviço no catálogo da oficina.
 * Apenas ADMINISTRADOR pode executar este caso de uso.
 */
@Injectable()
export class RegistrarServicoOficinaUseCase {
  constructor(
    @Inject(SERVICO_OFICINA_REPOSITORY)
    private readonly servicoRepository: ServicoOficinaRepository,
  ) {}

  async executar(input: RegistrarServicoOficinaInput): Promise<ServicoOficina> {
    const servico = ServicoOficina.criar(input);
    await this.servicoRepository.salvar(servico);
    return servico;
  }
}
