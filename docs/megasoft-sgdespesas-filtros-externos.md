# Megasoft SGDespesas — filtros externos

Script relacionado:

`cypress/e2e/portal/transparencia/megasoft/sgdespesas/filtros-externos.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/megasoft/sgdespesas/filtros-externos.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/megasoft/sgdespesas/filtros-externos.cy.js"
```

## Objetivo

Validar os filtros que ficam diretamente na listagem Megasoft: órgão,
COVID-19, tipo, busca textual e período.

## Testes cobertos

1. Filtra por órgão e valida o campo no detalhe.
2. Filtra COVID-19 como Sim.
3. Filtra COVID-19 como Não.
4. Filtra por Tipo = Empenho.
5. Filtra por Tipo = Liquidação.
6. Filtra por Tipo = Pagamento.
7. Busca nome do movimento, favorecido e descrição.
8. Filtra pelos últimos sete dias.
9. Filtra por anos.
10. Filtra por mês e ano no calendário.

## Regras

O teste normaliza textos para comparar acentos e espaços e usa dados reais da
listagem. Quando o portal não retorna registros, a validação exige a mensagem
oficial de ausência de resultados.
