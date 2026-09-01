import { ApiProperty } from '@nestjs/swagger';
import { Usuario } from '../../../../domain/usuario.entity';
import { PapelUsuario } from '../../../../domain/papel-usuario.enum';

/**
 * DTO de saída que representa os dados públicos de um usuário nas respostas da API.
 *
 * Expõe apenas os campos seguros da entidade {@link Usuario}, omitindo deliberadamente
 * `senhaHash` e `refreshTokenHash` para proteger dados sensíveis.
 * O método estático `de` serve como mapeador da entidade de domínio para este DTO.
 */
export class RespostaUsuarioDto {
  /** Identificador único do usuário no formato ULID com prefixo `us`. */
  @ApiProperty()
  id: string;

  /** Nome completo do usuário. */
  @ApiProperty()
  nome: string;

  /** E-mail do usuário; utilizado como login no sistema. */
  @ApiProperty()
  email: string;

  /** Papel do usuário que determina suas permissões no sistema. */
  @ApiProperty({ enum: PapelUsuario })
  papel: PapelUsuario;

  /** Indica se o usuário está ativo e pode acessar o sistema. */
  @ApiProperty()
  ativo: boolean;

  /** Data e hora de criação do cadastro do usuário. */
  @ApiProperty()
  criadoEm: Date;

  /**
   * Mapeia uma entidade de domínio {@link Usuario} para o DTO de resposta.
   * Garante que dados sensíveis (senhaHash, refreshTokenHash) não sejam expostos.
   * @param usuario - Entidade de domínio a ser convertida.
   * @returns Instância populada de {@link RespostaUsuarioDto}.
   */
  static de(usuario: Usuario): RespostaUsuarioDto {
    const dto = new RespostaUsuarioDto();
    dto.id = usuario.id.valor;
    dto.nome = usuario.nome;
    dto.email = usuario.email;
    dto.papel = usuario.papel;
    dto.ativo = usuario.ativo;
    dto.criadoEm = usuario.criadoEm;
    return dto;
  }
}
