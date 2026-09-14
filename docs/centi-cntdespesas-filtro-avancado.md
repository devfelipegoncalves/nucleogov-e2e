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

## Funções do script

### Conversão e obtenção de dados

- `normalizarTexto` e `normalizarParaComparacao`: limpam espaços, acentos e
  caixa para leitura e comparação.
- `normalizarDocumento` e `identificarTipoDocumento`: retiram pontuação e
  identificam se o valor é CPF ou CNPJ, inclusive quando há máscara parcial.
- `removerCodigo`, `valoresCorrespondem` e `obterTermosSignificativos`: tratam
  códigos e diferenças de descrição.
- `orgaosCorrespondem`: compara órgão por texto ou termos relevantes.
- `obterLinhasValidas`: retorna somente linhas reais da tabela.
- `aguardarListagem`: espera a listagem aparecer e terminar de carregar.
- `obterValorDoCampo`: lê valor de input, atributo ou texto.
- `obterCampoAvancadoPorRotulo`: localiza o campo do popup pelo label.
- `acessarPrimeiroRegistro`, `fecharDetalhe` e `obterNumeroDoDetalheAberto`:
  abrem/fecham detalhes e extraem o número do empenho.
- `obterCredorDaListagem`, `obterAnoDoDetalhamento`, `obterCnpjDoRegistro` e
  `obterNumeroDoDetalhamento`: obtêm dados de referência antes do filtro.
- `obterValoresEmpenhadosDosDetalhamentos`,
  `obterValoresLiquidadosDosDetalhamentos` e
  `obterValoresPagosDosDetalhamentos`: coletam valores de vários detalhes para
  montar filtros confiáveis.
- `obterCampoLicitacaoDoDetalheAberto`, `extrairNumeroDoProcessoLicitatorio` e
  `obterProcessoLicitatorioDoDetalhamento`: obtêm o processo licitatório.
- `obterOrgaoDoRegistro`, `obterAcaoDoRegistro`, `obterUnidadeDoRegistro`,
  `obterFuncaoDoRegistro`, `obterSubfuncaoDoRegistro`,
  `obterProgramaDoRegistro`, `obterFonteDoRegistro`, `obterGrupoDoRegistro`,
  `obterModalidadeAplicacaoDoRegistro`, `obterElementoDoRegistro` e
  `obterCategoriaEconomicaDoRegistro`: leem cada classificação do detalhe.

### Preenchimento e seleção

- `abrirFiltroAvancado`: abre o popup e aguarda seus campos.
- `selecionarOrgaoNoFiltroAvancado`: escolhe órgão por texto/código.
- `preencherCredorNoFiltroAvancado`, `preencherCpfCnpjNoFiltroAvancado` e
  `preencherNumeroNoFiltroAvancado`: preenchem campos textuais.
- `preencherValoresEmpenhadosNoFiltroAvancado`,
  `preencherValoresLiquidadosNoFiltroAvancado` e
  `preencherValoresPagosNoFiltroAvancado`: preenchem os pares mínimo/máximo.
- `selecionarLicitacaoNoFiltroAvancado`: procura uma licitação na lista
  dinâmica; `obterQuantidadeDeRegistrosSemRetry` mede o resultado e
  `selecionarLicitacaoComResultado` repete a operação quando necessário.
- `selecionarAnoNoFiltroAvancado`, `selecionarCovidNoFiltroAvancado`,
  `selecionarAcaoNoFiltroAvancado`, `selecionarUnidadeNoFiltroAvancado`,
  `selecionarFuncaoNoFiltroAvancado`, `selecionarSubfuncaoNoFiltroAvancado`,
  `selecionarProgramaNoFiltroAvancado`, `selecionarFonteNoFiltroAvancado`,
  `selecionarCategoriaEconomicaNoFiltroAvancado`,
  `selecionarGrupoNoFiltroAvancado`,
  `selecionarModalidadeAplicacaoNoFiltroAvancado` e
  `selecionarElementoNoFiltroAvancado`: localizam e selecionam cada filtro.
- `selecionarValorEmpenhadoComResultado`,
  `selecionarValorLiquidadoComResultado` e `selecionarValorPagoComResultado`:
  aplicam valores e só avançam quando há resultado.
- `pesquisarFiltroAvancado`: clica em pesquisar.
- `aguardarListagemComOuSemResultado` e
  `pesquisarFiltroAvancadoComOuSemResultado`: aguardam retorno com ou sem
  registros.

### Validação

- `validarCredorNoResultado`, `validarNumeroNoResultado`,
  `validarValorEmpenhadoNoResultado`, `validarValorLiquidadoNoResultado`,
  `validarValorPagoNoResultado`, `validarCpfCnpjNoResultado` e
  `validarAnoNoResultado`: conferem dados básicos do resultado.
- `validarResultadoCovidNoFiltroAvancado`: valida a opção COVID-19 e permite a
  mensagem oficial de ausência.
- `validarLicitacaoNoResultado`, `validarOrgaoNoResultado`,
  `validarAcaoNoResultado`, `validarUnidadeNoResultado`,
  `validarFuncaoNoResultado`, `validarSubfuncaoNoResultado`,
  `validarProgramaNoResultado`, `validarFonteNoResultado`,
  `validarGrupoNoResultado`, `validarModalidadeAplicacaoNoResultado`,
  `validarElementoNoResultado` e `validarCategoriaEconomicaNoResultado`:
  abrem o detalhe e conferem a classificação esperada.
