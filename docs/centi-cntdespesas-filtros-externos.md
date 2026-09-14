# Centi CNTDespesas — filtros externos

Script relacionado:

`cypress/e2e/portal/transparencia/centi/cntdespesas/filtros-externos.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/centi/cntdespesas/filtros-externos.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/centi/cntdespesas/filtros-externos.cy.js"
```

## Objetivo e configuração

Validar os filtros externos da listagem CNTDespesas no adaptador Centi. O
script aceita `DESPESAS_PATH` e `DESPESAS_NOME` por variável de ambiente para
ser reutilizado em diferentes portais Centi.

## Testes cobertos

1. Identifica um órgão, pesquisa pelo órgão e valida os resultados.
2. Filtra COVID-19 como Sim e depois como Não.
3. Filtra pela busca textual e valida o favorecido.
4. Filtra pelos últimos sete dias e valida as datas.
5. Filtra por ano no select de período.
6. Filtra por mês no select de período.
7. Filtra por mês e ano no popup de intervalo.

## Regras de validação

Os seletores dos componentes Centi ficam concentrados nas constantes do
arquivo. A listagem é aguardada antes de cada interação, e os valores são
comparados após normalização de espaços, acentos e códigos.

## Funções do script

- `normalizarTexto`, `normalizarParaComparacao` e `removerCodigo`: preparam
  textos para exibição e comparação.
- `obterTermosSignificativos` e `orgaosCorrespondem`: comparam órgãos mesmo
  quando a nomenclatura do portal varia.
- `obterLinhasValidas` e `aguardarListagem`: localizam registros e aguardam a
  tabela terminar de carregar.
- `obterValorDoCampo`: lê um valor de input, atributo ou texto.
- `obterTermoDaListagem`: escolhe um termo textual real para a busca.
- `pesquisarTextoEValidar`: preenche a busca externa, aguarda o retorno e
  valida o favorecido.
- `selecionarPeriodo` e `selecionarPeriodoPorPrefixo`: escolhem períodos por
  texto exato ou prefixo.
- `converterDataParaNumero` e `formatarDataParaNumero`: convertem datas para
  comparação e apresentação.
- `validarResultadoUltimosSeteDias`: confere datas no intervalo móvel.
- `aguardarRetornoDoFiltro`: espera loaders após a aplicação de um filtro.
- `validarPeriodoExibido`: confere início e fim mostrados no portal.
- `ultimoDiaDoMes`, `montarPeriodoMensal` e `montarPeriodoAnual`: calculam
  períodos usados nos cenários.
- `validarDatasDaListagemNoPeriodo`: valida todas as datas retornadas.
- `abrirPopupIntervalo`: abre o calendário de intervalo.
- `acessarPrimeiroRegistro`, `fecharDetalhe`, `identificarOrgaoNoDetalhe` e
  `retornarParaListagem`: controlam navegação entre listagem e detalhe.
- `lerElementosDoFiltro`: lê opções do select de órgão.
- `selecionarOrgaoNoFiltro` e `validarOrgaoDosResultados`: selecionam e validam
  o órgão.
- `selecionarOpcaoCovid` e `validarResultadoCovid`: aplicam e conferem o
  filtro COVID-19.
