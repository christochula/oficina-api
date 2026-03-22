-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ADMINISTRADOR', 'CONSULTOR_TECNICO', 'MECANICO', 'CLIENTE');

-- CreateEnum
CREATE TYPE "StatusOrdemServico" AS ENUM ('RECEBIDA', 'ATRIBUIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'APROVADA', 'EM_EXECUCAO', 'FINALIZADA', 'ENTREGUE', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoLinhaServico" AS ENUM ('MATERIAL', 'SERVICO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CPF', 'CNPJ');

-- CreateEnum
CREATE TYPE "EventoHistoricoOS" AS ENUM ('ORDEM_ABERTA', 'MECANICO_ATRIBUIDO', 'DIAGNOSTICO_REGISTRADO', 'ORCAMENTO_GERADO', 'ORCAMENTO_APROVADO', 'ORCAMENTO_REJEITADO', 'EXECUCAO_INICIADA', 'PECA_CONSUMIDA', 'ORDEM_FINALIZADA', 'VEICULO_ENTREGUE', 'ORDEM_CANCELADA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    "refreshTokenHash" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "tipoDoc" "TipoDocumento" NOT NULL,
    "numeroDoc" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculos" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "renavam" TEXT NOT NULL,
    "chassi" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "cor" TEXT NOT NULL,
    "quilometragem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos_oficina" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicos_oficina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_servico" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "status" "StatusOrdemServico" NOT NULL DEFAULT 'RECEBIDA',
    "clienteId" TEXT NOT NULL,
    "veiculoId" TEXT NOT NULL,
    "mecanicoResponsavelId" TEXT,
    "notasInternas" TEXT,
    "notasCliente" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problemas_relatados" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problemas_relatados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos_solicitados" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "nomeServico" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicos_solicitados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosticos" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnosticos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamentos" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "notasInternas" TEXT,
    "notasCliente" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "rejeitadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_orcamento" (
    "id" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grupos_orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linhas_servico" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "tipo" "TipoLinhaServico" NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "valorUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "pecaId" TEXT,

    CONSTRAINT "linhas_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_os" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "evento" "EventoHistoricoOS" NOT NULL,
    "descricao" TEXT,
    "usuarioId" TEXT,
    "statusAnterior" "StatusOrdemServico",
    "statusNovo" "StatusOrdemServico",
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumos_peca" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "pecaId" TEXT NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumos_peca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "precoVenda" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pecas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque" (
    "id" TEXT NOT NULL,
    "pecaId" TEXT NOT NULL,
    "quantidadeDisponivel" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "quantidadeMinima" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (Unique)
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "clientes_usuarioId_key" ON "clientes"("usuarioId");
CREATE UNIQUE INDEX "clientes_numeroDoc_key" ON "clientes"("numeroDoc");
CREATE UNIQUE INDEX "veiculos_placa_key" ON "veiculos"("placa");
CREATE UNIQUE INDEX "veiculos_renavam_key" ON "veiculos"("renavam");
CREATE UNIQUE INDEX "veiculos_chassi_key" ON "veiculos"("chassi");
CREATE UNIQUE INDEX "ordens_servico_numero_key" ON "ordens_servico"("numero");
CREATE UNIQUE INDEX "diagnosticos_ordemServicoId_key" ON "diagnosticos"("ordemServicoId");
CREATE UNIQUE INDEX "orcamentos_ordemServicoId_key" ON "orcamentos"("ordemServicoId");
CREATE UNIQUE INDEX "pecas_codigo_key" ON "pecas"("codigo");
CREATE UNIQUE INDEX "estoque_pecaId_key" ON "estoque"("pecaId");

-- CreateIndex (Performance)
CREATE INDEX "idx_ordens_servico_clienteId" ON "ordens_servico"("clienteId");
CREATE INDEX "idx_ordens_servico_status" ON "ordens_servico"("status");
CREATE INDEX "idx_ordens_servico_mecanicoResponsavelId" ON "ordens_servico"("mecanicoResponsavelId");
CREATE INDEX "idx_historico_os_ordemServicoId_criadoEm" ON "historico_os"("ordemServicoId", "criadoEm");
CREATE INDEX "idx_consumos_peca_ordemServicoId" ON "consumos_peca"("ordemServicoId");
CREATE INDEX "idx_problemas_relatados_ordemServicoId" ON "problemas_relatados"("ordemServicoId");
CREATE INDEX "idx_servicos_solicitados_ordemServicoId" ON "servicos_solicitados"("ordemServicoId");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_mecanicoResponsavelId_fkey" FOREIGN KEY ("mecanicoResponsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "problemas_relatados" ADD CONSTRAINT "problemas_relatados_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "servicos_solicitados" ADD CONSTRAINT "servicos_solicitados_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "servicos_solicitados" ADD CONSTRAINT "servicos_solicitados_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos_oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "diagnosticos" ADD CONSTRAINT "diagnosticos_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "grupos_orcamento" ADD CONSTRAINT "grupos_orcamento_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "linhas_servico" ADD CONSTRAINT "linhas_servico_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "linhas_servico" ADD CONSTRAINT "linhas_servico_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "pecas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "historico_os" ADD CONSTRAINT "historico_os_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consumos_peca" ADD CONSTRAINT "consumos_peca_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consumos_peca" ADD CONSTRAINT "consumos_peca_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "pecas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "estoque" ADD CONSTRAINT "estoque_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "pecas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
