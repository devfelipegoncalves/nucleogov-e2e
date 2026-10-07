/**
 * Testes dos filtros disponíveis diretamente na listagem de receitas do
 * módulo Megasoft/Fiorilli.
 *
 * Valida os filtros COVID-19 e órgão diretamente na listagem.
 */

const RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/mgreceitas";
const RECEITAS_NOME = Cypress.env("RECEITAS_NOME") || "mgreceitas";
const LISTAGEM_TIMEOUT = 60000;
const SELETOR_LINHAS = ".cont_dados .tb tr[id]";
const SELETOR_SELECT_COVID = "#select_covid .selected";
const SELETOR_OPCOES_COVID = "#select_covid .options .list a:visible";
const SELETOR_SELECT_ORGAO = "#select_orgao .selected";
const SELETOR_OPCOES_ORGAO = "#select_orgao .options .list a:visible";
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

function normalizarTexto(texto = "") {
  return String(texto).replace(/\s+/g, " ").trim();
}

function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function obterCodigoOrgao(texto) {
  return normalizarTexto(texto).match(/^\d+/)?.[0] || "";
}

function obterTermoPesquisaOrgao(texto) {
  const nomeOrgao = normalizarTexto(texto).replace(/^\d+\s*[-.)]\s*/, "");
  const termos = normalizarParaComparacao(nomeOrgao)
    .split(" ")
    .filter((termo) => termo.length > 2);

  return termos[termos.length - 1] || nomeOrgao;
}

function orgaosCorrespondem(orgaoEsperado, orgaoRetornado) {
  const esperado = normalizarParaComparacao(orgaoEsperado);
  const retornado = normalizarParaComparacao(orgaoRetornado);
  const codigoEsperado = obterCodigoOrgao(orgaoEsperado);
  const codigoRetornado = obterCodigoOrgao(orgaoRetornado);

  return (
    (codigoEsperado !== "" && codigoEsperado === codigoRetornado) ||
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

function obterLinhasValidas($body) {
  return $body
    .find(SELETOR_LINHAS)
    .toArray()
    .filter(
      (linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        linha.querySelector(".colNumero, .colDescricao"),
    );
}

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

function aguardarListagemInicial() {
  cy.get(".filtro", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  aguardarRetornoDoFiltro();
}

function selecionarOpcaoCovid(opcaoEsperada) {
  cy.get(SELETOR_SELECT_COVID, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(SELETOR_OPCOES_COVID, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find(
        (elemento) =>
          normalizarParaComparacao(elemento.textContent) ===
          normalizarParaComparacao(opcaoEsperada),
      );

      expect(opcao, `opção COVID-19 "${opcaoEsperada}" disponível`).to.exist;

      cy.wrap(opcao).click({ force: true });
      cy.get(SELETOR_SELECT_COVID).should("contain", opcaoEsperada);
      cy.get("#select_covid .options:visible").should("not.exist");
      aguardarRetornoDoFiltro();
    });
}

function registrarResultadoCovid(opcao, linhas, mensagem = "") {
  const resultado = mensagem
    ? `[${RECEITAS_NOME}][COVID-19=${opcao}] ${mensagem}`
    : `[${RECEITAS_NOME}][COVID-19=${opcao}] ${linhas.length} registro(s) encontrado(s)`;

  console.log(resultado);
  Cypress.log({
    name: mensagem ? "ALERTA" : "RESULTADO",
    message: resultado,
    consoleProps: () => ({
      filtro: "COVID-19",
      opcao,
      registros: linhas.length,
      ...(mensagem ? { mensagem } : {}),
    }),
  });
  cy.task("log", resultado);
  cy.log(resultado);
}

function validarResultadoCovid(opcao, exigirDados) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length > 0) {
      expect(
        linhas.length,
        `registros retornados para COVID-19 como ${opcao}`,
      ).to.be.greaterThan(0);
      registrarResultadoCovid(opcao, linhas);
      return;
    }

    const mensagem = normalizarTexto($body.find("#not-found-line").text());
    expect(
      mensagem,
      `mensagem da listagem para COVID-19 como ${opcao}`,
    ).to.contain("Nenhum resultado encontrado");
    registrarResultadoCovid(opcao, linhas, mensagem);

    if (exigirDados) {
      expect(
        linhas.length,
        `listagem retornou dados para COVID-19 como ${opcao}`,
      ).to.be.greaterThan(0);
    }
  });
}

function abrirPrimeiroRegistro() {
  return cy.get("body").then(($body) => {
    const linha = obterLinhasValidas($body)[0];

    expect(linha, "primeira receita disponível na listagem").to.exist;
    cy.wrap(linha)
      .find(".colIcone")
      .should("exist")
      .trigger("mousedown", { which: 1, force: true });
  });
}

function obterValorDoDetalhamento(rotuloEsperado) {
  return cy
    .get("#popdetalhes", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .get("#popdetalhes .campo", { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($campos) => {
      const campo = Array.from($campos).find(
        (elemento) =>
          normalizarParaComparacao(
            elemento.querySelector("label")?.textContent,
          ) === normalizarParaComparacao(rotuloEsperado),
      );

      expect(campo, `campo ${rotuloEsperado} no detalhamento da receita`).to
        .exist;

      const valor = normalizarTexto(
        campo.querySelector(".input")?.textContent || "",
      );
      expect(
        valor,
        `${rotuloEsperado} disponível no detalhamento`,
      ).to.not.equal("");

      return valor;
    });
}

function obterOrgaoDoDetalhamento() {
  return obterValorDoDetalhamento("Órgão");
}

function fecharDetalhamento() {
  cy.get("#popdetalhes #close", { timeout: LISTAGEM_TIMEOUT }).click({
    force: true,
  });
  cy.get("#popdetalhes").should("not.exist");
}

function obterOrgaoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterOrgaoDoDetalhamento().then((orgao) => {
    fecharDetalhamento();
    return cy.wrap(orgao, { log: false });
  });
}

function selecionarOrgaoCorrespondente(orgaoEsperado) {
  cy.get(SELETOR_SELECT_ORGAO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  const termoPesquisa = obterTermoPesquisaOrgao(orgaoEsperado);
  cy.get(".options > .containerbusca > #search", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true })
    .should("have.value", termoPesquisa);

  return cy
    .get(SELETOR_OPCOES_ORGAO, { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const codigoEsperado = obterCodigoOrgao(orgaoEsperado);
      const esperado = normalizarParaComparacao(orgaoEsperado);
      const opcao = Array.from($opcoes).find((elemento) => {
        const texto = normalizarParaComparacao(elemento.textContent);
        const codigo = normalizarTexto(
          elemento.getAttribute("href") || "",
        ).replace(/^#/, "");

        return (
          (codigoEsperado !== "" && codigo === codigoEsperado) ||
          texto === esperado ||
          texto.includes(esperado) ||
          esperado.includes(texto)
        );
      });

      expect(opcao, `órgão do registro "${orgaoEsperado}" disponível no filtro`)
        .to.exist;

      const orgaoSelecionado = normalizarTexto(opcao.textContent);
      expect(
        orgaosCorrespondem(orgaoEsperado, orgaoSelecionado),
        `opção do filtro "${orgaoSelecionado}" corresponde ao órgão "${orgaoEsperado}"`,
      ).to.equal(true);

      cy.wrap(opcao).click({ force: true });
      cy.get(SELETOR_SELECT_ORGAO).should("contain", orgaoSelecionado);
      cy.get("#select_orgao .options:visible").should("not.exist");
      aguardarRetornoDoFiltro();

      return cy.wrap({ orgaoEsperado, orgaoSelecionado }, { log: false });
    });
}

function validarOrgaoDoResultado({ orgaoEsperado, orgaoSelecionado }) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][Órgão=${orgaoSelecionado}] ${mensagem}`;

      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Órgão",
          orgaoEsperado,
          orgaoSelecionado,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      expect(
        linhas.length,
        `listagem retornou dados para o órgão ${orgaoSelecionado}`,
      ).to.be.greaterThan(0);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para o órgão ${orgaoSelecionado}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    obterOrgaoDoDetalhamento().then((orgaoRetornado) => {
      expect(
        orgaosCorrespondem(orgaoSelecionado, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com a opção do filtro "${orgaoSelecionado}"`,
      ).to.equal(true);
      fecharDetalhamento();
    });
  });
}

function abrirCalendarioPeriodo() {
  cy.get("#filtro_periodo .filtro_intervalo", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#popup_intervalo", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible");
}

function selecionarMesNoCalendario(anoInicial, anoEsperado, mesEsperado) {
  const mesFormatado = String(mesEsperado).padStart(2, "0");

  abrirCalendarioPeriodo();
  cy.get("#popup_intervalo .container-ano span").should(
    "contain",
    String(anoInicial),
  );

  const diferencaAnos = anoEsperado - anoInicial;
  const seletorNavegacao = diferencaAnos < 0 ? ".left" : ".right";

  for (let indice = 0; indice < Math.abs(diferencaAnos); indice += 1) {
    cy.get(`#popup_intervalo .container-ano ${seletorNavegacao}`).click({
      force: true,
    });
  }

  cy.get("#popup_intervalo .container-ano span").should(
    "contain",
    String(anoEsperado),
  );
  cy.get(`#popup_intervalo .container-meses span[data-mes='${mesFormatado}']`)
    .should("be.visible")
    .click({ force: true });
  cy.get("#popup_intervalo", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  return aguardarRetornoDoFiltro();
}

function validarResumoDoPeriodo(mes, ano) {
  cy.get(".periodo-pesquisa .periodo-inicial", {
    timeout: LISTAGEM_TIMEOUT,
  }).should("contain", MESES[mes - 1]);
  cy.get(".periodo-pesquisa .periodo-final", {
    timeout: LISTAGEM_TIMEOUT,
  }).should("contain", String(ano));
}

function validarListagemDoPeriodo(mes, ano) {
  aguardarRetornoDoFiltro();
  validarResumoDoPeriodo(mes, ano);

  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][período=${String(mes).padStart(
        2,
        "0",
      )}/${ano}] ${mensagem}`;

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Período",
          mes,
          ano,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para ${MESES[mes - 1]}/${ano}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    obterValorDoDetalhamento("Ano").then((anoRetornado) => {
      expect(anoRetornado, "ano do primeiro resultado").to.equal(String(ano));
    });
    obterValorDoDetalhamento("Mês").then((mesRetornado) => {
      expect(
        normalizarParaComparacao(mesRetornado),
        "mês do primeiro resultado",
      ).to.equal(normalizarParaComparacao(MESES[mes - 1]));
      fecharDetalhamento();
    });
  });
}

describe(`Portal: ${RECEITAS_NOME} - filtros externos`, () => {
  beforeEach(() => {
    cy.visitPortal(RECEITAS_PATH);
    aguardarListagemInicial();
  });

  it("filtra COVID-19 como Sim e depois como Não, validando cada retorno", () => {
    selecionarOpcaoCovid("Sim")
      .then(() => validarResultadoCovid("Sim", false))
      .then(() => selecionarOpcaoCovid("Não"))
      .then(() => validarResultadoCovid("Não", true));
  });

  it("filtra pelo órgão de um registro e valida o retorno", () => {
    obterOrgaoDoPrimeiroRegistro()
      .then((orgaoEsperado) => selecionarOrgaoCorrespondente(orgaoEsperado))
      .then((resultado) => validarOrgaoDoResultado(resultado));
  });

  it("filtra por mês anterior e depois altera o ano e o mês no calendário", () => {
    const hoje = new Date();
    const mesAnterior = hoje.getMonth() === 0 ? 12 : hoje.getMonth();
    const anoMesAnterior =
      hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
    const anoInicial = hoje.getFullYear();
    const segundoAno = anoMesAnterior - 1;

    selecionarMesNoCalendario(anoInicial, anoMesAnterior, mesAnterior)
      .then(() => validarListagemDoPeriodo(mesAnterior, anoMesAnterior))
      .then(() => selecionarMesNoCalendario(anoMesAnterior, segundoAno, 3))
      .then(() => validarListagemDoPeriodo(3, segundoAno));
  });
});
