# Checklist final de aceite

Use este arquivo como porta de qualidade. Itens de estado externo só podem ser marcados após verificação real.

## Conteúdo local

- [ ] Existem exatamente quatro diretórios/repositórios de entrega: `oficina-api`, `oficina-auth-serverless`, `oficina-infra-kubernetes` e `oficina-infra-database`.
- [ ] Cada repositório tem `.gitignore`, `LICENSE`, `README.md`, `.github/workflows` e configuração de proteção.
- [ ] Nenhum repositório inclui `node_modules`, `dist`, `coverage`, `.terraform`, `tfstate`, plan, chave, token ou `.env` real.
- [ ] Todos os marcadores intencionais estão documentados; nenhum `SUBSTITUIR_*` necessário para runtime foi esquecido.
- [ ] Os quatro READMEs explicam propósito, tecnologias, execução/deploy, arquitetura do repositório e contratos.
- [ ] Swagger/Postman estão versionados e referenciados pela aplicação.

## Qualidade da aplicação

- [ ] `npm ci` passa com lockfile consistente.
- [ ] `npm run format:check`, `npm run lint`, `npm run test:cov` e `npm run build` passam.
- [ ] E2E passa com PostgreSQL limpo.
- [ ] `prisma format`, `prisma validate` e `prisma migrate deploy` passam.
- [ ] A imagem Docker constrói e roda como usuário não root.
- [ ] `helm lint` e render dos dois ambientes passam.
- [ ] Probes `live` e `ready` têm semânticas distintas.

## Autenticação e segurança

- [ ] Testes cobrem CPF válido/formatado, checksum inválido, cliente inexistente/inativo e falha de banco.
- [ ] JWT expira, valida issuer/audience/algoritmo e não contém CPF.
- [ ] Ausência, alteração e expiração do token bloqueiam rotas privadas.
- [ ] Cliente não acessa/aprova/rejeita OS de outro cliente.
- [ ] Respostas e logs não permitem enumerar CPF.
- [ ] Segredos vêm do Secrets Manager; CI usa OIDC e permissões mínimas.
- [ ] API, ALB e RDS não têm exposição pública indevida.
- [ ] Dependências e imagem foram examinadas; riscos aceitos estão registrados.

## Terraform e Kubernetes

- [ ] `terraform fmt -check -recursive`, `init -backend=false` e `validate` passam nos três repositórios IaC.
- [ ] Plans de homologação e produção foram revisados e salvos como evidência sem divulgar dados sensíveis.
- [ ] Backends remotos são criptografados e bloqueados por ambiente.
- [ ] RDS produção tem Multi-AZ, backup/PITR, deletion protection, snapshot final, KMS e logs.
- [ ] Proxy exige TLS e SG do banco aceita somente origens declaradas.
- [ ] EKS tem nós privados, add-ons, IAM/IRSA e autoscaling.
- [ ] App tem dois pods mínimos, HPA 2–10, PDB, requests/limits, probes e rollout atômico.
- [ ] Migration executa antes do rollout e falha de migration interrompe o deploy.

## Datadog

- [ ] Operator, Cluster Agent e Agents estão saudáveis.
- [ ] APM, logs, métricas Kubernetes, Lambda e integração AWS recebem dados.
- [ ] `env`, `service` e `version` são consistentes entre sinais.
- [ ] Uma chamada é localizada por correlation ID e abre o trace relacionado.
- [ ] Dashboard mostra volume diário, tempo por três etapas e erros de integração.
- [ ] Dashboard também mostra latência, CPU, memória, saúde e falhas de OS.
- [ ] Monitores têm janela, limiar, recuperação, tags, canal e runbook.
- [ ] Teste sintético de readiness está ativo no ambiente correto.
- [ ] Nenhuma tag/log contém CPF, JWT ou informação sensível.

## GitHub e deploy real

- [ ] Os quatro repositórios foram criados e o conteúdo local foi enviado.
- [ ] `homolog` e `main` exigem PR, revisão e checks e bloqueiam force-push/exclusão.
- [ ] Environments `homolog` e `production` têm roles/variables corretas.
- [ ] CI e deploy de homologação passaram nos quatro repositórios.
- [ ] CI e deploy de produção passaram nos quatro repositórios.
- [ ] SHAs/outputs entre repositórios são compatíveis.
- [ ] `soat-architecture` foi adicionado aos quatro repositórios e o acesso foi confirmado.

## Vídeo e PDF

- [ ] O vídeo segue o roteiro, tem no máximo 15 minutos e áudio/tela legíveis.
- [ ] Mostra CPF auth, rejeição sem token e sucesso protegido.
- [ ] Mostra PR/checks, deploy, pods/HPA/health e versão SHA.
- [ ] Mostra dashboard Datadog ao vivo, logs JSON e trace correlacionado.
- [ ] Não mostra segredo, CPF real, token, state ou dados pessoais.
- [ ] O PDF contém exatamente os quatro links, vídeo, documentação e confirmação do colaborador.
- [ ] Todos os `SUBSTITUIR_*` foram resolvidos no PDF exportado.
- [ ] Links foram testados em janela anônima com a permissão esperada.

## Aprovação

- Revisor técnico: `SUBSTITUIR_NOME_DATA`
- Revisor de segurança/privacidade: `SUBSTITUIR_NOME_DATA`
- Responsável pela publicação: `SUBSTITUIR_NOME_DATA`
- Resultado: `APROVADO / REPROVADO COM AÇÕES`
- Ações pendentes: `SUBSTITUIR_ACOES`

