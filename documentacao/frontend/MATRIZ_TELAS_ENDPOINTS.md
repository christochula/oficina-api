# Matriz de telas, papéis e endpoints

## Acesso e navegação

| Tela | Papéis | Integração |
|---|---|---|
| Login Cliente | Público | `POST /auth/token` com CPF |
| Login Equipe | Público | `POST /api/v1/auth/login` |
| Renovação de sessão | Equipe | `POST /api/v1/auth/refresh` |
| Logout | Equipe; local para Cliente | `POST /api/v1/auth/logout` |
| Visão geral | Todos | Fontes variam por papel |

## Ordens de serviço

| Tela/ação | Papel autorizado | Endpoint |
|---|---|---|
| Fila operacional | Administrador, Consultor | `GET /ordens-servico` |
| Minhas ordens técnicas | Mecânico | `GET /ordens-servico/mecanico/minhas-ordens` |
| Minhas ordens | Cliente | `GET /ordens-servico/minhas/lista` |
| Abrir OS | Administrador, Consultor | `POST /ordens-servico` |
| Detalhe interno | Administrador, Consultor | `GET /ordens-servico/:id` |
| Detalhe técnico | Mecânico responsável | `GET /ordens-servico/mecanico/:id` |
| Detalhe seguro | Cliente titular | `GET /ordens-servico/minhas/:id` |
| Atribuir mecânico | Administrador, Consultor | `PATCH /ordens-servico/:id/atribuir/:mecanicoId` |
| Diagnóstico | Mecânico responsável | `PATCH /ordens-servico/:id/diagnostico` |
| Orçamento | Mecânico responsável | `PATCH /ordens-servico/:id/orcamento` |
| Aprovar/rejeitar | Cliente titular | `PATCH /ordens-servico/:id/aprovar` ou `/rejeitar` |
| Iniciar/consumir/finalizar | Mecânico responsável | `/iniciar-execucao`, `/consumo-peca`, `/finalizar` |
| Entregar | Administrador, Consultor | `PATCH /ordens-servico/:id/entregar` |

Fluxo principal apresentado pela timeline:

```text
RECEBIDA → ATRIBUIDA → EM_DIAGNOSTICO → AGUARDANDO_APROVACAO
         → APROVADA → EM_EXECUCAO → FINALIZADA → ENTREGUE

AGUARDANDO_APROVACAO → CANCELADA (quando o cliente rejeita)
```

## Cadastros e operação

| Módulo | Leitura | Mutação | Observação visível na UI |
|---|---|---|---|
| Clientes | Administrador, Consultor | mesmos papéis | Documento é imutável após criação |
| Veículos | Administrador, Consultor | mesmos papéis | Apenas cor e quilometragem são editáveis |
| Estoque | Administrador, Mecânico | Administrador | Código da peça é imutável; entrada precisa ser positiva |
| Catálogo | Administrador, Consultor, Mecânico | Administrador | Não existe preço base no serviço |
| Usuários | Administrador | Administrador | Somente criar e buscar por ID; sem lista falsa |
| Relatórios | Administrador, Consultor | somente leitura | Lead time e KPIs existentes |

## Estados de erro tratados

| Condição | Comportamento |
|---|---|
| Sem rede/timeout | Mensagem específica e tentativa novamente |
| `400` | Mensagens de validação apresentadas sem perder o formulário |
| `401` equipe | Uma rotação de refresh; depois retorna ao login |
| `401` cliente | Limpa a sessão e solicita CPF novamente |
| `403` | Tela de acesso restrito, sem controles proibidos |
| `404` | Estado não encontrado com retorno seguro |
| `409` | Conflito/duplicidade explicado pelo erro da API |
| `422` | Transição de domínio rejeitada; dados são recarregados |
| `5xx` | Erro recuperável e correlation ID para suporte |
