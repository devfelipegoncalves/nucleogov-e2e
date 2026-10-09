const DESPESAS_PATH =
  Cypress.env("DESPESAS_PATH") || "/cidadao/transparencia/mgdespesas";
const DESPESAS_NOME = Cypress.env("DESPESAS_NOME") || "mgdespesas";
const LISTAGEM_TIMEOUT = 60000;

// Os specs de MG e SG compartilham o mesmo fluxo, mas podem sobrescrever a
// rota e o nome do sistema por meio de Cypress.env quando necessário.
function normalizarTexto(texto = "") {
  return texto.replace(/\s+/g, " ").trim();
}

// Remove palavras genéricas para permitir comparar o órgão do detalhe com o
// texto da opção do filtro, que pode ter abreviações ou descrições diferentes.
function obterTermosSignificativos(texto) {
  const termosAdministrativos = new Set([
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
    "poder",
    "prefeitura",
    "orgao",
  ]);

  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((termo) => termo.length > 2 && !termosAdministrativos.has(termo));
}

// Aguarda a listagem inicial e garante que exista pelo menos um empenho para
// servir de massa de dados para o filtro que será testado.
function aguardarListagem() {
  cy.get("body", { timeout: LISTAGEM_TIMEOUT }).should(($body) => {
    expect(
      $body.find(".loader:visible").length,
      "loader visível da listagem",
    ).to.equal(0);
  });
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get("body", { timeout: LISTAGEM_TIMEOUT }).should(($body) => {
    expect(
      $body.find(".tb-load:visible").length,
      "loader visível da tabela",
    ).to.equal(0);
  });
  cy.get(".cont_dados .tb tr[id]")
    .filter((_, row) => !["not-found-line", "template_row"].includes(row.id))
    .should("have.length.at.least", 1);
}

// O órgão é obtido no popup do primeiro registro, em vez de ser escolhido
// arbitrariamente no filtro. Isso mantém o teste baseado em um dado real.
function obterOrgaoDoPortal() {
  return cy
    .get(".cont_dados .tb tr[id]")
    .filter((_, row) => !["not-found-line", "template_row"].includes(row.id))
    .first()
    .find("td.colIcone")
    .trigger("mousedown", { which: 1, force: true })
    .then(() =>
      cy
        .get("#popdetalhes", { timeout: 30000 })
        .should("be.visible")
        .should(($popup) => {
          const label = [...$popup[0].querySelectorAll("label")].find((item) =>
            ["órgão", "orgão", "orgao"].includes(
              normalizarTexto(item.textContent).toLowerCase(),
            ),
          );

          expect(label, "campo órgão no detalhe do portal").to.exist;
        })
        .then(($popup) => {
          const label = [...$popup[0].querySelectorAll("label")].find((item) =>
            ["órgão", "orgão", "orgao"].includes(
              normalizarTexto(item.textContent).toLowerCase(),
            ),
          );

          const campo = label.parentElement?.querySelector("textarea, input");
          const valor = normalizarTexto(
            campo?.value || campo?.textContent || "",
          );

          expect(valor, "órgão disponível nos dados do portal").to.not.equal(
            "",
          );
          return valor;
        }),
    )
    .then((orgao) => {
      cy.get("#popdetalhes #close").click({ force: true });
      cy.get("#popdetalhes").should("not.exist");
      return cy.wrap(orgao, { log: false });
    });
}

// Seleciona no filtro a opção que possui termos em comum com o órgão coletado
// no popup e retorna o texto efetivamente escolhido para a validação posterior.
function selecionarOrgaoDoPortal(orgaoDoPortal) {
  return cy.get("#select_orgao").then(($container) => {
    cy.wrap($container).find(".selected").click({ force: true });

    return cy
      .wrap($container)
      .find(".options .list a")
      .then(($opcoes) => {
        const termosDoPortal = obterTermosSignificativos(orgaoDoPortal);
        const opcao = Array.from($opcoes).find((elemento) => {
          const termosDaOpcao = obterTermosSignificativos(elemento.textContent);
          return termosDoPortal.some((termo) => termosDaOpcao.includes(termo));
        });

        expect(opcao, `órgão do portal "${orgaoDoPortal}" disponível no filtro`)
          .to.exist;

        const orgao = normalizarTexto(opcao.textContent);
        cy.wrap(opcao).click({ force: true });
        return cy.wrap(orgao, { log: false });
      });
  });
}

// Selects customizados do portal não são elementos <select>; primeiro abrimos
// a lista e depois clicamos no link da opção desejada.
function selecionarOpcao(containerSelector, textoOpcao) {
  cy.get(containerSelector).find(".selected").click({ force: true });
  cy.contains(`${containerSelector} .options .list a`, textoOpcao, {
    matchCase: false,
  }).click({ force: true });
}

// Aguarda apenas o término da requisição disparada por um filtro. Essa versão
// não exige linhas, pois alguns filtros podem legitimamente retornar vazio.
function aguardarRetornoDoFiltro() {
  cy.get("body", { timeout: LISTAGEM_TIMEOUT }).should(($body) => {
    expect(
      $body.find(".loader:visible").length,
      "loader visível da listagem",
    ).to.equal(0);
  });
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get("body", { timeout: LISTAGEM_TIMEOUT }).should(($body) => {
    expect(
      $body.find(".tb-load:visible").length,
      "loader visível da tabela",
    ).to.equal(0);
  });
}

function validarPeriodoExibido(inicial, final) {
  cy.get(".periodo-pesquisa .periodo-inicial").should("contain", inicial);
  cy.get(".periodo-pesquisa .periodo-final").should("contain", final);
}

function dataParaNumero(data) {
  const [dia, mes, ano] = data.split("/");
  return Number(`${ano}${mes}${dia}`);
}

function validarDatasDaListagemNoPeriodo(inicial, final) {
  const dataInicial = dataParaNumero(inicial);
  const dataFinal = dataParaNumero(final);

  aguardarRetornoDoFiltro();

  cy.get("body").then(($body) => {
    const linhas = $body
      .find(".cont_dados .tb tr[id]")
      .toArray()
      .filter((row) => !["not-found-line", "template_row"].includes(row.id));

    if (linhas.length === 0) {
      // Mesmo sem registros, o portal deve informar claramente o motivo ao
      // usuário. A mensagem é validada e registrada no log do teste.
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      expect(mensagem).to.contain("Nenhum resultado encontrado");
      const mensagemComContexto = `[${DESPESAS_NOME}][período] ${mensagem}`;

      console.log(mensagemComContexto);
      Cypress.log({
        name: "ALERTA",
        message: mensagemComContexto,
        consoleProps: () => ({
          filtro: "período",
          resultado: "sem dados",
          mensagem,
        }),
      });
      cy.task("log", mensagemComContexto);
      cy.log(mensagemComContexto);
      return;
    }

    const datas = linhas
      .slice(0, 10)
      .map((row) =>
        normalizarTexto(row.querySelector(".colData")?.textContent || ""),
      )
      .filter(Boolean);

    expect(datas.length, "datas disponíveis na listagem").to.be.greaterThan(0);

    datas.forEach((data) => {
      const dataAtual = dataParaNumero(data);
      expect(dataAtual, `data ${data} dentro do período`).to.be.at.least(
        dataInicial,
      );
      expect(dataAtual, `data ${data} dentro do período`).to.be.at.most(
        dataFinal,
      );
    });
  });
}

function ultimoDiaDoMes(mes, ano) {
  return new Date(ano, mes, 0).getDate();
}

function formatarData(data) {
  return `${String(data.getDate()).padStart(2, "0")}/${String(
    data.getMonth() + 1,
  ).padStart(2, "0")}/${data.getFullYear()}`;
}

function montarPeriodoAnual(ano) {
  return {
    label: `Ano de ${ano}`,
    inicial: `01/01/${ano}`,
    final: `31/12/${ano}`,
  };
}

function selecionarPeriodo(textoOpcao) {
  selecionarOpcao("#filtro_periodo", textoOpcao);
  aguardarRetornoDoFiltro();
}

function abrirCalendarioPeriodo() {
  cy.get("#filtro_periodo .filtro_intervalo").click({ force: true });
  cy.get("#popup_intervalo", { timeout: 30000 }).should("exist");
}

function validarOrgaoNoDetalhe(orgaoSelecionado) {
  cy.get(".cont_dados .tb tr[id]")
    .filter((_, row) => !["not-found-line", "template_row"].includes(row.id))
    .first()
    .find("td.colIcone")
    .trigger("mousedown", { which: 1, force: true });

  cy.get("#popdetalhes", { timeout: 30000 }).should(($popup) => {
    const popup = $popup[0];
    const label = [...popup.querySelectorAll("label")].find((item) =>
      ["órgão", "orgão", "orgao"].includes(
        normalizarTexto(item.textContent).toLowerCase(),
      ),
    );

    expect(label, "campo órgão no detalhe").to.exist;

    const campo = label.parentElement?.querySelector("textarea, input");
    const valor = normalizarTexto(campo?.value || campo?.textContent || "");

    expect(valor, "valor do órgão carregado").to.not.equal("");

    const termosSelecionados = obterTermosSignificativos(orgaoSelecionado);
    const termosRetornados = obterTermosSignificativos(valor);
    const possuiTermoEmComum = termosSelecionados.some((termo) =>
      termosRetornados.includes(termo),
    );

    expect(
      possuiTermoEmComum,
      `órgão retornado "${valor}" compatível com "${orgaoSelecionado}"`,
    ).to.equal(true);
  });

  cy.get("#popdetalhes #close").click({ force: true });
  cy.get("#popdetalhes").should("not.exist");
}

function validarListagemOuMensagemSemResultado() {
  cy.get("body").then(($body) => {
    const linhas = $body
      .find(".cont_dados .tb tr[id]")
      .toArray()
      .filter((row) => !["not-found-line", "template_row"].includes(row.id));

    if (linhas.length > 0) {
      expect(linhas.length).to.be.greaterThan(0);
      return;
    }

    const mensagem = normalizarTexto($body.find("#not-found-line").text());
    expect(mensagem).to.contain("Nenhum resultado encontrado");
  });
}

// Os testes externos exercitam os filtros que ficam diretamente na listagem:
// órgão, COVID-19 e período (intervalos prontos e calendário).
describe(`Portal: ${DESPESAS_NOME} - filtros externos`, () => {
  beforeEach(() => {
    cy.visitPortal(DESPESAS_PATH);
    cy.get(".filtro", { timeout: 30000 }).should("be.visible");
    aguardarListagem();
  });

  it("filtra por órgão e valida o campo no detalhe do resultado", () => {
    obterOrgaoDoPortal().then((orgaoDoPortal) => {
      selecionarOrgaoDoPortal(orgaoDoPortal).then((orgaoSelecionado) => {
        aguardarListagem();
        validarOrgaoNoDetalhe(normalizarTexto(orgaoSelecionado));
      });
    });
  });

  it("filtra covid-19 como sim e retorna dados", () => {
    selecionarOpcao("#search_coronavirus", "Sim");
    aguardarListagem();
  });

  it("filtra covid-19 como não e valida dados ou mensagem de vazio", () => {
    selecionarOpcao("#search_coronavirus", "Não");
    aguardarRetornoDoFiltro();
    validarListagemOuMensagemSemResultado();
  });

  it("filtra por últimos 7 dias no select de período", () => {
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje);
    seteDiasAtras.setDate(hoje.getDate() - 7);

    selecionarPeriodo("Últimos 7 dias");
    validarPeriodoExibido(formatarData(seteDiasAtras), formatarData(hoje));
    validarDatasDaListagemNoPeriodo(
      formatarData(seteDiasAtras),
      formatarData(hoje),
    );
  });

  it("filtra por anos no select de período", () => {
    const anoAtual = new Date().getFullYear();
    const periodos = [
      montarPeriodoAnual(anoAtual),
      montarPeriodoAnual(anoAtual - 1),
    ];

    periodos.forEach(({ label, inicial, final }) => {
      selecionarPeriodo(label);
      validarPeriodoExibido(inicial, final);
      validarDatasDaListagemNoPeriodo(inicial, final);
    });
  });

  it("filtra por mês e ano no calendário de período", () => {
    const anoAtual = new Date().getFullYear();
    const anoAnterior = anoAtual - 1;

    abrirCalendarioPeriodo();
    cy.get("#popup_intervalo .container-ano span").should(
      "contain",
      `${anoAtual}`,
    );
    cy.get("#popup_intervalo .container-ano .left").click();
    cy.get("#popup_intervalo .container-ano span").should(
      "contain",
      `${anoAnterior}`,
    );
    cy.get("#popup_intervalo .container-meses span[data-mes='03']").click();

    aguardarRetornoDoFiltro();
    validarPeriodoExibido(`01/03/${anoAnterior}`, `31/03/${anoAnterior}`);
    validarDatasDaListagemNoPeriodo(
      `01/03/${anoAnterior}`,
      `31/03/${anoAnterior}`,
    );

    abrirCalendarioPeriodo();
    cy.get("#popup_intervalo .container-ano span").should(
      "contain",
      `${anoAnterior}`,
    );
    cy.get("#popup_intervalo .container-meses span[data-mes='01']").click();

    const finalJaneiro = `${String(ultimoDiaDoMes(1, anoAnterior)).padStart(2, "0")}/01/${anoAnterior}`;
    aguardarRetornoDoFiltro();
    validarPeriodoExibido(`01/01/${anoAnterior}`, finalJaneiro);
    validarDatasDaListagemNoPeriodo(`01/01/${anoAnterior}`, finalJaneiro);
  });
});
