/**
 * Exportações do módulo Prodata SGDespesas.
 *
 * Cada cenário coleta todos os campos preenchidos no detalhamento do primeiro
 * empenho e verifica se os valores também aparecem no arquivo exportado. O
 * domínio é carregado de CYPRESS_BASE_URL.
 */

const SG_DESPESAS_PATH = "/cidadao/transparencia/sgdespesas";
const SG_DESPESAS_NOME = "sgdespesas";
const LISTAGEM_TIMEOUT = 60000;
const NOME_ARQUIVO_EXPORTACAO =
  Cypress.env("DESPESAS_EXPORTACAO_NOME") || "relatório-despesas";

const FORMATOS_ESPERADOS = [
  { nome: "HTML", extensao: "html" },
  { nome: "CSV", extensao: "csv" },
  { nome: "XLS", extensao: "xls" },
  { nome: "TXT", extensao: "txt" },
  { nome: "JSON", extensao: "json" },
  { nome: "XML", extensao: "xml" },
];

function normalizarTexto(texto = "") {
  return texto.replace(/\s+/g, " ").trim();
}

function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function visitarSgDespesas() {
  const alias = `carregamentoExportacaoSg${Cypress._.uniqueId()}`;

  cy.intercept("POST", "**/api").as(alias);
  cy.visitPortal(SG_DESPESAS_PATH);
  cy.wait(`@${alias}`, { timeout: LISTAGEM_TIMEOUT });
  cy.wait(`@${alias}`, { timeout: LISTAGEM_TIMEOUT });
}

function aguardarListagem() {
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get(".tb-load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
}

function obterLinhasValidas() {
  return cy
    .get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .then(($linhas) =>
      Array.from($linhas).filter(
        (linha) =>
          !["not-found-line", "template_row"].includes(linha.id) &&
          !linha.classList.contains("tb-load"),
      ),
    );
}

function fecharTermosDeUsoSeExibido() {
  cy.get("body").then(($body) => {
    const botaoContinuar = $body
      .find(
        ".container-termos-uso:visible button, .container-termos-uso:visible a",
      )
      .filter(
        (_, elemento) => normalizarTexto(elemento.textContent) === "Continuar",
      )
      .first();

    if (botaoContinuar.length) {
      cy.wrap(botaoContinuar).click({ force: true });
    }
  });
}

function obterValorDoCampo(campo) {
  return normalizarTexto(
    campo?.value || campo?.getAttribute("value") || campo?.textContent || "",
  );
}

function obterEntradaDoCampo(label) {
  const container = label.closest(".campo") || label.parentElement;
  const entrada = container?.querySelector(
    "textarea, input:not([type='hidden']), select, .input",
  );

  return (
    entrada ||
    (label.htmlFor && label.ownerDocument.getElementById(label.htmlFor))
  );
}

function obterCamposDoDetalhamento($pagina) {
  const campos = [];
  const camposAdicionados = new Set();

  Array.from($pagina[0].querySelectorAll(".campo label, label")).forEach(
    (label) => {
      const entrada = obterEntradaDoCampo(label);
      const rotulo = normalizarTexto(label.textContent);
      const valorOriginal = obterValorDoCampo(entrada);
      const valor = /descri|histórico|historico/i.test(rotulo)
        ? valorOriginal.split(/\s+/).slice(0, 8).join(" ")
        : valorOriginal;
      const chave = `${rotulo}::${valor}`;

      if (rotulo && valor && !camposAdicionados.has(chave)) {
        camposAdicionados.add(chave);
        campos.push({ label: rotulo, value: valor });
      }
    },
  );

  expect(campos, "campos no detalhamento Prodata").to.have.length.greaterThan(
    0,
  );
  return campos;
}

function obterDetalhamentoDaPrimeiraDespesa() {
  return obterLinhasValidas()
    .then((linhas) => {
      expect(
        linhas.length,
        "despesas disponíveis para exportação",
      ).to.be.at.least(1);

      cy.wrap(linhas[0]).find(".colNumero").first().click({ force: true });
    })
    .then(() => {
      fecharTermosDeUsoSeExibido();

      return cy
        .get("body", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .should(($pagina) => {
          expect(
            obterCamposDoDetalhamento($pagina),
            "campos carregados no detalhamento Prodata",
          ).to.have.length.greaterThan(0);
        })
        .then(($pagina) => {
          const detalhamento = obterCamposDoDetalhamento($pagina);

          visitarSgDespesas();
          aguardarListagem();

          return cy.wrap(detalhamento, { log: false });
        });
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
  cy.get("#exportar", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("button.export, .export")
    .filter(":visible")
    .first()
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
    "formatos de exportação Prodata disponíveis",
  ).to.have.members(extensoesEsperadas);
  expect(
    formatosDisponiveis,
    "quantidade de formatos de exportação Prodata",
  ).to.have.length(extensoesEsperadas.length);
}

function validarArquivoExportado(formato, campos) {
  cy.task(
    "assertDownloadedFileContains",
    {
      fileName: `${NOME_ARQUIVO_EXPORTACAO}.${formato}`,
      expectedFields: campos,
      adaptador: "prodata",
    },
    { timeout: LISTAGEM_TIMEOUT },
  ).then(({ tamanho, camposComparados, fileName }) => {
    expect(tamanho, `tamanho do arquivo Prodata ${formato}`).to.be.greaterThan(
      0,
    );
    expect(
      camposComparados,
      `campos comparados no arquivo Prodata ${formato}`,
    ).to.have.length.greaterThan(0);

    camposComparados.forEach(({ label, value, regra }) => {
      const mensagem = `${label}: "${value}" → ENCONTRADO (${regra})`;

      cy.log(`[${formato.toUpperCase()}] ${fileName}: ${mensagem}`);
      Cypress.log({
        name: `COMPARAÇÃO PRODATA ${formato.toUpperCase()}`,
        message: mensagem,
        consoleProps: () => ({
          arquivo: fileName,
          campo: label,
          valorDaListagem: value,
          regra,
        }),
      });
    });
  });
}

function exportarOpcao(texto, formato, campos) {
  cy.task("removeDownloadedFiles", {
    fileNames: [`${NOME_ARQUIVO_EXPORTACAO}.${formato}`],
  }).then(() => {
    cy.get("#exportar .btt_options a:visible")
      .contains(new RegExp(`^${texto}$`, "i"))
      .click({ force: true });

    validarArquivoExportado(formato, campos);
  });
}

describe(`Portal Prodata: ${SG_DESPESAS_NOME} - exportações`, () => {
  beforeEach(() => {
    visitarSgDespesas();
    aguardarListagem();
  });

  FORMATOS_ESPERADOS.forEach(({ nome, extensao }) => {
    it(`exporta ${nome} e compara todos os campos do detalhamento Prodata`, () => {
      obterDetalhamentoDaPrimeiraDespesa().then((campos) => {
        obterOpcoesDeExportacao().then((opcoes) => {
          validarFormatosDisponiveis(opcoes);

          const opcao = opcoes.find(
            (textoOpcao) => obterFormato(textoOpcao) === extensao,
          );
          expect(opcao, `opção Prodata ${nome} disponível`).to.exist;

          exportarOpcao(opcao, extensao, campos);
        });
      });
    });
  });
});
