import { Inject, Injectable } from '@nestjs/common';
import {
  ConflitoDeRecurso,
  RecursoNaoEncontrado,
  RegraDeNegocio,
} from '../../../shared/excecoes/dominio.exception';
import { cleanCNPJ, cleanCPF } from '../../../shared/utils/documento-validator';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { UsuarioId } from '../../../usuario/domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../../../usuario/domain/usuario.repository';
import type { UsuarioRepository } from '../../../usuario/domain/usuario.repository';
import { Cliente, TipoDocumento } from '../../domain/cliente.entity';
import { CLIENTE_REPOSITORY } from '../../domain/cliente.repository';
import type { ClienteRepository } from '../../domain/cliente.repository';

/**
 * DTO de entrada para o caso de uso de criação de cliente.
 * Contém todos os dados necessários para o primeiro cadastro,
 * incluindo o tipoDoc e numeroDoc que serão imutáveis após a criação.
 */
export interface CriarClienteInput {
  /** Tipo de documento: CPF para pessoa física, CNPJ para pessoa jurídica. */
  tipoDoc: TipoDocumento;
  /** Número do documento sem formatação (apenas dígitos). Imutável após o cadastro. */
  numeroDoc: string;
  nome: string;
  email: string;
  telefone: string;
  /** Vinculo opcional com um usuario autenticavel de papel CLIENTE. */
  usuarioId?: string | null;
  /** Endereço completo ou parcial do cliente. Todos os subcampos são opcionais. */
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  };
}

/**
 * Caso de uso responsável pelo cadastro de novos clientes na oficina.
 * Garante a unicidade pelo número do documento (CPF ou CNPJ) antes de persistir.
 * Retorna 409 Conflict se já existir um cliente com o mesmo documento.
 */
@Injectable()
export class CriarClienteUseCase {
  /**
   * @param clienteRepository - Repositório de clientes injetado via token CLIENTE_REPOSITORY.
   */
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
  ) {}

  /**
   * Executa o cadastro de um novo cliente após verificar unicidade do documento.
   * @param input - Dados do novo cliente, incluindo tipoDoc e numeroDoc.
   * @returns O aggregate Cliente recém-criado e persistido.
   * @throws ConflitoDeRecurso se já existir um cliente com o mesmo numeroDoc.
   */
  async executar(input: CriarClienteInput): Promise<Cliente> {
    // Normaliza o documento usando o utilitário interno:
    // - CPF: remove todos os não-numéricos
    // - CNPJ: remove não-numéricos (formato tradicional) ou não-alfanuméricos (novo formato julho/2026)
    // O front-end é responsável por aplicar máscaras de exibição.
    const numeroDocNormalizado =
      input.tipoDoc === TipoDocumento.CPF
        ? cleanCPF(input.numeroDoc)
        : cleanCNPJ(input.numeroDoc);
    const inputNormalizado = { ...input, numeroDoc: numeroDocNormalizado };

    const existente =
      await this.clienteRepository.buscarPorNumeroDoc(numeroDocNormalizado);
    if (existente) {
      throw new ConflitoDeRecurso(
        `Já existe um cliente com o documento '${numeroDocNormalizado}'`,
      );
    }

    const usuarioId = await this.resolverUsuarioAssociado(
      input.email,
      input.usuarioId ?? undefined,
    );
    const cliente = Cliente.criar({ ...inputNormalizado, usuarioId });
    await this.clienteRepository.salvar(cliente);
    return cliente;
  }

  private async resolverUsuarioAssociado(
    email: string,
    usuarioId?: string,
  ): Promise<string | null> {
    if (usuarioId) {
      const usuario = await this.usuarioRepository.buscarPorId(
        UsuarioId.de(usuarioId),
      );
      if (!usuario) throw new RecursoNaoEncontrado('Usuário', usuarioId);
      if (usuario.papel !== PapelUsuario.CLIENTE) {
        throw new RegraDeNegocio(
          'Apenas usuários com papel CLIENTE podem ser vinculados a clientes.',
        );
      }

      const clienteExistente =
        await this.clienteRepository.buscarPorUsuarioId(usuarioId);
      if (clienteExistente) {
        throw new ConflitoDeRecurso(
          `Usuário '${usuarioId}' já está vinculado a outro cliente.`,
        );
      }
      return usuario.id.valor;
    }

    const usuario = await this.usuarioRepository.buscarPorEmail(email);
    if (!usuario || usuario.papel !== PapelUsuario.CLIENTE) return null;

    const clienteExistente = await this.clienteRepository.buscarPorUsuarioId(
      usuario.id.valor,
    );
    if (clienteExistente) return null;
    return usuario.id.valor;
  }
}
