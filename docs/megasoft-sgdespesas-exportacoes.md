# Testes E2E do MegaSoft — Exportações de SG Despesas

Esta documentação descreve a cobertura de exportação de arquivos do módulo público `sgdespesas`.

## Localização

Spec executável:

```text
cypress/e2e/portal/transparencia/megasoft/sgdespesas/exportacoes.cy.js
```

O spec de SG configura a rota `/cidadao/transparencia/sgdespesas` e reutiliza o fluxo comum de exportações de `mgdespesas`. A implementação compartilhada está em:

```text
cypress/e2e/portal/transparencia/megasoft/mgdespesas/exportacoes.cy.js
```

Essa reutilização mantém a mesma regra de comparação nos dois adaptadores e evita que os cenários fiquem diferentes sem necessidade.

## Objetivo

Confirmar que os arquivos exportados pelo módulo SGDespesas contêm os mesmos dados apresentados no detalhamento de uma despesa real da listagem.

## Cenários

Existe um `it` independente para cada formato disponibilizado pelo portal:

- HTML — `relatorio-despesas.html`;
- CSV — `relatorio-despesas.csv`;
- XLS — `relatorio-despesas.xls`;
- TXT — `relatorio-despesas.txt`;
- JSON — `relatorio-despesas.json`;
- XML — `relatorio-despesas.xml`.

## Fluxo de cada `it`

Cada cenário visita novamente o módulo e executa os passos abaixo:

1. Aguarda a listagem e acessa a primeira despesa.
2. Guarda todos os labels e valores encontrados no detalhamento, incluindo campos vazios.
3. Fecha o detalhamento e retorna à listagem.
4. Abre o menu `EXPORTAR` e valida todos os formatos disponíveis.
5. Baixa somente o formato correspondente ao `it` atual.
6. Abre o arquivo baixado e compara todos os valores preenchidos do detalhamento com seu conteúdo.

O arquivo precisa existir, possuir tamanho maior que zero e conter os dados da despesa. A comparação normaliza acentuação e espaços; para CPF/CNPJ, também normaliza a máscara do documento.

## Comparação visível no `cy:open`

O painel do Cypress exibe uma entrada `COMPARAÇÃO <FORMATO>` para cada campo comparado. Cada entrada informa:

- o campo analisado;
- o valor capturado no detalhamento;
- o resultado `ENCONTRADO`;
- a regra de normalização utilizada.

As propriedades adicionais ficam disponíveis ao expandir `consoleProps` no painel de comandos.

## Como executar

Executar somente as exportações de SGDespesas:

```bash
npm run cy:run -- --spec 'cypress/e2e/portal/transparencia/megasoft/sgdespesas/exportacoes.cy.js'
```

Executar de forma interativa:

```bash
npm run cy:open -- --e2e --spec 'cypress/e2e/portal/transparencia/megasoft/sgdespesas/exportacoes.cy.js'
```

O domínio é definido por `CYPRESS_BASE_URL` no `.env` ou no ambiente do comando. Os arquivos são baixados em `cypress/artifacts/downloads/`.

## Resultado esperado

```text
6 passing
```
