# Centi CNTDespesas — filtros externos

Script relacionado:

`cypress/e2e/portal/transparencia/centi/cntdespesas/filtros-externos.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/centi/cntdespesas/filtros-externos.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/centi/cntdespesas/filtros-externos.cy.js"
```

## Objetivo e configuração

Validar os filtros externos da listagem CNTDespesas no adaptador Centi. O
script aceita `DESPESAS_PATH` e `DESPESAS_NOME` por variável de ambiente para
ser reutilizado em diferentes portais Centi.

## Testes cobertos

1. Identifica um órgão, pesquisa pelo órgão e valida os resultados.
2. Filtra COVID-19 como Sim e depois como Não.
3. Filtra pela busca textual e valida o favorecido.
4. Filtra pelos últimos sete dias e valida as datas.
5. Filtra por ano no select de período.
6. Filtra por mês no select de período.
7. Filtra por mês e ano no popup de intervalo.

## Regras de validação

Os seletores dos componentes Centi ficam concentrados nas constantes do
arquivo. A listagem é aguardada antes de cada interação, e os valores são
comparados após normalização de espaços, acentos e códigos.
