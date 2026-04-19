import { EntidadeBase } from '../../shared/domain/entidade-base';
import { ClienteId } from './cliente-id.value-object';

/**
 * Enum que classifica o tipo de documento fiscal do cliente.
 * Determina qual validação será aplicada ao campo numeroDoc
 * e diferencia pessoa física (CPF) de pessoa jurídica (CNPJ).
 */
export enum TipoDocumento {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
}

/**
 * Interface que agrupa os dados de endereço do cliente.
 * Todos os campos são opcionais pois o endereço completo
 * pode ser preenchido progressivamente ao longo do relacionamento.
 */
interface Endereco {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

/**
 * Interface interna que define as propriedades necessárias
 * para construir ou reconstituir um Cliente.
 * Usada exclusivamente pelos factory methods da entidade.
 */
interface PropriedadesCliente {
  id?: ClienteId;
  usuarioId?: string | null;
  tipoDoc: TipoDocumento;
  numeroDoc: string;
  nome: string;
  email: string;
  telefone: string;
  endereco?: Endereco;
  ativo?: boolean;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

/**
 * Aggregate Root que representa um cliente da oficina.
 * Pode ser pessoa física (CPF) ou jurídica (CNPJ), controlado pelo campo tipoDoc.
 * O numeroDoc é o identificador único de negócio e é imutável após o cadastro —
 * alteração de documento exige recadastro completo do cliente.
 * O cliente não possui vínculo direto com veículos; essa relação se dá via OrdemServico.
 */
export class Cliente extends EntidadeBase<ClienteId> {
  usuarioId: string | null;
  readonly tipoDoc: TipoDocumento; // imutável — define se é pessoa física ou jurídica
  readonly numeroDoc: string;      // imutável — CPF ou CNPJ, identificador único de negócio
  nome: string;
  email: string;
  telefone: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  ativo: boolean; // false indica cliente inativado (soft delete)

  /**
   * Construtor privado — use os factory methods `criar` ou `reconstituir`.
   * @param props - Propriedades completas para inicializar o aggregate.
   */
  private constructor(props: PropriedadesCliente) {
    super(props.id ?? ClienteId.novo(), props.criadoEm, props.atualizadoEm);
    this.usuarioId = props.usuarioId ?? null;
    this.tipoDoc = props.tipoDoc;
    this.numeroDoc = props.numeroDoc;
    this.nome = props.nome;
    this.email = props.email;
    this.telefone = props.telefone;
    this.logradouro = props.endereco?.logradouro ?? null;
    this.numero = props.endereco?.numero ?? null;
    this.complemento = props.endereco?.complemento ?? null;
    this.bairro = props.endereco?.bairro ?? null;
    this.cidade = props.endereco?.cidade ?? null;
    this.estado = props.endereco?.estado ?? null;
    this.cep = props.endereco?.cep ?? null;
    this.ativo = props.ativo ?? true;
  }

  /**
   * Cria um novo cliente a partir de dados fornecidos pelo usuário.
   * Gera automaticamente um novo ClienteId e define ativo = true por padrão.
   * @param props - Dados obrigatórios para o cadastro, sem id nem timestamps.
   * @returns Nova instância de Cliente pronta para ser persistida.
   */
  static criar(props: Omit<PropriedadesCliente, 'id' | 'criadoEm' | 'atualizadoEm'>): Cliente {
    return new Cliente(props);
  }

  /**
   * Reconstitui um Cliente a partir de dados carregados da persistência.
   * Restaura o estado completo da entidade, incluindo id e timestamps originais.
   * @param props - Dados completos incluindo id, criadoEm e atualizadoEm.
   * @returns Instância de Cliente com estado idêntico ao armazenado no banco.
   */
  static reconstituir(props: Required<Pick<PropriedadesCliente, 'id' | 'criadoEm' | 'atualizadoEm'>> & PropriedadesCliente): Cliente {
    return new Cliente(props);
  }

  /**
   * Atualiza os dados editáveis do cliente.
   * Os campos tipoDoc e numeroDoc são imutáveis e não podem ser alterados por este método.
   * Atualiza automaticamente o timestamp atualizadoEm ao final.
   * @param dados - Objeto parcial com os campos a serem atualizados (nome, email, telefone e/ou endereço).
   */
  atualizar(dados: {
    nome?: string;
    email?: string;
    telefone?: string;
    usuarioId?: string | null;
    endereco?: Endereco;
  }): void {
    if (dados.nome !== undefined) this.nome = dados.nome;
    if (dados.email !== undefined) this.email = dados.email;
    if (dados.telefone !== undefined) this.telefone = dados.telefone;
    if (dados.usuarioId !== undefined) this.usuarioId = dados.usuarioId;
    if (dados.endereco) {
      this.logradouro = dados.endereco.logradouro ?? this.logradouro;
      this.numero = dados.endereco.numero ?? this.numero;
      this.complemento = dados.endereco.complemento ?? this.complemento;
      this.bairro = dados.endereco.bairro ?? this.bairro;
      this.cidade = dados.endereco.cidade ?? this.cidade;
      this.estado = dados.endereco.estado ?? this.estado;
      this.cep = dados.endereco.cep ?? this.cep;
    }
    this.tocarAtualizadoEm();
  }

  /** Inativa o cliente (soft delete). */
  desativar(): void {
    this.ativo = false;
    this.tocarAtualizadoEm();
  }

  /** Reativa o cliente. */
  ativar(): void {
    this.ativo = true;
    this.tocarAtualizadoEm();
  }
}
