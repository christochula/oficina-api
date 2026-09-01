import { EventoDominio } from '../../../shared/eventos/evento-dominio';

/**
 * Evento de domínio disparado pela OrdemServico quando uma peça é consumida durante a execução.
 * É responsabilidade do caso de uso {@link RegistrarConsumoPecaUseCase} processar este evento,
 * delegando ao aggregate Estoque a operação de baixa (darSaida) na quantidade disponível.
 *
 * Ciclo de vida:
 * 1. OrdemServico.registrarConsumoPeca() cria este evento e o enfileira em `_eventos`.
 * 2. RegistrarConsumoPecaUseCase itera os eventos e chama EstoqueService.processarConsumoPeca().
 * 3. Os eventos são limpos via OrdemServico.limparEventos() após o processamento.
 */
export class ConsumoPecaEvento implements EventoDominio {
  /** Identificador do tipo de evento. Utilizado para roteamento e logging. */
  readonly tipo = 'ConsumoPeca';
  /** Data e hora em que o evento ocorreu. Preenchida automaticamente na criação. */
  readonly ocorridoEm: Date;

  /**
   * Cria uma nova instância do evento de consumo de peça.
   * @param ordemServicoId - ID da OS que gerou o consumo.
   * @param pecaId - ID da peça consumida do estoque.
   * @param quantidade - Quantidade de unidades consumidas (deve ser maior que zero).
   */
  constructor(
    readonly ordemServicoId: string,
    readonly pecaId: string,
    readonly quantidade: number,
  ) {
    this.ocorridoEm = new Date();
  }
}
