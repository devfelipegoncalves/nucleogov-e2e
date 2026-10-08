/**
 * Teste do filtro avançado de mês do módulo CNTReceitas da Centi.
 *
 * O cenário usa um mês real do primeiro detalhamento, aplica esse mês no
 * painel avançado, valida o retorno e repete o fluxo com outro mês.
 */

// Rota e nome podem ser sobrescritos para executar o mesmo teste em outra
// prefeitura que utilize a implementação de receitas da Centi.
const RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/cntreceitas";
const RECEITAS_NOME = Cypress.env("RECEITAS_NOME") || "cntreceitas";

// O painel avançado e a API carregam dados de forma assíncrona.
const LISTAGEM_TIMEOUT = 30000;
const SELETOR_LINHAS = ".cont_dados .tb tr[id]";
const SELETOR_FILTRO_AVANCADO = "#busca_avancada";
const SELETOR_SELECT_MES = "#select_mes";
const SELETOR_MESES = `${SELETOR_SELECT_MES} .options .list a:visible`;
const SELETOR_SELECT_CATEGORIA_ECONOMICA = "#select_categoria_economica";
const SELETOR_CATEGORIAS_ECONOMICAS = `${SELETOR_SELECT_CATEGORIA_ECONOMICA} .options .list a:visible`;
const SELETOR_SELECT_ORIGEM = "#select_origem";
const SELETOR_ORIGENS = `${SELETOR_SELECT_ORIGEM} .options .list a:visible`;
const SELETOR_SELECT_ESPECIE = "#select_especie";
const SELETOR_ESPECIES = `${SELETOR_SELECT_ESPECIE} .options .list a:visible`;
const SELETOR_SELECT_DESDOBRAMENTO = "#select_desdobramento";
const SELETOR_DESDOBRAMENTOS = `${SELETOR_SELECT_DESDOBRAMENTO} .options .list a:visible`;
const SELETOR_SELECT_TIPO = "#select_tipo";
const SELETOR_TIPOS = `${SELETOR_SELECT_TIPO} .options .list a:visible`;
const SELETOR_VALOR_PREVISAO_INICIAL = "#prevmin";
const SELETOR_VALOR_PREVISAO_FINAL = "#prevmax";
const SELETOR_VALOR_ARRECADACAO_INICIAL = "#arrmin";
const SELETOR_VALOR_ARRECADACAO_FINAL = "#arrmax";

// Nomes usados para comparar o texto do detalhe com a opção do select.
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// Remove espaços duplicados e quebras de linha do texto capturado no DOM.
function normalizarTexto(texto = "") {
  return String(texto).replace(/\s+/g, " ").trim();
}

// Compara textos sem depender de acentos ou letras maiúsculas.
function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Converte valores monetários brasileiros, como 1.234.567,890, para número.
function normalizarValorMonetario(valor) {
  const texto = normalizarTexto(valor).replace(/[^\d,.-]/g, "");

  if (texto.includes(",")) {
    return Number(texto.replace(/\./g, "").replace(",", "."));
  }

  return Number(texto);
}

// Prepara um número para a entrada sem separador de milhar da máscara do portal.
function formatarValorParaEntrada(numero) {
  return Number(numero).toFixed(2).replace(".", ",");
}

// Retorna o formato visual que a máscara aplica ao campo monetário.
function formatarValorComMascara(numero) {
  return Number(numero).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Converte nome ou número do mês para um objeto estável usado nas asserções.
function obterMes(texto) {
  if (texto && typeof texto === "object" && texto.numero && texto.nome) {
    return texto;
  }

  const textoNormalizado = normalizarParaComparacao(texto);
  const indicePorNome = MESES.findIndex((mes) =>
    textoNormalizado.includes(normalizarParaComparacao(mes)),
  );

  if (indicePorNome >= 0) {
    return { numero: indicePorNome + 1, nome: MESES[indicePorNome] };
  }

  const numero = Number(textoNormalizado.match(/\b(1[0-2]|[1-9])\b/)?.[1]);
  expect(numero, `mês válido no valor "${texto}"`).to.be.within(1, 12);

  return { numero, nome: MESES[numero - 1] };
}

// Compara meses pelo número, aceitando formatos diferentes de apresentação.
function mesesCorrespondem(mesEsperado, mesRetornado) {
  return obterMes(mesEsperado).numero === obterMes(mesRetornado).numero;
}

// Retorna somente linhas de receitas e espera o seletor existir no DOM.
// O retry do cy.get é importante no carregamento inicial da página.
function obterLinhasValidas() {
  return cy
    .get(SELETOR_LINHAS, { timeout: LISTAGEM_TIMEOUT })
    .filter(
      (_, linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        !linha.classList.contains("tb-load") &&
        linha.querySelector(".colModalidade, .colDescricao"),
    );
}

// Lê as linhas existentes sem exigir que a tabela possua resultados.
// É usado depois de um filtro para gerar uma mensagem de asserção clara
// quando o backend retorna "Nenhum resultado encontrado".
function obterLinhasExistentes() {
  return cy.get("body", { timeout: LISTAGEM_TIMEOUT }).then(($body) =>
    $body
      .find(SELETOR_LINHAS)
      .toArray()
      .filter(
        (linha) =>
          !["not-found-line", "template_row"].includes(linha.id) &&
          !linha.classList.contains("tb-load") &&
          linha.querySelector(".colModalidade, .colDescricao"),
      ),
  );
}

// Aguarda o carregamento terminar e exige receitas na listagem inicial.
function aguardarListagem() {
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get("body", { timeout: LISTAGEM_TIMEOUT }).should(($body) => {
    expect(
      $body.find(".loader:visible").length,
      "loader visível da listagem",
    ).to.equal(0);
    expect(
      $body.find("#load:visible, .tb-load:visible").length,
      "loader visível da tabela",
    ).to.equal(0);
  });

  return obterLinhasValidas().should("have.length.at.least", 1);
}

// Aguarda somente loaders; a quantidade de linhas é validada pelo cenário.
function aguardarRetornoDoFiltro() {
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  return cy.get("body", { timeout: LISTAGEM_TIMEOUT }).should(($body) => {
    expect(
      $body.find(".loader:visible").length,
      "loader visível da listagem",
    ).to.equal(0);
    expect(
      $body.find("#load:visible, .tb-load:visible").length,
      "loader visível da tabela",
    ).to.equal(0);
  });
}

// Abre o detalhamento da primeira receita da listagem atual.
function abrirPrimeiroRegistro() {
  return obterLinhasValidas()
    .first()
    .find(".colIcone")
    .should("exist")
    .should("be.visible")
    .click({ force: true });
}

// Lê o valor de inputs, textareas ou elementos de texto do detalhamento.
function obterValorDoCampo($campo) {
  const campo = $campo.first();
  return normalizarTexto(
    campo.val() || campo.attr("value") || campo.text() || "",
  );
}

// Lê o mês exibido no detalhamento e fecha o popup ao terminar.
function obterMesDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("#mes")
    .should("be.visible")
    .then(($campo) => {
      const mes = obterMes(obterValorDoCampo($campo));

      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      });
      cy.get("#popmov").should("not.exist");

      return cy.wrap(mes, { log: false });
    });
}

// Lê o ano exibido no detalhamento e fecha o popup ao terminar.
function obterAnoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("#ano")
    .should("be.visible")
    .then(($campo) => {
      const ano = obterValorDoCampo($campo);

      expect(ano, "ano disponível no detalhamento").to.match(/^\d{4}$/);

      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      });
      cy.get("#popmov").should("not.exist");

      return cy.wrap(ano, { log: false });
    });
}

// Lê o órgão do primeiro detalhamento e fecha o popup antes da nova busca.
function obterOrgaoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("#orgao")
    .should("be.visible")
    .then(($campo) => {
      const orgao = obterValorDoCampo($campo);

      expect(orgao, "órgão disponível no detalhamento").to.not.equal("");

      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      });
      cy.get("#popmov").should("not.exist");

      return cy.wrap(orgao, { log: false });
    });
}

// Lê a categoria econômica do primeiro detalhamento e fecha o popup.
function obterCategoriaEconomicaDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("#nat_categoria_economica")
    .should("be.visible")
    .then(($campo) => {
      const categoriaEconomica = obterValorDoCampo($campo);

      expect(
        categoriaEconomica,
        "categoria econômica disponível no detalhamento",
      ).to.not.equal("");

      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      });
      cy.get("#popmov").should("not.exist");

      return cy.wrap(categoriaEconomica, { log: false });
    });
}

// Lê a origem do primeiro detalhamento e fecha o popup.
function obterOrigemDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("#nat_origem")
    .should("be.visible")
    .then(($campo) => {
      const origem = obterValorDoCampo($campo);

      expect(origem, "origem disponível no detalhamento").to.not.equal("");

      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      });
      cy.get("#popmov").should("not.exist");

      return cy.wrap(origem, { log: false });
    });
}

// Lê a espécie do primeiro detalhamento e fecha o popup.
function obterEspecieDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("#nat_especie")
    .should("be.visible")
    .then(($campo) => {
      const especie = obterValorDoCampo($campo);

      expect(especie, "espécie disponível no detalhamento").to.not.equal("");

      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      });
      cy.get("#popmov").should("not.exist");

      return cy.wrap(especie, { log: false });
    });
}

// Lê o desdobramento do primeiro detalhamento e fecha o popup.
function obterDesdobramentoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("#nat_desdobramento")
    .should("be.visible")
    .then(($campo) => {
      const desdobramento = obterValorDoCampo($campo);

      expect(
        desdobramento,
        "desdobramento disponível no detalhamento",
      ).to.not.equal("");

      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      });
      cy.get("#popmov").should("not.exist");

      return cy.wrap(desdobramento, { log: false });
    });
}

// Lê o tipo do primeiro detalhamento e fecha o popup.
function obterTipoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("#nat_tipo")
    .should("be.visible")
    .then(($campo) => {
      const tipo = obterValorDoCampo($campo);

      expect(tipo, "tipo disponível no detalhamento").to.not.equal("");

      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      });
      cy.get("#popmov").should("not.exist");

      return cy.wrap(tipo, { log: false });
    });
}

// Coleta os valores da coluna Valor Previsão e identifica os limites do filtro.
function obterIntervaloValorPrevistoDaListagem() {
  return obterLinhasValidas().then(($linhas) => {
    const valores = $linhas
      .toArray()
      .map((linha) => normalizarTexto(linha.querySelector(".colNumero")?.textContent))
      .map((texto) => ({ texto, numero: normalizarValorMonetario(texto) }))
      .filter(({ numero }) => Number.isFinite(numero));

    expect(
      valores.length,
      "valores de previsão disponíveis na listagem",
    ).to.be.greaterThan(1);

    const menor = valores.reduce((atual, valor) =>
      valor.numero < atual.numero ? valor : atual,
    );
    const maior = valores.reduce((atual, valor) =>
      valor.numero > atual.numero ? valor : atual,
    );

    expect(menor.numero, "menor Valor Previsão").to.be.at.most(maior.numero);

    return cy.wrap(
      {
        menorNumero: menor.numero,
        maiorNumero: maior.numero,
        menorTexto: menor.texto,
        maiorTexto: maior.texto,
      },
      { log: false },
    );
  });
}

// Coleta os valores da coluna Arrecadado Mês e identifica os limites do filtro.
function obterIntervaloValorArrecadacaoDaListagem() {
  return obterLinhasValidas().then(($linhas) => {
    const valores = $linhas
      .toArray()
      .map((linha) => normalizarTexto(linha.querySelector(".colValor")?.textContent))
      .map((texto) => ({ texto, numero: normalizarValorMonetario(texto) }))
      .filter(({ numero }) => Number.isFinite(numero));

    expect(
      valores.length,
      "valores de arrecadação disponíveis na listagem",
    ).to.be.greaterThan(1);

    const menor = valores.reduce((atual, valor) =>
      valor.numero < atual.numero ? valor : atual,
    );
    const maior = valores.reduce((atual, valor) =>
      valor.numero > atual.numero ? valor : atual,
    );

    expect(menor.numero, "menor Valor Arrecadação").to.be.at.most(
      maior.numero,
    );

    return cy.wrap(
      {
        menorNumero: menor.numero,
        maiorNumero: maior.numero,
        menorTexto: menor.texto,
        maiorTexto: maior.texto,
      },
      { log: false },
    );
  });
}

// Abre o modal que contém todos os filtros avançados do CNTReceitas.
function abrirFiltroAvancado() {
  return cy
    .get(SELETOR_FILTRO_AVANCADO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });
}

// Abre o select de mês dentro do modal e aguarda suas opções visíveis.
function abrirSelectMes() {
  return cy
    .get(`${SELETOR_SELECT_MES} .selected`, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true })
    .then(() =>
      cy
        .get(`${SELETOR_SELECT_MES} .options`, {
          timeout: LISTAGEM_TIMEOUT,
        })
        .should("be.visible"),
    );
}

// Seleciona o mês esperado no autocomplete do painel avançado.
function selecionarMesNoFiltroAberto(mesEsperado) {
  const mes = obterMes(mesEsperado);

  cy.get(`${SELETOR_SELECT_MES} .options > .containerbusca > #search`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .clear({ force: true })
    .type(mes.nome, { force: true })
    .should("have.value", mes.nome);

  return cy
    .get(SELETOR_MESES, { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        mesesCorrespondem(mes, elemento.textContent),
      );

      expect(opcao, `mês ${mes.nome} disponível no filtro avançado`).to.exist;

      const mesSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get(`${SELETOR_SELECT_MES} .selected`).should(
        "contain",
        mesSelecionado,
      );

      return cy.wrap(
        { mesEsperado: mes, mesSelecionado },
        { log: false },
      );
    });
}

// Seleciona o ano exato no autocomplete do painel avançado.
function selecionarAnoNoFiltroAberto(anoEsperado) {
  const ano = String(anoEsperado);

  cy.get("#select_ano .options > .containerbusca > #search", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .clear({ force: true })
    .type(ano, { force: true })
    .should("have.value", ano);

  return cy
    .get("#select_ano .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) => {
        const texto = normalizarTexto(elemento.textContent);
        const valor = normalizarTexto(
          elemento.getAttribute("href") || "",
        ).replace(/^#/, "");

        return texto === ano || valor === ano;
      });

      expect(opcao, `ano ${ano} disponível no filtro avançado`).to.exist;

      cy.wrap(opcao).click({ force: true });
      cy.get("#select_ano .selected").should("contain", ano);

      return cy.wrap(
        { anoEsperado: ano, anoSelecionado: ano },
        { log: false },
      );
    });
}

// Normaliza nomes de órgãos que podem conter código, hífen ou acentos.
function normalizarOrgao(texto) {
  return normalizarParaComparacao(texto).replace(/^\d+\s*[-.)]\s*/, "");
}

// Compara o órgão do filtro com o órgão do detalhamento.
function orgaosCorrespondem(orgaoEsperado, orgaoRetornado) {
  const esperado = normalizarOrgao(orgaoEsperado);
  const retornado = normalizarOrgao(orgaoRetornado);

  return (
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

// Compara a categoria selecionada com a categoria apresentada no detalhe.
function categoriasEconomicasCorrespondem(
  categoriaEsperada,
  categoriaRetornada,
) {
  const esperado = normalizarParaComparacao(categoriaEsperada);
  const retornado = normalizarParaComparacao(categoriaRetornada);

  return (
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

// Compara a origem selecionada com a origem apresentada no detalhe.
function origensCorrespondem(origemEsperada, origemRetornada) {
  const esperada = normalizarParaComparacao(origemEsperada);
  const retornada = normalizarParaComparacao(origemRetornada);

  return (
    esperada === retornada ||
    esperada.includes(retornada) ||
    retornada.includes(esperada)
  );
}

// Compara a espécie selecionada com a espécie apresentada no detalhe.
function especiesCorrespondem(especieEsperada, especieRetornada) {
  const esperada = normalizarParaComparacao(especieEsperada);
  const retornada = normalizarParaComparacao(especieRetornada);

  return (
    esperada === retornada ||
    esperada.includes(retornada) ||
    retornada.includes(esperada)
  );
}

// Compara o desdobramento selecionado com o valor apresentado no detalhe.
function desdobramentosCorrespondem(
  desdobramentoEsperado,
  desdobramentoRetornado,
) {
  const esperado = normalizarParaComparacao(desdobramentoEsperado);
  const retornado = normalizarParaComparacao(desdobramentoRetornado);

  return (
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

// Compara o tipo selecionado com o tipo apresentado no detalhe.
function tiposCorrespondem(tipoEsperado, tipoRetornado) {
  const esperado = normalizarParaComparacao(tipoEsperado);
  const retornado = normalizarParaComparacao(tipoRetornado);

  return (
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

// Escolhe um termo curto para reduzir as opções do autocomplete de órgãos.
function obterTermoPesquisaOrgao(orgao) {
  const termosIgnorados = new Set([
    "a",
    "as",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "governo",
    "municipal",
    "orgao",
    "poder",
    "prefeitura",
  ]);
  const termos = normalizarOrgao(orgao)
    .split(/\s+/)
    .filter((termo) => termo.length > 2 && !termosIgnorados.has(termo));

  return termos[termos.length - 1] || normalizarTexto(orgao);
}

// Abre e pesquisa o órgão no select avançado da Centi.
function abrirESelecionarOrgaoNoFiltro(orgaoEsperado) {
  abrirFiltroAvancado();

  cy.get("#select_orgao_advanced .selected", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  const termoPesquisa = obterTermoPesquisaOrgao(orgaoEsperado);
  cy.get("#select_orgao_advanced .options > .containerbusca > #search", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true })
    .should("have.value", termoPesquisa);

  return cy
    .get("#select_orgao_advanced .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        orgaosCorrespondem(orgaoEsperado, elemento.textContent),
      );

      expect(
        opcao,
        `órgão "${orgaoEsperado}" disponível no filtro avançado`,
      ).to.exist;

      const orgaoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get("#select_orgao_advanced .selected").should(
        "contain",
        orgaoSelecionado,
      );

      return cy.wrap(
        { orgaoEsperado, orgaoSelecionado },
        { log: false },
      );
    });
}

// Abre e pesquisa a categoria econômica no select do filtro avançado.
function abrirESelecionarCategoriaEconomicaNoFiltro(categoriaEsperada) {
  abrirFiltroAvancado();

  cy.get(`${SELETOR_SELECT_CATEGORIA_ECONOMICA} .selected`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .click({ force: true });

  cy.get(
    `${SELETOR_SELECT_CATEGORIA_ECONOMICA} .options > .containerbusca > #search`,
    { timeout: LISTAGEM_TIMEOUT },
  )
    .should("be.visible")
    .clear({ force: true })
    .type(categoriaEsperada, { force: true })
    .should("have.value", categoriaEsperada);

  return cy
    .get(SELETOR_CATEGORIAS_ECONOMICAS, { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        categoriasEconomicasCorrespondem(
          categoriaEsperada,
          elemento.textContent,
        ),
      );

      expect(
        opcao,
        `categoria econômica "${categoriaEsperada}" disponível no filtro avançado`,
      ).to.exist;

      const categoriaSelecionada = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get(`${SELETOR_SELECT_CATEGORIA_ECONOMICA} .selected`).should(
        "contain",
        categoriaSelecionada,
      );

      return cy.wrap(
        { categoriaEsperada, categoriaSelecionada },
        { log: false },
      );
    });
}

// Abre e pesquisa a origem no select do filtro avançado.
function abrirESelecionarOrigemNoFiltro(origemEsperada) {
  abrirFiltroAvancado();

  cy.get(`${SELETOR_SELECT_ORIGEM} .selected`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .click({ force: true });

  cy.get(
    `${SELETOR_SELECT_ORIGEM} .options > .containerbusca > #search`,
    { timeout: LISTAGEM_TIMEOUT },
  )
    .should("be.visible")
    .clear({ force: true })
    .type(origemEsperada, { force: true })
    .should("have.value", origemEsperada);

  return cy
    .get(SELETOR_ORIGENS, { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        origensCorrespondem(origemEsperada, elemento.textContent),
      );

      expect(
        opcao,
        `origem "${origemEsperada}" disponível no filtro avançado`,
      ).to.exist;

      const origemSelecionada = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get(`${SELETOR_SELECT_ORIGEM} .selected`).should(
        "contain",
        origemSelecionada,
      );

      return cy.wrap({ origemEsperada, origemSelecionada }, { log: false });
    });
}

// Abre e pesquisa a espécie no select do filtro avançado.
function abrirESelecionarEspecieNoFiltro(especieEsperada) {
  abrirFiltroAvancado();

  cy.get(`${SELETOR_SELECT_ESPECIE} .selected`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .click({ force: true });

  cy.get(
    `${SELETOR_SELECT_ESPECIE} .options > .containerbusca > #search`,
    { timeout: LISTAGEM_TIMEOUT },
  )
    .should("be.visible")
    .clear({ force: true })
    .type(especieEsperada, { force: true })
    .should("have.value", especieEsperada);

  return cy
    .get(SELETOR_ESPECIES, { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        especiesCorrespondem(especieEsperada, elemento.textContent),
      );

      expect(
        opcao,
        `espécie "${especieEsperada}" disponível no filtro avançado`,
      ).to.exist;

      const especieSelecionada = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get(`${SELETOR_SELECT_ESPECIE} .selected`).should(
        "contain",
        especieSelecionada,
      );

      return cy.wrap({ especieEsperada, especieSelecionada }, { log: false });
    });
}

// Abre e pesquisa o desdobramento no select do filtro avançado.
function abrirESelecionarDesdobramentoNoFiltro(desdobramentoEsperado) {
  abrirFiltroAvancado();

  cy.get(`${SELETOR_SELECT_DESDOBRAMENTO} .selected`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .click({ force: true });

  cy.get(
    `${SELETOR_SELECT_DESDOBRAMENTO} .options > .containerbusca > #search`,
    { timeout: LISTAGEM_TIMEOUT },
  )
    .should("be.visible")
    .clear({ force: true })
    .type(desdobramentoEsperado, { force: true })
    .should("have.value", desdobramentoEsperado);

  return cy
    .get(SELETOR_DESDOBRAMENTOS, { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        desdobramentosCorrespondem(
          desdobramentoEsperado,
          elemento.textContent,
        ),
      );

      expect(
        opcao,
        `desdobramento "${desdobramentoEsperado}" disponível no filtro avançado`,
      ).to.exist;

      const desdobramentoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get(`${SELETOR_SELECT_DESDOBRAMENTO} .selected`).should(
        "contain",
        desdobramentoSelecionado,
      );

      return cy.wrap(
        { desdobramentoEsperado, desdobramentoSelecionado },
        { log: false },
      );
    });
}

// Abre e pesquisa o tipo no select do filtro avançado.
function abrirESelecionarTipoNoFiltro(tipoEsperado) {
  abrirFiltroAvancado();

  cy.get(`${SELETOR_SELECT_TIPO} .selected`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .click({ force: true });

  cy.get(`${SELETOR_SELECT_TIPO} .options > .containerbusca > #search`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .clear({ force: true })
    .type(tipoEsperado, { force: true })
    .should("have.value", tipoEsperado);

  return cy
    .get(SELETOR_TIPOS, { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        tiposCorrespondem(tipoEsperado, elemento.textContent),
      );

      expect(
        opcao,
        `tipo "${tipoEsperado}" disponível no filtro avançado`,
      ).to.exist;

      const tipoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get(`${SELETOR_SELECT_TIPO} .selected`).should(
        "contain",
        tipoSelecionado,
      );

      return cy.wrap({ tipoEsperado, tipoSelecionado }, { log: false });
    });
}

// Preenche os limites inicial e final do Valor Previsão.
function preencherIntervaloValorPrevistoNoFiltro({
  menorNumero,
  maiorNumero,
  menorTexto,
  maiorTexto,
}) {
  abrirFiltroAvancado();

  const menorEntrada = formatarValorParaEntrada(menorNumero);
  const maiorEntrada = formatarValorParaEntrada(maiorNumero);
  const menorFormatado = formatarValorComMascara(menorNumero);
  const maiorFormatado = formatarValorComMascara(maiorNumero);

  cy.get(SELETOR_VALOR_PREVISAO_INICIAL, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(menorEntrada, { force: true })
    .should("have.value", menorFormatado);

  return cy
    .get(SELETOR_VALOR_PREVISAO_FINAL, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(maiorEntrada, { force: true })
    .should("have.value", maiorFormatado)
    .then(() =>
      cy.wrap(
        {
          menorNumero,
          maiorNumero,
          menorTexto,
          maiorTexto,
        },
        { log: false },
      ),
    );
}

// Preenche Valor Previsão com o limite inicial maior que o limite final.
function preencherValorPrevistoComIntervaloInvalidoNoFiltro({
  menorNumero,
  maiorNumero,
  menorTexto,
  maiorTexto,
}) {
  abrirFiltroAvancado();

  const valorInicialInvalido = maiorNumero + 1;
  const valorInicialEntrada = formatarValorParaEntrada(valorInicialInvalido);
  const valorInicialFormatado = formatarValorComMascara(valorInicialInvalido);
  const valorFinalEntrada = formatarValorParaEntrada(menorNumero);
  const valorFinalFormatado = formatarValorComMascara(menorNumero);

  cy.get(SELETOR_VALOR_PREVISAO_INICIAL, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(valorInicialEntrada, { force: true })
    .should("have.value", valorInicialFormatado);

  return cy
    .get(SELETOR_VALOR_PREVISAO_FINAL, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(valorFinalEntrada, { force: true })
    .should("have.value", valorFinalFormatado)
    .then(() =>
      cy.wrap(
        {
          valorInicialInvalido,
          valorInicialFormatado,
          valorFinalNumero: menorNumero,
          valorFinalTexto: menorTexto,
          maiorTexto,
        },
        { log: false },
      ),
    );
}

// Preenche os limites inicial e final do Valor Arrecadação.
function preencherIntervaloValorArrecadacaoNoFiltro({
  menorNumero,
  maiorNumero,
  menorTexto,
  maiorTexto,
}) {
  abrirFiltroAvancado();

  const menorEntrada = formatarValorParaEntrada(menorNumero);
  const maiorEntrada = formatarValorParaEntrada(maiorNumero);
  const menorFormatado = formatarValorComMascara(menorNumero);
  const maiorFormatado = formatarValorComMascara(maiorNumero);

  cy.get(SELETOR_VALOR_ARRECADACAO_INICIAL, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(menorEntrada, { force: true })
    .should("have.value", menorFormatado);

  return cy
    .get(SELETOR_VALOR_ARRECADACAO_FINAL, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(maiorEntrada, { force: true })
    .should("have.value", maiorFormatado)
    .then(() =>
      cy.wrap(
        {
          menorNumero,
          maiorNumero,
          menorTexto,
          maiorTexto,
        },
        { log: false },
      ),
    );
}

// Preenche Valor Arrecadação com o limite inicial maior que o limite final.
function preencherValorArrecadacaoComIntervaloInvalidoNoFiltro({
  menorNumero,
  maiorNumero,
  menorTexto,
  maiorTexto,
}) {
  abrirFiltroAvancado();

  const valorInicialInvalido = maiorNumero + 1;
  const valorInicialEntrada = formatarValorParaEntrada(valorInicialInvalido);
  const valorInicialFormatado = formatarValorComMascara(valorInicialInvalido);
  const valorFinalEntrada = formatarValorParaEntrada(menorNumero);
  const valorFinalFormatado = formatarValorComMascara(menorNumero);

  cy.get(SELETOR_VALOR_ARRECADACAO_INICIAL, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(valorInicialEntrada, { force: true })
    .should("have.value", valorInicialFormatado);

  return cy
    .get(SELETOR_VALOR_ARRECADACAO_FINAL, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(valorFinalEntrada, { force: true })
    .should("have.value", valorFinalFormatado)
    .then(() =>
      cy.wrap(
        {
          valorInicialInvalido,
          valorInicialFormatado,
          valorFinalNumero: menorNumero,
          valorFinalTexto: menorTexto,
          maiorTexto,
        },
        { log: false },
      ),
    );
}

// Abre o select e escolhe um órgão diferente do usado anteriormente.
function selecionarOutroOrgaoNoFiltro(orgaoAtual) {
  abrirFiltroAvancado();

  return cy
    .get("#select_orgao_advanced .selected", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true })
    .then(() =>
      cy
        .get("#select_orgao_advanced .options .list a:visible", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .should("have.length.at.least", 2)
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find(
            (elemento) =>
              !orgaosCorrespondem(orgaoAtual, elemento.textContent),
          );

          expect(opcao, "outro órgão disponível no filtro avançado").to.exist;

          const outroOrgao = normalizarTexto(opcao.textContent);
          cy.wrap(opcao).click({ force: true });
          cy.get("#select_orgao_advanced .selected").should(
            "contain",
            outroOrgao,
          );

          return cy.wrap(
            { orgaoEsperado: outroOrgao, orgaoSelecionado: outroOrgao },
            { log: false },
          );
        }),
    );
}

// Abre o painel e seleciona o mês informado.
function selecionarMesNoFiltroAvancado(mesEsperado) {
  abrirFiltroAvancado();
  return abrirSelectMes().then(() => selecionarMesNoFiltroAberto(mesEsperado));
}

// Abre o painel e seleciona o ano informado.
function selecionarAnoNoFiltroAvancado(anoEsperado) {
  abrirFiltroAvancado();
  return cy
    .get("#select_ano .selected", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true })
    .then(() => selecionarAnoNoFiltroAberto(anoEsperado));
}

// Escolhe a primeira opção diferente do mês usado na consulta anterior.
function selecionarOutroMesNoFiltroAvancado(mesAtual) {
  abrirFiltroAvancado();

  return abrirSelectMes().then(() =>
    cy
      .get(SELETOR_MESES, { timeout: LISTAGEM_TIMEOUT })
      .should("have.length.at.least", 2)
      .then(($opcoes) => {
        const mesAtualNormalizado = obterMes(mesAtual);
        const outroMes = Array.from($opcoes)
          .map((elemento) => obterMes(elemento.textContent))
          .find((mes) => mes.numero !== mesAtualNormalizado.numero);

        expect(outroMes, `mês diferente de ${mesAtualNormalizado.nome}`).to
          .exist;

        return selecionarMesNoFiltroAberto(outroMes);
      }),
  );
}

// Escolhe uma opção de ano diferente da utilizada na primeira busca.
function selecionarOutroAnoNoFiltroAvancado(anoAtual) {
  abrirFiltroAvancado();

  return cy
    .get("#select_ano .selected", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true })
    .then(() =>
      cy
        .get("#select_ano .options .list a:visible", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .should("have.length.at.least", 2)
        .then(($opcoes) => {
          const anoAtualNormalizado = String(anoAtual);
          const outroAno = Array.from($opcoes)
            .map((elemento) => {
              const texto = normalizarTexto(elemento.textContent);
              const valor = normalizarTexto(
                elemento.getAttribute("href") || "",
              ).replace(/^#/, "");

              return /^\d{4}$/.test(valor) ? valor : texto;
            })
            .find(
              (ano) =>
                /^\d{4}$/.test(ano) && ano !== anoAtualNormalizado,
            );

          expect(outroAno, `ano diferente de ${anoAtualNormalizado}`).to.exist;

          return selecionarAnoNoFiltroAberto(outroAno);
        }),
    );
}

// Aplica a seleção clicando em PESQUISAR e espera o modal desaparecer.
function executarBuscaAvancada() {
  cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  cy.get(SELETOR_SELECT_MES, { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  return aguardarRetornoDoFiltro();
}

// Confere se há resultado e se o mês do primeiro detalhe bate com o filtro.
function validarMesDoResultado({ mesEsperado, mesSelecionado }) {
  return aguardarRetornoDoFiltro()
    .then(() => obterLinhasExistentes())
    .then((linhas) => {
      expect(
        linhas.length,
        `registros retornados para o mês ${mesSelecionado}`,
      ).to.be.greaterThan(0);
    })
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .find("#mes")
        .should("be.visible")
        .then(($campo) => {
          const mesRetornado = obterValorDoCampo($campo);

          expect(
            mesesCorrespondem(mesEsperado, mesRetornado),
            `mês retornado "${mesRetornado}" compatível com "${mesSelecionado}"`,
          ).to.equal(true);

          cy.log(
            `[${RECEITAS_NOME}][mês] "${mesSelecionado}" → "${mesRetornado}"`,
          );
        }),
    )
    .then(() =>
      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      }),
    )
    .then(() => cy.get("#popmov").should("not.exist"));
}

// Confere se o primeiro resultado pertence ao ano escolhido no filtro.
function validarAnoDoResultado({ anoEsperado, anoSelecionado }) {
  return aguardarRetornoDoFiltro()
    .then(() => obterLinhasExistentes())
    .then((linhas) => {
      expect(
        linhas.length,
        `registros retornados para o ano ${anoSelecionado}`,
      ).to.be.greaterThan(0);
    })
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .find("#ano")
        .should("be.visible")
        .then(($campo) => {
          const anoRetornado = obterValorDoCampo($campo);

          expect(
            anoRetornado,
            `ano retornado compatível com "${anoSelecionado}"`,
          ).to.equal(String(anoEsperado));

          cy.log(
            `[${RECEITAS_NOME}][ano] "${anoSelecionado}" → "${anoRetornado}"`,
          );
        }),
    )
    .then(() =>
      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      }),
    )
    .then(() => cy.get("#popmov").should("not.exist"));
}

// Confere se o órgão do primeiro resultado bate com o filtro escolhido.
function validarOrgaoDoResultado({ orgaoEsperado, orgaoSelecionado }) {
  return aguardarRetornoDoFiltro()
    .then(() => obterLinhasExistentes())
    .then((linhas) => {
      expect(
        linhas.length,
        `registros retornados para o órgão ${orgaoSelecionado}`,
      ).to.be.greaterThan(0);
    })
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .find("#orgao")
        .should("be.visible")
        .then(($campo) => {
          const orgaoRetornado = obterValorDoCampo($campo);

          expect(
            orgaosCorrespondem(orgaoEsperado, orgaoRetornado),
            `órgão retornado "${orgaoRetornado}" compatível com "${orgaoSelecionado}"`,
          ).to.equal(true);

          cy.log(
            `[${RECEITAS_NOME}][órgão] "${orgaoSelecionado}" → "${orgaoRetornado}"`,
          );
        }),
    )
    .then(() =>
      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      }),
    )
    .then(() => cy.get("#popmov").should("not.exist"));
}

// Confere se a categoria econômica do primeiro resultado bate com o filtro.
function validarCategoriaEconomicaDoResultado({
  categoriaEsperada,
  categoriaSelecionada,
}) {
  return aguardarRetornoDoFiltro()
    .then(() => obterLinhasExistentes())
    .then((linhas) => {
      expect(
        linhas.length,
        `registros retornados para a categoria econômica ${categoriaSelecionada}`,
      ).to.be.greaterThan(0);
    })
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .find("#nat_categoria_economica")
        .should("be.visible")
        .then(($campo) => {
          const categoriaRetornada = obterValorDoCampo($campo);

          expect(
            categoriasEconomicasCorrespondem(
              categoriaEsperada,
              categoriaRetornada,
            ),
            `categoria econômica retornada "${categoriaRetornada}" compatível com "${categoriaSelecionada}"`,
          ).to.equal(true);

          cy.log(
            `[${RECEITAS_NOME}][categoria econômica] "${categoriaSelecionada}" → "${categoriaRetornada}"`,
          );
        }),
    )
    .then(() =>
      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      }),
    )
    .then(() => cy.get("#popmov").should("not.exist"));
}

// Confere se a origem do primeiro resultado bate com o filtro escolhido.
function validarOrigemDoResultado({ origemEsperada, origemSelecionada }) {
  return aguardarRetornoDoFiltro()
    .then(() => obterLinhasExistentes())
    .then((linhas) => {
      expect(
        linhas.length,
        `registros retornados para a origem ${origemSelecionada}`,
      ).to.be.greaterThan(0);
    })
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .find("#nat_origem")
        .should("be.visible")
        .then(($campo) => {
          const origemRetornada = obterValorDoCampo($campo);

          expect(
            origensCorrespondem(origemEsperada, origemRetornada),
            `origem retornada "${origemRetornada}" compatível com "${origemSelecionada}"`,
          ).to.equal(true);

          cy.log(
            `[${RECEITAS_NOME}][origem] "${origemSelecionada}" → "${origemRetornada}"`,
          );
        }),
    )
    .then(() =>
      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      }),
    )
    .then(() => cy.get("#popmov").should("not.exist"));
}

// Confere se a espécie do primeiro resultado bate com o filtro escolhido.
function validarEspecieDoResultado({ especieEsperada, especieSelecionada }) {
  return aguardarRetornoDoFiltro()
    .then(() => obterLinhasExistentes())
    .then((linhas) => {
      expect(
        linhas.length,
        `registros retornados para a espécie ${especieSelecionada}`,
      ).to.be.greaterThan(0);
    })
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .find("#nat_especie")
        .should("be.visible")
        .then(($campo) => {
          const especieRetornada = obterValorDoCampo($campo);

          expect(
            especiesCorrespondem(especieEsperada, especieRetornada),
            `espécie retornada "${especieRetornada}" compatível com "${especieSelecionada}"`,
          ).to.equal(true);

          cy.log(
            `[${RECEITAS_NOME}][espécie] "${especieSelecionada}" → "${especieRetornada}"`,
          );
        }),
    )
    .then(() =>
      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      }),
    )
    .then(() => cy.get("#popmov").should("not.exist"));
}

// Confere se o desdobramento do primeiro resultado bate com o filtro escolhido.
function validarDesdobramentoDoResultado({
  desdobramentoEsperado,
  desdobramentoSelecionado,
}) {
  return aguardarRetornoDoFiltro()
    .then(() => obterLinhasExistentes())
    .then((linhas) => {
      expect(
        linhas.length,
        `registros retornados para o desdobramento ${desdobramentoSelecionado}`,
      ).to.be.greaterThan(0);
    })
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .find("#nat_desdobramento")
        .should("be.visible")
        .then(($campo) => {
          const desdobramentoRetornado = obterValorDoCampo($campo);

          expect(
            desdobramentosCorrespondem(
              desdobramentoEsperado,
              desdobramentoRetornado,
            ),
            `desdobramento retornado "${desdobramentoRetornado}" compatível com "${desdobramentoSelecionado}"`,
          ).to.equal(true);

          cy.log(
            `[${RECEITAS_NOME}][desdobramento] "${desdobramentoSelecionado}" → "${desdobramentoRetornado}"`,
          );
        }),
    )
    .then(() =>
      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      }),
    )
    .then(() => cy.get("#popmov").should("not.exist"));
}

// Confere se o tipo do primeiro resultado bate com o filtro escolhido.
function validarTipoDoResultado({ tipoEsperado, tipoSelecionado }) {
  return aguardarRetornoDoFiltro()
    .then(() => obterLinhasExistentes())
    .then((linhas) => {
      expect(
        linhas.length,
        `registros retornados para o tipo ${tipoSelecionado}`,
      ).to.be.greaterThan(0);
    })
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .find("#nat_tipo")
        .should("be.visible")
        .then(($campo) => {
          const tipoRetornado = obterValorDoCampo($campo);

          expect(
            tiposCorrespondem(tipoEsperado, tipoRetornado),
            `tipo retornado "${tipoRetornado}" compatível com "${tipoSelecionado}"`,
          ).to.equal(true);

          cy.log(
            `[${RECEITAS_NOME}][tipo] "${tipoSelecionado}" → "${tipoRetornado}"`,
          );
        }),
    )
    .then(() =>
      cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      }),
    )
    .then(() => cy.get("#popmov").should("not.exist"));
}

// Confere se todos os Valores Previsão retornados estão dentro do intervalo.
function validarIntervaloValorPrevistoDoResultado({
  menorNumero,
  maiorNumero,
  menorTexto,
  maiorTexto,
}) {
  return aguardarRetornoDoFiltro()
    .then(() => obterLinhasExistentes())
    .then((linhas) => {
      expect(
        linhas.length,
        `registros retornados entre ${menorTexto} e ${maiorTexto}`,
      ).to.be.greaterThan(0);

      const valoresRetornados = Array.from(linhas).map((linha) => {
        const texto = normalizarTexto(
          linha.querySelector(".colNumero")?.textContent,
        );
        const numero = normalizarValorMonetario(texto);

        expect(numero, `Valor Previsão válido no retorno "${texto}"`).to.be
          .finite;
        expect(
          numero,
          `Valor Previsão "${texto}" dentro do intervalo pesquisado`,
        ).to.be.within(menorNumero, maiorNumero);

        return numero;
      });

      cy.log(
        `[${RECEITAS_NOME}][Valor Previsão] ${valoresRetornados.length} registro(s) entre ${menorTexto} e ${maiorTexto}`,
      );
    });
}

// Confere se todos os Valores Arrecadação retornados estão no intervalo.
function validarIntervaloValorArrecadacaoDoResultado({
  menorNumero,
  maiorNumero,
  menorTexto,
  maiorTexto,
}) {
  return aguardarRetornoDoFiltro()
    .then(() => obterLinhasExistentes())
    .then((linhas) => {
      expect(
        linhas.length,
        `registros retornados entre ${menorTexto} e ${maiorTexto}`,
      ).to.be.greaterThan(0);

      const valoresRetornados = Array.from(linhas).map((linha) => {
        const texto = normalizarTexto(
          linha.querySelector(".colValor")?.textContent,
        );
        const numero = normalizarValorMonetario(texto);

        expect(numero, `Valor Arrecadação válido no retorno "${texto}"`).to.be
          .finite;
        expect(
          numero,
          `Valor Arrecadação "${texto}" dentro do intervalo pesquisado`,
        ).to.be.within(menorNumero, maiorNumero);

        return numero;
      });

      cy.log(
        `[${RECEITAS_NOME}][Valor Arrecadação] ${valoresRetornados.length} registro(s) entre ${menorTexto} e ${maiorTexto}`,
      );
    });
}

// Cada teste começa na listagem sem filtros aplicados anteriormente.
describe(`Portal: ${RECEITAS_NOME} - filtro avançado`, () => {
  beforeEach(() => {
    cy.visitPortal(RECEITAS_PATH);
    cy.get(".filtro", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
    aguardarListagem();
  });

  // Usa o mês do primeiro registro e depois valida outro mês disponível.
  it("busca o mês do registro e depois outro mês", () => {
    obterMesDoPrimeiroRegistro()
      .then((mesInicial) => selecionarMesNoFiltroAvancado(mesInicial))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) =>
        validarMesDoResultado(resultado).then(() => resultado),
      )
      .then(({ mesEsperado }) =>
        selecionarOutroMesNoFiltroAvancado(mesEsperado),
      )
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarMesDoResultado(resultado));
  });

  // Usa o ano do primeiro registro e depois valida outro ano disponível.
  it("busca o ano do registro e depois outro ano", () => {
    obterAnoDoPrimeiroRegistro()
      .then((anoInicial) => selecionarAnoNoFiltroAvancado(anoInicial))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) =>
        validarAnoDoResultado(resultado).then(() => resultado),
      )
      .then(({ anoSelecionado }) =>
        selecionarOutroAnoNoFiltroAvancado(anoSelecionado),
      )
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarAnoDoResultado(resultado));
  });

  // Usa a categoria econômica do detalhe e valida o retorno filtrado.
  it("busca a categoria econômica do registro", () => {
    obterCategoriaEconomicaDoPrimeiroRegistro()
      .then((categoriaInicial) =>
        abrirESelecionarCategoriaEconomicaNoFiltro(categoriaInicial),
      )
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarCategoriaEconomicaDoResultado(resultado));
  });

  // Usa a origem do detalhe e valida o retorno filtrado.
  it("busca a origem do registro", () => {
    obterOrigemDoPrimeiroRegistro()
      .then((origemInicial) => abrirESelecionarOrigemNoFiltro(origemInicial))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarOrigemDoResultado(resultado));
  });

  // Usa a espécie do detalhe e valida o retorno filtrado.
  it("busca a espécie do registro", () => {
    obterEspecieDoPrimeiroRegistro()
      .then((especieInicial) => abrirESelecionarEspecieNoFiltro(especieInicial))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarEspecieDoResultado(resultado));
  });

  // Usa o desdobramento do detalhe e valida o retorno filtrado.
  it("busca o desdobramento do registro", () => {
    obterDesdobramentoDoPrimeiroRegistro()
      .then((desdobramentoInicial) =>
        abrirESelecionarDesdobramentoNoFiltro(desdobramentoInicial),
      )
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarDesdobramentoDoResultado(resultado));
  });

  // Usa o tipo do detalhe e valida o retorno filtrado.
  it("busca o tipo do registro", () => {
    obterTipoDoPrimeiroRegistro()
      .then((tipoInicial) => abrirESelecionarTipoNoFiltro(tipoInicial))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarTipoDoResultado(resultado));
  });

  // Usa o menor e o maior Valor Previsão da listagem como limites do filtro.
  it("busca um intervalo de Valor Previsão e valida todos os resultados", () => {
    obterIntervaloValorPrevistoDaListagem()
      .then((intervalo) => preencherIntervaloValorPrevistoNoFiltro(intervalo))
      .then((intervalo) => executarBuscaAvancada().then(() => intervalo))
      .then((intervalo) =>
        validarIntervaloValorPrevistoDoResultado(intervalo),
      );
  });

  // Usa o menor e o maior Valor Arrecadação da listagem como limites do filtro.
  it("busca um intervalo de Valor Arrecadação e valida todos os resultados", () => {
    obterIntervaloValorArrecadacaoDaListagem()
      .then((intervalo) =>
        preencherIntervaloValorArrecadacaoNoFiltro(intervalo),
      )
      .then((intervalo) => executarBuscaAvancada().then(() => intervalo))
      .then((intervalo) =>
        validarIntervaloValorArrecadacaoDoResultado(intervalo),
      );
  });

  // Confirma o alerta e impede a busca quando o intervalo está invertido.
  it("exibe alerta quando o Valor Previsão inicial é maior que o final", () => {
    obterIntervaloValorPrevistoDaListagem()
      .then((intervalo) =>
        preencherValorPrevistoComIntervaloInvalidoNoFiltro(intervalo),
      )
      .then((intervaloInvalido) => {
        cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT })
          .should("be.visible")
          .click({ force: true });

        return cy
          .get(".alertas-msg > p", { timeout: LISTAGEM_TIMEOUT })
          .first()
          .should("be.visible")
          .invoke("text")
          .then((textoAlerta) => {
            const mensagem = normalizarTexto(textoAlerta);
            const indicaIntervaloInvalido =
              /mínimo|máximo|menor|maior|intervalo|valor|inválid|invalíd/i.test(
                mensagem,
              );

            expect(
              indicaIntervaloInvalido,
              "alerta de Valor Previsão inicial maior que o final",
            ).to.equal(true);

            Cypress.log({
              name: "ALERTA",
              message: mensagem || "Valor Previsão inicial maior que o final",
              consoleProps: () => ({
                valorInicial: intervaloInvalido.valorInicialInvalido,
                valorFinal: intervaloInvalido.valorFinalNumero,
                mensagem,
              }),
            });
            cy.log(`ALERTA: ${mensagem}`);
          })
          .then(() => {
            // O modal continua aberto, comprovando que a busca foi bloqueada.
            cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT }).should(
              "be.visible",
            );
            cy.get(SELETOR_SELECT_MES, { timeout: LISTAGEM_TIMEOUT }).should(
              "exist",
            );
          });
      });
  });

  // Confirma o alerta e impede a busca quando o intervalo está invertido.
  it("exibe alerta quando o Valor Arrecadação inicial é maior que o final", () => {
    obterIntervaloValorArrecadacaoDaListagem()
      .then((intervalo) =>
        preencherValorArrecadacaoComIntervaloInvalidoNoFiltro(intervalo),
      )
      .then((intervaloInvalido) => {
        cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT })
          .should("be.visible")
          .click({ force: true });

        return cy
          .get(".alertas-msg > p", { timeout: LISTAGEM_TIMEOUT })
          .first()
          .should("be.visible")
          .invoke("text")
          .then((textoAlerta) => {
            const mensagem = normalizarTexto(textoAlerta);
            const indicaIntervaloInvalido =
              /mínimo|máximo|menor|maior|intervalo|valor|inválid|invalíd/i.test(
                mensagem,
              );

            expect(
              indicaIntervaloInvalido,
              "alerta de Valor Arrecadação inicial maior que o final",
            ).to.equal(true);

            Cypress.log({
              name: "ALERTA",
              message:
                mensagem || "Valor Arrecadação inicial maior que o final",
              consoleProps: () => ({
                valorInicial: intervaloInvalido.valorInicialInvalido,
                valorFinal: intervaloInvalido.valorFinalNumero,
                mensagem,
              }),
            });
            cy.log(`ALERTA: ${mensagem}`);
          })
          .then(() => {
            // O modal continua aberto, comprovando que a busca foi bloqueada.
            cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT }).should(
              "be.visible",
            );
            cy.get(SELETOR_SELECT_MES, { timeout: LISTAGEM_TIMEOUT }).should(
              "exist",
            );
          });
      });
  });

  // Usa o órgão do detalhe e depois valida um segundo órgão selecionado.
  it("busca o órgão do registro e depois outro órgão", () => {
    obterOrgaoDoPrimeiroRegistro()
      .then((orgaoInicial) => abrirESelecionarOrgaoNoFiltro(orgaoInicial))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) =>
        validarOrgaoDoResultado(resultado).then(() => resultado),
      )
      .then(({ orgaoSelecionado }) =>
        selecionarOutroOrgaoNoFiltro(orgaoSelecionado),
      )
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarOrgaoDoResultado(resultado));
  });
});
