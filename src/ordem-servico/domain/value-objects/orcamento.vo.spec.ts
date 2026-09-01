import { Orcamento } from './orcamento.vo';
import { GrupoOrcamento } from './grupo-orcamento.vo';
import { LinhaServico, TipoLinhaServico } from './linha-servico.vo';

function criarGrupo(
  linhas: { quantidade: number; valorUnitario: number }[],
): GrupoOrcamento {
  return new GrupoOrcamento({
    titulo: 'Grupo Teste',
    linhasServico: linhas.map(
      ({ quantidade, valorUnitario }) =>
        new LinhaServico({
          tipo: TipoLinhaServico.SERVICO,
          descricao: 'Serviço',
          quantidade,
          valorUnitario,
        }),
    ),
  });
}

describe('Orcamento', () => {
  it('deve calcular total como soma dos subtotais das linhas', () => {
    const grupos = [
      criarGrupo([
        { quantidade: 2, valorUnitario: 50 }, // 100
        { quantidade: 1, valorUnitario: 30 }, // 30
        { quantidade: 3, valorUnitario: 20 }, // 60
      ]),
    ];
    const orcamento = new Orcamento({ grupos });
    expect(orcamento.total).toBe(190);
  });

  it('total deve ser zero quando não há grupos', () => {
    const orcamento = new Orcamento({ grupos: [] });
    expect(orcamento.total).toBe(0);
  });

  it('deve arredondar total para 2 casas decimais', () => {
    const grupos = [criarGrupo([{ quantidade: 3, valorUnitario: 10.56 }])]; // 3 * 10.56 = 31.68
    const orcamento = new Orcamento({ grupos });
    expect(orcamento.total).toBe(31.68);
  });

  it('aprovadoEm e rejeitadoEm devem ser null por padrão', () => {
    const orcamento = new Orcamento({ grupos: [] });
    expect(orcamento.aprovadoEm).toBeNull();
    expect(orcamento.rejeitadoEm).toBeNull();
  });

  it('deve aceitar aprovadoEm e rejeitadoEm quando fornecidos', () => {
    const aprovadoEm = new Date('2026-01-01');
    const orcamento = new Orcamento({ grupos: [], aprovadoEm });
    expect(orcamento.aprovadoEm).toBe(aprovadoEm);
  });

  it('criadoEm deve ser preenchido automaticamente', () => {
    const antes = new Date();
    const orcamento = new Orcamento({ grupos: [] });
    const depois = new Date();
    expect(orcamento.criadoEm.getTime()).toBeGreaterThanOrEqual(
      antes.getTime(),
    );
    expect(orcamento.criadoEm.getTime()).toBeLessThanOrEqual(depois.getTime());
  });

  it('deve preservar id quando fornecido', () => {
    const orcamento = new Orcamento({ id: 'orc-1', grupos: [] });
    expect(orcamento.id).toBe('orc-1');
  });
});
