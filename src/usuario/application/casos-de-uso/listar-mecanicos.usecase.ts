import { Inject, Injectable } from '@nestjs/common';
import { Usuario } from '../../domain/usuario.entity';
import { USUARIO_REPOSITORY } from '../../domain/usuario.repository';
import type {
  FiltrosListagemMecanicos,
  UsuarioRepository,
} from '../../domain/usuario.repository';

/** Resultado paginado da listagem de mecânicos. */
export interface ListarMecanicosOutput {
  itens: Usuario[];
  total: number;
}

/** Lista usuários mecânicos para seleção durante a atribuição de uma OS. */
@Injectable()
export class ListarMecanicosUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
  ) {}

  async executar(
    pagina: number,
    porPagina: number,
    filtros: FiltrosListagemMecanicos = {},
  ): Promise<ListarMecanicosOutput> {
    return this.usuarioRepository.listarMecanicos(pagina, porPagina, filtros);
  }
}
