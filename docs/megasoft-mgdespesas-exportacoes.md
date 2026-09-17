# Testes E2E do MegaSoft — Exportações de MG Despesas

Esta documentação descreve o teste de exportação de arquivos do módulo público `mgdespesas`.

## Localização

Spec:

```text
cypress/e2e/portal/transparencia/megasoft/mgdespesas/exportacoes.cy.js
```

O teste utiliza a rota padrão:

```text
/cidadao/transparencia/mgdespesas
```

O caminho pode ser alterado por `Cypress.env("DESPESAS_PATH")`, e o nome usado no `describe` pode ser alterado por `Cypress.env("DESPESAS_NOME")`.

## Objetivo

Confirmar que cada formato de exportação contém os mesmos dados apresentados no detalhamento de uma despesa real da listagem.

O spec cria um `it` separado para cada formato encontrado:

- HTML — `relatorio-despesas.html`;
- CSV — `relatorio-despesas.csv`;
- XLS — `relatorio-despesas.xls`;
- TXT — `relatorio-despesas.txt`;
- JSON — `relatorio-despesas.json`;
- XML — `relatorio-despesas.xml`.

Se o portal deixar de disponibilizar um desses formatos, o teste correspondente falhará na validação do menu.

## Fluxo de cada `it`

Cada cenário começa com uma nova visita ao módulo e executa os passos abaixo:

1. Aguarda a listagem e abre o detalhamento da primeira despesa real.
2. Armazena o label e o valor de todos os campos encontrados no detalhamento, inclusive campos vazios.
3. Fecha o detalhamento, retorna à listagem e abre o menu `EXPORTAR`.
4. Confirma que o conjunto de formatos disponíveis corresponde aos seis formatos cobertos.
5. Seleciona somente o formato do `it` atual e aguarda o download.
6. Abre o arquivo baixado no processo Node e verifica se todos os valores preenchidos do detalhamento aparecem no arquivo.

O arquivo só é considerado válido quando existe, possui tamanho maior que zero e contém os dados capturados. A comparação ignora diferenças de acentuação e espaços. Para CPF/CNPJ, a máscara de pontuação é normalizada, pois o detalhamento e as exportações podem apresentá-la de forma diferente.

## Visualização da comparação no `cy:open`

Depois que o arquivo é aberto, o teste registra no painel de comandos do Cypress:

- o formato e o nome do arquivo analisado;
- cada campo comparado;
- o valor capturado no detalhamento;
- o resultado `ENCONTRADO`;
- a regra de normalização aplicada.

As entradas aparecem com o nome `COMPARAÇÃO HTML`, `COMPARAÇÃO CSV`, `COMPARAÇÃO XLS`, `COMPARAÇÃO TXT`, `COMPARAÇÃO JSON` ou `COMPARAÇÃO XML`. Ao expandir uma entrada no Cypress, `consoleProps` também mostra o arquivo, o campo, o valor do detalhamento e o resultado da busca.

## Helpers principais

- `obterDetalhamentoDaPrimeiraDespesa`: abre o popup, coleta todos os campos e fecha o detalhamento para retornar à listagem.
- `obterOpcoesDeExportacao`: abre o menu e captura as opções disponibilizadas pelo portal.
- `validarFormatosDisponiveis`: compara as opções encontradas com HTML, CSV, XLS, TXT, JSON e XML.
- `validarArquivoExportado`: chama o task Node que espera, abre e compara o arquivo baixado.
- `assertDownloadedFileContains`: task configurado em `cypress.config.js` que lê o arquivo no `downloadsFolder`, verifica seu tamanho e compara os valores esperados.

## Como executar

Executar somente as exportações:

```bash
npm run cy:run -- --spec 'cypress/e2e/portal/transparencia/megasoft/mgdespesas/exportacoes.cy.js'
```

Executar de forma interativa:

```bash
npm run cy:open -- --e2e --spec 'cypress/e2e/portal/transparencia/megasoft/mgdespesas/exportacoes.cy.js'
```

O domínio é definido por `CYPRESS_BASE_URL` no `.env` ou no ambiente do comando. Os arquivos temporários são baixados em `cypress/artifacts/downloads/`, conforme a configuração do Cypress.

## Resultado esperado

Uma execução bem-sucedida apresenta seis cenários aprovados, um para cada formato:

```text
6 passing
```
