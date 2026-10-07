/**
 * Teste do filtro externo de órgão do módulo CNTReceitas da Centi.
 *
 * O órgão é obtido no detalhamento de uma receita da listagem. Em seguida,
 * o teste seleciona esse órgão e outro órgão disponível no filtro, validando
 * o detalhamento do primeiro resultado após cada seleção.
 */

const RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/cntreceitas";
const RECEITAS_NOME = Cypress.env("RECEITAS_NOME") || "cntreceitas";
const LISTAGEM_TIMEOUT = 30000;
const SELETOR_LINHAS = ".cont_dados .tb tr[id]";
const SELETOR_SELECT_ORGAO = ".conteinerorgao > .select > .selected";
const SELETOR_OPCOES_ORGAO = ".conteinerorgao > .select > .options";
const SELETOR_BUSCA_TEXTO = ".filtro .containerbusca.busca_texto #search";
const SELETOR_CALENDARIO = "#filtro_periodo .filtro_intervalo";
const MESES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
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

function obterNumeroMes(texto) {
  const valor = normalizarParaComparacao(texto);
  const indice = MESES.findIndex((mes) => valor.includes(mes));
  const numero = indice >= 0 ? indice + 1 : Number(valor.match(/\b(1[0-2]|[1-9])\b/)?.[1]);

  expect(numero, `mês válido no valor "${texto}"`).to.be.within(1, 12);
  return numero;
}

function removerCodigo(texto = "") {
  return normalizarParaComparacao(texto).replace(/^\d+[\s.]*[-.)]\s*/, "");
}

function obterTermosSignificativos(texto) {
  const termosIgnorados = new Set([
    "a",
    "as",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "executivo",
    "governo",
    "municipal",
    "municipio",
    "orgao",
    "poder",
    "prefeitura",
  ]);

  return removerCodigo(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((termo) => termo.length > 2 && !termosIgnorados.has(termo));
}

function orgaosCorrespondem(orgaoEsperado, orgaoEncontrado) {
  const esperado = removerCodigo(orgaoEsperado);
  const encontrado = removerCodigo(orgaoEncontrado);

  if (!esperado || !encontrado) return false;
  if (
    esperado === encontrado ||
    esperado.includes(encontrado) ||
    encontrado.includes(esperado)
  ) {
    return true;
  }

  if (
    /\bprefeitura\b|\bpoder executivo\b/.test(esperado) &&
    /\bprefeitura\b|\bpoder executivo\b/.test(encontrado)
  ) {
    return true;
  }

  const termosEsperados = obterTermosSignificativos(esperado);
  const termosEncontrados = obterTermosSignificativos(encontrado);

  return termosEsperados.some((termo) => termosEncontrados.includes(termo));
}

function obterLinhasValidas() {
  return cy
    .get(SELETOR_LINHAS, { timeout: LISTAGEM_TIMEOUT })
    .filter(
      (_, linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        !linha.classList.contains("tb-load") &&
        linha.querySelector(".colIcone, .colDescricao"),
    );
}

function aguardarListagem() {
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get(".tb-load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");

  return obterLinhasValidas().should("have.length.at.least", 1);
}

function obterValorDoCampo($campo) {
  const campo = $campo.first();
  return normalizarTexto(
    campo.val() || campo.attr("value") || campo.text() || "",
  );
}

function abrirPrimeiroRegistro() {
  return obterLinhasValidas()
    .first()
    .find(".colIcone")
    .should("exist")
    .should("be.visible")
    .click({ force: true });
}

function fecharDetalhamento() {
  cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
    force: true,
  });
  cy.get("#popmov").should("not.exist");
}

function obterOrgaoDoDetalhamento() {
  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("#orgao")
    .should("be.visible")
    .then(($campo) => {
      const orgao = obterValorDoCampo($campo);

      expect(orgao, "órgão disponível no detalhamento").to.not.equal("");
      return cy.wrap(orgao, { log: false });
    });
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

  return cy
    .get(SELETOR_OPCOES_ORGAO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find(".list a", { timeout: LISTAGEM_TIMEOUT })
    .filter(":visible")
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        orgaosCorrespondem(orgaoEsperado, elemento.textContent),
      );

      expect(
        opcao,
        `órgão encontrado "${orgaoEsperado}" disponível no filtro`,
      ).to.exist;

      const orgaoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get(SELETOR_SELECT_ORGAO, { timeout: LISTAGEM_TIMEOUT }).should(
        "contain",
        orgaoSelecionado,
      );

      return cy.wrap(orgaoSelecionado, { log: false });
    });
}

function selecionarOutroOrgao(orgaoAtual) {
  cy.get(SELETOR_SELECT_ORGAO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(SELETOR_OPCOES_ORGAO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find(".list a", { timeout: LISTAGEM_TIMEOUT })
    .filter(":visible")
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find(
        (elemento) => !orgaosCorrespondem(orgaoAtual, elemento.textContent),
      );

      expect(opcao, "segundo órgão disponível no filtro").to.exist;

      const outroOrgao = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get(SELETOR_SELECT_ORGAO, { timeout: LISTAGEM_TIMEOUT }).should(
        "contain",
        outroOrgao,
      );

      return cy.wrap(outroOrgao, { log: false });
    });
}

function validarOrgaoDosResultados(orgaoEsperado) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() => obterOrgaoDoDetalhamento())
    .then((orgaoRetornado) => {
      expect(
        orgaosCorrespondem(orgaoEsperado, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com "${orgaoEsperado}"`,
      ).to.equal(true);

      cy.log(
        `[${RECEITAS_NOME}][órgão] "${orgaoEsperado}" → "${orgaoRetornado}"`,
      );
      return fecharDetalhamento();
    });
}

function obterNaturezaEDescricaoDaPrimeiraReceita() {
  return obterLinhasValidas()
    .first()
    .then(($linha) => {
      const natureza = normalizarTexto(
        Cypress.$($linha).find(".colModalidade").text(),
      );
      const descricao = normalizarTexto(
        Cypress.$($linha).find(".colDescricao").text(),
      );

      expect(natureza, "natureza disponível na primeira receita").to.not.equal(
        "",
      );
      expect(
        descricao,
        "descrição disponível na primeira receita",
      ).to.not.equal("");

      return cy.wrap({ natureza, descricao }, { log: false });
    });
}

function pesquisarTextoEValidar(termo, seletorColuna, nomeDoCampo) {
  cy.get(SELETOR_BUSCA_TEXTO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear()
    .type(termo, { force: true })
    .should("have.value", termo);

  return aguardarListagem().then(($linhas) => {
    const termoNormalizado = normalizarParaComparacao(termo);
    const encontrouTermo = Array.from($linhas).some((linha) =>
      normalizarParaComparacao(
        Cypress.$(linha).find(seletorColuna).text(),
      ).includes(termoNormalizado),
    );

    expect(
      encontrouTermo,
      `${nomeDoCampo} "${termo}" retornado na listagem`,
    ).to.equal(true);

    cy.log(
      `[${RECEITAS_NOME}][busca textual][${nomeDoCampo}] "${termo}" encontrado`,
    );
  });
}

function obterPeriodoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($popup) => {
      const ano = Number(obterValorDoCampo($popup.find("#ano")));
      const mes = obterNumeroMes(obterValorDoCampo($popup.find("#mes")));

      expect(ano, "ano disponível no detalhamento").to.be.greaterThan(0);
      fecharDetalhamento();
      return cy.wrap({ ano, mes }, { log: false });
    });
}

function selecionarMesEAno(periodo) {
  cy.get(SELETOR_CALENDARIO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#popup_intervalo", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find(".container-ano span")
    .then(($anoAtual) => {
      const anoAtual = Number(normalizarTexto($anoAtual.text()));
      expect(anoAtual, "ano exibido no calendário").to.be.greaterThan(0);

      const direcao = periodo.ano > anoAtual ? ".right" : ".left";
      const quantidade = Math.abs(periodo.ano - anoAtual);

      for (let indice = 0; indice < quantidade; indice += 1) {
        cy.get(`#popup_intervalo .container-ano ${direcao}`)
          .should("be.visible")
          .click({ force: true });
      }
    })
    .then(() => {
      cy.get("#popup_intervalo .container-ano span").should(
        "contain",
        String(periodo.ano),
      );

      const mes = String(periodo.mes).padStart(2, "0");
      cy.get(`#popup_intervalo .container-meses span[data-mes="${mes}"]`)
        .should("be.visible")
        .click({ force: true });
    })
    .then(() => {
      cy.get("#popup_intervalo").should("not.exist");
      return aguardarListagem();
    });
}

function validarPeriodoDosResultados(periodo, descricao) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($popup) => ({
          ano: Number(obterValorDoCampo($popup.find("#ano"))),
          mes: obterNumeroMes(obterValorDoCampo($popup.find("#mes"))),
        })),
    )
    .then((periodoRetornado) => {
      expect(
        periodoRetornado.ano,
        `ano retornado para ${descricao}`,
      ).to.equal(periodo.ano);
      expect(
        periodoRetornado.mes,
        `mês retornado para ${descricao}`,
      ).to.equal(periodo.mes);
      cy.log(
        `[${RECEITAS_NOME}][período][${descricao}] ${String(periodoRetornado.mes).padStart(2, "0")}/${periodoRetornado.ano}`,
      );
      return fecharDetalhamento();
    });
}

describe(`Portal: ${RECEITAS_NOME} - filtros externos`, () => {
  beforeEach(() => {
    cy.visitPortal(RECEITAS_PATH);
    cy.get(".filtro", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
    aguardarListagem();
  });

  it("filtra pelo órgão do registro e depois por outro órgão", () => {
    obterOrgaoDoPrimeiroRegistro()
      .then((orgaoEncontrado) => selecionarOrgaoCorrespondente(orgaoEncontrado))
      .then((orgaoSelecionado) =>
        validarOrgaoDosResultados(orgaoSelecionado).then(
          () => orgaoSelecionado,
        ),
      )
      .then((orgaoSelecionado) => selecionarOutroOrgao(orgaoSelecionado))
      .then((outroOrgao) => validarOrgaoDosResultados(outroOrgao));
  });

  it("busca pela natureza e pela descrição da primeira receita", () => {
    obterNaturezaEDescricaoDaPrimeiraReceita().then(({ natureza, descricao }) =>
      pesquisarTextoEValidar(natureza, ".colModalidade", "natureza")
        .then(() => pesquisarTextoEValidar(descricao, ".colDescricao", "descrição")),
    );
  });

  it("filtra pelo mês do registro, por outro mês e depois altera o ano", () => {
    obterPeriodoDoPrimeiroRegistro().then((periodoInicial) => {
      const outroMes =
        periodoInicial.mes === 1
          ? { ano: periodoInicial.ano - 1, mes: 12 }
          : { ano: periodoInicial.ano, mes: periodoInicial.mes - 1 };
      const outroAno = {
        ano: periodoInicial.ano - 1,
        mes: periodoInicial.mes,
      };

      return selecionarMesEAno(periodoInicial)
        .then(() => validarPeriodoDosResultados(periodoInicial, "mês original"))
        .then(() => selecionarMesEAno(outroMes))
        .then(() => validarPeriodoDosResultados(outroMes, "outro mês"))
        .then(() => selecionarMesEAno(outroAno))
        .then(() => validarPeriodoDosResultados(outroAno, "outro ano"));
    });
  });
});
