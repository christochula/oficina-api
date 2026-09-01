import { EntidadeBase } from '../../shared/domain/entidade-base';
import { RegraDeNegocio } from '../../shared/excecoes/dominio.exception';
import { PecaId } from './peca-id.value-object';

/**
 * Entidade interna do aggregate Estoque que representa uma peça cadastrada.
 * A Peça não é um Aggregate Root — só existe e é acessada através do Estoque.
 * Contém os dados cadastrais da peça e seu identificador único.
 */
export interface Peca {
  /** Identificador único da peça (ULID com prefixo `pc`). */
  id: PecaId;
  /** Código interno de identificação da peça (ex: código do fabricante). */
  codigo: string;
  /** Nome descritivo da peça. */
  nome: string;
  /** Descrição adicional da peça (opcional). */
  descricao?: string | null;
  /** Preço de venda da peça em reais. */
  precoVenda: number;
  /** Indica se a peça está ativa e disponível para uso. */
  ativo: boolean;
  /** Data de criação do cadastro da peça. */
  criadoEm: Date;
  /** Data da última atualização do cadastro da peça. */
  atualizadoEm: Date;
}

/**
 * Interface interna com as propriedades para construção e reconstituição do Estoque.
 */
interface PropriedadesEstoque {
  /** Campo legado — o ID do aggregate é derivado da peça. Não utilizado diretamente. */
  id?: string;
  /** Peça à qual este registro de estoque pertence. */
  peca: Peca;
  /** Quantidade de unidades disponíveis em estoque (padrão: 0). */
  quantidadeDisponivel?: number;
  /** Quantidade mínima desejada em estoque para alertas (padrão: 0). */
  quantidadeMinima?: number;
  /** Data da última atualização do estoque. */
  atualizadoEm?: Date;
}

/**
 * Aggregate Root do módulo de controle de peças e quantidades da oficina.
 * Encapsula uma Peça (entidade interna) e seu saldo disponível em estoque.
 *
 * Responsabilidades:
 * - Controlar entradas de peças (reposição de estoque).
 * - Controlar saídas de peças (consumo durante execução de OS).
 * - Garantir que o estoque não fique negativo.
 *
 * O ID do aggregate é o mesmo da Peça ({@link PecaId}) — há exatamente um
 * registro de Estoque por Peça no sistema.
 */
export class Estoque extends EntidadeBase<PecaId> {
  /** Peça associada a este registro de estoque. */
  peca: Peca;
  /** Quantidade atual disponível de unidades da peça. */
  quantidadeDisponivel: number;
  /** Quantidade mínima desejada para manutenção do estoque. */
  quantidadeMinima: number;

  /**
   * Construtor privado. Use `criar()` para novos registros ou `reconstituir()` para carregar do banco.
   * @param props - Propriedades do estoque.
   */
  private constructor(props: PropriedadesEstoque) {
    super(props.peca.id, undefined, props.atualizadoEm);
    this.peca = props.peca;
    this.quantidadeDisponivel = props.quantidadeDisponivel ?? 0;
    this.quantidadeMinima = props.quantidadeMinima ?? 0;
  }

  /**
   * Cria um novo registro de Estoque para uma Peça recém-cadastrada.
   * @param props - Dados iniciais do estoque, incluindo a peça.
   * @returns Nova instância de Estoque.
   */
  static criar(props: PropriedadesEstoque): Estoque {
    return new Estoque(props);
  }

  /**
   * Reconstitui um Estoque a partir dos dados persistidos no banco de dados.
   * Não aplica validações de regra de negócio.
   * @param props - Propriedades completas do estoque carregadas da persistência.
   * @returns Instância de Estoque reconstituída.
   */
  static reconstituir(props: PropriedadesEstoque): Estoque {
    return new Estoque(props);
  }

  /**
   * Aumenta a quantidade disponível da peça em estoque (reposição).
   * Utilizado no caso de uso {@link DarEntradaEstoqueUseCase}.
   * @param quantidade - Número de unidades a adicionar (deve ser maior que zero).
   * @throws RegraDeNegocio se a quantidade for menor ou igual a zero.
   */
  darEntrada(quantidade: number): void {
    if (quantidade <= 0)
      throw new RegraDeNegocio('Quantidade de entrada deve ser maior que zero');
    this.quantidadeDisponivel += quantidade;
    this.tocarAtualizadoEm();
  }

  /**
   * Reduz a quantidade disponível da peça em estoque (consumo).
   * Chamado pelo EstoqueService ao processar o evento {@link ConsumoPecaEvento}
   * disparado pela OrdemServico durante a execução.
   * @param quantidade - Número de unidades a subtrair (deve ser maior que zero).
   * @throws RegraDeNegocio se a quantidade for menor ou igual a zero.
   * @throws RegraDeNegocio se o estoque disponível for insuficiente para atender a saída.
   */
  /**
   * Atualiza os dados cadastrais da Peça interna (nome, descrição e/ou preço de venda).
   * O código da peça é imutável e não pode ser alterado por este método.
   * Utilizado pelo caso de uso {@link AtualizarPecaUseCase}.
   * @param dados - Campos a atualizar; campos omitidos não são modificados.
   */
  atualizarDadosPeca(dados: {
    nome?: string;
    descricao?: string | null;
    precoVenda?: number;
  }): void {
    if (dados.nome !== undefined) this.peca.nome = dados.nome;
    if (Object.prototype.hasOwnProperty.call(dados, 'descricao'))
      this.peca.descricao = dados.descricao;
    if (dados.precoVenda !== undefined) this.peca.precoVenda = dados.precoVenda;
    this.peca.atualizadoEm = new Date();
    this.tocarAtualizadoEm();
  }

  /** Inativa a peça associada ao estoque. */
  desativarPeca(): void {
    this.peca.ativo = false;
    this.peca.atualizadoEm = new Date();
    this.tocarAtualizadoEm();
  }

  /** Reativa a peça associada ao estoque. */
  ativarPeca(): void {
    this.peca.ativo = true;
    this.peca.atualizadoEm = new Date();
    this.tocarAtualizadoEm();
  }

  darSaida(quantidade: number): void {
    if (quantidade <= 0)
      throw new RegraDeNegocio('Quantidade de saída deve ser maior que zero');
    if (this.quantidadeDisponivel < quantidade) {
      throw new RegraDeNegocio(
        `Estoque insuficiente para a peça '${this.peca.nome}'. Disponível: ${this.quantidadeDisponivel}`,
      );
    }
    this.quantidadeDisponivel -= quantidade;
    this.tocarAtualizadoEm();
  }
}
