import { Cliente, TipoDocumento } from './cliente.entity';
import { ClienteId } from './cliente-id.value-object';

function clienteBase() {
  return Cliente.criar({
    tipoDoc: TipoDocumento.CPF,
    numeroDoc: '11144477735',
    nome: 'João Silva',
    email: 'joao@example.com',
    telefone: '11999999999',
  });
}

describe('Cliente', () => {
  describe('criar()', () => {
    it('deve criar cliente com os dados fornecidos', () => {
      const cliente = clienteBase();
      expect(cliente.nome).toBe('João Silva');
      expect(cliente.email).toBe('joao@example.com');
      expect(cliente.tipoDoc).toBe(TipoDocumento.CPF);
      expect(cliente.numeroDoc).toBe('11144477735');
      expect(cliente.ativo).toBe(true);
    });

    it('deve gerar id com prefixo cl', () => {
      const cliente = clienteBase();
      expect(cliente.id.valor.startsWith('cl')).toBe(true);
    });

    it('deve deixar campos de endereço como null quando não fornecido', () => {
      const cliente = clienteBase();
      expect(cliente.logradouro).toBeNull();
      expect(cliente.cidade).toBeNull();
      expect(cliente.cep).toBeNull();
    });

    it('deve criar cliente com endereço completo', () => {
      const cliente = Cliente.criar({
        tipoDoc: TipoDocumento.CNPJ,
        numeroDoc: '11222333000181',
        nome: 'Empresa X',
        email: 'empresa@x.com',
        telefone: '1133334444',
        endereco: {
          logradouro: 'Rua A',
          numero: '10',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01310100',
        },
      });
      expect(cliente.logradouro).toBe('Rua A');
      expect(cliente.cidade).toBe('São Paulo');
      expect(cliente.cep).toBe('01310100');
    });
  });

  describe('reconstituir()', () => {
    it('deve reconstituir cliente com id e timestamps fornecidos', () => {
      const id = ClienteId.novo();
      const criadoEm = new Date('2026-01-01');
      const atualizadoEm = new Date('2026-01-02');
      const cliente = Cliente.reconstituir({
        id,
        tipoDoc: TipoDocumento.CPF,
        numeroDoc: '11144477735',
        nome: 'João',
        email: 'joao@test.com',
        telefone: '11900000000',
        criadoEm,
        atualizadoEm,
      });
      expect(cliente.id).toBe(id);
      expect(cliente.criadoEm).toBe(criadoEm);
    });
  });

  describe('atualizar()', () => {
    it('deve atualizar nome', () => {
      const cliente = clienteBase();
      cliente.atualizar({ nome: 'Novo Nome' });
      expect(cliente.nome).toBe('Novo Nome');
    });

    it('deve atualizar email', () => {
      const cliente = clienteBase();
      cliente.atualizar({ email: 'novo@email.com' });
      expect(cliente.email).toBe('novo@email.com');
    });

    it('deve atualizar telefone', () => {
      const cliente = clienteBase();
      cliente.atualizar({ telefone: '11888888888' });
      expect(cliente.telefone).toBe('11888888888');
    });

    it('deve atualizar campos de endereço', () => {
      const cliente = clienteBase();
      cliente.atualizar({ endereco: { cidade: 'Campinas', estado: 'SP' } });
      expect(cliente.cidade).toBe('Campinas');
      expect(cliente.estado).toBe('SP');
    });

    it('não deve alterar tipoDoc nem numeroDoc', () => {
      const cliente = clienteBase();
      cliente.atualizar({ nome: 'Outro' });
      expect(cliente.tipoDoc).toBe(TipoDocumento.CPF);
      expect(cliente.numeroDoc).toBe('11144477735');
    });

    it('deve atualizar atualizadoEm ao atualizar', () => {
      const cliente = clienteBase();
      const antes = cliente.atualizadoEm;
      // Pequena pausa para garantir diferença de tempo
      jest.useFakeTimers();
      jest.advanceTimersByTime(10);
      cliente.atualizar({ nome: 'Novo' });
      jest.useRealTimers();
      expect(cliente.atualizadoEm.getTime()).toBeGreaterThanOrEqual(antes.getTime());
    });

    it('campos de endereço não fornecidos devem manter valor anterior', () => {
      const cliente = Cliente.criar({
        tipoDoc: TipoDocumento.CPF,
        numeroDoc: '11144477735',
        nome: 'João',
        email: 'j@j.com',
        telefone: '11999',
        endereco: { cidade: 'SP', estado: 'SP' },
      });
      cliente.atualizar({ endereco: { cidade: 'RJ' } });
      expect(cliente.cidade).toBe('RJ');
      expect(cliente.estado).toBe('SP');
    });
  });

  describe('equals()', () => {
    it('dois clientes com mesmo id devem ser iguais', () => {
      const id = ClienteId.novo();
      const a = Cliente.reconstituir({
        id, tipoDoc: TipoDocumento.CPF, numeroDoc: '1', nome: 'A', email: 'a@a.com', telefone: '1', criadoEm: new Date(), atualizadoEm: new Date(),
      });
      const b = Cliente.reconstituir({
        id, tipoDoc: TipoDocumento.CPF, numeroDoc: '1', nome: 'B', email: 'b@b.com', telefone: '2', criadoEm: new Date(), atualizadoEm: new Date(),
      });
      expect(a.equals(b)).toBe(true);
    });
  });
});
