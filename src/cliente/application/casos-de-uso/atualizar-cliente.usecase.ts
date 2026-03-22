import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Cliente } from '../../domain/cliente.entity';
import { ClienteId } from '../../domain/cliente-id.value-object';
import { CLIENTE_REPOSITORY } from '../../domain/cliente.repository';
import type { ClienteRepository } from '../../domain/cliente.repository';

/**
 * DTO de entrada para o caso de uso de atualização de cliente.
 * Contém apenas os campos permitidos para edição.
 * tipoDoc e numeroDoc são intencionalmente omitidos pois são imutáveis.
 */
export interface AtualizarClienteInput {
  /** Identificador interno do cliente (ClienteId com prefixo "cl"). */
  id: string;
  nome?: string;
  email?: string;
  telefone?: string;
  /** Campos de endereço que serão atualizados; campos ausentes mantêm o valor existente. */
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
 * Caso de uso responsável por atualizar os dados editáveis de um cliente existente.
 * Aplica a regra de negócio de que tipoDoc e numeroDoc são imutáveis —
 * esses campos não fazem parte do input e não são alterados pela entidade.
 */
@Injectable()
export class AtualizarClienteUseCase {
  /**
   * @param clienteRepository - Repositório de clientes injetado via token CLIENTE_REPOSITORY.
   */
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {}

  /**
   * Localiza o cliente, aplica as alterações permitidas e persiste o resultado.
   * @param input - Dados de atualização, incluindo o id do cliente e campos opcionais.
   * @returns O aggregate Cliente com o estado atualizado.
   * @throws RecursoNaoEncontrado se nenhum cliente for encontrado com o id informado.
   */
  async executar(input: AtualizarClienteInput): Promise<Cliente> {
    const cliente = await this.clienteRepository.buscarPorId(ClienteId.de(input.id));
    if (!cliente) throw new RecursoNaoEncontrado('Cliente', input.id);

    cliente.atualizar({
      nome: input.nome,
      email: input.email,
      telefone: input.telefone,
      endereco: input.endereco,
    });

    await this.clienteRepository.salvar(cliente);
    return cliente;
  }
}
