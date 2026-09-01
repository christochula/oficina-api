import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Veiculo } from '../../domain/veiculo.entity';
import { VeiculoId } from '../../domain/veiculo-id.value-object';
import { VeiculoRepository } from '../../domain/veiculo.repository';

/**
 * Implementação do VeiculoRepository utilizando Prisma como ORM.
 * Faz a ponte entre o aggregate Veiculo (domínio) e a tabela `veiculos` (PostgreSQL).
 * Garante que os tipos Prisma não vazem para a camada de domínio por meio do método privado `mapear`.
 */
@Injectable()
export class PrismaVeiculoRepository implements VeiculoRepository {
  /**
   * @param prisma - Serviço global do Prisma para acesso ao banco de dados.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persiste o veículo no banco usando upsert.
   * Insere todos os campos na criação e atualiza apenas os campos editáveis
   * (cor, quilometragem, ativo) nas atualizações. Placa, RENAVAM e chassi nunca são alterados no bloco update.
   * @param veiculo - Aggregate Veiculo com estado a ser persistido.
   */
  async salvar(veiculo: Veiculo): Promise<void> {
    await this.prisma.veiculo.upsert({
      where: { id: veiculo.id.valor },
      create: {
        id: veiculo.id.valor,
        placa: veiculo.placa,
        renavam: veiculo.renavam,
        chassi: veiculo.chassi,
        marca: veiculo.marca,
        modelo: veiculo.modelo,
        ano: veiculo.ano,
        cor: veiculo.cor,
        quilometragem: veiculo.quilometragem,
        ativo: veiculo.ativo,
        criadoEm: veiculo.criadoEm,
        atualizadoEm: veiculo.atualizadoEm,
      },
      update: {
        cor: veiculo.cor,
        quilometragem: veiculo.quilometragem,
        ativo: veiculo.ativo,
        atualizadoEm: veiculo.atualizadoEm,
      },
    });
  }

  /**
   * Busca um veículo pelo identificador interno (VeiculoId com prefixo "ve").
   * @param id - VeiculoId do veículo desejado.
   * @returns Veiculo reconstituído ou null se não encontrado.
   */
  async buscarPorId(id: VeiculoId): Promise<Veiculo | null> {
    const r = await this.prisma.veiculo.findUnique({ where: { id: id.valor } });
    if (!r) return null;
    return this.mapear(r);
  }

  /**
   * Busca um veículo pela placa, aproveitando a constraint unique da coluna `placa`.
   * @param placa - Placa do veículo (formato Mercosul ou padrão antigo).
   * @returns Veiculo reconstituído ou null se não encontrado.
   */
  async buscarPorPlaca(placa: string): Promise<Veiculo | null> {
    const r = await this.prisma.veiculo.findUnique({ where: { placa } });
    if (!r) return null;
    return this.mapear(r);
  }

  /**
   * Lista veículos de forma paginada, ordenados por placa (ASC).
   * @param pagina - Número da página (base 1).
   * @param porPagina - Quantidade de registros por página.
   * @returns Lista de veículos da página e total geral de registros.
   */
  async listar(
    pagina: number,
    porPagina: number,
  ): Promise<{ itens: Veiculo[]; total: number }> {
    const [registros, total] = await Promise.all([
      this.prisma.veiculo.findMany({
        orderBy: { placa: 'asc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.prisma.veiculo.count(),
    ]);
    return { itens: registros.map((r) => this.mapear(r)), total };
  }

  /**
   * Converte um registro Prisma (modelo de persistência) em um aggregate Veiculo (domínio).
   * Este mapeamento explícito garante que os tipos do Prisma não vazem para além da camada de infraestrutura.
   * @param r - Registro bruto retornado pelo Prisma.
   * @returns Instância de Veiculo reconstituída com estado idêntico ao persistido.
   */
  private mapear(r: {
    id: string;
    placa: string;
    renavam: string;
    chassi: string;
    marca: string;
    modelo: string;
    ano: number;
    cor: string;
    quilometragem: number;
    ativo: boolean;
    criadoEm: Date;
    atualizadoEm: Date;
  }): Veiculo {
    return Veiculo.reconstituir({
      id: VeiculoId.de(r.id),
      placa: r.placa,
      renavam: r.renavam,
      chassi: r.chassi,
      marca: r.marca,
      modelo: r.modelo,
      ano: r.ano,
      cor: r.cor,
      quilometragem: r.quilometragem,
      ativo: r.ativo,
      criadoEm: r.criadoEm,
      atualizadoEm: r.atualizadoEm,
    });
  }
}
