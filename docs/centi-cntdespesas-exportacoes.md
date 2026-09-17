# Centi CNTDespesas — exportações

Este documento descreve os testes de exportação do módulo público
`cntdespesas` no adaptador Centi.

## Localização e execução

Spec:

```text
cypress/e2e/portal/transparencia/centi/cntdespesas/exportacoes.cy.js
```

```bash
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/centi/cntdespesas/exportacoes.cy.js"
```

A rota padrão é `/cidadao/transparencia/cntdespesas`. Ela pode ser alterada por
`Cypress.env("DESPESAS_PATH")`, e o nome do módulo por
`Cypress.env("DESPESAS_NOME")`.

## Cenários

O spec cria um cenário independente para cada formato disponibilizado pelo
portal Centi:

- HTML — `relatório-despesas.html`;
- CSV — `relatório-despesas.csv`;
- XLS — `relatório-despesas.xls`;
- TXT — `relatório-despesas.txt`;
- JSON — `relatório-despesas.json`;
- XML — `relatório-despesas.xml`.

Em cada cenário, o teste abre o detalhamento do primeiro empenho real e lê os
campos do contrato HTML do Centi: data, órgão, CPF/CNPJ, empenho, saldo a
pagar, favorecido, descrição/histórico, valores empenhado/liquidado/pago,
licitação, destinação do recurso, ação, unidade, função, subfunção, programa,
fonte, categoria econômica, grupo, modalidade de aplicação, elemento e
subelemento. Somente os campos existentes e preenchidos
são enviados para a comparação. Depois o popup é fechado e somente o formato
do cenário é exportado.
O task `assertDownloadedFileContains`, configurado em `cypress.config.js`,
aguarda o download, verifica o tamanho do arquivo e compara os valores do
detalhamento com seu conteúdo, normalizando acentuação, espaços e máscaras de
CPF/CNPJ. Para os valores monetários da Centi, a pontuação também é
normalizada, permitindo comparar, por exemplo, `R$ 1.234,56` com `1234,56`.

Se um formato deixar de aparecer no menu `EXPORTAR`, a validação do conjunto de
formatos falha para deixar a alteração do portal explícita.
