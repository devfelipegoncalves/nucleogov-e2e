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

## Funções do script

As funções seguem o fluxo **obter → selecionar → validar**. As funções `obter`
leem dados reais do portal, as `selecionar` interagem com o popup e as `validar`
confirmam o resultado.

### Texto, órgãos e interação

- `normalizarTexto`, `normalizarParaComparacao` e `removerCodigo`: limpam
  espaços, acentos, caixa e códigos para comparações seguras.
- `valoresDoFiltroCorrespondem`: compara uma opção com o valor esperado usando
  texto completo ou descrição sem código.
- `obterTermosSignificativos`: transforma um nome em palavras úteis.
- `obterSiglaDoOrgao`, `ehPrefeituraOuPoderExecutivo`,
  `obterIdentificadoresDoOrgao` e `orgaosCorrespondem`: tratam variações de
  nome, sigla e identificação do órgão.
- `obterCampoAvancadoPorRotulo`: localiza um campo pelo label.
- `obterValorDoCampo` e `aguardarCampoComValor`: leem um campo e aguardam o
  detalhe terminar de preenchê-lo.
- `selecionarOpcao`: abre um select e escolhe um link.
- `obterContainerDoSelect`: transforma o container atual em chainable Cypress.
- `abrirSelectAvancadoComOpcoes`, `obterOpcoesCarregadas` e
  `pesquisarAutocomplete`: abrem o select, coletam opções e digitam no filtro.
- `aguardarListagem`, `obterLinhasValidas` e
  `validarResultadoOuNenhumResultado`: controlam loaders, linhas úteis e
  resultado vazio.
- `prepararListagemComFavorecido`, `abrirFiltroAvancado`,
  `limparFiltrosAntesDoTeste` e `fecharTermosDeUsoSeExibido`: preparam a tela
  para cada cenário.
- `selecionarCovidAvancado(opcao)`: seleciona Sim ou Não no filtro booleano.

### Obtenção e validação dos filtros

- Os pares `obterHistoricoDoPrimeiroRegistro`/`validarHistoricoNoDetalhe`,
  `obterFavorecidoDoPrimeiroRegistro`/`validarFavorecidoNaListagem` e
  `obterNumeroDoPrimeiroRegistro`/`validarNumeroNaListagem` tratam texto,
  favorecido e número do empenho.
- `obterCnpjDeUmRegistro` e `validarCnpjNoDetalhe` obtêm um CNPJ válido e
  conferem seus dígitos.
- Os pares `obterOrgaoDoPrimeiroRegistro`/`selecionarOrgao`/
  `validarOrgaoNoDetalhe`, `obterUnidadesDisponiveisNoFiltro`/
  `obterUnidadeDoRegistroPesquisavel`/`selecionarUnidade`/
  `validarUnidadeNoDetalhe` tratam órgão e unidade.
- `unidadeCombinaComOpcao(unidade, opcao)`: compara uma unidade do detalhe com
  a opção disponível por código ou descrição.
- `obterFuncaoDoPrimeiroRegistro`, `obterSubfuncaoDoPrimeiroRegistro`,
  `obterGrupoDoPrimeiroRegistro`, `obterModalidadeAplicacaoDoPrimeiroRegistro`,
  `obterNaturezaDoPrimeiroRegistro`, `obterElementoDoPrimeiroRegistro` e
  `obterCategoriaEconomicaDoPrimeiroRegistro` leem classificações do detalhe.
- `selecionarFuncao`, `selecionarSubfuncao`, `selecionarGrupo`,
  `selecionarModalidadeAplicacao`, `selecionarNatureza`,
  `selecionarElementoDaDespesa` e `selecionarCategoriaEconomica` aplicam essas
  classificações no popup.
- `validarFuncaoNoDetalhe`, `validarSubfuncaoNoDetalhe`,
  `validarGrupoNoDetalhe`, `validarModalidadeAplicacaoNoDetalhe`,
  `validarNaturezaNoDetalhe`, `validarElementoNoDetalhe` e
  `validarCategoriaEconomicaNoDetalhe` conferem os campos no resultado.
- `obterAcoesDoPrimeiroRegistro`, `selecionarAcoes` e `validarAcoesNoDetalhe`
  tratam ações do empenho.
- `obterProgramaDoEmpenho`, `pesquisarProgramaAteEncontrarResultado`,
  `tentarOpcoesDePrograma`, `validarProgramaNoDetalhe` e
  `registrarAlertaPrograma` tratam programas e registram indisponibilidade.
- `obterFonteDoEmpenho`, `selecionarFonte`, `validarFonteNoDetalhe` e
  `validarFonteNaListagem` tratam fontes.

### Valores e datas

- `converterValorMonetario` transforma moeda brasileira em número.
- `formatarValorMonetario` transforma número em texto aceito pelo formulário.
- `obterTextoDoValorNaLinha` localiza colunas por seletor ou cabeçalho; as
  funções `obterTextoDoValorEmpenhadoNaLinha`,
  `obterTextoDoValorLiquidadoNaLinha` e `obterTextoDoValorPagoNaLinha`
  especializam essa leitura.
- `obterValoresMonetariosDaListagem` e `obterValoresEmpenhadosDaListagem`,
  `obterValoresLiquidadosDaListagem`, `obterValoresPagosDaListagem` calculam
  limites para os cenários.
- `preencherValorAvancado` preenche um campo pelo label.
- `validarValoresMonetariosNaListagem` e suas três funções especializadas
  garantem que o limite foi respeitado.
- `validarValoresEmpenhadosNaListagem`, `validarValoresLiquidadosNaListagem`
  e `validarValoresPagosNaListagem`: encaminham a validação para o tipo
  monetário correto.
- `converterData`, `obterDatasInicialEFinalDaListagem` e
  `validarDatasNoPeriodo` convertem, obtêm e validam datas.
