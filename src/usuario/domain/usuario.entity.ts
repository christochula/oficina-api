import { EntidadeBase } from '../../shared/domain/entidade-base';
import { PapelUsuario } from './papel-usuario.enum';
import { UsuarioId } from './usuario-id.value-object';

/**
 * Propriedades necessárias para construir ou reconstituir um Usuario.
 * O campo `id` é opcional na criação, pois é gerado automaticamente pelo domínio.
 */
interface PropriedadesUsuario {
  id?: UsuarioId;
  nome: string;
  email: string;
  senhaHash: string; // Hash bcrypt da senha — a senha em texto simples nunca é armazenada
  papel: PapelUsuario;
  refreshTokenHash?: string | null; // Hash bcrypt do refresh token ativo; null quando não autenticado
  ativo?: boolean; // Indica se o usuário pode acessar o sistema; padrão true na criação
  criadoEm?: Date;
  atualizadoEm?: Date;
}

/**
 * Entidade de domínio que representa um usuário do sistema da oficina.
 *
 * Cobre tanto usuários internos (ADMINISTRADOR, CONSULTOR_TECNICO, MECANICO)
 * quanto externos (CLIENTE). É o aggregate root do módulo de usuários e
 * centraliza as regras de negócio relacionadas ao controle de acesso.
 * O construtor é privado — criação e reconstituição ocorrem via fábricas estáticas.
 */
export class Usuario extends EntidadeBase<UsuarioId> {
  nome: string;
  email: string; // Identificador único de negócio — usado no login e como chave de unicidade
  senhaHash: string; // Hash bcrypt da senha — jamais expor em respostas de API
  papel: PapelUsuario; // Define as permissões e o escopo de acesso do usuário
  refreshTokenHash: string | null; // Hash do último refresh token emitido; null após logout
  ativo: boolean; // Controle de acesso: usuários inativos não podem autenticar

  /**
   * Construtor privado — use os métodos fábrica `criar` ou `reconstituir`.
   * @param props - Propriedades iniciais do usuário.
   */
  private constructor(props: PropriedadesUsuario) {
    super(props.id ?? UsuarioId.novo(), props.criadoEm, props.atualizadoEm);
    this.nome = props.nome;
    this.email = props.email;
    this.senhaHash = props.senhaHash;
    this.papel = props.papel;
    this.refreshTokenHash = props.refreshTokenHash ?? null;
    this.ativo = props.ativo ?? true;
  }

  /**
   * Fábrica para criação de um novo usuario.
   * Gera um novo UsuarioId automaticamente e define `ativo` como `true`.
   * @param props - Dados do usuário sem `id`, `criadoEm` e `atualizadoEm`.
   */
  static criar(props: Omit<PropriedadesUsuario, 'id' | 'criadoEm' | 'atualizadoEm'>): Usuario {
    return new Usuario(props);
  }

  /**
   * Fábrica para reconstituir um usuario a partir de dados persistidos.
   * Usado exclusivamente pela camada de infraestrutura ao ler do banco de dados.
   * @param props - Dados completos do usuário conforme armazenados.
   */
  static reconstituir(props: Required<PropriedadesUsuario>): Usuario {
    return new Usuario(props);
  }

  /**
   * Atualiza o hash do refresh token armazenado para o usuário.
   * Passar `null` invalida a sessão ativa (equivalente a logout).
   * @param hash - Hash bcrypt do novo refresh token, ou `null` para revogar.
   */
  atualizarRefreshToken(hash: string | null): void {
    this.refreshTokenHash = hash;
    this.tocarAtualizadoEm();
  }

  /**
   * Desativa o usuário, impedindo futuros logins sem removê-lo do sistema.
   * A desativação é irreversível por este método — reativação requer acesso direto ao repositório.
   */
  desativar(): void {
    this.ativo = false;
    this.tocarAtualizadoEm();
  }
}
