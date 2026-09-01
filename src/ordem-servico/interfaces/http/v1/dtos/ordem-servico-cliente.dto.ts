import { OrdemServico } from '../../../../domain/ordem-servico.entity';

/**
 * Projeta uma OS para respostas destinadas ao cliente.
 *
 * A lista de campos e explicita para impedir que novas propriedades internas do
 * aggregate sejam expostas acidentalmente por serializacao.
 */
export function paraRespostaOrdemServicoCliente(os: OrdemServico) {
  return {
    id: os.id.valor,
    numero: os.numero,
    status: os.status,
    veiculoId: os.veiculoId,
    problemasRelatados: os.problemasRelatados.map((problema) => ({
      id: problema.id,
      descricao: problema.descricao,
    })),
    servicosSolicitados: os.servicosSolicitados.map((servico) => ({
      id: servico.id,
      servicoId: servico.servicoId,
      nomeServico: servico.nomeServico,
      observacao: servico.observacao,
    })),
    notasCliente: os.notasCliente,
    diagnostico: os.diagnostico
      ? {
          id: os.diagnostico.id,
          descricao: os.diagnostico.descricao,
        }
      : null,
    orcamento: os.orcamento
      ? {
          id: os.orcamento.id,
          grupos: os.orcamento.grupos.map((grupo) => ({
            id: grupo.id,
            titulo: grupo.titulo,
            linhasServico: grupo.linhasServico.map((linha) => ({
              id: linha.id,
              tipo: linha.tipo,
              descricao: linha.descricao,
              quantidade: linha.quantidade,
              valorUnitario: linha.valorUnitario,
              subtotal: linha.subtotal,
            })),
            total: grupo.total,
            ordem: grupo.ordem,
          })),
          total: os.orcamento.total,
          notasCliente: os.orcamento.notasCliente,
          aprovadoEm: os.orcamento.aprovadoEm,
          rejeitadoEm: os.orcamento.rejeitadoEm,
          criadoEm: os.orcamento.criadoEm,
        }
      : null,
    historico: os.historico.map((item) => ({
      evento: item.evento,
      statusAnterior: item.statusAnterior,
      statusNovo: item.statusNovo,
      criadoEm: item.criadoEm,
    })),
    criadoEm: os.criadoEm,
    atualizadoEm: os.atualizadoEm,
  };
}
