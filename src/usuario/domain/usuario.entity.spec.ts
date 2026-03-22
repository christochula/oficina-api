import { Usuario } from './usuario.entity';
import { PapelUsuario } from './papel-usuario.enum';
import { UsuarioId } from './usuario-id.value-object';

function usuarioBase() {
  return Usuario.criar({
    nome: 'Carlos Mecânico',
    email: 'carlos@oficina.com',
    senhaHash: '$2b$10$hash',
    papel: PapelUsuario.MECANICO,
  });
}

describe('Usuario', () => {
  describe('criar()', () => {
    it('deve criar usuário com dados fornecidos', () => {
      const usuario = usuarioBase();
      expect(usuario.nome).toBe('Carlos Mecânico');
      expect(usuario.email).toBe('carlos@oficina.com');
      expect(usuario.senhaHash).toBe('$2b$10$hash');
      expect(usuario.papel).toBe(PapelUsuario.MECANICO);
      expect(usuario.ativo).toBe(true);
      expect(usuario.refreshTokenHash).toBeNull();
    });

    it('deve gerar id com prefixo us', () => {
      const usuario = usuarioBase();
      expect(usuario.id.valor.startsWith('us')).toBe(true);
    });
  });

  describe('reconstituir()', () => {
    it('deve reconstituir usuário com todos os campos', () => {
      const id = UsuarioId.novo();
      const criadoEm = new Date('2026-01-01');
      const atualizadoEm = new Date('2026-01-02');
      const usuario = Usuario.reconstituir({
        id,
        nome: 'Admin',
        email: 'admin@oficina.com',
        senhaHash: 'hash',
        papel: PapelUsuario.ADMINISTRADOR,
        refreshTokenHash: 'refresh_hash',
        ativo: true,
        criadoEm,
        atualizadoEm,
      });
      expect(usuario.id).toBe(id);
      expect(usuario.refreshTokenHash).toBe('refresh_hash');
      expect(usuario.criadoEm).toBe(criadoEm);
    });
  });

  describe('atualizarRefreshToken()', () => {
    it('deve atualizar o refreshTokenHash', () => {
      const usuario = usuarioBase();
      usuario.atualizarRefreshToken('novo_hash');
      expect(usuario.refreshTokenHash).toBe('novo_hash');
    });

    it('deve aceitar null para revogar a sessão', () => {
      const usuario = usuarioBase();
      usuario.atualizarRefreshToken('hash');
      usuario.atualizarRefreshToken(null);
      expect(usuario.refreshTokenHash).toBeNull();
    });

    it('deve atualizar atualizadoEm', () => {
      const usuario = usuarioBase();
      const antes = usuario.atualizadoEm;
      jest.useFakeTimers();
      jest.advanceTimersByTime(10);
      usuario.atualizarRefreshToken('hash');
      jest.useRealTimers();
      expect(usuario.atualizadoEm.getTime()).toBeGreaterThanOrEqual(antes.getTime());
    });
  });

  describe('desativar()', () => {
    it('deve definir ativo como false', () => {
      const usuario = usuarioBase();
      expect(usuario.ativo).toBe(true);
      usuario.desativar();
      expect(usuario.ativo).toBe(false);
    });

    it('deve atualizar atualizadoEm ao desativar', () => {
      const usuario = usuarioBase();
      const antes = usuario.atualizadoEm;
      jest.useFakeTimers();
      jest.advanceTimersByTime(10);
      usuario.desativar();
      jest.useRealTimers();
      expect(usuario.atualizadoEm.getTime()).toBeGreaterThanOrEqual(antes.getTime());
    });
  });
});
