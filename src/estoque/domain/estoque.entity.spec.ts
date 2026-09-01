import { Estoque } from './estoque.entity';
import { RegraDeNegocio } from '../../shared/excecoes/dominio.exception';
import { PecaId } from './peca-id.value-object';

function criarPeca() {
  const agora = new Date();
  return {
    id: PecaId.novo(),
    codigo: 'PC001',
    nome: 'Filtro de Óleo',
    precoVenda: 45.9,
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

function estoqueComQuantidade(quantidade: number) {
  return Estoque.criar({
    peca: criarPeca(),
    quantidadeDisponivel: quantidade,
  });
}

describe('Estoque', () => {
  describe('criar()', () => {
    it('deve criar estoque com quantidade inicial', () => {
      const estoque = estoqueComQuantidade(10);
      expect(estoque.quantidadeDisponivel).toBe(10);
    });

    it('deve criar estoque com quantidade zero por padrão', () => {
      const estoque = Estoque.criar({ peca: criarPeca() });
      expect(estoque.quantidadeDisponivel).toBe(0);
    });

    it('deve criar estoque com quantidadeMinima', () => {
      const estoque = Estoque.criar({ peca: criarPeca(), quantidadeMinima: 5 });
      expect(estoque.quantidadeMinima).toBe(5);
    });
  });

  describe('reconstituir()', () => {
    it('deve reconstituir estoque com todos os dados', () => {
      const peca = criarPeca();
      const estoque = Estoque.reconstituir({
        peca,
        quantidadeDisponivel: 20,
        quantidadeMinima: 3,
      });
      expect(estoque.quantidadeDisponivel).toBe(20);
      expect(estoque.quantidadeMinima).toBe(3);
      expect(estoque.peca).toBe(peca);
    });
  });

  describe('darEntrada()', () => {
    it('deve aumentar a quantidade disponível', () => {
      const estoque = estoqueComQuantidade(5);
      estoque.darEntrada(10);
      expect(estoque.quantidadeDisponivel).toBe(15);
    });

    it('deve lançar RegraDeNegocio se quantidade for zero', () => {
      const estoque = estoqueComQuantidade(5);
      expect(() => estoque.darEntrada(0)).toThrow(RegraDeNegocio);
    });

    it('deve lançar RegraDeNegocio se quantidade for negativa', () => {
      const estoque = estoqueComQuantidade(5);
      expect(() => estoque.darEntrada(-1)).toThrow(RegraDeNegocio);
    });

    it('deve atualizar atualizadoEm', () => {
      const estoque = estoqueComQuantidade(5);
      const antes = estoque.atualizadoEm;
      jest.useFakeTimers();
      jest.advanceTimersByTime(10);
      estoque.darEntrada(1);
      jest.useRealTimers();
      expect(estoque.atualizadoEm.getTime()).toBeGreaterThanOrEqual(
        antes.getTime(),
      );
    });
  });

  describe('darSaida()', () => {
    it('deve diminuir a quantidade disponível', () => {
      const estoque = estoqueComQuantidade(10);
      estoque.darSaida(3);
      expect(estoque.quantidadeDisponivel).toBe(7);
    });

    it('deve lançar RegraDeNegocio se quantidade for zero', () => {
      const estoque = estoqueComQuantidade(10);
      expect(() => estoque.darSaida(0)).toThrow(RegraDeNegocio);
    });

    it('deve lançar RegraDeNegocio se quantidade for negativa', () => {
      const estoque = estoqueComQuantidade(10);
      expect(() => estoque.darSaida(-1)).toThrow(RegraDeNegocio);
    });

    it('deve lançar RegraDeNegocio se estoque for insuficiente', () => {
      const estoque = estoqueComQuantidade(2);
      expect(() => estoque.darSaida(5)).toThrow(RegraDeNegocio);
    });

    it('deve permitir saída exata do total disponível', () => {
      const estoque = estoqueComQuantidade(5);
      estoque.darSaida(5);
      expect(estoque.quantidadeDisponivel).toBe(0);
    });

    it('deve atualizar atualizadoEm após saída', () => {
      const estoque = estoqueComQuantidade(10);
      const antes = estoque.atualizadoEm;
      jest.useFakeTimers();
      jest.advanceTimersByTime(10);
      estoque.darSaida(1);
      jest.useRealTimers();
      expect(estoque.atualizadoEm.getTime()).toBeGreaterThanOrEqual(
        antes.getTime(),
      );
    });
  });
});
