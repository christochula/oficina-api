import { LinhaServico, TipoLinhaServico } from './linha-servico.vo';

describe('LinhaServico', () => {
  it('deve calcular subtotal = quantidade * valorUnitario', () => {
    const linha = new LinhaServico({
      tipo: TipoLinhaServico.SERVICO,
      descricao: 'Troca de óleo',
      quantidade: 2,
      valorUnitario: 50,
    });
    expect(linha.subtotal).toBe(100);
  });

  it('deve arredondar subtotal para 2 casas decimais', () => {
    const linha = new LinhaServico({
      tipo: TipoLinhaServico.MATERIAL,
      descricao: 'Filtro',
      quantidade: 3,
      valorUnitario: 10.56, // 3 * 10.56 = 31.68 — evita imprecisão de ponto flutuante
    });
    expect(linha.subtotal).toBe(31.68);
  });

  it('deve atribuir pecaId quando fornecido', () => {
    const linha = new LinhaServico({
      tipo: TipoLinhaServico.MATERIAL,
      descricao: 'Pastilha',
      quantidade: 1,
      valorUnitario: 80,
      pecaId: 'pc_01',
    });
    expect(linha.pecaId).toBe('pc_01');
  });

  it('deve deixar pecaId como null quando não fornecido', () => {
    const linha = new LinhaServico({
      tipo: TipoLinhaServico.SERVICO,
      descricao: 'Alinhamento',
      quantidade: 1,
      valorUnitario: 120,
    });
    expect(linha.pecaId).toBeNull();
  });

  it('deve preservar id quando fornecido', () => {
    const linha = new LinhaServico({
      id: 'linha-1',
      tipo: TipoLinhaServico.SERVICO,
      descricao: 'Balanceamento',
      quantidade: 1,
      valorUnitario: 60,
    });
    expect(linha.id).toBe('linha-1');
  });

  it('id deve ser undefined quando não fornecido', () => {
    const linha = new LinhaServico({
      tipo: TipoLinhaServico.SERVICO,
      descricao: 'Balanceamento',
      quantidade: 1,
      valorUnitario: 60,
    });
    expect(linha.id).toBeUndefined();
  });
});
