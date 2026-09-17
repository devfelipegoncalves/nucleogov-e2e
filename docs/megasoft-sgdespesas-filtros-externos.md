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

## Funções do script

- `normalizarTexto`, `normalizarParaComparacao` e `removerCodigoOrgao`: limpam
  o texto antes da comparação.
- `obterTermosSignificativos`, `obterCodigoOrgao`,
  `obterNomeOrgaoParaPesquisa`, `obterSiglasOrgao`,
  `obterIdentificadoresOrgao` e `orgaosCorrespondem`: localizam o órgão apesar
  de variações de nome, código e sigla.
- `ehPrefeituraOuPoderExecutivo(nome)`: identifica as duas descrições que o
  portal pode usar para o órgão executivo.
- `aguardarListagem` e `aguardarRetornoDoFiltro`: aguardam tabela e loaders.
- `obterOrgaoDoPortal`, `selecionarOrgaoDoPortal` e
  `validarOrgaoNoDetalhe`: obtêm, selecionam e conferem órgão.
- `selecionarOpcao`: seleciona uma opção de select externo.
- `pesquisarCovidEValidarListagem`: testa COVID-19 e trata retorno vazio.
- `pesquisarTipoEValidarListagem`: testa Empenho, Liquidação e Pagamento.
- `validarPeriodoExibido`, `dataParaNumero`,
  `validarDatasDaListagemNoPeriodo`, `ultimoDiaDoMes`, `formatarData` e
  `montarPeriodoAnual`: calculam e conferem períodos.
- `selecionarPeriodo` e `abrirCalendarioPeriodo`: interagem com período pronto
  e calendário manual.
- `obterLinhasValidas`, `obterTextoDaColuna` e
  `obterNomeMovimentoDaListagem`: extraem linhas, colunas e movimento.
- `obterDadosParaBuscaTextual`, `validarCampoNaListagem`,
  `pesquisarTextoEValidarCampo` e
  `pesquisarNomeMovimentoFavorecidoEDescricao`: preparam, executam e validam
  as buscas textuais.

## Exportações

O fluxo de exportação está documentado em [Exportações de arquivos](megasoft-sgdespesas-exportacoes.md). O spec de SG reutiliza o fluxo comum de MGDespesas com a rota `/cidadao/transparencia/sgdespesas`.
