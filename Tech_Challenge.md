# Tech Challenge

## Contexto

O Tech Challenge é o projeto da fase que englobará os conhecimentos obtidos em todas as disciplinas da fase.

Esta é uma atividade que, em princípio, deve ser desenvolvida em grupo.

> **Importante:** atentar-se ao prazo de entrega, pois trata-se de uma atividade obrigatória, uma vez que vale **60% da nota de todas as disciplinas da fase**.

---

# Desafio

Com a expansão da oficina para múltiplas unidades e o aumento constante na base de clientes, tornou-se necessário garantir:

* Segurança;
* Escalabilidade;
* Alta disponibilidade;
* Visibilidade total sobre o funcionamento do sistema.

Agora, a direção da oficina quer:

* Controlar acessos e autenticações com segurança;
* Monitorar o ambiente e detectar gargalos em tempo real;
* Adotar soluções **serverless** para autenticação e notificações;
* Segregar a aplicação em repositórios organizados com CI/CD completo;
* Melhorar e documentar a modelagem do banco de dados, garantindo consistência e performance.

---

# Objetivo

Elevar a aplicação a um nível de operação corporativa, utilizando práticas de:

* Cloud;
* Infraestrutura como código (IaC);
* Segurança;
* Observabilidade.

---

# Requisitos Obrigatórios

## 1. Autenticação e API Gateway

Implementar um **API Gateway**.

Exemplos:

* AWS API Gateway;
* Kong;
* Traefik;
* Outro equivalente.

### Autenticação

Proteger rotas sensíveis da aplicação com autenticação via **CPF**.

### Function Serverless

Criar uma **Function Serverless** responsável por:

1. Validar o CPF do cliente;
2. Consultar a existência e o status do cliente na base de dados;
3. Gerar e devolver um **token JWT** válido para consumo das APIs protegidas.

---

# 2. Estrutura de Repositórios e CI/CD

O projeto deve ser organizado em **quatro repositórios separados**, cada um contendo CI/CD implementado.

Podem ser utilizadas ferramentas como:

* GitHub Actions;
* GitLab CI;
* Outras soluções equivalentes.

Os repositórios devem possuir **deploy automático para a nuvem**.

## Repositórios obrigatórios

### Repositório 1 — Lambda / Function Serverless

Responsável pela função serverless de autenticação.

**Tecnologia esperada:**

* Lambda / Function Serverless;
* API Gateway;
* Autenticação via CPF;
* Geração de JWT.

---

### Repositório 2 — Infraestrutura Kubernetes

Responsável pelo provisionamento da infraestrutura Kubernetes utilizando Terraform.

**Tecnologias obrigatórias:**

* Kubernetes;
* Terraform.

---

### Repositório 3 — Infraestrutura do Banco de Dados

Responsável pelo provisionamento do banco de dados gerenciado utilizando Terraform.

**Requisitos:**

* Banco de dados gerenciado;
* Terraform.

O banco pode utilizar uma das seguintes tecnologias, entre outras equivalentes:

* PostgreSQL;
* MySQL;
* SQL Server.

---

### Repositório 4 — Aplicação Principal

Responsável pela aplicação principal executando em Kubernetes.

Deve contemplar:

* Aplicação;
* Containers;
* Kubernetes;
* Integração com o API Gateway;
* Integração com o banco de dados;
* Observabilidade.

---

# 3. Regras de Proteção dos Repositórios

Todos os repositórios devem seguir regras de proteção de código.

### Branch principal

A branch `main` ou `master` deve ser protegida.

**Não são permitidos commits diretos.**

### Pull Requests

É obrigatório utilizar **Pull Requests** para realizar merge.

### Deploy

Deve existir deploy automático das branches de:

* Homologação;
* Produção.

---

# 4. Infraestrutura Obrigatória

A escolha da nuvem é livre.

A infraestrutura obrigatoriamente deve possuir:

## API Gateway

Responsável pelo controle e roteamento das APIs.

## Function Serverless

Responsável pela autenticação.

## Banco de Dados Gerenciado

Pode utilizar:

* PostgreSQL;
* MySQL;
* SQL Server;
* Outro banco equivalente.

## Cluster Kubernetes

O cluster deve possuir capacidade de escalabilidade.

## Terraform

O Terraform deve ser utilizado para provisionamento da infraestrutura.

---

# 5. Monitoramento e Observabilidade

Implementar integração com uma ferramenta de observabilidade.

Exemplos:

* Datadog;
* New Relic.

A escolha da ferramenta é livre.

---

## Métricas e Monitoramento

O sistema deve monitorar:

### Latência das APIs

Monitorar o tempo de resposta das APIs.

### Recursos do Kubernetes

Monitorar:

* CPU;
* Memória.

### Healthchecks e Uptime

Monitorar a disponibilidade dos serviços e seus respectivos healthchecks.

### Processamento de Ordens de Serviço

Criar alertas para falhas no processamento de ordens de serviço.

### Logs Estruturados

Os logs devem utilizar formato **JSON**.

Os logs devem incluir mecanismos de **correlação entre requisições**, permitindo acompanhar uma requisição através dos diferentes componentes do sistema.

---

# 6. Dashboards

Devem ser disponibilizados dashboards contendo, no mínimo:

## Volume diário de ordens de serviço

Apresentar o volume de ordens de serviço processadas diariamente.

## Tempo médio de execução por status

Apresentar o tempo médio de execução para cada status:

* Diagnóstico;
* Execução;
* Finalização.

## Erros e falhas

Apresentar:

* Erros;
* Falhas nas integrações;
* Problemas no processamento.

---

# 7. Documentação da Arquitetura

Deve ser entregue documentação arquitetural completa.

A documentação deve conter:

## Diagrama de Componentes

O diagrama deve apresentar a visão geral da arquitetura, incluindo:

* Nuvem;
* APIs;
* API Gateway;
* Function Serverless;
* Banco de dados;
* Kubernetes;
* Monitoramento.

## Diagrama de Sequência

Criar diagramas de sequência para os fluxos:

### Fluxo de autenticação

Demonstrar o fluxo completo desde a solicitação de autenticação utilizando CPF até a geração e retorno do JWT.

### Abertura de ordem de serviço

Demonstrar o fluxo completo de abertura de uma ordem de serviço através dos componentes da arquitetura.

---

# 8. RFCs — Request for Comments

Devem ser criadas **RFCs** para decisões técnicas relevantes.

Exemplos de decisões que podem ser documentadas:

* Escolha da nuvem;
* Escolha do banco de dados;
* Estratégia de autenticação;
* Estratégia de observabilidade;
* Estratégia de CI/CD.

As RFCs devem apresentar a decisão, alternativas consideradas e justificativas.

---

# 9. ADRs — Architecture Decision Records

Devem ser criadas **ADRs** para decisões arquiteturais permanentes.

Exemplos:

* Escolha do padrão de comunicação;
* Uso de HPA;
* Estratégia de escalabilidade;
* Padrões arquiteturais;
* Estratégia de integração entre serviços.

---

# 10. Modelagem do Banco de Dados

Deve ser apresentada uma justificativa formal para:

* Escolha do banco de dados;
* Ajustes realizados no modelo relacional;
* Garantia de consistência;
* Garantia de performance.

A documentação deve conter:

## Diagrama ER

Apresentar o modelo entidade-relacionamento.

## Relacionamentos

Explicar os relacionamentos entre as entidades.

## Justificativa das alterações

Documentar as alterações realizadas no modelo existente e explicar tecnicamente os motivos.

---

# Entregáveis

## 1. Repositórios Git

Devem existir **4 repositórios separados**, contendo:

* Código;
* CI/CD;
* Instruções claras no `README.md`.

### Todos os repositórios devem incluir

* `Dockerfile`, quando aplicável;
* Pipelines de CI/CD funcionais;
* Links para os deploys ativos, quando aplicável.

---

# 2. README.md

Cada um dos quatro repositórios deve possuir um `README.md`.

O README deve conter:

## Descrição

Descrição clara do propósito do repositório.

## Tecnologias

Lista das tecnologias utilizadas.

## Execução

Passos necessários para executar o projeto.

## Deploy

Passos e informações relacionados ao deploy.

## Arquitetura

Diagrama da arquitetura específica daquele repositório.

## APIs

Link para:

* Swagger;
* Postman.

---

# 3. Vídeo de Demonstração

O vídeo deve ser enviado para:

* YouTube; ou
* Vimeo.

O vídeo pode ser:

* Público; ou
* Não listado.

### Duração máxima

**15 minutos.**

### O vídeo deve demonstrar

#### Autenticação

Demonstrar a autenticação utilizando CPF.

#### Pipeline CI/CD

Demonstrar a execução da pipeline CI/CD.

#### Deploy

Demonstrar o deploy automatizado.

#### APIs protegidas

Demonstrar o consumo das APIs protegidas utilizando o token de autenticação.

#### Dashboard

Demonstrar o dashboard de monitoramento com análise ao vivo.

#### Logs e Traces

Demonstrar logs e traces sendo gerados durante a execução do sistema.

---

# 4. Entrega no Portal do Aluno

Deve ser entregue um **único documento PDF** contendo:

* Links dos 4 repositórios;
* Link do vídeo de demonstração;
* Links das documentações;
* Confirmação do usuário `soat-architecture` adicionado a todos os repositórios.

---

# Checklist de Requisitos

## Arquitetura

* [ ] API Gateway implementado
* [ ] Function Serverless implementada
* [ ] Autenticação via CPF
* [ ] JWT implementado
* [ ] Banco de dados gerenciado
* [ ] Cluster Kubernetes
* [ ] Kubernetes com escalabilidade
* [ ] Terraform utilizado para provisionamento
* [ ] Solução de observabilidade implementada

## Repositórios

* [ ] Repositório 1 — Lambda / Function Serverless
* [ ] Repositório 2 — Kubernetes + Terraform
* [ ] Repositório 3 — Banco de Dados + Terraform
* [ ] Repositório 4 — Aplicação Principal + Kubernetes

## CI/CD

* [ ] CI/CD no repositório 1
* [ ] CI/CD no repositório 2
* [ ] CI/CD no repositório 3
* [ ] CI/CD no repositório 4
* [ ] Branch `main/master` protegida
* [ ] Pull Requests obrigatórios
* [ ] Deploy automático de homologação
* [ ] Deploy automático de produção

## Observabilidade

* [ ] Datadog ou New Relic
* [ ] Monitoramento de latência
* [ ] Monitoramento de CPU
* [ ] Monitoramento de memória
* [ ] Healthchecks
* [ ] Uptime
* [ ] Alertas para falhas de ordens de serviço
* [ ] Logs estruturados em JSON
* [ ] Correlação entre requisições
* [ ] Dashboard de volume diário de OS
* [ ] Dashboard de tempo médio por status
* [ ] Dashboard de erros e falhas de integração

## Documentação

* [ ] Diagrama de componentes
* [ ] Diagrama de sequência — autenticação
* [ ] Diagrama de sequência — abertura de OS
* [ ] RFCs
* [ ] ADRs
* [ ] Justificativa da escolha do banco
* [ ] Documentação do modelo relacional
* [ ] Diagrama ER
* [ ] Documentação dos relacionamentos

## README

* [ ] README no repositório Lambda
* [ ] README no repositório Kubernetes
* [ ] README no repositório Banco de Dados
* [ ] README no repositório Aplicação
* [ ] Descrição do projeto
* [ ] Tecnologias utilizadas
* [ ] Instruções de execução
* [ ] Instruções de deploy
* [ ] Diagrama da arquitetura
* [ ] Link Swagger/Postman
* [ ] Links dos deploys ativos, quando aplicável

## Vídeo

* [ ] Vídeo com até 15 minutos
* [ ] Autenticação via CPF
* [ ] Pipeline CI/CD
* [ ] Deploy automatizado
* [ ] Consumo das APIs protegidas
* [ ] Dashboard
* [ ] Logs
* [ ] Traces

## Entrega Final

* [ ] PDF único
* [ ] Links dos 4 repositórios
* [ ] Link do vídeo
* [ ] Links das documentações
* [ ] Usuário `soat-architecture` adicionado aos 4 repositórios
