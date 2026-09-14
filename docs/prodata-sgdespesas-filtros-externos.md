# Prodata SGDespesas — filtros externos

Script relacionado:

`cypress/e2e/portal/transparencia/prodata/sgdespesas/filtros-externos.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/filtros-externos.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/filtros-externos.cy.js"
```

## Objetivo

Validar os filtros exibidos diretamente na listagem do SGDespesas Prodata, sem
abrir o popup avançado.

## Preparação

Cada teste acessa `/cidadao/transparencia/sgdespesas`, aguarda o filtro externo
e espera a primeira listagem sem loaders. O órgão, os textos de busca e os
períodos são obtidos ou calculados durante a execução para reduzir dependência
de dados fixos.

## Testes cobertos

1. Obtém o órgão de um empenho, filtra por órgão e valida o campo no detalhe.
2. Filtra COVID-19 como Sim e valida registros ou a mensagem de ausência.
3. Filtra COVID-19 como Não e valida registros ou a mensagem de ausência.
4. Filtra por Tipo = Empenho.
5. Filtra por Tipo = Liquidação.
6. Filtra por Tipo = Pagamento.
7. Pesquisa sequencialmente nome do movimento, favorecido e descrição.
8. Filtra pelos últimos sete dias e valida as datas retornadas.
9. Filtra pelo ano atual e pelo ano anterior.
10. Navega pelo calendário e valida março e janeiro do ano anterior.

## Regras de validação

- Órgãos podem ser comparados por código, nome, sigla ou termos significativos.
- A ausência de dados só é aceita quando o portal exibe
  `Nenhum resultado encontrado`.
- As datas são convertidas para `AAAAMMDD` antes da comparação.
- Os resultados e alertas são registrados no log do Cypress para facilitar a
  análise no runner.
