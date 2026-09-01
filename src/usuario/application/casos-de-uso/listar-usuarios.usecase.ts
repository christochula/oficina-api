import { Inject, Injectable } from '@nestjs/common';
import { RegraDeNegocio } from '../../../shared/excecoes/dominio.exception';
import {
  ehPapelUsuarioInterno,
  PapelUsuario,
} from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { USUARIO_REPOSITORY } from '../../domain/usuario.repository';
import type {
  FiltrosListagemUsuarios,
  UsuarioRepository,
} from '../../domain/usuario.repository';

export interface ListarUsuariosOutput {
  itens: Usuario[];
  total: number;
}

/** Lista usuários internos para a gestão administrativa. */
@Injectable()
export class ListarUsuariosUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
  ) {}

  async executar(
    pagina: number,
    porPagina: number,
    filtros: FiltrosListagemUsuarios = {},
  ): Promise<ListarUsuariosOutput> {
    if (
      filtros.papel !== undefined &&
      !ehPapelUsuarioInterno(filtros.papel as PapelUsuario)
    ) {
      throw new RegraDeNegocio(
        'A listagem administrativa aceita somente papéis internos da oficina',
      );
    }
    return this.usuarioRepository.listarInternos(pagina, porPagina, filtros);
  }
}
