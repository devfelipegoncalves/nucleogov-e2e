/**
 * Teste do filtro externo de órgão do módulo Fiorilli Receitas FRL.
 *
 * O cenário usa órgãos reais do portal: captura o órgão do primeiro
 * detalhamento, pesquisa esse órgão no filtro da listagem e valida o retorno.
 * Em seguida seleciona outro órgão disponível e confirma novamente os dados.
 */

const RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/receitas_frl";
const RECEITAS_NOME = "fiorilli/receitas_frl";
const LISTAGEM_TIMEOUT = 60000;
const SELETOR_SELECT_MES = "#select_mes";
const SELETOR_COLUNA_DETALHE = ".colNumero, .colCodigo";
const SELETOR_COLUNA_ORGAO = ".colOrgao, .col3";
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
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

// Uniformiza espaços e quebras de linha para comparações estáveis.
function normalizarTexto(texto = "") {
  return String(texto).replace(/\s+/g, " ").trim();
}

// Remove acentos e caixa para comparar nomes de órgãos.
function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Converte o texto do mês exibido no detalhe ou no filtro para seu número.
function obterNumeroMes(texto) {
  const valor = normalizarParaComparacao(texto);
  const indice = MESES.findIndex((mes) =>
    valor.includes(normalizarParaComparacao(mes)),
  );
  const numero =
    indice >= 0 ? indice + 1 : Number(valor.match(/\b(1[0-2]|[1-9])\b/)?.[1]);

  expect(numero, `mês válido no valor "${texto}"`).to.be.within(1, 12);
  return numero;
}

// Lê campos que podem ser inputs ou elementos textuais no detalhamento.
function lerValorDoCampo(selector) {
  return cy
    .get(selector, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) =>
      normalizarTexto(
        $campo.val() ||
          $campo.attr("value") ||
          $campo.text() ||
          $campo.find(".input").text(),
      ),
    );
}

// Remove o código que pode aparecer antes do nome do órgão.
function removerCodigoDoOrgao(texto = "") {
  return normalizarParaComparacao(texto).replace(/^\d+\s*[-.)]\s*/, "");
}

// Divide o órgão em termos relevantes, ignorando conectivos administrativos.
function obterTermosDoOrgao(texto) {
  const palavrasIgnoradas = new Set([
    "a",
    "as",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
  ]);

  return removerCodigoDoOrgao(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((palavra) => palavra.length > 2 && !palavrasIgnoradas.has(palavra));
}

// Confirma que dois textos representam o mesmo órgão.
function orgaosCorrespondem(orgaoEsperado, orgaoRetornado) {
  const esperado = removerCodigoDoOrgao(orgaoEsperado);
  const retornado = removerCodigoDoOrgao(orgaoRetornado);

  if (esperado === retornado || esperado.includes(retornado)) {
    return true;
  }

  const termosEsperados = obterTermosDoOrgao(orgaoEsperado);
  const termosRetornados = obterTermosDoOrgao(orgaoRetornado);

  return termosEsperados.every((termo) => termosRetornados.includes(termo));
}

// Garante que os recursos visuais e os carregadores terminaram de carregar.
function aguardarAssetsDoPortal() {
  cy.document({ timeout: LISTAGEM_TIMEOUT }).should((documento) => {
    expect(documento.readyState, "documento pronto").to.equal("complete");
  });
  cy.get("#load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
}

// Aguarda a tabela de receitas terminar de carregar.
function aguardarAssetsEListagem() {
  aguardarAssetsDoPortal();
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get(".tb-load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
}

// Retorna as linhas reais, excluindo templates e linhas de carregamento.
function obterLinhasDeDados() {
  return Cypress.$(".cont_dados .tb tr[id]")
    .toArray()
    .filter(
      (linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        !linha.classList.contains("tb-load") &&
        linha.querySelector(SELETOR_COLUNA_DETALHE),
    );
}

// Aguarda pelo menos um registro na listagem atual.
function aguardarListagemComDados() {
  aguardarAssetsEListagem();
  return cy
    .get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .should("have.length.at.least", 1);
}

// Aguarda o retorno de uma consulta de filtro sem mascarar uma listagem vazia.
function aguardarRetornoDoFiltro() {
  cy.get("#load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
}

// Abre uma receita real da listagem para obter o órgão diretamente do detalhe.
function obterOrgaoDaPrimeiraReceita() {
  cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .first()
    .find(SELETOR_COLUNA_DETALHE)
    .first()
    .click({ force: true });

  return cy
    .get("#container_content", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(() =>
      cy
        .get("#orgao", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .invoke("text")
        .then((texto) => {
          const orgao = normalizarTexto(texto);

          expect(orgao, "órgão disponível no detalhamento").to.not.equal("");
          cy.log(`[${RECEITAS_NOME}][órgão do detalhamento] ${orgao}`);
          return cy.wrap(orgao, { log: false });
        }),
    )
    .then((orgao) => {
      // O detalhe é um popup e o portal não preserva os filtros ao fechá-lo.
      // Reabrimos a rota da listagem antes de pesquisar o órgão capturado.
      cy.visitPortal(RECEITAS_PATH);
      return aguardarListagemComDados().then(() =>
        cy.wrap(orgao, { log: false }),
      );
    });
}

// Lê o mês e o ano do primeiro detalhamento e retorna à listagem.
function obterPeriodoDaPrimeiraReceita() {
  cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .first()
    .find(SELETOR_COLUNA_DETALHE)
    .first()
    .click({ force: true });

  return cy
    .get("#container_content", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(() =>
      lerValorDoCampo("#ano").then((textoAno) =>
        lerValorDoCampo("#mes").then((textoMes) => ({
          ano: Number(textoAno),
          mes: obterNumeroMes(textoMes),
        })),
      ),
    )
    .then((periodo) => {
      expect(periodo.ano, "ano disponível no detalhamento").to.be.greaterThan(
        0,
      );
      cy.log(
        `[${RECEITAS_NOME}][mês do detalhamento] ${MESES[periodo.mes - 1]}/${periodo.ano}`,
      );
      cy.visitPortal(RECEITAS_PATH);
      return aguardarListagemComDados().then(() =>
        cy.wrap(periodo, { log: false }),
      );
    });
}

// Seleciona uma opção mensal no select específico de receitas. Nesta página,
// o mês é um filtro independente e o href da opção contém apenas o número do
// mês, enquanto o ano permanece no select próprio do portal.
function selecionarMesNoFiltro(periodo) {
  const nomeMesEsperado = MESES[periodo.mes - 1];

  cy.get(`${SELETOR_SELECT_MES} .selected`, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(`${SELETOR_SELECT_MES} .options .list a`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) => {
        const codigo = Number(elemento.getAttribute("href")?.replace(/^#/, ""));
        const texto = normalizarParaComparacao(elemento.textContent);
        return (
          codigo === periodo.mes ||
          texto === normalizarParaComparacao(nomeMesEsperado)
        );
      });

      expect(opcao, `mês ${nomeMesEsperado} disponível no filtro`).to.exist;
      cy.wrap(opcao).click({ force: true });
      cy.get(`${SELETOR_SELECT_MES} .selected`).should(
        "have.attr",
        "id",
        String(periodo.mes).padStart(2, "0"),
      );
      return cy.wrap(periodo, { log: false });
    });
}

// Seleciona a primeira opção mensal diferente do período atual.
function selecionarOutroMesNoFiltro(periodoAtual) {
  cy.get(`${SELETOR_SELECT_MES} .selected`, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(`${SELETOR_SELECT_MES} .options .list a`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) => {
        const codigo = Number(elemento.getAttribute("href")?.replace(/^#/, ""));
        return codigo >= 1 && codigo <= 12 && codigo !== periodoAtual.mes;
      });

      expect(opcao, "outro mês disponível no filtro").to.exist;
      const outroPeriodo = {
        mes: Number(opcao.getAttribute("href").replace(/^#/, "")),
        ano: periodoAtual.ano,
      };

      cy.wrap(opcao).click({ force: true });
      cy.get(`${SELETOR_SELECT_MES} .selected`).should(
        "have.attr",
        "id",
        String(outroPeriodo.mes).padStart(2, "0"),
      );
      return cy.wrap(outroPeriodo, { log: false });
    });
}

// Confere mês e ano no detalhamento do primeiro resultado filtrado.
function validarPeriodoNaListagem(periodoEsperado, descricao) {
  aguardarRetornoDoFiltro();
  aguardarListagemComDados();

  cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .first()
    .find(SELETOR_COLUNA_DETALHE)
    .first()
    .click({ force: true });

  return cy
    .get("#container_content", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(() =>
      lerValorDoCampo("#ano").then((textoAno) =>
        lerValorDoCampo("#mes").then((textoMes) => {
          const periodoRetornado = {
            ano: Number(textoAno),
            mes: obterNumeroMes(textoMes),
          };

          expect(
            periodoRetornado.ano,
            `ano retornado para ${descricao}`,
          ).to.equal(periodoEsperado.ano);
          expect(
            periodoRetornado.mes,
            `mês retornado para ${descricao}`,
          ).to.equal(periodoEsperado.mes);
        }),
      ),
    )
    .then(() => {
      cy.log(
        `[${RECEITAS_NOME}][${descricao}] ${MESES[periodoEsperado.mes - 1]}/${periodoEsperado.ano}`,
      );
      cy.visitPortal(RECEITAS_PATH);
      return aguardarListagemComDados();
    });
}

// Pesquisa um órgão real no select customizado e seleciona a opção equivalente.
function pesquisarESelecionarOrgao(orgaoEsperado) {
  const codigoOrgao = normalizarTexto(orgaoEsperado).match(/^\d+/)?.[0];
  const termosOrgao = obterTermosDoOrgao(orgaoEsperado);
  const termoPesquisa = termosOrgao[termosOrgao.length - 1] || orgaoEsperado;

  cy.get("#select_orgao .selected", { timeout: LISTAGEM_TIMEOUT }).click({
    force: true,
  });
  cy.get("#select_orgao input:visible", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });
  cy.get("#select_orgao .options .icon-lupa:visible", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });

  return cy
    .get("#select_orgao .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao =
        Array.from($opcoes).find(
          (elemento) =>
            codigoOrgao &&
            elemento.getAttribute("href") === `#${codigoOrgao}`,
        ) ||
        Array.from($opcoes).find((elemento) =>
          orgaosCorrespondem(orgaoEsperado, elemento.textContent),
        );

      expect(
        opcao,
        `órgão "${orgaoEsperado}" disponível no filtro`,
      ).to.exist;
      cy.wrap(opcao).click({ force: true });

      return cy
        .get("#select_orgao .selected p", { timeout: LISTAGEM_TIMEOUT })
        .invoke("text")
        .then((texto) => normalizarTexto(texto));
    });
}

// Confirma que todos os registros retornados pertencem ao órgão pesquisado.
function validarOrgaoNaListagem(orgaoEsperado) {
  aguardarRetornoDoFiltro();

  cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .should("have.length.at.least", 1)
    .each(($linha) => {
      const orgaoRetornado = normalizarTexto(
        $linha.find(SELETOR_COLUNA_ORGAO).text(),
      );

      expect(orgaoRetornado, "órgão preenchido na listagem").to.not.equal("");
      expect(
        orgaosCorrespondem(orgaoEsperado, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com "${orgaoEsperado}"`,
      ).to.equal(true);
    });
}

// Seleciona a primeira opção diferente do órgão atual.
function selecionarOutroOrgao(orgaoAtual) {
  cy.get("#select_orgao .selected", { timeout: LISTAGEM_TIMEOUT }).click({
    force: true,
  });

  return cy
    .get("#select_orgao .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 2)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find(
        (elemento) => !orgaosCorrespondem(orgaoAtual, elemento.textContent),
      );

      expect(opcao, "outro órgão disponível no filtro").to.exist;
      const outroOrgao = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy.wrap(outroOrgao, { log: false });
    });
}

describe(`Portal: ${RECEITAS_NOME} - filtros externos`, () => {
  beforeEach(() => {
    cy.visitPortal(RECEITAS_PATH);
    aguardarListagemComDados();
  });

  it("filtra pelo órgão do detalhamento e depois por outro órgão", () => {
    obterOrgaoDaPrimeiraReceita()
      .then((orgaoDoDetalhamento) => pesquisarESelecionarOrgao(orgaoDoDetalhamento))
      .then((orgaoSelecionado) => {
        expect(orgaoSelecionado, "órgão selecionado no filtro").to.not.equal(
          "",
        );
        validarOrgaoNaListagem(orgaoSelecionado);
        return selecionarOutroOrgao(orgaoSelecionado);
      })
      .then((outroOrgao) => {
        expect(outroOrgao, "segundo órgão selecionado").to.not.equal("");
        validarOrgaoNaListagem(outroOrgao);
      });
  });

  it("filtra pelo mês do detalhamento e depois por outro mês", () => {
    obterPeriodoDaPrimeiraReceita()
      .then((periodoInicial) => selecionarMesNoFiltro(periodoInicial))
      .then((periodoInicial) =>
        validarPeriodoNaListagem(periodoInicial, "mês do detalhamento").then(
          () => periodoInicial,
        ),
      )
      .then((periodoInicial) => selecionarOutroMesNoFiltro(periodoInicial))
      .then((outroPeriodo) =>
        validarPeriodoNaListagem(outroPeriodo, "outro mês"),
      );
  });
});
