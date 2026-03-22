import { IdUnico } from './id.value-object';
import { OrdemServicoId } from '../../ordem-servico/domain/ordem-servico-id.value-object';
import { ClienteId } from '../../cliente/domain/cliente-id.value-object';
import { VeiculoId } from '../../veiculo/domain/veiculo-id.value-object';
import { UsuarioId } from '../../usuario/domain/usuario-id.value-object';

describe('IdUnico', () => {
  describe('novo()', () => {
    it('OrdemServicoId deve iniciar com prefixo os', () => {
      const id = OrdemServicoId.novo();
      expect(id.valor.startsWith('os')).toBe(true);
    });

    it('ClienteId deve iniciar com prefixo cl', () => {
      const id = ClienteId.novo();
      expect(id.valor.startsWith('cl')).toBe(true);
    });

    it('VeiculoId deve iniciar com prefixo ve', () => {
      const id = VeiculoId.novo();
      expect(id.valor.startsWith('ve')).toBe(true);
    });

    it('UsuarioId deve iniciar com prefixo us', () => {
      const id = UsuarioId.novo();
      expect(id.valor.startsWith('us')).toBe(true);
    });

    it('dois IDs novos devem ser diferentes', () => {
      const a = OrdemServicoId.novo();
      const b = OrdemServicoId.novo();
      expect(a.valor).not.toBe(b.valor);
    });
  });

  describe('de()', () => {
    it('deve reconstituir id a partir de valor existente', () => {
      const valor = 'os_01ABCDEF1234567890123456';
      const id = OrdemServicoId.de(valor);
      expect(id.valor).toBe(valor);
    });

    it('deve reconstituir ClienteId com valor exato', () => {
      const valor = 'cl_01ABCDEF1234567890123456';
      const id = ClienteId.de(valor);
      expect(id.valor).toBe(valor);
    });
  });

  describe('equals()', () => {
    it('dois ids com o mesmo valor devem ser iguais', () => {
      const valor = 'os_01ABCDEF1234567890123456';
      const a = OrdemServicoId.de(valor);
      const b = OrdemServicoId.de(valor);
      expect(a.equals(b)).toBe(true);
    });

    it('dois ids com valores diferentes não devem ser iguais', () => {
      const a = OrdemServicoId.novo();
      const b = OrdemServicoId.novo();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('deve retornar o valor completo do id', () => {
      const valor = 'os_01ABCDEF1234567890123456';
      const id = OrdemServicoId.de(valor);
      expect(id.toString()).toBe(valor);
    });
  });
});
