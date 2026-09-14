# Prodata SGDespesas — filtros externos

Script relacionado:

`cypress/e2e/portal/transparencia/prodata/sgdespesas/filtros-externos.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/filtros-externos.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/filtros-externos.cy.js"
```

## Objetivo

Validar os filtros exibidos diretamente na listagem do SGDespesas Prodata, sem
abrir o popup avançado.

## Preparação

Cada teste acessa `/cidadao/transparencia/sgdespesas`, aguarda o filtro externo
e espera a primeira listagem sem loaders. O órgão, os textos de busca e os
períodos são obtidos ou calculados durante a execução para reduzir dependência
de dados fixos.

## Testes cobertos

1. Obtém o órgão de um empenho, filtra por órgão e valida o campo no detalhe.
2. Filtra COVID-19 como Sim e valida registros ou a mensagem de ausência.
3. Filtra COVID-19 como Não e valida registros ou a mensagem de ausência.
4. Filtra por Tipo = Empenho.
5. Filtra por Tipo = Liquidação.
6. Filtra por Tipo = Pagamento.
7. Pesquisa sequencialmente nome do movimento, favorecido e descrição.
8. Filtra pelos últimos sete dias e valida as datas retornadas.
9. Filtra pelo ano atual e pelo ano anterior.
10. Navega pelo calendário e valida março e janeiro do ano anterior.

## Regras de validação

- Órgãos podem ser comparados por código, nome, sigla ou termos significativos.
- A ausência de dados só é aceita quando o portal exibe
  `Nenhum resultado encontrado`.
- As datas são convertidas para `AAAAMMDD` antes da comparação.
- Os resultados e alertas são registrados no log do Cypress para facilitar a
  análise no runner.

## Funções do script

- `normalizarTexto(texto)`: limpa espaços extras.
- `normalizarParaComparacao(texto)`: remove acentos e converte para minúsculas.
- `obterTermosSignificativos(texto)`: separa palavras úteis para comparar
  nomes de órgãos.
- `obterCodigoOrgao(texto)`: extrai o código inicial do órgão.
- `removerCodigoOrgao(texto)`: remove o código antes da descrição.
- `ehPrefeituraOuPoderExecutivo(nome)`: identifica nomes equivalentes do Poder
  Executivo.
- `obterNomeOrgaoParaPesquisa(orgao)`: escolhe o texto mais adequado para o
  campo de busca, usando regras conhecidas por código.
- `obterSiglasOrgao(nome)` / `obterIdentificadoresOrgao(nome)`: montam siglas e
  identificadores alternativos.
- `orgaosCorrespondem(esperado, encontrado)`: compara órgão por nome, sigla,
  código ou termos significativos.
- `aguardarListagem()`: espera a tabela e uma linha válida.
- `obterOrgaoDoPortal()`: abre o primeiro empenho, lê seu órgão e retorna à
  listagem.
- `selecionarOrgaoDoPortal(orgao)`: abre o select e seleciona primeiro por
  código e depois por nome.
- `selecionarOpcao(container, texto)`: abre um select e clica na opção textual.
- `aguardarRetornoDoFiltro()`: aguarda a atualização da tabela após o filtro.
- `validarPeriodoExibido(inicial, final)`: confere os textos do intervalo
  exibido pelo portal.
- `dataParaNumero(data)`: converte `DD/MM/AAAA` para `AAAAMMDD`.
- `validarDatasDaListagemNoPeriodo(inicial, final)`: verifica cada data da
  listagem dentro do intervalo ou valida a mensagem de lista vazia.
- `ultimoDiaDoMes(mes, ano)`: calcula o último dia de um mês.
- `formatarData(data)`: formata um objeto Date como data brasileira.
- `montarPeriodoAnual(ano)`: cria label, início e fim de um ano.
- `selecionarPeriodo(texto)`: escolhe o período e aguarda a resposta.
- `abrirCalendarioPeriodo()`: abre o popup de seleção manual de intervalo.
- `validarOrgaoNoDetalhe(orgao)`: compara o órgão selecionado com o detalhe.
- `pesquisarCovidEValidarListagem(opcao)`: filtra COVID-19 e aceita dados ou a
  mensagem oficial de ausência.
- `pesquisarTipoEValidarListagem(tipo)`: verifica as três opções de Tipo,
  seleciona a escolhida e valida o retorno.
- `obterLinhasValidas()`: remove linhas de template e de “nenhum resultado”.
- `obterTextoDaColuna(linha, seletores, rotulos)`: busca uma coluna por classe
  ou pelo cabeçalho da tabela.
- `obterNomeMovimentoDaListagem(linha)`: obtém o nome do movimento com fallback
  para o número da linha.
- `obterDadosParaBuscaTextual()`: encontra uma linha com movimento, favorecido
  e descrição preenchidos.
- `validarCampoNaListagem(linhas, texto, obterCampo, nome)`: verifica se uma
  coluna contém o termo pesquisado.
- `pesquisarTextoEValidarCampo(texto, obterCampo, nome)`: executa a busca
  textual e chama a validação da coluna.
- `pesquisarNomeMovimentoFavorecidoEDescricao()`: encadeia as três buscas
  textuais usando os dados da mesma linha.
