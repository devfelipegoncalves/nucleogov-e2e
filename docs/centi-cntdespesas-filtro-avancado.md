# Centi CNTDespesas — filtro avançado

Script relacionado:

`cypress/e2e/portal/transparencia/centi/cntdespesas/filtro-avancado.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/centi/cntdespesas/filtro-avancado.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/centi/cntdespesas/filtro-avancado.cy.js"
```

## Objetivo e configuração

Validar o filtro avançado do adaptador Centi para CNTDespesas. A rota e o nome
do módulo usam `Cypress.env("DESPESAS_PATH")` e `Cypress.env("DESPESAS_NOME")`,
com `/cidadao/transparencia/cntdespesas` e `cntdespesas` como padrão.

## Testes cobertos

1. Filtra por órgão e valida o órgão no detalhe.
2. Filtra por credor e valida a listagem.
3. Filtra por CPF/CNPJ e valida o documento.
4. Filtra por número do empenho e valida o número no detalhe.
5. Filtra por valores empenhados.
6. Filtra por valores liquidados.
7. Filtra por valores pagos.
8. Filtra por procedimento licitatório.
9. Filtra por ano usando a busca avançada.
10. Filtra COVID-19 como Sim.
11. Filtra COVID-19 como Não.
12. Filtra por ação e valida a ação no detalhe.
13. Filtra por unidade.
14. Filtra por função.
15. Filtra por sub-função.
16. Filtra por programa.
17. Filtra por fonte.
18. Filtra por categoria econômica.
19. Filtra por grupo.
20. Filtra por modalidade de aplicação.
21. Filtra por elemento.

## Regras de validação

O script identifica automaticamente CPF ou CNPJ, normaliza códigos e textos e
usa seletores constantes para o popup Centi. Valores retornados podem ser
validados na listagem ou no `#pop_detalhes`, conforme o cenário.
