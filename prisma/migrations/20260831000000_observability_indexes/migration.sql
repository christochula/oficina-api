-- Índices de suporte às consultas e aos painéis operacionais do Tech Challenge 3.
CREATE INDEX "clientes_tipoDoc_ativo_idx" ON "clientes"("tipoDoc", "ativo");
CREATE INDEX "ordens_servico_status_criadoEm_idx" ON "ordens_servico"("status", "criadoEm");
CREATE INDEX "historico_os_statusNovo_criadoEm_idx" ON "historico_os"("statusNovo", "criadoEm");
