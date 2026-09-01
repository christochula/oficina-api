import { monotonicFactory } from 'ulidx';

/** Fábrica de ULID monotônico — garante ordenação crescente mesmo dentro do mesmo milissegundo. */
const ulid = monotonicFactory();

/**
 * Objeto de valor base abstrato para todos os identificadores únicos do sistema.
 *
 * Combina um prefixo de duas letras que identifica o tipo de aggregate (ex: 'os', 'cl', 've')
 * com um ULID monotônico, garantindo unicidade global, rastreabilidade por tipo de entidade
 * e ordenação lexicográfica por tempo de criação.
 *
 * Subclasses concretas definem o prefixo fixo de cada aggregate root
 * (ex: `OrdemServicoId` usa 'os', `ClienteId` usa 'cl').
 */
export abstract class IdUnico {
  /** Valor textual completo do identificador, no formato `<prefixo><ULID>`. */
  readonly valor: string;

  /**
   * Cria ou reconstitui um identificador único.
   *
   * Quando `valor` é omitido, gera um novo identificador concatenando o prefixo
   * com um ULID monotônico recém-gerado. Quando `valor` é fornecido, reconstitui
   * o identificador a partir de um valor persistido, sem gerar novo ULID.
   *
   * @param prefixo - Prefixo curto que identifica o tipo de entidade (ex: 'os', 'cl', 've').
   * @param valor - Valor existente para reconstituição; se omitido, gera novo identificador.
   */
  protected constructor(prefixo: string, valor?: string) {
    this.valor = valor ?? `${prefixo}${ulid()}`;
  }

  /**
   * Compara dois identificadores por igualdade de valor.
   * Dois IDs são iguais se e somente se seus valores textuais forem idênticos.
   *
   * @param outro - Outro identificador a ser comparado.
   * @returns `true` se os valores forem iguais; `false` caso contrário.
   */
  equals(outro: IdUnico): boolean {
    return this.valor === outro.valor;
  }

  /**
   * Retorna a representação textual do identificador.
   * Útil para serialização, logs e persistência.
   *
   * @returns O valor completo do identificador (prefixo + ULID).
   */
  toString(): string {
    return this.valor;
  }
}
