# Publicação e revisão no GitHub

Publicação autorizada pelo usuário e realizada em 04/11/2026. As branches `main` dos quatro repositórios existentes foram preservadas; suas alterações estão nos PRs de revisão abaixo.

| Repositório | Código publicado / revisão |
|---|---|
| OS Service | [PR #20](https://github.com/christochula/oficina-api/pull/20), branch `feature/phase4-distributed` |
| Auth/Gateway | [PR #4](https://github.com/christochula/oficina-auth-serverless/pull/4), branch `feature/phase4-distributed` |
| Infra do banco legado | [PR #2](https://github.com/christochula/oficina-infra-database/pull/2), branch `feature/phase4-distributed` |
| Infra Kubernetes/observabilidade | [PR #30](https://github.com/christochula/oficina-infra-kubernetes/pull/30), branch `feature/phase4-distributed` |
| Billing Service | [Repositório novo](https://github.com/christochula/oficina-billing-service), código inicial na `main` |
| Production Service | [Repositório novo](https://github.com/christochula/oficina-production-service), código inicial na `main` |

Os quatro PRs foram abertos como rascunhos, sem merge. As seis branches `main` foram verificadas pela API do GitHub: exigem PR, uma aprovação, checagens automáticas obrigatórias e aplicação das regras também a administradores. Os nomes das checagens estão em `scripts/configure-repositories.mjs`. O Environment `homolog` existe nos seis repositórios.

## Configuração que falta para os ambientes externos

O SonarCloud aguarda `SONAR_TOKEN` como Secret do repositório e `SONAR_PROJECT_KEY`/`SONAR_ORGANIZATION` como Variables do repositório. Os jobs de Sonar não utilizam o Environment `homolog`. Uma falha de autorização/configuração do Sonar não representa reprovação de qualidade do código.

Credenciais AWS e configurações de runtime/deploy pertencem ao Environment `homolog`, conforme o [guia de configuração](configuracao.md). Nomes de credenciais já existentes não comprovam validade da sessão Academy. Provisionamento AWS, pagamento com contas Mercado Pago de teste e Datadog reais precisam das configurações e de suas próprias evidências.

O PDF já identifica Matheus Chula e Karina Lage. RMs e link do vídeo permanecem pendentes no arquivo `entrega.json`.
