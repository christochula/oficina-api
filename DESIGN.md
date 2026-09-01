---
version: alpha
name: Oficina - Operacao Clara
description: Sistema visual e briefing de produto para o portal web responsivo da Oficina API
colors:
  primary: "#17324D"
  primary-hover: "#102A43"
  on-primary: "#FFFFFF"
  action: "#1D4ED8"
  action-hover: "#1E40AF"
  on-action: "#FFFFFF"
  accent: "#F59E0B"
  accent-soft: "#FEF3C7"
  background: "#F4F7FA"
  surface: "#FFFFFF"
  surface-muted: "#EAF0F5"
  surface-strong: "#DCE5EE"
  text: "#182230"
  text-muted: "#526170"
  text-subtle: "#6B7785"
  border: "#C5D0DC"
  border-strong: "#718096"
  success: "#166534"
  success-soft: "#DCFCE7"
  warning: "#92400E"
  warning-soft: "#FEF3C7"
  error: "#B42318"
  error-soft: "#FEE4E2"
  info: "#075985"
  info-soft: "#E0F2FE"
  focus: "#2563EB"
  overlay: "rgba(15, 23, 42, 0.56)"
  status-received-bg: "#E2E8F0"
  status-received-fg: "#334155"
  status-assigned-bg: "#DBEAFE"
  status-assigned-fg: "#1E40AF"
  status-diagnosis-bg: "#CFFAFE"
  status-diagnosis-fg: "#155E75"
  status-awaiting-bg: "#FEF3C7"
  status-awaiting-fg: "#92400E"
  status-approved-bg: "#DCFCE7"
  status-approved-fg: "#166534"
  status-execution-bg: "#EDE9FE"
  status-execution-fg: "#5B21B6"
  status-finalized-bg: "#D1FAE5"
  status-finalized-fg: "#065F46"
  status-delivered-bg: "#CCFBF1"
  status-delivered-fg: "#115E59"
  status-canceled-bg: "#FEE2E2"
  status-canceled-fg: "#991B1B"
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-0.02em"
  headline-lg:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  headline-md:
    fontFamily: Manrope
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title-md:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.25
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.25
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.01em"
  data-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
    fontFeature: '"tnum" 1'
  data-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.3
    fontFeature: '"tnum" 1'
rounded:
  none: "0px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "12px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.on-action}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "12px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "12px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "12px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.md}"
    padding: "12px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "24px"
  chip:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  status-warning:
    backgroundColor: "{colors.status-awaiting-bg}"
    textColor: "{colors.status-awaiting-fg}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  status-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  status-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  navigation-item-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "12px"
    height: "44px"
  attention-marker:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.full}"
    size: "8px"
  attention-panel:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.lg}"
    padding: "16px"
  surface-emphasis:
    backgroundColor: "{colors.surface-strong}"
    rounded: "{rounded.md}"
    padding: "12px"
  metadata-muted:
    textColor: "{colors.text-muted}"
    typography: "{typography.body-sm}"
  metadata-subtle:
    textColor: "{colors.text-subtle}"
    typography: "{typography.caption}"
  divider:
    backgroundColor: "{colors.border}"
    height: "1px"
  divider-strong:
    backgroundColor: "{colors.border-strong}"
    height: "1px"
  alert-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "12px"
  alert-info:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "12px"
  focus-ring:
    backgroundColor: "{colors.focus}"
    rounded: "{rounded.sm}"
    size: "2px"
  modal-overlay:
    backgroundColor: "{colors.overlay}"
  status-received:
    backgroundColor: "{colors.status-received-bg}"
    textColor: "{colors.status-received-fg}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  status-assigned:
    backgroundColor: "{colors.status-assigned-bg}"
    textColor: "{colors.status-assigned-fg}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  status-diagnosis:
    backgroundColor: "{colors.status-diagnosis-bg}"
    textColor: "{colors.status-diagnosis-fg}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  status-approved:
    backgroundColor: "{colors.status-approved-bg}"
    textColor: "{colors.status-approved-fg}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  status-execution:
    backgroundColor: "{colors.status-execution-bg}"
    textColor: "{colors.status-execution-fg}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  status-finalized:
    backgroundColor: "{colors.status-finalized-bg}"
    textColor: "{colors.status-finalized-fg}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  status-delivered:
    backgroundColor: "{colors.status-delivered-bg}"
    textColor: "{colors.status-delivered-fg}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
  status-canceled:
    backgroundColor: "{colors.status-canceled-bg}"
    textColor: "{colors.status-canceled-fg}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "28px"
---

# Oficina — sistema visual e briefing de frontend

> Fonte de verdade para importar no Google Stitch. O arquivo descreve o produto, o sistema visual, as telas e os estados que devem ser desenhados. O Stitch deve produzir UI de alta fidelidade e código visual reaproveitável, sem implementar o frontend real nem conectar serviços.

## Overview

### Missão do Stitch

Desenhar um portal web responsivo para a operação de uma oficina automotiva. O resultado deve permitir que a equipe futura de desenvolvimento aproveite layouts, componentes, tokens e código de apresentação gerados pelo Stitch.

O produto precisa transmitir organização, segurança e agilidade. A referência emocional é uma oficina moderna, limpa e precisa: técnica sem ser fria, profissional sem parecer um ERP antigo e humana sem recorrer a ilustrações infantis.

A marca disponível é apenas o nome provisório **Oficina**. Crie um wordmark discreto e um símbolo simples, facilmente substituível, sem transformar esta tarefa em um projeto completo de branding.

### Resultado esperado

O Stitch deve entregar:

- uma página de referência do design system com tokens, tipografia, botões, campos, tabelas, chips, alertas e estados;
- telas desktop e mobile de alta fidelidade;
- protótipos navegáveis dos fluxos prioritários;
- componentes visuais reutilizáveis e consistentes;
- variantes de carregamento, vazio, sucesso, validação, erro e acesso negado;
- código somente da camada de apresentação, organizado para reaproveitamento posterior.

Não implementar chamadas HTTP, autenticação real, persistência, regras de autorização, cálculo de valores, integrações, telemetria, Datadog ou lógica de domínio.

### Contexto do produto

A aplicação gerencia clientes, veículos, catálogo de serviços, estoque de peças e ordens de serviço. A ordem de serviço é o centro da experiência: começa na recepção, passa por atribuição a um mecânico, diagnóstico, orçamento, decisão do cliente, execução, finalização e entrega.

Todos os textos visíveis devem estar em português do Brasil. Usar:

- datas no padrão dd/MM/aaaa e horários de 24 horas;
- valores monetários no padrão R$ 0,00;
- quilometragem no padrão 00.000 km;
- CPF, CNPJ, CEP, telefone e placa com máscaras visuais brasileiras;
- nomes e dados inteiramente fictícios nos mockups.

### Perfis e autorização visual

A interface deve mudar conforme o perfil. Ações não permitidas devem ser ocultadas, e não apenas desabilitadas. Essa adaptação visual não substitui a autorização obrigatória no backend.

| Perfil | Objetivo principal | Navegação e ações permitidas |
| --- | --- | --- |
| Administrador | Governar a operação inteira | visão geral, ordens, fila, clientes, veículos, estoque, catálogo, usuários e relatórios; abrir, atribuir e entregar OS |
| Consultor técnico | Operar recepção e acompanhar atendimento | visão geral, ordens, fila, clientes, veículos e relatórios; consultar catálogo; abrir, atribuir e entregar OS; sem gestão de estoque ou usuários |
| Mecânico | Executar somente o trabalho atribuído | meu trabalho e minhas OS; consultar serviços e peças; registrar diagnóstico, gerar orçamento, iniciar execução, consumir peça e finalizar |
| Cliente | Acompanhar somente seus próprios serviços | início, minhas OS e detalhe; visualizar diagnóstico, orçamento e histórico permitido; aprovar ou rejeitar orçamento |

Nunca mostrar ao cliente notas internas, usuário responsável, dados de outros clientes, custo interno, IDs técnicos ou detalhes de observabilidade.

### Acesso

A entrada deve ter duas opções claras no mesmo universo visual:

- **Sou cliente:** CPF como credencial acadêmica do fluxo serverless, com máscara, texto curto de privacidade e botão Continuar.
- **Sou da equipe:** e-mail, senha, mostrar/ocultar senha e botão Entrar.

Não oferecer acompanhamento sem autenticação: a rota de status cujo nome técnico contém publico exige perfil interno e não deve virar uma tela pública. Não desenhar auto cadastro, recuperação de senha, login social, MFA ou edição de perfil, pois esses fluxos não existem no escopo atual.

Mensagens de falha no acesso por CPF devem ser genéricas para não revelar se o documento está cadastrado ou ativo. A sessão de cliente dura cinco minutos e não possui refresh token; desenhar aviso de sessão expirada e retorno seguro ao acesso. A sessão de operador possui renovação, mas o Stitch não deve implementar esse mecanismo.

### Ciclo da ordem de serviço

Representar o ciclo principal nesta ordem:

**Recebida → Atribuída → Em diagnóstico → Aguardando aprovação → Aprovada → Em execução → Finalizada → Entregue**

O diagnóstico pode ser registrado antes do orçamento, mas o layout não deve bloquear visualmente a geração do orçamento quando esse registro não estiver presente. A rejeição do orçamento leva a **Cancelada**, um estado terminal.

A timeline deve distinguir:

- etapas concluídas;
- etapa atual;
- etapas futuras;
- cancelamento;
- data e hora de cada evento conhecido;
- responsável apenas para perfis internos quando disponível.

### Princípios de experiência

1. **Próxima ação evidente:** cada tela operacional destaca uma única ação primária válida para o estado atual.
2. **Contexto preservado:** número da OS, veículo, cliente e status permanecem visíveis ao executar tarefas.
3. **Densidade controlada:** tabelas eficientes no desktop e cartões legíveis no celular.
4. **Segurança por desenho:** decisões irreversíveis exigem confirmação e explicação das consequências.
5. **Progresso compreensível:** estados técnicos sempre têm rótulos humanos, ícone e descrição curta.
6. **Sem decoração gratuita:** cada cor, animação e superfície deve ajudar a hierarquia ou o entendimento.

## Colors

A estética é light-first. O fundo azul-acinzentado muito claro separa o conteúdo das superfícies brancas. Azul-marinho ancora a marca e a navegação; azul cobalto identifica ações; âmbar sinaliza espera ou atenção. Vermelho é reservado para erro, cancelamento e decisões destrutivas.

### Paleta principal

- **Azul oficina (#17324D):** marca, sidebar e títulos institucionais.
- **Azul ação (#1D4ED8):** CTA primário, link ativo, foco e seleção.
- **Âmbar segurança (#F59E0B):** atenção operacional e destaque de orçamento pendente.
- **Fundo técnico (#F4F7FA):** canvas da aplicação.
- **Superfície limpa (#FFFFFF):** cartões, formulários, modais e tabelas.
- **Tinta grafite (#182230):** texto principal.
- **Ardósia legível (#526170):** texto secundário.
- **Verde conclusão (#166534):** sucesso e avanço concluído.
- **Vermelho crítico (#B42318):** erro, rejeição e ação destrutiva.

Não usar gradientes chamativos, neon, preto puro, excesso de azul ou fundos com aparência oleosa. Uma textura abstrata muito sutil inspirada em grade técnica pode aparecer somente no painel lateral da tela de acesso.

### Cores de status

| Estado de domínio | Rótulo de UI | Fundo | Texto | Ícone sugerido |
| --- | --- | --- | --- | --- |
| RECEBIDA | Recebida | #E2E8F0 | #334155 | inbox |
| ATRIBUIDA | Atribuída | #DBEAFE | #1E40AF | user-check |
| EM_DIAGNOSTICO | Em diagnóstico | #CFFAFE | #155E75 | scan-search |
| AGUARDANDO_APROVACAO | Aguardando aprovação | #FEF3C7 | #92400E | clock |
| APROVADA | Aprovada | #DCFCE7 | #166534 | badge-check |
| EM_EXECUCAO | Em execução | #EDE9FE | #5B21B6 | wrench |
| FINALIZADA | Finalizada | #D1FAE5 | #065F46 | circle-check |
| ENTREGUE | Entregue | #CCFBF1 | #115E59 | key-round |
| CANCELADA | Cancelada | #FEE2E2 | #991B1B | circle-x |

Cor nunca é o único indicador. Todo status precisa de texto e, quando o espaço permitir, ícone.

## Typography

Usar **Manrope** em títulos e **Inter** em corpo, formulários e dados. Se alguma fonte não estiver disponível, usar uma fallback sans-serif de métrica semelhante sem alterar a hierarquia.

- Títulos de página: Manrope 28 px ou 32 px, peso 700, tracking levemente fechado.
- Títulos de seção: Manrope 18 px ou 22 px, peso 600 ou 700.
- Corpo: Inter 14 px no desktop e 16 px em formulários/mobile.
- Rótulos: Inter 13 px ou 14 px, peso 600.
- Metadados: Inter 12 px, nunca abaixo de 12 px.
- Valores de KPI, dinheiro, duração e quantidade: numerais tabulares.
- IDs longos não devem dominar a tela; mostrar número operacional da OS e oferecer cópia do ID apenas em contexto técnico interno.

Evitar texto todo em caixa alta. Reservar caixa alta para micro rótulos raros, com espaçamento de letras adequado. Não usar mais de três pesos tipográficos na mesma tela.

## Layout

### Estrutura desktop

- Canvas mínimo de referência: 1440 × 1024 px.
- Sidebar interna recolhível: 256 px aberta e 80 px recolhida.
- Topbar: 64 px, com breadcrumb, título contextual, ajuda e menu do usuário.
- Conteúdo: largura fluida com máximo de 1600 px, margem de 24 a 32 px.
- Grade de 12 colunas, gutter de 24 px.
- Espaçamento baseado em 4 px, priorizando passos de 8 px.
- Tabelas com cabeçalho fixo quando houver rolagem longa.
- A ação primária da página fica no canto superior direito ou em barra contextual persistente.

### Estrutura mobile

- Canvas de referência: 390 × 844 px; também verificar 360 px de largura.
- Topbar compacta de 56 px.
- Perfis internos usam menu lateral em drawer.
- Portal do cliente pode usar navegação inferior simples para Início e Minhas OS.
- Tabelas viram cartões empilhados; manter número, status, veículo, data e próxima ação.
- Ações críticas do detalhe podem usar uma barra inferior sticky, respeitando safe areas.
- Alvos de toque têm no mínimo 44 × 44 px, preferencialmente 48 px.

### Breakpoints de desenho

- 360–479 px: telefone.
- 480–767 px: telefone grande.
- 768–1023 px: tablet.
- 1024–1439 px: desktop compacto.
- 1440 px ou mais: desktop amplo.

Não esconder informação essencial em hover. Evitar rolagem horizontal; se uma tabela realmente exigir, manter a primeira coluna fixa e oferecer uma alternativa em cartões.

## Elevation & Depth

A profundidade vem primeiro de bordas e camadas tonais, não de sombras pesadas.

- Cartão padrão: borda de 1 px #C5D0DC e sombra 0 1px 2px rgba(15, 23, 42, 0.06).
- Cartão acionável em hover: borda azul discretamente reforçada e sombra 0 6px 16px rgba(15, 23, 42, 0.10), sem saltos exagerados.
- Dropdown e popover: sombra 0 12px 28px rgba(15, 23, 42, 0.14).
- Modal e drawer: overlay #0F172A com 56% de opacidade e sombra ampla.
- Sidebar: contraste tonal sólido, sem glassmorphism.
- Linhas de tabela: separadores sutis; hover de linha por alteração de fundo, não por elevação.

## Shapes

A linguagem é técnica e amigável, com cantos moderadamente arredondados.

- Inputs e botões: 8 px.
- Cartões, tabelas-contêiner e drawers: 12 px.
- Modais grandes: 16 px.
- Chips, avatares e badges: formato pill ou círculo.
- Ícones dentro de contêineres: 8 px.
- Não misturar cantos muito quadrados com formas excessivamente arredondadas.
- Não transformar todos os blocos em pills.

O símbolo provisório da marca pode combinar um O abstrato, um arco de velocímetro e um pequeno check, usando traço simples e sem detalhes automotivos clichês.

## Components

### Prancha obrigatória do design system

Antes das telas, gerar uma prancha com:

- logo provisório e wordmark;
- paleta e pares de contraste;
- escala tipográfica;
- escala de espaçamento e raios;
- ícones;
- botões primary, secondary, ghost e danger;
- inputs, select, combobox, textarea, checkbox, radio e switch;
- data table, paginação, filtros e cartões mobile equivalentes;
- status badges para os nove estados;
- alertas, banners, toast, tooltip, modal, drawer e confirmação;
- skeleton, vazio, erro, acesso negado e sessão expirada;
- timeline da OS;
- cards de KPI e visual de duração;
- exemplos desktop e mobile.

### App shell e navegação

A sidebar usa fundo Azul oficina, ícones lineares e rótulos claros. O item ativo tem superfície clara ou azul-cobalto com contraste AA. O rodapé da sidebar mostra e-mail, papel e saída para operadores. Não presumir nome de perfil: os tokens atuais não fornecem esse dado e não existe endpoint de perfil.

Não criar uma navegação única com todos os módulos. Gerar variantes por perfil:

- **Administrador:** Visão geral, Ordens de serviço, Fila, Clientes, Veículos, Estoque, Catálogo, Usuários, Relatórios.
- **Consultor técnico:** Visão geral, Ordens de serviço, Fila, Clientes, Veículos, Relatórios.
- **Mecânico:** Meu trabalho, Minhas ordens.
- **Cliente:** Início, Minhas ordens.

O catálogo e a consulta de peças podem aparecer dentro do fluxo do mecânico, sem sugerir permissão de manutenção.

### Botões e ações

- Uma única ação primary por região visual.
- Secondary para alternativas seguras.
- Ghost para ações de baixa ênfase.
- Danger somente para rejeitar, cancelar ou desativar.
- Botões com ícone sempre mantêm rótulo em ações de negócio.
- Estado loading preserva a largura e troca o ícone por spinner.
- Estado disabled mantém legibilidade e deve explicar a causa quando necessário.
- Confirmações usam verbos específicos: Rejeitar orçamento, Desativar cliente, Registrar entrega.

A ação **Rejeitar orçamento** deve explicar que a OS será cancelada. A ação **Registrar entrega** deve confirmar que a conclusão é operacional e definitiva.

### Formulários

- Rótulos sempre visíveis acima do campo.
- Asterisco e texto geral explicam obrigatoriedade.
- Helper text antecede o erro; mensagem de erro fica junto ao campo.
- Validação ocorre após blur ou tentativa de envio, sem mensagens agressivas durante digitação.
- Máscaras não devem impedir colar valores sem pontuação.
- O CNPJ deve aceitar o formato numérico legado e o formato alfanumérico, sem tratar letras como erro visual.
- Campos monetários alinham números à direita.
- Textareas exibem contador apenas quando houver limite real.
- Formulários longos usam seções ou stepper; não usar um modal pequeno para abertura de OS.
- Ao sair com alterações, mostrar confirmação de descarte.

### Tabelas, listas e filtros

A tabela base deve oferecer:

- cabeçalho legível;
- ordenação apenas quando suportada;
- filtro por status em chips ou select;
- paginação visível;
- contagem de resultados;
- seleção somente quando houver ação em lote real;
- menu contextual acessível;
- skeleton de linhas;
- estado vazio com orientação de próxima ação;
- equivalente mobile em cartões.

Não desenhar busca global como se estivesse integrada. Buscas suportadas podem ser contextuais: cliente por CPF/CNPJ e veículo por placa. Busca de OS pelo número operacional é desejável, mas deve ser anotada no handoff como dependência futura.

### Status badge e timeline

O componente StatusBadge recebe estado, rótulo e ícone. Não mostrar os nomes de enum ao usuário.

A timeline deve ser vertical no mobile e horizontal resumida no topo do desktop, com histórico detalhado em seção própria. Em estados longos, exibir uma frase de orientação, por exemplo: **A oficina aguarda sua aprovação para continuar**.

### Componentes do domínio

Criar componentes reutilizáveis com estes nomes conceituais:

- AppShell;
- RoleNavigation;
- PageHeader;
- StatusBadge;
- ServiceOrderCard;
- ServiceOrderTable;
- ServiceOrderSummary;
- ServiceOrderTimeline;
- NextActionPanel;
- VehicleSummaryCard;
- CustomerSummaryCard;
- DiagnosisPanel;
- BudgetBuilder;
- BudgetGroup;
- BudgetLine;
- BudgetSummary;
- PartConsumptionDialog;
- KpiCard;
- DurationBreakdown;
- EmptyState;
- FeedbackBanner;
- ConfirmDialog;
- ResponsiveDataView.

Os nomes são uma orientação para o código exportado; o desenho deve continuar compreensível mesmo fora de um framework.

### Orçamento

O orçamento é agrupado por problema ou serviço. O construtor do mecânico deve conter:

- cabeçalho com número da OS, veículo e diagnóstico;
- grupos repetíveis com título;
- linhas de tipo Material ou Serviço;
- descrição, quantidade, valor unitário e subtotal;
- seletor de peça apenas para Material;
- total por grupo e total geral;
- notas internas separadas visualmente das notas ao cliente;
- ação Adicionar grupo e Adicionar item;
- resumo sticky no desktop e barra de total no mobile;
- validações inline e confirmação antes de enviar ao cliente.

Depois de enviado, o orçamento fica somente leitura. Não desenhar edição, regeneração ou reenvio em Aguardando aprovação.

Para linhas de Material, tornar a escolha da peça obrigatória na UI. Quantidade pode ter até três casas decimais. Estoque só é baixado quando o mecânico registra o consumo durante a execução, nunca na abertura ou no orçamento.

A tela do cliente deve priorizar transparência:

- total em destaque;
- grupos e linhas legíveis;
- notas destinadas ao cliente;
- data de criação;
- botões Aprovar orçamento e Rejeitar orçamento;
- confirmação explícita para a rejeição;
- nenhum campo de notas internas ou ID de peça.

### KPIs e relatórios

A tela de relatórios de Administrador e Consultor deve usar somente indicadores existentes:

- espera para atribuição;
- diagnóstico até orçamento;
- espera pela decisão do cliente;
- execução;
- espera para entrega;
- lead time total;
- tempo técnico líquido;
- taxa de aprovação de orçamentos.

Cada KPI de duração mostra média, mínimo, máximo e número de amostras. Quando houver zero amostras, exibir **Sem dados suficientes**, e não 0 h como se fosse desempenho perfeito. Não inventar séries históricas, metas, comparação percentual ou previsão sem fonte de dados.

Usar cards para o resumo e uma decomposição horizontal das durações. O relatório avançado de tempo de ciclo pode ter seletores de evento inicial, evento final, intervalos a descontar e IDs de OS.

Datadog é uma ferramenta externa de observabilidade técnica. Se houver referência visual, usar apenas um card discreto **Observabilidade técnica** com ícone de link externo e ação **Abrir Datadog**. Não criar um falso Log Explorer, APM, mapa de serviços ou dashboard embutido.

### Estados de feedback

Toda tela de dados deve ter variantes explícitas:

- carregando com skeleton;
- vazia na primeira utilização;
- vazia após filtros;
- erro recuperável com Tentar novamente;
- conexão lenta ou offline;
- 401 sessão expirada;
- 403 acesso negado;
- 404 recurso não encontrado;
- 409 cadastro duplicado;
- validação de formulário;
- sucesso com toast e atualização visual;
- ação em andamento;
- confirmação destrutiva.

Mensagens devem dizer o que aconteceu e como prosseguir. Não exibir stack trace, nome de serviço interno, token ou CPF completo. Em falhas 5xx, o correlationId pode aparecer apenas no detalhe do erro, com botão Copiar código; nunca deve ir para URL, título, breadcrumb ou analytics.

### Telas prioritárias P0

| Tela | Perfis | Conteúdo e estados obrigatórios |
| --- | --- | --- |
| Prancha do design system | equipe de produto | todos os componentes, status e responsividade |
| Acesso | todos | alternância Cliente/Equipe, CPF, e-mail/senha, erros genéricos, sessão expirada e logout |
| Visão geral operacional | Administrador, Consultor | KPIs resumidos, fila priorizada, aguardando aprovação, finalizadas aguardando entrega |
| Meu trabalho | Mecânico | cards de OS atribuídas, agrupamento por próxima ação, prioridade e estados vazio/carregando |
| Início do cliente | Cliente | OS ativas, etapa atual, orçamento pendente e atalhos para detalhes |
| Lista e fila de OS | Administrador, Consultor | filtro de status, paginação, prioridade, status, veículo, cliente, mecânico e próxima ação |
| Nova OS | Administrador, Consultor | stepper Cliente, Veículo, Solicitação e Revisão; usar cadastro existente ou dados novos; peças mencionadas somente na variante Administrador |
| Detalhe interno da OS | Administrador, Consultor | resumo, cliente, veículo, solicitação, responsável, orçamento, histórico e ação contextual |
| Detalhe técnico da OS | Mecânico | somente OS própria; diagnóstico, orçamento, peças, execução, histórico e ação contextual |
| Construtor de orçamento | Mecânico | grupos, linhas, totais, notas, validação e preview do cliente |
| Detalhe da OS do cliente | Cliente | projeção segura, timeline, diagnóstico, orçamento e decisão quando cabível |

### Telas prioritárias P1

| Tela | Perfis | Conteúdo principal |
| --- | --- | --- |
| Clientes | Administrador, Consultor | lista, consulta por documento, cadastro, edição, ativação e desativação |
| Veículos | Administrador, Consultor | lista, consulta por placa, cadastro, edição, ativação e desativação |
| Estoque | Administrador | lista, saldo, mínimo, preço, cadastro, edição, entrada e ativação/desativação |
| Catálogo de serviços | Administrador | lista, categorias, cadastro, edição e ativação/desativação |
| Catálogo somente leitura | Consultor, Mecânico | seleção ou consulta contextual, sem ações administrativas |
| Usuários | Administrador | criar usuário e consultar por ID; não fingir que existe listagem completa |
| Relatórios | Administrador, Consultor | KPIs de ciclo, lead time e construtor avançado |
| Erros de página | todos | 403, 404 e 500 coerentes com o app shell |

### Detalhes das telas centrais

#### Visão geral operacional

Cabeçalho com saudação discreta, data e CTA **Nova ordem de serviço**. Cards principais: OS em andamento, aguardando aprovação, em execução e prontas para entrega. Em seguida, fila priorizada e bloco Próximas ações. Não usar gráficos decorativos sem dado.

#### Lista e fila de OS

No desktop, tabela com número, status, abertura, cliente, veículo, mecânico e próxima ação. No mobile, cartão com número e status na primeira linha, veículo na segunda, cliente/data em metadados e CTA no rodapé.

A fila segue prioridade operacional visual: Em execução, Aguardando aprovação, Em diagnóstico e Recebida, preservando as mais antigas primeiro dentro de cada grupo.

#### Nova ordem de serviço

Usar um stepper de quatro etapas:

1. Cliente: localizar por CPF/CNPJ ou informar novo cadastro.
2. Veículo: localizar por placa ou informar placa, RENAVAM, chassi, marca, modelo, ano, cor e km.
3. Solicitação: problemas relatados, serviços do catálogo e observações. Peças mencionadas aparecem somente para Administrador; Consultor não possui consulta ao estoque.
4. Revisão: separar notas internas de notas visíveis ao cliente e confirmar abertura.

Manter resumo lateral no desktop. No mobile, usar resumo recolhível e ações Voltar/Continuar fixas.

#### Detalhe da OS

Cabeçalho persistente com **OS #1042**, status, veículo e data de abertura. Abaixo, um NextActionPanel explica a ação válida. Usar abas ou âncoras para Resumo, Diagnóstico, Orçamento, Peças e Histórico.

Variantes de ação por papel e estado:

- **Recebida:** Administrador ou Consultor pode Atribuir mecânico.
- **Atribuída:** somente o mecânico responsável pode Registrar diagnóstico ou Gerar orçamento.
- **Em diagnóstico:** somente o mecânico responsável pode Atualizar diagnóstico ou Gerar orçamento.
- **Aguardando aprovação:** o cliente titular pode Aprovar ou Rejeitar; a equipe apenas acompanha.
- **Aprovada:** somente o mecânico responsável pode Iniciar execução.
- **Em execução:** somente o mecânico responsável pode Registrar peça utilizada, repetidas vezes, ou Finalizar serviço.
- **Finalizada:** Administrador ou Consultor pode Registrar entrega.
- **Entregue e Cancelada:** somente leitura.

Não criar botões de reatribuição, edição de orçamento enviado, reabertura, retrocesso, cancelamento geral ou um botão genérico Avançar status.

#### Cadastros

Clientes, veículos, peças e serviços compartilham o mesmo padrão: lista responsiva, PageHeader, filtros compatíveis, drawer de detalhes quando simples e página dedicada para formulários longos.

Respeitar as regras de edição:

- cliente: tipo e número do documento tornam-se imutáveis após o cadastro;
- veículo: placa, RENAVAM, chassi, marca, modelo e ano ficam somente leitura; apenas cor e quilometragem são editáveis;
- peça: código é imutável, quantidade mínima só é informada na criação e entrada de estoque exige valor positivo;
- estoque baixo: usar badge quando quantidade disponível for menor ou igual à mínima;
- serviço: não possui preço base; valores são definidos somente nas linhas do orçamento;
- usuário: oferecer criação e consulta por ID, sem simular CRUD completo; acesso de cliente permanece separado pelo CPF.

Não associar veículo diretamente a um proprietário na UI, pois o modelo atual relaciona veículo e cliente por meio da OS.

### Dados sintéticos de referência

Usar um conjunto pequeno e consistente entre as telas:

- OS #1042, Toyota Corolla 2020, placa BRA2E19, cliente Marina Costa;
- OS #1041, Honda Fit 2018, placa QWE4R56, cliente Paulo Mendes;
- serviços Troca de óleo, Alinhamento e Diagnóstico de freios;
- peças Filtro de óleo, Pastilha de freio dianteira e Óleo 5W30;
- mecânicos Ana Souza e Carlos Lima;
- documentos sempre mascarados, por exemplo ***.***.***-**;
- CPF/CNPJ, contato, endereço, placa, RENAVAM e chassi mascarados em listas; dados completos somente no detalhe interno autorizado;
- valores e horários plausíveis, sem reproduzir dados reais.

### Limites conhecidos da integração futura

O design pode mostrar visualmente seletores e dados simulados, mas o código exportado não deve fingir que estas integrações já existem:

- não há listagem de usuários para preencher automaticamente um seletor de mecânico;
- usuários hoje podem ser criados e consultados por ID, mas não listados;
- respostas internas de OS usam IDs de cliente e veículo, sem nomes expandidos;
- mecânicos não podem consultar cliente ou veículo, e a projeção do cliente recebe somente veiculoId;
- a listagem interna atual omite Atribuída, Aprovada, Finalizada, Entregue e Cancelada;
- não há busca HTTP de OS pelo número operacional;
- Consultor pode enviar peças mencionadas na abertura, mas não possui leitura de estoque; ocultar esse passo para ele;
- serviços inativos não aparecem na listagem, portanto a reativação exige evolução do contrato;
- não existem endpoint de perfil, recuperação de senha, MFA ou perfil editável do cliente;
- a rota técnica com publico no nome exige autenticação interna e não deve gerar experiência pública;
- Datadog não fornece dados para o frontend de negócio neste escopo.

Marcar essas dependências somente em notas do handoff para desenvolvedores. Não mostrar rótulos como mock, futuro ou endpoint ausente para o usuário final.

### Acessibilidade

- Atender WCAG 2.2 AA.
- Contraste mínimo de 4,5:1 para texto normal e 3:1 para texto grande e elementos gráficos relevantes.
- Foco visível com anel de 2 px e offset de 2 px.
- Ordem de tabulação previsível.
- Skip link no app shell.
- Labels e descrições ligados semanticamente aos campos.
- Erros anunciáveis por leitor de tela.
- Modais com foco contido e retorno ao elemento de origem.
- Tabelas com cabeçalhos corretos.
- Ícones decorativos ocultos de tecnologias assistivas.
- Status e alertas nunca dependem apenas de cor.
- Respeitar prefers-reduced-motion.
- Não usar placeholder como rótulo.
- Não usar texto menor que 12 px.

### Movimento e microinterações

O movimento deve confirmar, não distrair:

- transições de cor, borda e sombra em 140–180 ms ease-out;
- drawer em até 220 ms;
- modal com fade e escala sutil de 0,98 para 1 em até 180 ms;
- toast com entrada e saída suave em até 200 ms;
- progresso da timeline em até 300 ms;
- skeleton discreto, sem brilho agressivo;
- hover sem deslocar o layout;
- variante sem movimento quando o sistema solicitar redução.

Usar uma única família de ícones lineares, preferencialmente Lucide, com traço consistente de 1,75–2 px. Não usar emoji como ícone de interface.

### Contrato do código exportado

Quando o formato estiver disponível, priorizar **React + TypeScript + Tailwind CSS**. Se o Stitch exportar HTML e CSS, manter a mesma estrutura semântica e transformar os tokens deste arquivo em CSS custom properties.

O código gerado deve:

- conter somente componentes de apresentação;
- usar dados mockados em um módulo separado e fácil de remover;
- receber dados e handlers por props;
- usar HTML semântico e atributos ARIA somente quando necessários;
- reaproveitar componentes, sem copiar o mesmo markup entre telas;
- manter textos em pt-BR;
- incluir variantes responsivas;
- evitar estilos inline, salvo valores dinâmicos inevitáveis;
- não incluir segredos, URLs reais, CPF completo ou tokens;
- não executar fetch, axios, GraphQL, WebSocket ou SDK de terceiros;
- não implementar armazenamento local, cookies, guards, cálculo de orçamento ou transição de status;
- não instalar um backend, banco, servidor de autenticação ou Datadog;
- não alterar o código NestJS deste repositório.

Os botões podem navegar entre telas apenas no protótipo do Stitch. A equipe de desenvolvimento conectará rotas, dados, autorização e eventos posteriormente.

### Sequência de geração recomendada

Não gerar tudo em uma única tentativa.

1. Importar este DESIGN.md e gerar a prancha do design system.
2. Criar duas direções visuais para Visão geral operacional e Detalhe interno da OS.
3. Escolher uma direção e consolidar tokens e componentes.
4. Gerar o lote P0, conectando o protótipo do ciclo principal.
5. Revisar desktop e mobile lado a lado.
6. Gerar o lote P1 reutilizando os mesmos componentes.
7. Exportar código somente após consistência visual e acessibilidade.
8. Entregar uma lista de componentes, telas, variantes e dependências simuladas.

## Do's and Don'ts

### Faça

- Use o número da OS como principal referência humana.
- Mantenha status e próxima ação visíveis.
- Reutilize os mesmos componentes entre perfis.
- Mostre claramente o que o cliente pode ou não ver.
- Use linguagem direta: Nova ordem de serviço, Gerar orçamento, Registrar entrega.
- Dê destaque especial a orçamentos aguardando decisão.
- Mostre totais de orçamento com hierarquia inequívoca.
- Crie estados vazios úteis, com ação quando ela for permitida.
- Garanta equivalência funcional entre desktop e mobile.
- Inclua notas de handoff sobre os pontos que ainda dependem de API.
- Gere variantes antes de fechar a direção visual principal.

### Não faça

- Não implemente o frontend real nem qualquer integração.
- Não invente endpoints, dados de telemetria, gráficos históricos ou permissões.
- Não exponha notas internas ao cliente.
- Não mostre ações administrativas ao Consultor, Mecânico ou Cliente.
- Não crie um painel Datadog falso.
- Não use aparência genérica de template SaaS roxo, neon ou glassmorphism.
- Não sobrecarregue o dashboard com gráficos.
- Não use cards para cada pequeno campo.
- Não esconda ações essenciais em menus de três pontos.
- Não use apenas cor para comunicar status.
- Não use confirmações vagas como Tem certeza? sem dizer a consequência.
- Não use dados pessoais reais.
- Não deixe links, menus ou botões sem estado visual de foco, hover, pressed, loading e disabled.

### Checklist de aceite visual

A geração estará pronta para handoff quando:

- as quatro experiências por perfil estiverem distintas e coerentes;
- o fluxo da OS puder ser compreendido sem conhecer os enums;
- todos os nove status tiverem badge e timeline consistentes;
- as ações visíveis respeitarem papel e estado;
- as telas P0 existirem em desktop e mobile;
- orçamento e decisão do cliente forem claros e seguros;
- todos os componentes tiverem estados essenciais;
- o contraste e a navegação por teclado atenderem AA;
- os mockups não exibirem dados reais;
- o código visual estiver componentizado e sem integrações;
- dependências futuras de API estiverem registradas apenas no handoff.

### Prompt inicial recomendado para o Stitch

Use este DESIGN.md como fonte de verdade do projeto Oficina. Comece pela prancha do design system e depois produza duas direções de alta fidelidade para a Visão geral operacional e o Detalhe interno da OS, em 1440 × 1024 px e 390 × 844 px. Preserve exatamente os perfis, estados, permissões, paleta, tipografia e limites descritos. Gere somente design, protótipo navegável e código da camada visual com dados sintéticos. Não implemente backend, autenticação, API, persistência ou Datadog. Antes de avançar para as demais telas, verifique consistência, acessibilidade e reutilização de componentes.
