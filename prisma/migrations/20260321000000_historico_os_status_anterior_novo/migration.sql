-- AlterTable: adiciona statusAnterior e statusNovo ao historico_os
-- Ambos são nullable para compatibilidade com registros históricos existentes.
-- statusAnterior é null apenas no evento ORDEM_ABERTA (não há status anterior na criação).
-- Eventos sem transição de status (PECA_CONSUMIDA) têm statusAnterior = statusNovo.

ALTER TABLE "historico_os"
  ADD COLUMN "statusAnterior" "StatusOrdemServico",
  ADD COLUMN "statusNovo"     "StatusOrdemServico";
