import { Inject, Injectable } from '@nestjs/common';
import { ConflitoDeRecurso } from '../../../shared/excecoes/dominio.exception';
import { cleanCNPJ, cleanCPF } from '../../../shared/utils/documento-validator';
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

    const existente = await this.clienteRepository.buscarPorNumeroDoc(numeroDocNormalizado);
    if (existente) {
      throw new ConflitoDeRecurso(`Já existe um cliente com o documento '${numeroDocNormalizado}'`);
    }

    const cliente = Cliente.criar(inputNormalizado);
    await this.clienteRepository.salvar(cliente);
    return cliente;
  }
}
