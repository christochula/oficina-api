import { OrdemServico } from '../../../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../../../domain/ordem-servico-id.value-object';
import { StatusOrdemServico } from '../../../../domain/status-ordem-servico.enum';
import { GrupoOrcamento } from '../../../../domain/value-objects/grupo-orcamento.vo';
import {
  LinhaServico,
  TipoLinhaServico,
} from '../../../../domain/value-objects/linha-servico.vo';
import { Orcamento } from '../../../../domain/value-objects/orcamento.vo';
import { paraRespostaOrdemServicoCliente } from './ordem-servico-cliente.dto';

describe('paraRespostaOrdemServicoCliente', () => {
  it('omite notas e metadados internos em toda a resposta', () => {
    const agora = new Date('2026-08-31T12:00:00.000Z');
    const orcamento = new Orcamento({
      grupos: [
        new GrupoOrcamento({
          titulo: 'Reparo',
          linhasServico: [
            new LinhaServico({
              tipo: TipoLinhaServico.SERVICO,
              descricao: 'Ajuste',
              quantidade: 1,
              valorUnitario: 100,
            }),
          ],
        }),
      ],
      notasInternas: 'segredo-orcamento',
      notasCliente: 'orientacao-visivel',
      criadoEm: agora,
    });
    const os = OrdemServico.reconstituir({
      id: OrdemServicoId.de('os_01'),
      numero: 1,
      clienteId: 'cl_01',
      veiculoId: 've_01',
      mecanicoResponsavelId: 'us_mecanico',
      status: StatusOrdemServico.AGUARDANDO_APROVACAO,
      problemasRelatados: [{ descricao: 'Ruido' }],
      servicosSolicitados: [],
      notasInternas: 'segredo-os',
      notasCliente: 'nota-visivel',
      diagnostico: { descricao: 'Diagnostico visivel' },
      orcamento,
      historico: [
        {
          evento: 'ORCAMENTO_GERADO',
          descricao: 'segredo-historico',
          usuarioId: 'us_mecanico',
          statusAnterior: StatusOrdemServico.EM_DIAGNOSTICO,
          statusNovo: StatusOrdemServico.AGUARDANDO_APROVACAO,
          criadoEm: agora,
        },
      ],
      consumosPeca: [{ pecaId: 'pc_interna', quantidade: 1, criadoEm: agora }],
      criadoEm: agora,
      atualizadoEm: agora,
    });

    const resposta = paraRespostaOrdemServicoCliente(os);
    const json = JSON.stringify(resposta);

    expect(resposta).not.toHaveProperty('notasInternas');
    expect(resposta).not.toHaveProperty('clienteId');
    expect(resposta).not.toHaveProperty('mecanicoResponsavelId');
    expect(resposta).not.toHaveProperty('consumosPeca');
    expect(resposta.orcamento).not.toHaveProperty('notasInternas');
    expect(resposta.historico[0]).not.toHaveProperty('descricao');
    expect(resposta.historico[0]).not.toHaveProperty('usuarioId');
    expect(json).not.toContain('segredo-');
    expect(json).not.toContain('pc_interna');
    expect(json).toContain('orientacao-visivel');
  });
});
