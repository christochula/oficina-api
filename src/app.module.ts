import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClienteModule } from './cliente/cliente.module';
import { EstoqueModule } from './estoque/estoque.module';
import { OrdemServicoModule } from './ordem-servico/ordem-servico.module';
import { ServicoOficinaModule } from './servico-oficina/servico-oficina.module';
import { DatabaseModule } from './shared/database/database.module';
import { UsuarioModule } from './usuario/usuario.module';
import { VeiculoModule } from './veiculo/veiculo.module';
import { HealthModule } from './health/health.module';
import { ObservabilityModule } from './shared/observability/observability.module';

// Módulo raiz da aplicação — registra todos os módulos de funcionalidade.
// ConfigModule é global para que variáveis de ambiente (.env) sejam acessíveis em toda a app.
// DatabaseModule é global (@Global) e disponibiliza o PrismaService sem importação explícita.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carrega .env e expõe ConfigService globalmente
    ObservabilityModule, // logger JSON, correlação e métricas de negócio Datadog
    DatabaseModule, // PrismaService global — deve ser importado antes dos módulos de domínio
    HealthModule, // liveness e readiness usados por Kubernetes e Datadog Synthetics
    AuthModule, // autenticação JWT — depende de UsuarioModule
    UsuarioModule, // gerenciamento de usuários internos e externos
    ClienteModule, // gerenciamento de clientes da oficina
    VeiculoModule, // gerenciamento de veículos atendidos
    ServicoOficinaModule, // catálogo de serviços da oficina — base para OS
    OrdemServicoModule, // ciclo de vida completo das OS — aggregate central
    EstoqueModule, // controle de peças e quantidades
  ],
})
export class AppModule {}
