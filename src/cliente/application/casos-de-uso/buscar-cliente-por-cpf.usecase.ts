import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { cleanCNPJ } from '../../../shared/utils/documento-validator';
import { Cliente } from '../../domain/cliente.entity';
import { CLIENTE_REPOSITORY } from '../../domain/cliente.repository';
import type { ClienteRepository } from '../../domain/cliente.repository';

/**
 * Caso de uso responsável por localizar um cliente pelo número do documento (CPF ou CNPJ).
 * Serve como ponto de entrada para consultas da rota GET /clientes/documento/:numeroDoc,
 * permitindo que operadores da oficina identifiquem um cliente já cadastrado sem conhecer seu ID interno.
 */
@Injectable()
export class BuscarClientePorNumeroDocUseCase {
  /**
   * @param clienteRepository - Repositório de clientes injetado via token CLIENTE_REPOSITORY.
   */
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {}

  /**
   * Executa a busca do cliente pelo número de documento fornecido.
   * @param numeroDoc - CPF ou CNPJ sem formatação (apenas dígitos).
   * @returns O aggregate Cliente encontrado.
   * @throws RecursoNaoEncontrado se nenhum cliente possuir o documento informado.
   */
  async executar(numeroDoc: string): Promise<Cliente> {
    // cleanCNPJ detecta automaticamente se é numérico ou alfanumérico (novo CNPJ julho/2026)
    // e aplica a limpeza correta — funciona igualmente para CPF (sem letras = só dígitos).
    const docNormalizado = cleanCNPJ(numeroDoc);
    const cliente =
      await this.clienteRepository.buscarPorNumeroDoc(docNormalizado);
    if (!cliente) throw new RecursoNaoEncontrado('Cliente', docNormalizado);
    return cliente;
  }
}
