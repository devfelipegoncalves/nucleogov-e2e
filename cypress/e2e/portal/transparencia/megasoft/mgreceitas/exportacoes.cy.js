/**
 * Testes das exportações da listagem de receitas do módulo Megasoft.
 *
 * Para cada formato disponibilizado pelo portal, o teste abre o primeiro
 * registro, guarda todos os campos preenchidos do detalhamento, exporta a
 * listagem e compara esses valores com o arquivo baixado.
 */

const RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/mgreceitas";
const RECEITAS_NOME = Cypress.env("RECEITAS_NOME") || "mgreceitas";
const LISTAGEM_TIMEOUT = 60000;
const NOME_ARQUIVO_EXPORTACAO =
  Cypress.env("RECEITAS_EXPORTACAO_NOME") || "relatorio-receitas";
const NOMES_ARQUIVOS_EXPORTACAO = [
  NOME_ARQUIVO_EXPORTACAO,
  "relatorio-receitas",
  "relatorio-receita",
];
const FORMATOS_ESPERADOS = [
  { nome: "HTML", extensao: "html" },
  { nome: "CSV", extensao: "csv" },
  { nome: "XLS", extensao: "xls" },
  { nome: "TXT", extensao: "txt" },
  { nome: "JSON", extensao: "json" },
  { nome: "XML", extensao: "xml" },
];
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

function normalizarTexto(texto = "") {
  return String(texto).replace(/\s+/g, " ").trim();
}

function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function obterValorExportado({ label, value }) {
  const labelNormalizado = normalizarParaComparacao(label);
  const valorNormalizado = normalizarParaComparacao(value);

  if (labelNormalizado === "mes") {
    const indice = MESES.findIndex((mes) => valorNormalizado.includes(mes));
    if (indice >= 0) return String(indice + 1);

    const numero = valorNormalizado.match(/\b(1[0-2]|[1-9])\b/)?.[1];
    if (numero) return numero;
  }

  if (labelNormalizado === "orgao") {
    return normalizarTexto(value).replace(/^\d+\s*[-.)]\s*/, "");
  }

  if (/valor previsto|valor previsao|valor arrecadado|valor acumulado/.test(
    labelNormalizado,
  )) {
    return normalizarTexto(value).replace(/^r\$\s*/i, "");
  }

  return value;
}

function prepararCamposParaExportacao(campos) {
  return campos.map((campo) => ({
    ...campo,
    value: obterValorExportado(campo),
  }));
}

function aguardarListagem() {
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

function obterLinhasDeDados() {
  return cy.get(".cont_dados .tb tr[id]").then(($linhas) =>
    Array.from($linhas).filter(
      (linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        !linha.classList.contains("tb-load") &&
        linha.querySelector(".colNumero, .colDescricao"),
    ),
  );
}

function obterCamposDoDetalhamento($popup) {
  const campos = Array.from($popup[0].querySelectorAll("label"))
    .map((label) => {
      const container = label.closest(".campo") || label.parentElement;
      const campo =
        container?.querySelector(
          "textarea, input:not([type='hidden']), select, .input",
        ) ||
        (label.htmlFor && label.ownerDocument.getElementById(label.htmlFor));

      return {
        label: normalizarTexto(label.textContent),
        value: normalizarTexto(campo?.value || campo?.textContent || ""),
      };
    })
    .filter(({ label }) => label);

  expect(campos, "campos presentes no detalhamento da receita").to.have.length
    .greaterThan(0);
  expect(
    campos.filter(({ value }) => value),
    "campos preenchidos no detalhamento da receita",
  ).to.have.length.greaterThan(0);

  return campos;
}

function obterDetalhamentoDaPrimeiraReceita() {
  obterLinhasDeDados().then((linhas) => {
    expect(linhas.length, "receitas disponíveis para exportação").to.be.at.least(
      1,
    );

    cy.wrap(linhas[0])
      .find(".colIcone")
      .should("exist")
      .trigger("mousedown", { which: 1, force: true });
  });

  return cy
    .get("#popdetalhes", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find(".campo", { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($campos) => {
      const $popup = $campos.first().closest("#popdetalhes");
      const campos = obterCamposDoDetalhamento($popup);

      cy.log(`[${RECEITAS_NOME}] ${campos.length} campo(s) coletado(s)`);
      campos.forEach(({ label, value }) => {
        Cypress.log({
          name: "CAMPO DO DETALHAMENTO",
          message: `${label}: "${value}"`,
          consoleProps: () => ({ label, valor: value }),
        });
      });

      cy.get("#popdetalhes #close", { timeout: LISTAGEM_TIMEOUT }).click({
        force: true,
      });
      cy.get("#popdetalhes").should("not.exist");

      return cy.wrap(campos, { log: false });
    });
}

function obterFormato(texto) {
  const formato = normalizarParaComparacao(texto);

  if (formato.includes("csv")) return "csv";
  if (formato.includes("txt")) return "txt";
  if (formato.includes("excel") || formato.includes("xls")) return "xls";
  if (formato.includes("json")) return "json";
  if (formato.includes("xml")) return "xml";
  if (formato.includes("html")) return "html";

  return "arquivo";
}

function obterOpcoesDeExportacao() {
  cy.get("#exportar button.export", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#exportar .btt_options a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) =>
      Array.from($opcoes)
        .map((opcao) => normalizarTexto(opcao.textContent))
        .filter(Boolean),
    );
}

function validarFormatosDisponiveis(opcoes) {
  const formatosDisponiveis = opcoes.map(obterFormato);
  const extensoesEsperadas = FORMATOS_ESPERADOS.map(({ extensao }) => extensao);

  expect(
    formatosDisponiveis,
    "formatos de exportação disponíveis",
  ).to.have.members(extensoesEsperadas);
  expect(
    formatosDisponiveis,
    "quantidade de formatos de exportação",
  ).to.have.length(extensoesEsperadas.length);
}

function nomesDosArquivos(formato) {
  return NOMES_ARQUIVOS_EXPORTACAO.map(
    (nome) => `${nome}.${formato}`,
  ).filter((nome, indice, nomes) => nomes.indexOf(nome) === indice);
}

function validarArquivoExportado(formato, detalhamento) {
  const nomes = nomesDosArquivos(formato);

  cy.task(
    "assertDownloadedFileContains",
    {
      fileName: nomes[0],
      fileNames: nomes.slice(1),
      expectedFields: prepararCamposParaExportacao(detalhamento),
      reportarCamposAusentes: true,
    },
    { timeout: LISTAGEM_TIMEOUT },
  ).then(({ tamanho, camposComparados, camposAusentes }) => {
    expect(tamanho, `tamanho do arquivo ${formato} exportado`).to.be.greaterThan(
      0,
    );
    expect(
      camposComparados,
      `campos comparados no arquivo ${formato}`,
    ).to.have.length.greaterThan(0);
    expect(
      camposAusentes.join(", "),
      `campos ausentes no arquivo ${formato}`,
    ).to.equal("");

    cy.log(`[${formato.toUpperCase()}] ${nomes.join(" ou ")} validado`);
    camposComparados.forEach(({ label, value, regra, encontrado }) => {
      const resultado = encontrado ? "ENCONTRADO" : "AUSENTE";
      const mensagem = `${label}: "${value}" → ${resultado} (${regra})`;

      cy.log(`[${formato.toUpperCase()}] ${mensagem}`);
      Cypress.log({
        name: `COMPARAÇÃO ${formato.toUpperCase()}`,
        message: mensagem,
        consoleProps: () => ({
          arquivos: nomes,
          campo: label,
          valorDoDetalhamento: value,
          encontradoNoArquivo: encontrado,
          regra,
        }),
      });
    });
  });
}

function exportarOpcao(texto, formato, detalhamento) {
  const nomes = nomesDosArquivos(formato);

  cy.task("removeDownloadedFiles", { fileNames: nomes }).then(() => {
    cy.get("#exportar .btt_options a:visible")
      .contains(new RegExp(`^${texto}$`, "i"))
      .click({ force: true });

    validarArquivoExportado(formato, detalhamento);
  });
}

describe(`Portal: ${RECEITAS_NOME} - exportações`, () => {
  beforeEach(() => {
    cy.visitPortal(RECEITAS_PATH);
    aguardarListagem();
  });

  FORMATOS_ESPERADOS.forEach(({ nome, extensao }) => {
    it(`exporta ${nome} e compara todos os campos com o detalhamento`, () => {
      obterDetalhamentoDaPrimeiraReceita().then((detalhamento) => {
        obterOpcoesDeExportacao().then((opcoes) => {
          validarFormatosDisponiveis(opcoes);

          const opcao = opcoes.find(
            (texto) => obterFormato(texto) === extensao,
          );
          expect(opcao, `opção ${nome} disponível para exportação`).to.exist;

          exportarOpcao(opcao, extensao, detalhamento);
        });
      });
    });
  });
});
