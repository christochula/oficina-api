import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Cliente, TipoDocumento } from '../../domain/cliente.entity';
import { ClienteId } from '../../domain/cliente-id.value-object';
import { ClienteRepository } from '../../domain/cliente.repository';

/**
 * Implementação do ClienteRepository utilizando Prisma como ORM.
 * Faz a ponte entre o aggregate Cliente (domínio) e a tabela `clientes` (PostgreSQL).
 * Garante que os tipos Prisma não vazem para a camada de domínio por meio do método privado `mapear`.
 */
@Injectable()
export class PrismaClienteRepository implements ClienteRepository {
  /**
   * @param prisma - Serviço global do Prisma para acesso ao banco de dados.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persiste o cliente no banco usando upsert.
   * Insere na criação e atualiza apenas os campos editáveis (nome, email, telefone, endereço, ativo)
   * nas atualizações. tipoDoc e numeroDoc nunca são alterados no bloco update.
   * @param cliente - Aggregate Cliente com estado a ser persistido.
   */
  async salvar(cliente: Cliente): Promise<void> {
    await this.prisma.cliente.upsert({
      where: { id: cliente.id.valor },
      create: {
        id: cliente.id.valor,
        tipoDoc: cliente.tipoDoc,
        numeroDoc: cliente.numeroDoc,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        logradouro: cliente.logradouro,
        numero: cliente.numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        cep: cliente.cep,
        ativo: cliente.ativo,
        criadoEm: cliente.criadoEm,
        atualizadoEm: cliente.atualizadoEm,
      },
      update: {
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        logradouro: cliente.logradouro,
        numero: cliente.numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        cep: cliente.cep,
        ativo: cliente.ativo,
        atualizadoEm: cliente.atualizadoEm,
      },
    });
  }

  /**
   * Busca um cliente pelo identificador interno (ClienteId com prefixo "cl").
   * @param id - ClienteId do cliente desejado.
   * @returns Cliente reconstituído ou null se não encontrado.
   */
  async buscarPorId(id: ClienteId): Promise<Cliente | null> {
    const registro = await this.prisma.cliente.findUnique({ where: { id: id.valor } });
    if (!registro) return null;
    return this.mapear(registro);
  }

  /**
   * Busca um cliente pelo número do documento (CPF ou CNPJ).
   * Aproveita a constraint unique da coluna `numeroDoc` para busca eficiente.
   * @param numeroDoc - CPF ou CNPJ sem formatação.
   * @returns Cliente reconstituído ou null se não encontrado.
   */
  async buscarPorNumeroDoc(numeroDoc: string): Promise<Cliente | null> {
    const registro = await this.prisma.cliente.findUnique({ where: { numeroDoc } });
    if (!registro) return null;
    return this.mapear(registro);
  }

  /**
   * Lista clientes de forma paginada, ordenados por nome (ASC).
   * @param pagina - Número da página (base 1).
   * @param porPagina - Quantidade de registros por página.
   * @returns Lista de clientes da página e total geral de registros.
   */
  async listar(pagina: number, porPagina: number): Promise<{ itens: Cliente[]; total: number }> {
    const [registros, total] = await Promise.all([
      this.prisma.cliente.findMany({
        orderBy: { nome: 'asc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.prisma.cliente.count(),
    ]);
    return { itens: registros.map((r) => this.mapear(r)), total };
  }

  /**
   * Converte um registro Prisma (modelo de persistência) em um aggregate Cliente (domínio).
   * Este mapeamento explícito garante que os tipos do Prisma não vazem para além da camada de infraestrutura.
   * @param r - Registro bruto retornado pelo Prisma.
   * @returns Instância de Cliente reconstituída com estado idêntico ao persistido.
   */
  private mapear(r: {
    id: string; tipoDoc: string; numeroDoc: string; nome: string; email: string;
    telefone: string; logradouro: string | null; numero: string | null;
    complemento: string | null; bairro: string | null; cidade: string | null;
    estado: string | null; cep: string | null; ativo: boolean;
    criadoEm: Date; atualizadoEm: Date;
  }): Cliente {
    return Cliente.reconstituir({
      id: ClienteId.de(r.id),
      tipoDoc: r.tipoDoc as TipoDocumento,
      numeroDoc: r.numeroDoc,
      nome: r.nome,
      email: r.email,
      telefone: r.telefone,
      endereco: {
        logradouro: r.logradouro ?? undefined,
        numero: r.numero ?? undefined,
        complemento: r.complemento ?? undefined,
        bairro: r.bairro ?? undefined,
        cidade: r.cidade ?? undefined,
        estado: r.estado ?? undefined,
        cep: r.cep ?? undefined,
      },
      ativo: r.ativo,
      criadoEm: r.criadoEm,
      atualizadoEm: r.atualizadoEm,
    });
  }
}
