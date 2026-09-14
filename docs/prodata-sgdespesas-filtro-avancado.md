# Prodata SGDespesas — filtro avançado

Script relacionado:

`cypress/e2e/portal/transparencia/prodata/sgdespesas/filtro-avancado.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/filtro-avancado.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/filtro-avancado.cy.js"
```

## Objetivo

Validar os campos do popup de filtro avançado do módulo SGDespesas Prodata,
aplicando filtros com dados reais obtidos da listagem e conferindo o retorno no
detalhamento ou na própria tabela.

## Preparação e sincronização

O `beforeEach` visita a rota `/cidadao/transparencia/sgdespesas`, aguarda a
listagem, limpa filtros anteriores e prepara uma linha com favorecido quando
necessário. `visitarSgDespesas()` registra o intercept antes da visita e espera
as duas chamadas `POST /api`: uma para a listagem e outra para as opções dos
filtros.

Os selects são componentes customizados. Depois de abertos, o campo Buscar
filtra os links localmente por `keyup`; não há uma nova requisição para cada
termo. Quando uma lista chega vazia, o código fecha/reabre o select ou recarrega
a página até `MAX_TENTATIVAS_CARREGAMENTO_SELECT`.

## Testes cobertos

1. Pesquisa por número do empenho e valida o número no detalhe.
2. Pesquisa por favorecido e valida o favorecido retornado.
3. Pesquisa por CPF/CNPJ e valida os dígitos no detalhe.
4. Pesquisa por órgão e valida o órgão retornado.
5. Pesquisa por histórico do empenho.
6. Pesquisa por categoria econômica.
7. Pesquisa por grupo.
8. Pesquisa por modalidade de aplicação.
9. Pesquisa por elemento da despesa; registra alerta se a opção não estiver disponível.
10. Pesquisa por data inicial e final.
11. Pesquisa por unidade.
12. Pesquisa por função.
13. Pesquisa por subfunção.
14. Pesquisa por natureza da despesa.
15. Pesquisa por programa, com tentativa de recuperação para listas dinâmicas.
16. Pesquisa por ação.
17. Pesquisa por fonte.
18. Pesquisa por COVID-19 = Sim.
19. Pesquisa por COVID-19 = Não.
20. Pesquisa por valor mínimo empenhado.
21. Pesquisa por valor máximo empenhado.
22. Pesquisa por valor mínimo liquidado.
23. Pesquisa por valor máximo liquidado.
24. Pesquisa por valor mínimo pago.
25. Pesquisa por valor máximo pago.
26. Valida alerta quando o mínimo empenhado é maior que o máximo.
27. Valida alerta quando o mínimo liquidado é maior que o máximo.
28. Valida alerta quando o mínimo pago é maior que o máximo.
29. Valida alerta quando a data inicial é maior que a data final.

## Helpers principais

- `visitarSgDespesas`: sincroniza as cargas iniciais do módulo.
- `aguardarListagem`: aguarda loaders e tabela disponíveis.
- `obter...DoPrimeiroRegistro`: lê dados reais do detalhe.
- `abrirFiltroAvancado`: abre o popup apenas quando necessário.
- `abrirSelectAvancadoComOpcoes`: abre e obtém opções visíveis.
- `pesquisarAutocomplete`: digita no filtro local do select.
- `obterOpcaoDoFiltro`: encontra a opção por descrição, código ou ambos.
- `validarResultadoOuNenhumResultado`: aceita resultado válido ou a mensagem
  oficial de ausência de dados.

## Manutenção

Prefira dados extraídos do portal a valores fixos. Ao adicionar um cenário,
inclua o teste nesta documentação, mantenha a validação próxima do fluxo e
remova qualquer `it.only` antes de versionar.
