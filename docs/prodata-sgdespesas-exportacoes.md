# Prodata SGDespesas — exportações

Este documento explica, passo a passo, como funciona o teste E2E de exportação
do módulo público `sgdespesas` no adaptador Prodata.

O texto foi escrito para quem ainda está conhecendo Cypress, JavaScript e a
estrutura deste projeto.

## Antes de começar: detalhamento não é anexo

Neste teste existem dois arquivos diferentes:

1. O arquivo JavaScript do teste:
   `cypress/e2e/portal/transparencia/prodata/sgdespesas/exportacoes.cy.js`.
2. O arquivo criado pelo download, por exemplo:
   `cypress/artifacts/downloads/relatório-despesas.html`.

Quando o teste “abre” uma despesa, ele não abre um anexo. Ele clica no número da
despesa e abre o detalhamento dentro da página do portal. Depois, o teste fecha
esse detalhamento, escolhe um formato de exportação e lê o arquivo baixado
diretamente na pasta de downloads.

O fluxo completo é:

```text
abrir listagem
  → clicar na primeira despesa
  → capturar os campos do detalhamento
  → voltar para a listagem
  → escolher o formato de exportação
  → ler o arquivo baixado
  → comparar os valores capturados com o conteúdo do arquivo
```

## Arquivos envolvidos

### Arquivo do teste

O spec está em:

```text
cypress/e2e/portal/transparencia/prodata/sgdespesas/exportacoes.cy.js
```

Ele controla o navegador: visita a página, clica na despesa, abre o menu de
exportação e chama a task que lê o arquivo.

### Configuração das tasks

As tasks que executam código no Node.js ficam em:

```text
cypress.config.js
```

Isso é necessário porque o código executado no navegador pelo Cypress não deve
ler arquivos do computador diretamente. A task recebe os dados do teste,
acessa a pasta de downloads e devolve o resultado para o Cypress.

## Como o detalhamento é aberto

O `beforeEach` executa `visitarSgDespesas()` e `aguardarListagem()` antes de cada
cenário.

### 1. Acessar a listagem

`visitarSgDespesas()`:

- registra um `intercept` para as requisições `POST` feitas pelo portal;
- visita `/cidadao/transparencia/sgdespesas`;
- espera as requisições iniciais terminarem.

Depois, `aguardarListagem()` confirma que:

- o carregador `.loader` desapareceu;
- o container `.cont_dados` está visível;
- a tabela terminou de carregar e não possui `.tb-load`.

### 2. Encontrar a primeira despesa

`obterLinhasValidas()` busca as linhas usando:

```js
.cont_dados .tb tr[id]
```

As linhas de template, “nenhum resultado” e carregamento são ignoradas. Se não
houver pelo menos uma linha, o cenário falha porque não existe uma despesa real
para usar na comparação.

### 3. Clicar para abrir o detalhamento

Em `obterDetalhamentoDaPrimeiraDespesa()`, o teste clica no elemento
`.colNumero` da primeira linha:

```js
cy.wrap(linhas[0]).find(".colNumero").first().click({ force: true });
```

Esse clique abre o detalhamento Prodata na página. O teste também fecha o aviso
de termos de uso quando ele aparece sobre o conteúdo.

## Como os campos do detalhamento são capturados

A função responsável é `obterCamposDoDetalhamento($pagina)`.

Ela procura os elementos `label` da página e, para cada label, tenta encontrar o
campo correspondente dentro do mesmo `.campo` ou do elemento pai:

```js
textarea,
input:not([type='hidden']),
select,
.input
```

O valor é obtido nesta ordem:

1. propriedade `.value` do campo;
2. atributo HTML `value`;
3. texto interno do elemento.

Campos sem rótulo, sem valor ou repetidos não são adicionados. Os dados ficam
em um array simples, que é retornado para o cenário:

```js
[
  {
    label: "Descrição / Histórico",
    value: "PROCESSO DE LIQUIDAÇÃO ...",
  },
  {
    label: "Favorecido",
    value: "EMPRESA EXEMPLO LTDA",
  },
];
```

O teste exige que pelo menos um campo preenchido seja encontrado. Essa
verificação evita continuar com uma comparação vazia quando o detalhamento
ainda não terminou de carregar.

Depois da captura, o teste visita novamente a listagem para fechar o
detalhamento e deixar a página pronta para o próximo passo.

## Como o arquivo é exportado

Para cada formato, o spec cria um cenário independente:

- HTML — `relatório-despesas.html`;
- CSV — `relatório-despesas.csv`;
- XLS — `relatório-despesas.xls`;
- TXT — `relatório-despesas.txt`;
- JSON — `relatório-despesas.json`;
- XML — `relatório-despesas.xml`.

`obterOpcoesDeExportacao()` abre o botão `#exportar`, lê as opções visíveis e
confirma que os seis formatos esperados estão disponíveis.

Antes do clique, `exportarOpcao()` chama a task `removeDownloadedFiles`:

```js
cy.task("removeDownloadedFiles", {
  fileNames: [`relatório-despesas.${formato}`],
});
```

Essa limpeza remove somente o arquivo da extensão atual. Ela é importante
porque, durante uma execução pelo Cypress Open, pode existir um arquivo de uma
execução anterior. Sem a limpeza, o teste poderia ler o relatório antigo antes
de o novo download terminar.

Em seguida, o teste clica na opção do menu:

```js
cy.get("#exportar .btt_options a:visible")
  .contains(new RegExp(`^${texto}$`, "i"))
  .click({ force: true });
```

O navegador salva o arquivo em:

```text
cypress/artifacts/downloads/
```

## Como o arquivo é lido e comparado

Após o clique, `validarArquivoExportado()` chama a task
`assertDownloadedFileContains`:

```js
cy.task("assertDownloadedFileContains", {
  fileName: `relatório-despesas.${formato}`,
  expectedFields: campos,
  adaptador: "prodata",
});
```

Os parâmetros têm estas funções:

- `fileName`: nome que o download deve possuir;
- `expectedFields`: campos capturados no detalhamento;
- `adaptador`: informa que as regras específicas do Prodata devem ser usadas.

### Etapas internas da task

Em `cypress.config.js`, a task realiza as seguintes etapas:

1. Monta o caminho completo do arquivo dentro de `downloadsFolder`.
2. Espera até 30 segundos pelo arquivo.
3. Confirma que o arquivo existe e possui tamanho maior que zero.
4. Lê o conteúdo usando UTF-8.
5. Decodifica entidades HTML, como `&amp;`, `&nbsp;` e `&quot;`.
6. Normaliza o conteúdo para permitir comparações consistentes.
7. Compara cada valor capturado no detalhamento.
8. Rejeita a task se algum valor estiver ausente.
9. Retorna os campos comparados quando todos forem encontrados.

## Regras de normalização

A comparação não exige que a aparência seja idêntica em todos os formatos.
Algumas exportações exibem o mesmo dado com diferenças de apresentação.

### Texto comum

São normalizados:

- acentos: `Educação` e `Educacao`;
- letras maiúsculas e minúsculas;
- espaços repetidos;
- quebras de linha;
- pontuação, na comparação compacta do Prodata.

Por isso, uma diferença como esta não causa falha:

```text
JURÍDICO ADMINISTRATIVA
JURIDICOADMINISTRATIVA
```

### CPF e CNPJ

Para labels que contêm `CPF` ou `CNPJ`, são comparados somente os números e,
quando presentes, os asteriscos:

```text
12.345.678/0001-90
12345678000190
```

Esses valores são considerados equivalentes.

### Valores monetários

Para campos monetários do Prodata, a pontuação é ignorada na comparação:

```text
R$ 1.234,56
1234.56
```

O objetivo é verificar o número, mesmo que o arquivo use uma formatação
diferente da tela.

## O que acontece quando um campo não é encontrado

Se o valor de algum campo não aparecer no arquivo, a task lança um erro como:

```text
Dados ausentes em relatório-despesas.html: Descrição / Histórico
```

O nome exibido depois dos dois-pontos é o `label` capturado no detalhamento.
Isso não significa necessariamente que o arquivo deveria possuir exatamente
esse mesmo título. Por exemplo, o detalhamento pode usar `Descrição /
Histórico`, enquanto a exportação usa `Descrição`. O valor do campo é o dado
principal da comparação.

Para investigar uma falha:

1. Abra a imagem gerada em `cypress/artifacts/screenshots`.
2. Verifique qual despesa foi aberta no detalhamento.
3. Abra o arquivo correspondente em `cypress/artifacts/downloads`.
4. Procure o valor completo do campo, não somente o label.
5. Confirme se o arquivo é de uma execução atual e não de uma execução
   anterior.
6. Confira se o portal mudou o nome do arquivo ou o formato do conteúdo.

## Como executar

O domínio deve estar definido por `CYPRESS_BASE_URL` no `.env`.

Execute somente este spec com:

```bash
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/exportacoes.cy.js"
```

Para abrir o Cypress em modo interativo:

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/exportacoes.cy.js"
```

Os seis cenários usam a mesma estratégia, mas cada um baixa e valida uma
extensão diferente.
