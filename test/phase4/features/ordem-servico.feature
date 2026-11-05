# language: pt
Funcionalidade: Ordem de serviço distribuída com pagamento após reparo
  Cenário: Diagnóstico até entrega com três serviços e confirmação de pagamento
    Dado uma OS diagnosticada com orçamento aguardando aprovação
    Quando o cliente aprova o orçamento
    Então a Saga libera a execução
    Quando o mecânico conclui o reparo e a cobrança é criada
    Então a entrega permanece bloqueada
    Quando o Mercado Pago confirma o pagamento
    Então a oficina pode entregar o veículo

  Cenário: Estoque insuficiente compensa a preparação
    Dado uma OS cujo orçamento exige mais peças que o estoque
    Quando o cliente aprova o orçamento
    Então a Saga libera as reservas e preserva a aprovação
