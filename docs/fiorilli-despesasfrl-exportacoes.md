# Fiorilli Despesas FRL — exportações

Script relacionado:

`cypress/e2e/portal/transparencia/fiorilli/despesasfrl/exportacoes.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/fiorilli/despesasfrl/exportacoes.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/fiorilli/despesasfrl/exportacoes.cy.js"
```

## Objetivo

Confirmar que o módulo público `despesas_frl` disponibiliza as exportações
esperadas e que cada arquivo contém os campos preenchidos exibidos no
detalhamento da primeira despesa real.

O fluxo de cada cenário é:

```text
abrir a listagem
  → abrir a primeira despesa
  → capturar os campos preenchidos do detalhamento
  → voltar para a listagem
  → abrir o menu de exportação
  → baixar o formato escolhido
  → comparar o arquivo com o detalhamento
```

## Formatos cobertos

O spec cria um cenário para cada formato:

- HTML — `relatorio-despesas.html` ou `relatório-despesas.html`;
- CSV — `relatorio-despesas.csv` ou `relatório-despesas.csv`;
- XLS — `relatorio-despesas.xls` ou `relatório-despesas.xls`;
- TXT — `relatorio-despesas.txt` ou `relatório-despesas.txt`;
- JSON — `relatorio-despesas.json` ou `relatório-despesas.json`;
- XML — `relatorio-despesas.xml` ou `relatório-despesas.xml`.

Antes de exportar, o teste lê as opções visíveis do menu `#exportar` e exige
exatamente esses seis formatos.

## Campos comparados

Os campos preenchidos são coletados em `.campo label` no detalhamento. Para
cada campo, o teste procura `textarea`, `input`, `select` ou `.input` e lê o
valor exibido. Campos sem rótulo, sem valor ou duplicados são descartados.

O arquivo baixado precisa ser maior que zero e conter todos os valores
capturados. A comparação feita pela task `assertDownloadedFileContains` para o
adaptador Fiorilli:

- normaliza acentos, maiúsculas/minúsculas e espaços;
- compara CPF/CNPJ somente pelos dígitos e máscaras relevantes;
- normaliza a pontuação de valores monetários;
- registra, no log do Cypress, cada campo como `ENCONTRADO` ou `AUSENTE`;
- falha o cenário se qualquer campo esperado estiver ausente.

## Tasks de download

As tasks ficam em `cypress.config.js` e usam a pasta:

`cypress/artifacts/downloads/`

`removeDownloadedFiles` remove somente os nomes esperados antes de cada
download. Isso evita que uma execução anterior seja confundida com o arquivo
atual. Depois do clique, a task de comparação aguarda até 30 segundos pelo
arquivo e valida o conteúdo.

## Manutenção

Se o portal alterar o nome do arquivo, um formato, os seletores do menu ou a
estrutura do detalhamento, atualize o spec e este documento juntos. Os testes
devem continuar usando um registro real da listagem, sem fixar valores de uma
despesa específica.
