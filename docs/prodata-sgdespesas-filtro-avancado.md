# Prodata SGDespesas — filtro avançado

Script relacionado:

`cypress/e2e/portal/transparencia/rotinas/sgdespesas/filtro-avancado-prodata.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/rotinas/sgdespesas/filtro-avancado-prodata.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/rotinas/sgdespesas/filtro-avancado-prodata.cy.js"
```

## Objetivo

Validar os campos do popup de filtro avançado do módulo SGDespesas Prodata,
aplicando filtros com dados reais obtidos da listagem e conferindo o retorno no
detalhamento ou na própria tabela.

## Preparação e sincronização

O `beforeEach` visita a rota `/cidadao/transparencia/sgdespesas`, aguarda a
listagem, limpa filtros anteriores e prepara uma linha com favorecido quando
necessário. `visitarSgDespesas()` registra o intercept antes da visita e espera
as duas chamadas `POST /api`: uma para a listagem e outra para as opções dos
filtros.

Os selects são componentes customizados. Depois de abertos, o campo Buscar
filtra os links localmente por `keyup`; não há uma nova requisição para cada
termo. Quando uma lista chega vazia, o código fecha/reabre o select ou recarrega
a página até `MAX_TENTATIVAS_CARREGAMENTO_SELECT`.

## Testes cobertos

1. Pesquisa por número do empenho e valida o número no detalhe.
2. Pesquisa por favorecido e valida o favorecido retornado.
3. Pesquisa por CPF/CNPJ e valida os dígitos no detalhe.
4. Pesquisa por órgão e valida o órgão retornado.
5. Pesquisa por histórico do empenho.
6. Pesquisa por categoria econômica.
7. Pesquisa por grupo.
8. Pesquisa por modalidade de aplicação.
9. Pesquisa por elemento da despesa; registra alerta se a opção não estiver disponível.
10. Pesquisa por data inicial e final.
11. Pesquisa por unidade.
12. Pesquisa por função.
13. Pesquisa por subfunção.
14. Pesquisa por natureza da despesa.
15. Pesquisa por programa, com tentativa de recuperação para listas dinâmicas.
16. Pesquisa por ação.
17. Pesquisa por fonte.
18. Pesquisa por COVID-19 = Sim.
19. Pesquisa por COVID-19 = Não.
20. Pesquisa por valor mínimo empenhado.
21. Pesquisa por valor máximo empenhado.
22. Pesquisa por valor mínimo liquidado.
23. Pesquisa por valor máximo liquidado.
24. Pesquisa por valor mínimo pago.
25. Pesquisa por valor máximo pago.
26. Valida alerta quando o mínimo empenhado é maior que o máximo.
27. Valida alerta quando o mínimo liquidado é maior que o máximo.
28. Valida alerta quando o mínimo pago é maior que o máximo.
29. Valida alerta quando a data inicial é maior que a data final.

## Helpers principais

- `visitarSgDespesas`: sincroniza as cargas iniciais do módulo.
- `aguardarListagem`: aguarda loaders e tabela disponíveis.
- `obter...DoPrimeiroRegistro`: lê dados reais do detalhe.
- `abrirFiltroAvancado`: abre o popup apenas quando necessário.
- `abrirSelectAvancadoComOpcoes`: abre e obtém opções visíveis.
- `pesquisarAutocomplete`: digita no filtro local do select.
- `obterOpcaoDoFiltro`: encontra a opção por descrição, código ou ambos.
- `validarResultadoOuNenhumResultado`: aceita resultado válido ou a mensagem
  oficial de ausência de dados.

## Funções do script

As funções seguem o padrão **obter → selecionar → validar**. As funções
`obter...` leem dados do portal, as `selecionar...` interagem com o filtro e as
`validar...` conferem o resultado. Quando uma função retorna `cy...`, ela coloca
uma nova etapa na fila do Cypress; por isso ela deve ser retornada quando o
chamador precisa esperar seu resultado.

### Normalização e comparação

- `normalizarTexto(texto)`: remove espaços extras no início, no fim e entre
  palavras. Retorna o texto limpo.
- `normalizarParaComparacao(texto)`: além de limpar espaços, remove acentos e
  converte para minúsculas. É usada somente para comparar textos.
- `removerCodigo(texto)`: remove o código inicial de textos como `3 - Despesas
Correntes`, deixando apenas a descrição.
- `obterCodigoNumerico(texto)`: extrai e normaliza o código numérico inicial.
- `opcaoCorrespondeAoCodigo(esperado, opcao)`: verifica se os códigos dos dois
  textos são iguais ou representam uma relação pai/filho.
- `obterIdentificacaoDaOpcao(elemento)`: reúne texto e atributos do link da
  opção (`href`, `data-id` e `value`) para permitir comparação flexível.
- `obterCodigoOrgao(texto)`: extrai o código numérico inicial de um órgão.
- `valoresDoFiltroCorrespondem(esperado, opcao)`: compara descrição completa e
  descrição sem código, aceitando uma conter a outra.
- `obterTermosSignificativos(texto)`: separa palavras úteis e ignora artigos e
  termos administrativos comuns.
- `obterSiglaDoOrgao(nome)`: retorna a sigla conhecida ou monta uma sigla pelas
  iniciais do nome.
- `ehPrefeituraOuPoderExecutivo(nome)`: identifica as duas formas usadas pelo
  portal para representar o Poder Executivo.
- `obterIdentificadoresDoOrgao(nome)`: monta o conjunto de nomes e siglas
  equivalentes de um órgão.
- `orgaosCorrespondem(esperado, encontrado)`: compara órgão por nome, sigla,
  código indireto ou termos significativos.

### DOM, carregamento e selects

- `obterCampoAvancadoPorRotulo(rotulo)`: encontra o container `.campo` pelo
  texto do label e retorna um chainable Cypress.
- `obterValorDoCampo(campo)`: lê o primeiro valor disponível entre `value`,
  atributo `value` e texto do elemento.
- `aguardarCampoComValor(campo)`: callback usado por `should` até o detalhe
  preencher o campo.
- `selecionarOpcao(container, texto)`: abre um select simples e clica no link
  correspondente.
- `obterContainerDoSelect(campo)`: transforma um seletor string em elemento
  Cypress e relê o DOM atual.
- `obterSeletorDoSelect(campo)`: obtém um seletor estável por ID para evitar
  referências a elementos removidos pelo portal.
- `visitarSgDespesas()`: intercepta e aguarda as duas chamadas iniciais antes
  de continuar; a segunda carrega as opções dos filtros.
- `recarregarPaginaEReabrirFiltro(campo, tentativa, continuar)`: recarrega o
  portal quando a lista está vazia e chama novamente a operação interrompida.
- `abrirSelectAvancadoComOpcoes(campo, recarregar, tentativa)`: abre o select,
  coleta links visíveis e coordena a recuperação de lista vazia.
- `pesquisarAutocomplete(campo, texto)`: digita no campo Buscar; o componente
  do portal filtra localmente por `keyup`, portanto não há request por termo.
- `obterOpcoesDoFiltro(campo, termo, tentativa)`: tenta termos alternativos,
  coleta opções visíveis e solicita recarga quando necessário.
- `obterOpcaoDoFiltro(campo, termos, corresponde, tentativa)`: encontra uma
  opção usando uma função de comparação fornecida pelo cenário.
- `aguardarListagem()`: espera loaders desaparecerem e a tabela aparecer.
- `obterLinhasValidas()`: retorna linhas que não são templates nem a linha de
  “nenhum resultado”.
- `validarResultadoOuNenhumResultado(nome, validar)`: executa a validação ou
  aceita a mensagem oficial de lista vazia.
- `prepararListagemComFavorecido()`: troca o período quando necessário até
  encontrar uma linha com favorecido preenchido.
- `abrirFiltroAvancado(campo)`: abre o popup somente se o campo pedido ainda
  não estiver visível.
- `limparFiltrosAntesDoTeste()`: remove filtros persistidos pelo portal.
- `fecharTermosDeUsoSeExibido()`: fecha o aviso de cookies quando ele cobre o
  conteúdo do detalhe.
- `selecionarCovidAvancado(opcao)`: abre o select booleano, localiza Sim ou Não
  e clica na opção.

### Leitura e validação dos campos do empenho

- `obterHistoricoDoPrimeiroRegistro()` / `validarHistoricoNoDetalhe()`: leem e
  conferem a descrição do empenho.
- `obterFavorecidoDoPrimeiroRegistro()` / `validarFavorecidoNoDetalhe()`: leem
  e conferem o favorecido.
- `obterCpfCnpjDeUmRegistro(indice)` / `validarCpfCnpjNoDetalhe()`: procuram um
  documento com 11 ou 14 dígitos e conferem seus dígitos.
- `obterNumeroDoPrimeiroRegistro()` / `validarNumeroNoDetalhe()`: obtêm o
  número do empenho e conferem o mesmo número no detalhe filtrado.
- `obterOrgaoDoPrimeiroRegistro()` / `selecionarOrgao()` /
  `validarOrgaoNoDetalhe()`: obtêm, selecionam e validam o órgão.
- `obterUnidadesDisponiveisNoFiltro()` / `obterUnidadeDoRegistroPesquisavel()`
  / `selecionarUnidade()` / `validarUnidadeNoDetalhe()`: encontram uma unidade
  realmente disponível e validam seu retorno.
- `unidadeCombinaComOpcao(unidade, opcao)`: compara uma unidade do detalhe com
  cada opção disponível por código ou descrição.
- `obterFuncaoDoPrimeiroRegistro()` / `selecionarFuncao()` /
  `validarFuncaoNoDetalhe()`: tratam o filtro de função.
- `obterSubfuncaoDoPrimeiroRegistro()` / `selecionarSubfuncao()` /
  `validarSubfuncaoNoDetalhe()`: tratam o filtro de subfunção.
- `obterGrupoDoPrimeiroRegistro()` / `selecionarGrupo()` /
  `validarGrupoNoDetalhe()`: tratam o grupo orçamentário.
- `obterModalidadeAplicacaoDoPrimeiroRegistro()` /
  `selecionarModalidadeAplicacao()` /
  `validarModalidadeAplicacaoNoDetalhe()`: tratam a modalidade.
- `obterNaturezaDoPrimeiroRegistro()` / `selecionarNatureza()` /
  `validarNaturezaNoDetalhe()`: tratam a natureza da despesa.
- `obterElementoDoPrimeiroRegistro()` / `selecionarElementoDaDespesa()` /
  `validarElementoNoDetalhe()`: tratam o elemento e retornam alerta quando a
  opção não é fornecida pelo portal.
- `obterCategoriaEconomicaDoPrimeiroRegistro()` /
  `selecionarCategoriaEconomica()` /
  `validarCategoriaEconomicaNoDetalhe()`: tratam a categoria econômica.

### Valores, datas, ações, programas e fontes

- `converterValorMonetario(valor)`: converte formatos brasileiros e retorna um
  número para comparação.
- `formatarValorMonetario(valor)`: converte um número para texto monetário
  aceito pelo campo do formulário.
- `obterTextoDoValorNaLinha(linha, tipo)`: localiza a coluna monetária por
  seletor ou cabeçalho.
- `obterTextoDoValorEmpenhadoNaLinha()` / `obterTextoDoValorLiquidadoNaLinha()`
  / `obterTextoDoValorPagoNaLinha()`: especializam a leitura de cada valor.
- `obterValoresMonetariosDaListagem(obterTexto, descricao)`: coleta mínimo,
  máximo e valores numéricos das linhas.
- `obterValoresEmpenhadosDaListagem()` / `obterValoresLiquidadosDaListagem()` /
  `obterValoresPagosDaListagem()`: aplicam a coleta ao tipo correspondente.
- `preencherValorAvancado(rotulo, valor)`: encontra o campo monetário pelo
  label e preenche o valor formatado.
- `validarValoresMonetariosNaListagem(limite, tipo, obterTexto, descricao)`:
  confere que as linhas respeitam o limite aplicado.
- `validarValoresEmpenhadosNaListagem()` /
  `validarValoresLiquidadosNaListagem()` /
  `validarValoresPagosNaListagem()`: especializam a validação monetária.
- `converterData(data)`: converte data brasileira para número comparável.
- `obterDatasInicialEFinalDaListagem()`: extrai o menor e o maior dia da tabela.
- `validarDatasNoPeriodo(inicial, final)`: garante que as datas retornadas
  estejam dentro do intervalo informado.
- `extrairNumeroDoDetalhamento(texto)` / `obterNumeroDoDetalhamentoAtual()`:
  extraem o identificador numérico exibido no detalhe.
- `obterDadosDaAcaoDoPrimeiroRegistro()` / `obterDadosDaAcaoNoResultado()`:
  leem ação e número do empenho para validar o filtro.
- `selecionarAcoes(nome, indice, tentativa)` / `selecionarAcaoComResultado()`:
  selecionam ação com recuperação para listas dependentes.
- `registrarAlertaPrograma(mensagem, detalhes)`: registra ausência de programa
  sem esconder a informação no relatório.
- `obterProgramaDoEmpenho(indice)` / `pesquisarProgramaAteEncontrarResultado()`
  / `tentarOpcoesDePrograma()`: encontram e pesquisam programa com tentativas.
- `validarProgramaNoDetalhe(nome)`: confere o programa do resultado.
- `obterFonteDoEmpenho()` / `selecionarFonte()` / `validarFonteNoDetalhe()` /
  `validarFonteNaListagem()`: obtêm, selecionam e validam a fonte.

## Manutenção

Prefira dados extraídos do portal a valores fixos. Ao adicionar um cenário,
inclua o teste nesta documentação, mantenha a validação próxima do fluxo e
remova qualquer `it.only` antes de versionar.
