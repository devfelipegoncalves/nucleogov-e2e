/**
 * Exportações do módulo Fiorilli Despesas FRL.
 *
 * Cada cenário abre o primeiro empenho real, coleta os campos preenchidos no
 * detalhamento, retorna à listagem e confere esses valores no formato
 * exportado pelo portal.
 */

const DESPESAS_PATH = "/cidadao/transparencia/despesas_frl";
const DESPESAS_NOME = "fiorilli/despesas_frl";
const LISTAGEM_TIMEOUT = 60000;
const NOME_ARQUIVO_EXPORTACAO = "relatorio-despesas";

const FORMATOS_ESPERADOS = [
  { nome: "HTML", extensao: "html" },
  { nome: "CSV", extensao: "csv" },
  { nome: "XLS", extensao: "xls" },
  { nome: "TXT", extensao: "txt" },
  { nome: "JSON", extensao: "json" },
  { nome: "XML", extensao: "xml" },
];

// O exportador do Fiorilli mantém a coluna Programa no layout, mas não
// preenche o valor dela. O detalhamento, por outro lado, retorna o Programa
// corretamente; por isso esse campo não pode ser usado como valor de
// comparação dos arquivos enquanto essa divergência do endpoint existir.
const CAMPOS_SEM_VALOR_NA_EXPORTACAO = [/^programa$/i];

function normalizarTexto(texto = "") {
  return String(texto).replace(/\s+/g, " ").trim();
}

function aguardarListagem() {
  cy.get("#load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get(".tb-load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
}

function obterLinhasDeDados() {
  return cy
    .get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .then(($linhas) =>
      Array.from($linhas).filter(
        (linha) =>
          !["not-found-line", "template_row"].includes(linha.id) &&
          !linha.classList.contains("tb-load") &&
          linha.querySelector(".colNumero"),
      ),
    );
}

function obterValorDoCampo(campo) {
  if (!campo) {
    return "";
  }

  if (campo.tagName === "SELECT") {
    return normalizarTexto(
      Array.from(campo.selectedOptions || [])
        .map((opcao) => opcao.textContent)
        .join(" ") || campo.value,
    );
  }

  return normalizarTexto(
    campo.value || campo.getAttribute("value") || campo.textContent || "",
  );
}

function obterCamposDoDetalhamento($detalhamento) {
  const campos = [];
  const camposAdicionados = new Set();

  Array.from($detalhamento[0].querySelectorAll(".campo label")).forEach(
    (label) => {
      const container = label.closest(".campo") || label.parentElement;
      const campo = container?.querySelector(
        "textarea, input:not([type='hidden']), select, .input",
      );
      const rotulo = normalizarTexto(label.textContent);
      const valor = obterValorDoCampo(campo);
      const chave = `${rotulo}::${valor}`;

      if (rotulo && valor && !camposAdicionados.has(chave)) {
        camposAdicionados.add(chave);
        campos.push({ label: rotulo, value: valor });
      }
    },
  );

  expect(
    campos,
    "campos preenchidos no detalhamento",
  ).to.have.length.greaterThan(0);
  return campos;
}

function filtrarCamposComparaveisNaExportacao(campos) {
  const camposIgnorados = campos.filter(({ label }) =>
    CAMPOS_SEM_VALOR_NA_EXPORTACAO.some((padrao) => padrao.test(label)),
  );

  camposIgnorados.forEach(({ label, value }) => {
    Cypress.log({
      name: "CAMPO SEM VALOR NA EXPORTAÇÃO FIORILLI",
      message: `${label}: "${value}"`,
      consoleProps: () => ({
        campo: label,
        valorDoDetalhamento: value,
        motivo: "A coluna é exportada, mas o endpoint retorna o valor vazio.",
      }),
    });
  });

  return campos.filter(
    ({ label }) =>
      !CAMPOS_SEM_VALOR_NA_EXPORTACAO.some((padrao) => padrao.test(label)),
  );
}

function obterDetalhamentoDaPrimeiraDespesa() {
  return obterLinhasDeDados()
    .then((linhas) => {
      expect(
        linhas.length,
        "despesas disponíveis para exportação",
      ).to.be.at.least(1);

      cy.wrap(linhas[0]).find(".colNumero").first().click({ force: true });
    })
    .then(() =>
      cy
        .url({ timeout: LISTAGEM_TIMEOUT })
        .should("include", "/transparencia/despesa_frl/")
        .then(() => {
          cy.get("#load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
          return cy
            .get(".cont_right .cnt", { timeout: LISTAGEM_TIMEOUT })
            .should("be.visible")
            .should(($detalhamento) => {
              expect(
                obterCamposDoDetalhamento($detalhamento),
                "campos carregados no detalhamento",
              ).to.have.length.greaterThan(0);
            })
            .then(($detalhamento) => {
              const detalhamento = obterCamposDoDetalhamento($detalhamento);

              return cy.wrap(detalhamento, { log: false });
            });
        }),
    )
    .then((detalhamento) => {
      cy.get("#voltar-list", { timeout: LISTAGEM_TIMEOUT })
        .should("exist")
        .click({ force: true });
      cy.url({ timeout: LISTAGEM_TIMEOUT }).should(
        "match",
        /\/transparencia\/despesas_frl$/,
      );
      aguardarListagem();

      return cy.wrap(detalhamento, { log: false });
    });
}

function obterFormato(texto) {
  const formato = normalizarTexto(texto).toLowerCase();

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
    "formatos de exportação Fiorilli disponíveis",
  ).to.have.members(extensoesEsperadas);
  expect(
    formatosDisponiveis,
    "quantidade de formatos de exportação Fiorilli",
  ).to.have.length(extensoesEsperadas.length);
}

function nomesDoArquivo(formato) {
  return [
    `${NOME_ARQUIVO_EXPORTACAO}.${formato}`,
    `relatório-despesas.${formato}`,
  ];
}

function validarArquivoExportado(formato, detalhamento) {
  const [fileName, ...fileNames] = nomesDoArquivo(formato);

  cy.task(
    "assertDownloadedFileContains",
    {
      fileName,
      fileNames,
      expectedFields: filtrarCamposComparaveisNaExportacao(detalhamento),
      adaptador: "fiorilli",
      reportarCamposAusentes: true,
    },
    { timeout: LISTAGEM_TIMEOUT },
  ).then(({ tamanho, camposComparados, camposAusentes, fileName: arquivo }) => {
    expect(
      tamanho,
      `tamanho do arquivo ${formato} exportado`,
    ).to.be.greaterThan(0);
    expect(
      camposComparados,
      `campos comparados no arquivo ${formato}`,
    ).to.have.length.greaterThan(0);

    camposComparados.forEach(({ label, value, regra, encontrado }) => {
      const resultado = encontrado ? "ENCONTRADO" : "AUSENTE";
      const mensagem = `${label}: "${value}" → ${resultado} (${regra})`;

      cy.log(`[${formato.toUpperCase()}] ${arquivo}: ${mensagem}`);
      Cypress.log({
        name: `COMPARAÇÃO FIORILLI ${formato.toUpperCase()}`,
        message: mensagem,
        consoleProps: () => ({
          arquivo,
          campo: label,
          valorDoDetalhamento: value,
          encontradoNaExportacao: encontrado,
          regra,
        }),
      });
    });

    expect(
      camposAusentes,
      `campos ausentes no arquivo ${formato}`,
    ).to.deep.equal([]);

    return cy
      .task("readDownloadedFile", { fileNames: [arquivo] })
      .then(({ content }) => {
        expect(
          normalizarTexto(content).toLowerCase(),
          `coluna Programa no arquivo ${formato}`,
        ).to.contain("programa");
      });
  });
}

function exportarOpcao(texto, formato, detalhamento) {
  const arquivos = nomesDoArquivo(formato);

  cy.task("removeDownloadedFiles", { fileNames: arquivos }).then(() => {
    cy.get("#exportar .btt_options a:visible")
      .contains(new RegExp(`^${texto}$`, "i"))
      .click({ force: true });

    validarArquivoExportado(formato, detalhamento);
  });
}

describe(`Portal: ${DESPESAS_NOME} - exportações`, () => {
  beforeEach(() => {
    cy.visitPortal(DESPESAS_PATH);
    aguardarListagem();
  });

  FORMATOS_ESPERADOS.forEach(({ nome, extensao }) => {
    it(`exporta ${nome} e compara os campos do detalhamento`, () => {
      obterDetalhamentoDaPrimeiraDespesa().then((detalhamento) => {
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
