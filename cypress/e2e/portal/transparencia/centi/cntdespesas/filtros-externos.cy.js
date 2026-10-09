/**
 * Testes E2E dos filtros externos do módulo CNTDespesas no adaptador Centi.
 *
 * Valida órgão, COVID-19, busca textual e períodos usando os controles que
 * ficam diretamente na listagem. DESPESAS_PATH e DESPESAS_NOME podem ser
 * configurados por ambiente para reutilizar o spec em diferentes portais.
 *
 * Execução:
 * npm run cy:run -- --spec "cypress/e2e/portal/transparencia/centi/cntdespesas/filtros-externos.cy.js"
 */

// Seletores dos componentes customizados usados pelos filtros externos.
const DESPESAS_PATH =
  Cypress.env("DESPESAS_PATH") || "/cidadao/transparencia/cntdespesas";
const DESPESAS_NOME = Cypress.env("DESPESAS_NOME") || "cntdespesas";

const SELETOR_LINHAS_VALIDAS = ".cont_dados .tb tr[id]";
const SELETOR_SELECT_ORGAO = ".containerorgao > .select > .selected";
const SELETOR_CONTAINER_SELECT_ORGAO = ".containerorgao > .select";
const SELETOR_OPCOES_ORGAO = ".containerorgao > .select > .options";
const SELETOR_SELECT_COVID = "#search_coronavirus .select > .selected";
const SELETOR_OPCOES_COVID = "#search_coronavirus .select > .options";
const SELETOR_BUSCA_TEXTO = ".filtro .busca_texto #search";
const SELETOR_ACIONAR_BUSCA = ".filtro .busca_texto .icon-lupa";
const SELETOR_SELECT_PERIODO = "#filtro_periodo .select > .selected";
const SELETOR_OPCOES_PERIODO = "#filtro_periodo .select > .options";

/*
 * Este arquivo valida os filtros visíveis diretamente na listagem Centi.
 * Funções "obter" leem valores de referência, "selecionar" interagem com os
 * controles, "aguardar" sincronizam o DOM e "validar" conferem o resultado.
 */

// Normalização de texto e comparação de órgãos.
function normalizarTexto(texto = "") {
  return texto.replace(/\s+/g, " ").trim();
}

function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function removerCodigo(texto = "") {
  return normalizarParaComparacao(texto).replace(/^[\d.]+\s*[-.)]\s*/, "");
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

  if (!esperado || !encontrado) {
    return false;
  }

  if (
    esperado === encontrado ||
    esperado.includes(encontrado) ||
    encontrado.includes(esperado)
  ) {
    return true;
  }

  // O mesmo órgão pode aparecer como Prefeitura em um local e Poder
  // Executivo em outro, conforme o cadastro usado pela Centi.
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

// Funções de leitura da tabela, busca textual e período.
function obterLinhasValidas() {
  return cy
    .get(SELETOR_LINHAS_VALIDAS, { timeout: 30000 })
    .filter(
      (_, linha) => !["not-found-line", "template_row"].includes(linha.id),
    );
}

function aguardarListagem() {
  cy.get(".loader", { timeout: 30000 }).should("not.exist");
  cy.get(".cont_dados", { timeout: 30000 }).should("be.visible");
  obterLinhasValidas().should("have.length.at.least", 1);
}

function obterValorDoCampo($campo) {
  const campo = $campo.first();
  return normalizarTexto(
    campo.val() || campo.attr("value") || campo.text() || "",
  );
}

function obterTermoDaListagem() {
  return obterLinhasValidas()
    .first()
    .find(".colCredor")
    .should("be.visible")
    .invoke("text")
    .then((favorecido) => {
      const termos = normalizarParaComparacao(favorecido)
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((termo) => termo.length >= 4);

      expect(
        termos.length,
        "termo de favorecido disponível para busca textual",
      ).to.be.greaterThan(0);

      return cy.wrap(termos[0], { log: false });
    });
}

function pesquisarTextoEValidar(termoBuscado) {
  cy.get(SELETOR_BUSCA_TEXTO, { timeout: 30000 })
    .should("be.visible")
    .clear()
    .type(termoBuscado, { force: true })
    .should("have.value", termoBuscado);

  cy.get(SELETOR_ACIONAR_BUSCA, { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  cy.get(".loader", { timeout: 30000 }).should("not.exist");
  cy.get(".cont_dados", { timeout: 30000 }).should("be.visible");
  cy.get(".tb-load", { timeout: 30000 }).should("not.exist");

  return obterLinhasValidas().then(($linhas) => {
    expect(
      $linhas.length,
      `registros retornados para a busca textual por "${termoBuscado}"`,
    ).to.be.greaterThan(0);

    const encontrouTermo = Array.from($linhas).some((linha) =>
      normalizarParaComparacao(
        Cypress.$(linha).find(".colCredor").text(),
      ).includes(normalizarParaComparacao(termoBuscado)),
    );

    expect(
      encontrouTermo,
      `favorecido contendo "${termoBuscado}" exibido na listagem`,
    ).to.equal(true);
  });
}

function selecionarPeriodo(textoPeriodo) {
  cy.get(SELETOR_SELECT_PERIODO, { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(SELETOR_OPCOES_PERIODO, { timeout: 30000 })
    .should("be.visible")
    .find(".list a", { timeout: 30000 })
    .filter(":visible")
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find(
        (elemento) =>
          normalizarParaComparacao(elemento.textContent) ===
          normalizarParaComparacao(textoPeriodo),
      );

      expect(opcao, `opção de período "${textoPeriodo}" disponível`).to.exist;
      cy.wrap(opcao).click({ force: true });

      return cy.wrap(opcao.textContent, { log: false });
    });
}

function selecionarPeriodoPorPrefixo(prefixo) {
  cy.get(SELETOR_SELECT_PERIODO, { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(SELETOR_OPCOES_PERIODO, { timeout: 30000 })
    .should("be.visible")
    .find(".list a", { timeout: 30000 })
    .filter(":visible")
    .then(($opcoes) => {
      const prefixoNormalizado = normalizarParaComparacao(prefixo);
      const opcao = Array.from($opcoes).find((elemento) =>
        normalizarParaComparacao(elemento.textContent).startsWith(
          prefixoNormalizado,
        ),
      );

      expect(opcao, `opção de período iniciada por "${prefixo}"`).to.exist;
      const periodo = {
        id: opcao.getAttribute("href"),
        texto: normalizarTexto(opcao.textContent),
      };

      cy.wrap(opcao).click({ force: true });
      return cy.wrap(periodo, { log: false });
    });
}

function converterDataParaNumero(data) {
  const partes = normalizarTexto(data).split(/[/-]/);

  if (partes.length !== 3) {
    return NaN;
  }

  const [primeiro, segundo, terceiro] = partes.map(Number);
  const [dia, mes, ano] =
    partes[0].length === 4
      ? [terceiro, segundo, primeiro]
      : [primeiro, segundo, terceiro];

  return Number(
    `${ano}${String(mes).padStart(2, "0")}${String(dia).padStart(2, "0")}`,
  );
}

function formatarDataParaNumero(data) {
  return Number(
    `${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, "0")}${String(data.getDate()).padStart(2, "0")}`,
  );
}

function validarResultadoUltimosSeteDias() {
  cy.get(".loader", { timeout: 30000 }).should("not.exist");
  cy.get(".cont_dados", { timeout: 30000 }).should("be.visible");
  cy.get(".tb-load", { timeout: 30000 }).should("not.exist");

  const hoje = new Date();
  const limiteInicial = new Date(hoje);
  limiteInicial.setDate(hoje.getDate() - 7);
  const dataInicial = formatarDataParaNumero(limiteInicial);
  const dataFinal = formatarDataParaNumero(hoje);

  cy.get("body").then(($body) => {
    const linhas = $body
      .find(SELETOR_LINHAS_VALIDAS)
      .toArray()
      .filter(
        (linha) => !["not-found-line", "template_row"].includes(linha.id),
      );

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      expect(mensagem, "mensagem para período sem registros").to.contain(
        "Nenhum resultado encontrado",
      );
      return;
    }

    const datas = linhas
      .map((linha) =>
        normalizarTexto(Cypress.$(linha).find(".colData").first().text()),
      )
      .filter(Boolean)
      .map(converterDataParaNumero);

    expect(datas.length, "datas dos registros filtrados").to.be.greaterThan(0);
    datas.forEach((data, indice) => {
      expect(
        Number.isNaN(data),
        `data do registro ${indice + 1} válida`,
      ).to.equal(false);
      expect(
        data,
        `data do registro ${indice + 1} dentro dos últimos 7 dias`,
      ).to.be.at.least(dataInicial);
      expect(
        data,
        `data do registro ${indice + 1} dentro da data atual`,
      ).to.be.at.most(dataFinal);
    });
  });
}

function aguardarRetornoDoFiltro() {
  cy.get(".loader", { timeout: 30000 }).should("not.exist");
  cy.get(".cont_dados", { timeout: 30000 }).should("be.visible");
  cy.get(".tb-load", { timeout: 30000 }).should("not.exist");
}

function validarPeriodoExibido(dataInicial, dataFinal) {
  cy.get(".relatorio .periodo-inicial", { timeout: 30000 }).should(
    "contain",
    dataInicial,
  );
  cy.get(".relatorio .periodo-final", { timeout: 30000 }).should(
    "contain",
    dataFinal,
  );
}

function ultimoDiaDoMes(mes, ano) {
  return new Date(ano, mes, 0).getDate();
}

function montarPeriodoMensal(idPeriodo) {
  const [mes, ano] = idPeriodo.split("_").map(Number);
  const mesFormatado = String(mes).padStart(2, "0");

  return {
    inicial: `01/${mesFormatado}/${ano}`,
    final: `${String(ultimoDiaDoMes(mes, ano)).padStart(2, "0")}/${mesFormatado}/${ano}`,
  };
}

function montarPeriodoAnual(ano) {
  return {
    inicial: `01/01/${ano}`,
    final: `31/12/${ano}`,
  };
}

function validarDatasDaListagemNoPeriodo(dataInicial, dataFinal) {
  aguardarRetornoDoFiltro();

  const limiteInicial = converterDataParaNumero(dataInicial);
  const limiteFinal = converterDataParaNumero(dataFinal);

  cy.get("body").then(($body) => {
    const linhas = $body
      .find(SELETOR_LINHAS_VALIDAS)
      .toArray()
      .filter(
        (linha) => !["not-found-line", "template_row"].includes(linha.id),
      );

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      expect(mensagem, "mensagem para período sem registros").to.contain(
        "Nenhum resultado encontrado",
      );
      return;
    }

    const datas = linhas
      .map((linha) =>
        normalizarTexto(Cypress.$(linha).find(".colData").first().text()),
      )
      .filter(Boolean)
      .map(converterDataParaNumero);

    expect(datas.length, "datas dos registros do período").to.be.greaterThan(0);
    datas.forEach((data, indice) => {
      expect(
        Number.isNaN(data),
        `data do registro ${indice + 1} válida`,
      ).to.equal(false);
      expect(
        data,
        `data do registro ${indice + 1} dentro do período`,
      ).to.be.at.least(limiteInicial);
      expect(
        data,
        `data do registro ${indice + 1} dentro do período`,
      ).to.be.at.most(limiteFinal);
    });
  });
}

function abrirPopupIntervalo() {
  cy.get("#filtro_periodo .filtro_intervalo", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy.get("#popup_intervalo", { timeout: 30000 }).should("be.visible");
}

function acessarPrimeiroRegistro() {
  return obterLinhasValidas()
    .first()
    .find(".icon-file")
    .should("exist")
    .should("be.visible")
    .click({ force: true });
}

function fecharDetalhe() {
  cy.get("#pop_detalhes #close", { timeout: 30000 }).click({ force: true });
  cy.get("#pop_detalhes").should("not.exist");
}

function identificarOrgaoNoDetalhe() {
  acessarPrimeiroRegistro();

  return cy
    .get("#pop_detalhes", { timeout: 30000 })
    .should("be.visible")
    .find("#orgao")
    .first()
    .should("be.visible")
    .then(($campo) => {
      const orgao = obterValorDoCampo($campo);

      expect(orgao, "órgão disponível no detalhe do registro").to.not.equal("");
      fecharDetalhe();
      return cy.wrap(orgao, { log: false });
    });
}

function retornarParaListagem() {
  cy.visitPortal(DESPESAS_PATH);
  aguardarListagem();
}

function lerElementosDoFiltro() {
  return cy
    .get(SELETOR_SELECT_ORGAO, { timeout: 30000 })
    .should("exist")
    .then(() => cy.get(".filtro", { timeout: 30000 }))
    .then(($filtro) => {
      const elementos = Array.from(
        $filtro[0].querySelectorAll("label, input, select, button, a, [id]"),
      ).map((elemento) => ({
        tag: elemento.tagName.toLowerCase(),
        id: elemento.id || "",
        classe: elemento.className || "",
        texto: normalizarTexto(elemento.textContent || elemento.value || ""),
      }));

      const mensagem = `[${DESPESAS_NOME}][filtros] ${JSON.stringify(elementos)}`;
      Cypress.log({
        name: "LEITURA DOS FILTROS",
        message: mensagem,
        consoleProps: () => ({ elementos }),
      });
      cy.task("log", mensagem);

      return cy.wrap(elementos, { log: false });
    });
}

function selecionarOrgaoNoFiltro(orgaoIdentificado) {
  return cy
    .get(SELETOR_SELECT_ORGAO, { timeout: 30000 })
    .should("be.visible")
    .click({ force: true })
    .then(() =>
      cy
        .get(SELETOR_OPCOES_ORGAO, { timeout: 30000 })
        .should("be.visible")
        .find(".list a", { timeout: 30000 })
        .filter(":visible")
        .should("have.length.at.least", 1)
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find((elemento) =>
            orgaosCorrespondem(orgaoIdentificado, elemento.textContent),
          );

          expect(
            opcao,
            `órgão identificado "${orgaoIdentificado}" disponível no filtro`,
          ).to.exist;

          const orgaoSelecionado = normalizarTexto(opcao.textContent);
          cy.wrap(opcao).click({ force: true });
          cy.get(`${SELETOR_CONTAINER_SELECT_ORGAO} .selected`, {
            timeout: 30000,
          }).should("contain", orgaoSelecionado);

          return cy.wrap(orgaoSelecionado, { log: false });
        }),
    );
}

function validarOrgaoDosResultados(orgaoSelecionado) {
  aguardarListagem();
  acessarPrimeiroRegistro();

  cy.get("#pop_detalhes", { timeout: 30000 })
    .should("be.visible")
    .find("#orgao")
    .first()
    .should("be.visible")
    .then(($campo) => {
      const orgaoRetornado = obterValorDoCampo($campo);

      expect(orgaoRetornado, "órgão disponível no resultado").to.not.equal("");
      expect(
        orgaosCorrespondem(orgaoSelecionado, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com "${orgaoSelecionado}"`,
      ).to.equal(true);
    })
    .then(() => fecharDetalhe());
}

function selecionarOpcaoCovid(opcaoCovid) {
  cy.get(SELETOR_SELECT_COVID, { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(SELETOR_OPCOES_COVID, { timeout: 30000 })
    .should("be.visible")
    .find(".list a", { timeout: 30000 })
    .filter(":visible")
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find(
        (elemento) =>
          normalizarParaComparacao(elemento.textContent) ===
          normalizarParaComparacao(opcaoCovid),
      );

      expect(opcao, `opção COVID-19 "${opcaoCovid}" disponível`).to.exist;
      cy.wrap(opcao).click({ force: true });
      cy.get("#search_coronavirus .selected").should("contain", opcaoCovid);
    });
}

function validarResultadoCovid(opcaoCovid) {
  return cy
    .get(".loader", { timeout: 30000 })
    .should("not.exist")
    .get(".cont_dados", { timeout: 30000 })
    .should("be.visible")
    .get(".tb-load", { timeout: 30000 })
    .should("not.exist")
    .get("body")
    .then(($body) => {
      const linhas = $body
        .find(SELETOR_LINHAS_VALIDAS)
        .toArray()
        .filter(
          (linha) => !["not-found-line", "template_row"].includes(linha.id),
        );

      if (opcaoCovid === "Não") {
        expect(
          linhas.length,
          "listagem retornou dados para COVID-19 Não",
        ).to.be.greaterThan(0);
        return;
      }

      if (linhas.length > 0) {
        expect(
          linhas.length,
          `registros retornados para COVID-19 ${opcaoCovid}`,
        ).to.be.greaterThan(0);
        return;
      }

      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      expect(
        mensagem,
        `mensagem de ausência de dados para COVID-19 ${opcaoCovid}`,
      ).to.contain("Nenhum resultado encontrado");
    });
}

// Cenários dos filtros externos do adaptador Centi.
describe(`Portal: ${DESPESAS_NOME} - filtros externos`, () => {
  beforeEach(() => {
    cy.visitPortal(DESPESAS_PATH);
    lerElementosDoFiltro();
    cy.get(".filtro", { timeout: 30000 }).should("be.visible");
    aguardarListagem();
  });

  // Obtém um órgão real, aplica o filtro externo e valida os resultados.
  it("identifica o órgão de um registro, pesquisa pelo órgão e valida os resultados", () => {
    identificarOrgaoNoDetalhe()
      .then((orgaoIdentificado) => {
        retornarParaListagem();
        return selecionarOrgaoNoFiltro(orgaoIdentificado);
      })
      .then((orgaoSelecionado) => {
        validarOrgaoDosResultados(orgaoSelecionado);
      });
  });

  // Executa as duas opções de COVID-19 e valida cada retorno.
  it("filtra COVID-19 como Sim e depois como Não, validando cada retorno", () => {
    selecionarOpcaoCovid("Sim")
      .then(() => validarResultadoCovid("Sim"))
      .then(() => selecionarOpcaoCovid("Não"))
      .then(() => validarResultadoCovid("Não"));
  });

  // Realiza uma busca textual e confere o favorecido da listagem.
  it("filtra pela busca textual e valida o favorecido retornado", () => {
    obterTermoDaListagem().then((termoBuscado) => {
      pesquisarTextoEValidar(termoBuscado);
    });
  });

  // Valida as datas retornadas para o intervalo dos últimos sete dias.
  it("filtra pelos últimos 7 dias e valida as datas retornadas", () => {
    selecionarPeriodo("Últimos 7 dias").then(() => {
      cy.get("#filtro_periodo .selected", { timeout: 30000 }).should(
        "contain",
        "7 dias",
      );
      validarResultadoUltimosSeteDias();
    });
  });

  // Seleciona um ano no filtro de período e valida a listagem.
  it("filtra por ano no select de período", () => {
    const anoAtual = new Date().getFullYear();
    const periodos = [
      montarPeriodoAnual(anoAtual),
      montarPeriodoAnual(anoAtual - 1),
    ];

    periodos.forEach(({ inicial, final }, indice) => {
      selecionarPeriodo(`Ano de ${anoAtual - indice}`);
      validarPeriodoExibido(inicial, final);
      validarDatasDaListagemNoPeriodo(inicial, final);
    });
  });

  // Seleciona um mês no filtro de período e valida a listagem.
  it("filtra por mês no select de período", () => {
    selecionarPeriodoPorPrefixo("Mês de").then(({ id }) => {
      const periodo = montarPeriodoMensal(id);

      validarPeriodoExibido(periodo.inicial, periodo.final);
      validarDatasDaListagemNoPeriodo(periodo.inicial, periodo.final);
    });
  });

  // Usa o popup de intervalo para selecionar mês e ano explicitamente.
  it("filtra por mês e ano no popup de intervalo", () => {
    const anoAtual = new Date().getFullYear();
    const anoAnterior = anoAtual - 1;
    const periodo = {
      inicial: `01/03/${anoAnterior}`,
      final: `31/03/${anoAnterior}`,
    };

    abrirPopupIntervalo();
    cy.get("#popup_intervalo .container-ano span").should(
      "contain",
      `${anoAtual}`,
    );
    cy.get("#popup_intervalo .container-ano .left")
      .should("be.visible")
      .click({ force: true });
    cy.get("#popup_intervalo .container-ano span").should(
      "contain",
      `${anoAnterior}`,
    );
    cy.get("#popup_intervalo .container-meses span[data-mes='03']")
      .should("be.visible")
      .click({ force: true });

    validarPeriodoExibido(periodo.inicial, periodo.final);
    validarDatasDaListagemNoPeriodo(periodo.inicial, periodo.final);
  });
});
