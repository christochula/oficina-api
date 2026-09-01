# RFC-001 — Adoção da AWS como plataforma de nuvem

- Status: aceita
- Data: 2026-08-31
- Responsáveis: equipe SOAT

## Contexto

O desafio exige API Gateway, função serverless, banco gerenciado, Kubernetes escalável, infraestrutura como código e deploy automatizado. A solução também precisa integrar telemetria de aplicação, cluster e componentes serverless ao Datadog.

## Proposta

Adotar AWS e mapear as capacidades para os seguintes serviços:

| Capacidade | Serviço |
|---|---|
| Entrada pública e autorização | API Gateway HTTP API |
| Autenticação e authorizer | AWS Lambda |
| Orquestração | Amazon EKS |
| Registro de imagens | Amazon ECR |
| Banco relacional | Amazon RDS for PostgreSQL + RDS Proxy |
| Segredos e criptografia | Secrets Manager + KMS |
| Integração privada | VPC Link + ALB interno |
| Mensageria opcional de notificações | SQS, DLQ e SNS |
| Identidade do CI/CD | GitHub Actions OIDC + IAM |

Toda infraestrutura será descrita em Terraform. A aplicação será empacotada em contêiner e entregue ao EKS por Helm.

## Motivos

- Há correspondência direta entre os requisitos e serviços gerenciados maduros.
- API Gateway, Lambda, EKS e RDS têm integração com VPC, IAM, CloudWatch e Datadog.
- OIDC elimina chaves AWS estáticas nos repositórios.
- Multi-AZ, autoscaling, backups e criptografia podem ser expressos e auditados como código.

## Alternativas consideradas

- Azure com API Management, Functions, AKS e Azure Database: tecnicamente adequada, mas aumentaria a divergência em relação à infraestrutura AWS já presente no projeto de origem.
- Google Cloud com API Gateway, Cloud Functions, GKE e Cloud SQL: tecnicamente adequada, com a mesma desvantagem de migração.
- Kubernetes e banco autogerenciados: rejeitados por ampliar patching, backup, failover e operação sem benefício para o domínio.

## Consequências

- A equipe precisa administrar custos de EKS, NAT Gateway, RDS, Datadog e tráfego.
- Recursos são regionais em `sa-east-1` por padrão; mudança de região exige novos `tfvars`.
- A implantação depende de conta AWS, domínios/URLs e credenciais Datadog fornecidos fora do Git.
- Haverá algum acoplamento aos contratos de API Gateway, IAM e Secrets Manager.

## Critérios de aceite

- Os quatro repositórios validam e planejam sem segredos no código.
- O tráfego público chega apenas pelo API Gateway.
- EKS e RDS permanecem em subnets privadas.
- Homologação e produção usam papéis OIDC separados.

