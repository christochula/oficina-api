# Diagrama de arquitetura cloud (macro)

Diagrama macro focado em infraestrutura AWS. Para o PDF final, recriar em
draw.io / diagrams.net usando o conjunto de **ícones oficiais AWS 2024**
(File → New → template AWS), seguindo exatamente este fluxo.

## Fluxo principal

```mermaid
flowchart LR
  Cliente([Cliente / Operador])

  subgraph AWS["AWS - Conta Academy - us-east-1"]
    direction LR
    APIGW["Amazon API Gateway<br/>(HTTP API)"]

    subgraph Serverless["Autenticacao serverless"]
      LAuth["AWS Lambda<br/>auth-token (CPF -> JWT)"]
      LAuthz["AWS Lambda<br/>authorizer (valida JWT)"]
      LNotif["AWS Lambda<br/>notification"]
      SQS["Amazon SQS + DLQ"]
      SNS["Amazon SNS"]
    end

    SM["AWS Secrets Manager"]
    ECR["Amazon ECR"]

    subgraph VPC["Amazon VPC (default)"]
      ELB["Elastic Load Balancing<br/>(Service LoadBalancer)"]
      subgraph EKS["Amazon EKS"]
        Pods["Pods oficina-api<br/>(NestJS) + HPA"]
        Agent["Datadog Agent<br/>(DaemonSet)"]
      end
      RDS[("Amazon RDS<br/>PostgreSQL 16")]
    end

    CW["Amazon CloudWatch"]
  end

  Datadog["Datadog SaaS<br/>APM · Logs · Dashboards · Monitores · Synthetics"]
  GHA["GitHub Actions<br/>(CI/CD - 4 pipelines)"]

  Cliente -->|"1. POST /auth/token (CPF)"| APIGW
  APIGW --> LAuth
  LAuth -->|GetSecretValue| SM
  LAuth -->|"SELECT clientes (TLS)"| RDS
  LAuth -->|"2. JWT curto"| Cliente

  Cliente -->|"3. Bearer JWT em /api/*"| APIGW
  APIGW --> LAuthz
  APIGW -->|"4. HTTP_PROXY"| ELB --> Pods
  Pods -->|Prisma / TLS| RDS
  Pods --> SQS --> LNotif --> SNS

  Pods --> Agent --> Datadog
  LAuth -.logs.-> CW
  APIGW -.access logs.-> CW

  GHA -->|build - push| ECR
  GHA -->|terraform apply / helm upgrade| AWS
```

## Fluxo de observabilidade

```mermaid
flowchart LR
  subgraph EKS["Amazon EKS"]
    App["Aplicacao NestJS"]
  end
  App -->|"logs JSON (stdout)"| Agent["Datadog Agent"]
  App -->|"APM (dd-trace, :8126)"| Agent
  App -->|"metricas de negocio (DogStatsD, :8125)"| Agent
  Kube["kube-state-metrics<br/>CPU / memoria"] --> Agent
  Agent --> DD["Datadog"]
  DD --> Dash["Dashboard (10 widgets)"]
  DD --> Mon["5 Monitores + 1 Synthetic"]
  Mon -->|condicao de falha| Alert["ALERT -> canal"]
```

## Notas para a versão com ícones AWS

| Bloco mermaid | Ícone AWS |
|---|---|
| API Gateway | *Amazon API Gateway* |
| Lambda x3 | *AWS Lambda* |
| SQS / SNS | *Amazon Simple Queue Service* / *Amazon Simple Notification Service* |
| Secrets Manager | *AWS Secrets Manager* |
| ECR | *Amazon Elastic Container Registry* |
| ELB | *Elastic Load Balancing* (Network/Classic LB) |
| EKS | *Amazon Elastic Kubernetes Service* |
| RDS | *Amazon RDS* (badge PostgreSQL) |
| CloudWatch | *Amazon CloudWatch* |
| VPC | *Amazon VPC* (moldura) |
| Datadog / GitHub | logos de terceiros (partner icons) |
