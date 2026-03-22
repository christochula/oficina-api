import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Estoque, Peca } from '../../domain/estoque.entity';
import { PecaId } from '../../domain/peca-id.value-object';
import { EstoqueRepository, EstoqueService } from '../../domain/estoque.repository';
import { RegraDeNegocio, RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';

/**
 * Implementação do repositório e serviço de Estoque utilizando Prisma ORM.
 * Implementa simultaneamente {@link EstoqueRepository} e {@link EstoqueService},
 * sendo registrada no módulo para ambos os tokens de injeção.
 *
 * Responsabilidades:
 * - Persistir e reconstituir o aggregate Estoque (com a Peça interna).
 * - Processar eventos de consumo de peça disparados pela OrdemServico.
 * - Realizar o mapeamento entre tipos Prisma e tipos de domínio.
 *
 * Estratégia de persistência em `salvar`:
 * - Se a Peça não existe: cria Peça e Estoque juntos em uma operação.
 * - Se a Peça existe: realiza upsert apenas no Estoque (quantidades e data).
 */
@Injectable()
export class PrismaEstoqueRepository implements EstoqueRepository, EstoqueService {
  /** @param prisma - Serviço Prisma injetado para acesso ao banco de dados. */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persiste o aggregate Estoque no banco de dados.
   * Estratégia diferenciada conforme existência prévia da Peça.
   * @param estoque - Aggregate Estoque a ser salvo.
   */
  async salvar(estoque: Estoque): Promise<void> {
    const pecaExiste = await this.prisma.peca.findUnique({ where: { id: estoque.peca.id.valor } });

    if (!pecaExiste) {
      await this.prisma.peca.create({
        data: {
          id: estoque.peca.id.valor,
          codigo: estoque.peca.codigo,
          nome: estoque.peca.nome,
          descricao: estoque.peca.descricao,
          precoVenda: estoque.peca.precoVenda,
          ativo: estoque.peca.ativo,
          criadoEm: estoque.peca.criadoEm,
          atualizadoEm: estoque.peca.atualizadoEm,
          estoque: {
            create: {
              quantidadeDisponivel: estoque.quantidadeDisponivel,
              quantidadeMinima: estoque.quantidadeMinima,
              atualizadoEm: estoque.atualizadoEm,
            },
          },
        },
      });
    } else {
      await this.prisma.$transaction([
        this.prisma.peca.update({
          where: { id: estoque.peca.id.valor },
          data: {
            nome: estoque.peca.nome,
            descricao: estoque.peca.descricao,
            precoVenda: estoque.peca.precoVenda,
            atualizadoEm: estoque.peca.atualizadoEm,
          },
        }),
        this.prisma.estoque.upsert({
          where: { pecaId: estoque.peca.id.valor },
          create: {
            pecaId: estoque.peca.id.valor,
            quantidadeDisponivel: estoque.quantidadeDisponivel,
            quantidadeMinima: estoque.quantidadeMinima,
            atualizadoEm: estoque.atualizadoEm,
          },
          update: {
            quantidadeDisponivel: estoque.quantidadeDisponivel,
            quantidadeMinima: estoque.quantidadeMinima,
            atualizadoEm: estoque.atualizadoEm,
          },
        }),
      ]);
    }
  }

  /**
   * Busca o registro de estoque pelo PecaId tipado.
   * @param pecaId - PecaId da peça cujo estoque deve ser buscado.
   * @returns O Estoque reconstituído ou null se não existir.
   */
  async buscarPorPecaId(pecaId: PecaId): Promise<Estoque | null> {
    const r = await this.prisma.estoque.findUnique({
      where: { pecaId: pecaId.valor },
      include: { peca: true },
    });
    if (!r) return null;
    return this.mapear(r);
  }

  /**
   * Busca o registro de estoque pela string do ID da peça.
   * @param id - String do ID da peça.
   * @returns O Estoque reconstituído ou null se não existir.
   */
  async buscarPorId(id: string): Promise<Estoque | null> {
    const r = await this.prisma.estoque.findUnique({
      where: { pecaId: id },
      include: { peca: true },
    });
    if (!r) return null;
    return this.mapear(r);
  }

  /**
   * Lista registros de estoque de forma paginada, ordenados por nome da peça (ASC).
   * @param pagina - Número da página (base 1).
   * @param porPagina - Quantidade de registros por página.
   * @returns Lista de Estoques da página e contagem total.
   */
  async listar(pagina: number, porPagina: number): Promise<{ itens: Estoque[]; total: number }> {
    const [registros, total] = await Promise.all([
      this.prisma.estoque.findMany({
        include: { peca: true },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        orderBy: { peca: { nome: 'asc' } },
      }),
      this.prisma.estoque.count(),
    ]);
    return { itens: registros.map((r) => this.mapear(r)), total };
  }

  /**
   * Implementação do EstoqueService: processa o consumo de uma peça.
   * Chamado pelo caso de uso {@link RegistrarConsumoPecaUseCase} ao processar
   * eventos {@link ConsumoPecaEvento} disparados pela OrdemServico.
   * @param pecaId - ID da peça consumida.
   * @param quantidade - Quantidade de unidades a subtrair do estoque.
   * @throws RecursoNaoEncontrado se não houver registro de estoque para a peça.
   * @throws RegraDeNegocio se o estoque disponível for insuficiente.
   */
  async processarConsumoPeca(pecaId: string, quantidade: number): Promise<void> {
    const estoque = await this.buscarPorPecaId(PecaId.de(pecaId));
    if (!estoque) throw new RecursoNaoEncontrado('Estoque para peça', pecaId);

    estoque.darSaida(quantidade);
    await this.salvar(estoque);
  }

  /**
   * Mapeia um registro bruto do Prisma para o aggregate Estoque de domínio.
   * Converte tipos Decimal do Prisma para number e monta os objetos de domínio.
   * @param r - Registro bruto retornado pelo Prisma com a relação `peca` incluída.
   * @returns Instância de Estoque reconstituída com todos os dados.
   */
  private mapear(r: {
    pecaId: string; quantidadeDisponivel: unknown; quantidadeMinima: unknown; atualizadoEm: Date;
    peca: { id: string; codigo: string; nome: string; descricao: string | null; precoVenda: unknown; ativo: boolean; criadoEm: Date; atualizadoEm: Date };
  }): Estoque {
    const peca: Peca = {
      id: PecaId.de(r.peca.id),
      codigo: r.peca.codigo,
      nome: r.peca.nome,
      descricao: r.peca.descricao,
      precoVenda: Number(r.peca.precoVenda),
      ativo: r.peca.ativo,
      criadoEm: r.peca.criadoEm,
      atualizadoEm: r.peca.atualizadoEm,
    };

    return Estoque.reconstituir({
      peca,
      quantidadeDisponivel: Number(r.quantidadeDisponivel),
      quantidadeMinima: Number(r.quantidadeMinima),
      atualizadoEm: r.atualizadoEm,
    });
  }
}
