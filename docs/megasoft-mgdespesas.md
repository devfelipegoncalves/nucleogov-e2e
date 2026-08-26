# Testes E2E do MegaSoft — MG Despesas

Esta documentação descreve os testes Cypress do módulo público de despesas do sistema MegaSoft para `mgdespesas`.

## Localização

```text
cypress/e2e/portal/transparencia/megasoft/mgdespesas/
├── filtros-externos.cy.js
└── filtro-avancado.cy.js
```

Os testes usam a rota padrão:

```text
/cidadao/transparencia/mgdespesas
```

O caminho pode ser sobrescrito por `Cypress.env("DESPESAS_PATH")`. O nome exibido no `describe` pode ser alterado por `Cypress.env("DESPESAS_NOME")`; isso permite reutilizar o mesmo fluxo em uma variação compatível do portal.

## Filtros externos

Arquivo: `filtros-externos.cy.js`

Os filtros externos aparecem diretamente na listagem. O teste de órgão coleta o valor no popup do primeiro registro, fecha o popup, encontra a opção correspondente no select customizado e valida o primeiro resultado filtrado.

São cobertos:

- órgão;
- COVID-19 como `Sim`;
- COVID-19 como `Não`, aceitando dados ou a mensagem de lista vazia;
- últimos 7 dias;
- períodos anuais do ano atual e do ano anterior;
- mês e ano pelo calendário de período.

Para os filtros de período, o teste verifica tanto o intervalo exibido no resumo quanto as datas das primeiras linhas retornadas. Se não houver dados, coleta `#not-found-line`, valida a mensagem `Nenhum resultado encontrado` e registra o alerta no log do Cypress e no console do processo.

## Filtro avançado

Arquivo: `filtro-avancado.cy.js`

Antes de cada cenário, o teste abre a listagem, limpa filtros anteriores e tenta garantir que exista um favorecido disponível. A massa de teste é obtida dinamicamente do primeiro empenho e usada no filtro correspondente.

São cobertos:

- favorecido;
- descrição do empenho;
- CPF/CNPJ;
- número do empenho;
- valor empenhado;
- valor liquidado;
- valor pago;
- período;
- órgão;
- unidade;
- função;
- subfunção;
- grupo;
- modalidade de aplicação;
- elemento da despesa pelo número da natureza;
- programa;
- fonte;
- categoria econômica;
- COVID-19 como `Sim` e `Não`;
- validação de data inicial maior que a data final.

### Regra especial do Programa

O programa é obtido no detalhamento e pesquisado no autocomplete do filtro. O teste conta as opções compatíveis, seleciona a primeira e executa a consulta. Quando não há linhas válidas, limpa e repete a pesquisa, selecionando a próxima opção até encontrar registros. A validação final acessa o detalhamento do primeiro resultado e compara o programa retornado com o programa pesquisado.

## Como executar

Executar somente os filtros externos:

```bash
npm run cy:run -- --spec 'cypress/e2e/portal/transparencia/megasoft/mgdespesas/filtros-externos.cy.js'
```

Executar somente o filtro avançado:

```bash
npm run cy:run -- --spec 'cypress/e2e/portal/transparencia/megasoft/mgdespesas/filtro-avancado.cy.js'
```

Executar os dois specs:

```bash
npm run cy:run -- --spec 'cypress/e2e/portal/transparencia/megasoft/mgdespesas/filtros-externos.cy.js,cypress/e2e/portal/transparencia/megasoft/mgdespesas/filtro-avancado.cy.js'
```

O domínio do portal é definido por `CYPRESS_BASE_URL` no ambiente de execução. Os artefatos de falha são salvos em `cypress/artifacts/screenshots/`.

## Padrão dos helpers

- `normalizarTexto`: remove espaços excedentes antes das comparações.
- `obterTermosSignificativos`: reduz diferenças de acentuação, pontuação e palavras administrativas.
- `aguardarListagem` e `aguardarRetornoDoFiltro`: sincronizam o teste com o carregamento assíncrono do portal.
- `obterLinhasValidas`: ignora placeholders da tabela.
- `validarResultadoOuNenhumResultado`: centraliza a validação de dados ou mensagem de lista vazia.
- `abrirFiltroAvancado`: evita clicar novamente no botão quando o painel já está aberto.
