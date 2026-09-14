# Megasoft SGDespesas — filtro avançado

Script relacionado:

`cypress/e2e/portal/transparencia/megasoft/sgdespesas/filtro-avancado.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/megasoft/sgdespesas/filtro-avancado.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/megasoft/sgdespesas/filtro-avancado.cy.js"
```

## Objetivo e fluxo

Valida o popup de filtro avançado do adaptador Megasoft. Os testes carregam a
listagem, obtêm dados reais do empenho, aplicam o filtro correspondente e
validam a tabela ou o detalhe. A estrutura possui seletores e regras próprias
do adaptador Megasoft.

## Testes cobertos

1. Pesquisa por favorecido.
2. Pesquisa por histórico do empenho.
3. Pesquisa por CPF/CNPJ.
4. Pesquisa por número do empenho.
5. Pesquisa por valor mínimo empenhado.
6. Pesquisa por valor máximo empenhado.
7. Valida alerta de mínimo empenhado maior que máximo.
8. Pesquisa por valor mínimo liquidado.
9. Pesquisa por valor máximo liquidado.
10. Valida alerta de mínimo liquidado maior que máximo.
11. Pesquisa por valor mínimo pago.
12. Pesquisa por valor máximo pago.
13. Valida alerta de mínimo pago maior que máximo.
14. Pesquisa por data inicial e final.
15. Pesquisa por órgão.
16. Pesquisa por unidade.
17. Pesquisa por função.
18. Pesquisa por subfunção.
19. Pesquisa por grupo.
20. Pesquisa por elemento.
21. Pesquisa por ações.
22. Pesquisa por programa.
23. Pesquisa por fonte.
24. Pesquisa por categoria econômica.
25. Valida alerta quando a data inicial é maior que a data final.

## Manutenção

Os helpers devem continuar obtendo valores do portal em tempo de execução.
Alterações de layout devem ser feitas neste script e documentadas aqui, sem
copiar automaticamente os seletores do Prodata.
