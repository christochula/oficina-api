import { Veiculo } from './veiculo.entity';
import { VeiculoId } from './veiculo-id.value-object';

function veiculoBase() {
  return Veiculo.criar({
    placa: 'ABC1234',
    renavam: '12345678901',
    chassi: '9BWZZZ377VT004251',
    marca: 'Toyota',
    modelo: 'Corolla',
    ano: 2020,
    cor: 'Prata',
    quilometragem: 10000,
  });
}

describe('Veiculo', () => {
  describe('criar()', () => {
    it('deve criar veículo com os dados fornecidos', () => {
      const veiculo = veiculoBase();
      expect(veiculo.placa).toBe('ABC1234');
      expect(veiculo.renavam).toBe('12345678901');
      expect(veiculo.chassi).toBe('9BWZZZ377VT004251');
      expect(veiculo.marca).toBe('Toyota');
      expect(veiculo.modelo).toBe('Corolla');
      expect(veiculo.ano).toBe(2020);
      expect(veiculo.cor).toBe('Prata');
      expect(veiculo.quilometragem).toBe(10000);
      expect(veiculo.ativo).toBe(true);
    });

    it('deve gerar id com prefixo ve', () => {
      const veiculo = veiculoBase();
      expect(veiculo.id.valor.startsWith('ve')).toBe(true);
    });

    it('deve definir quilometragem como 0 quando não fornecida', () => {
      const veiculo = Veiculo.criar({
        placa: 'XYZ9999',
        renavam: '98765432100',
        chassi: '1HGBH41JXMN109186',
        marca: 'Honda',
        modelo: 'Civic',
        ano: 2022,
        cor: 'Branco',
      });
      expect(veiculo.quilometragem).toBe(0);
    });
  });

  describe('reconstituir()', () => {
    it('deve reconstituir veículo com id e timestamps fornecidos', () => {
      const id = VeiculoId.novo();
      const criadoEm = new Date('2026-01-01');
      const atualizadoEm = new Date('2026-01-02');
      const veiculo = Veiculo.reconstituir({
        id,
        placa: 'ABC1234',
        renavam: '12345678901',
        chassi: '9BWZZZ377VT004251',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        cor: 'Prata',
        criadoEm,
        atualizadoEm,
      });
      expect(veiculo.id).toBe(id);
      expect(veiculo.criadoEm).toBe(criadoEm);
    });
  });

  describe('atualizar()', () => {
    it('deve atualizar cor', () => {
      const veiculo = veiculoBase();
      veiculo.atualizar({ cor: 'Preto' });
      expect(veiculo.cor).toBe('Preto');
    });

    it('deve atualizar quilometragem', () => {
      const veiculo = veiculoBase();
      veiculo.atualizar({ quilometragem: 25000 });
      expect(veiculo.quilometragem).toBe(25000);
    });

    it('não deve alterar placa, renavam e chassi', () => {
      const veiculo = veiculoBase();
      veiculo.atualizar({ cor: 'Azul' });
      expect(veiculo.placa).toBe('ABC1234');
      expect(veiculo.renavam).toBe('12345678901');
      expect(veiculo.chassi).toBe('9BWZZZ377VT004251');
    });

    it('deve atualizar atualizadoEm ao chamar atualizar', () => {
      const veiculo = veiculoBase();
      const antes = veiculo.atualizadoEm;
      jest.useFakeTimers();
      jest.advanceTimersByTime(10);
      veiculo.atualizar({ cor: 'Verde' });
      jest.useRealTimers();
      expect(veiculo.atualizadoEm.getTime()).toBeGreaterThanOrEqual(antes.getTime());
    });

    it('campos não fornecidos não devem ser alterados', () => {
      const veiculo = veiculoBase();
      veiculo.atualizar({ cor: 'Azul' });
      expect(veiculo.quilometragem).toBe(10000);
    });
  });
});
