/**
 * Exportações do módulo Centi CNTDespesas.
 *
 * Cada cenário captura os dados do primeiro empenho real, exporta um formato
 * e confirma que o arquivo contém os mesmos valores exibidos no detalhe.
 * DESPESAS_PATH e DESPESAS_NOME podem ser sobrescritos pelo ambiente.
 */

const DESPESAS_PATH =
  Cypress.env("DESPESAS_PATH") || "/cidadao/transparencia/cntdespesas";
const DESPESAS_NOME = Cypress.env("DESPESAS_NOME") || "cntdespesas";
const LISTAGEM_TIMEOUT = 30000;
const POPUP_DETALHES = "#pop_detalhes";
const NOME_ARQUIVO_EXPORTACAO = "relatório-despesas";

// IDs dos campos usados pelo detalhe do adaptador Centi. Alguns portais
// podem não preencher todos eles em um mesmo empenho; por isso a coleta só
// inclui os campos existentes e com valor.
const CAMPOS_CENTI = [
  { seletor: "#data", rotulo: "Data" },
  { seletor: "#orgao", rotulo: "Órgão" },
  { seletor: "#cpf_cnpj", rotulo: "CPF/CNPJ" },
  { seletor: "#empenho", rotulo: "Empenho" },
  { seletor: "#saldo_pagar", rotulo: "Saldo a Pagar" },
  { seletor: "#valor_empenhado", rotulo: "Valor empenhado" },
  { seletor: "#liquidacao", rotulo: "Valor liquidado" },
  { seletor: "#pagamento", rotulo: "Valor pago" },
  { seletor: "#licitacao", rotulo: "Licitação" },
  { seletor: "#destinacao_recurso", rotulo: "Destinação do Recurso" },
  { seletor: "#acao", rotulo: "Ação" },
  { seletor: "#unidade", rotulo: "Unidade" },
  { seletor: "#funcao", rotulo: "Função" },
  { seletor: "#subfuncao", rotulo: "Subfunção" },
  { seletor: "#programa", rotulo: "Programa" },
  { seletor: "#fonte", rotulo: "Fonte" },
  { seletor: "#categoria", rotulo: "Categoria econômica" },
  { seletor: "#grupo", rotulo: "Grupo" },
  { seletor: "#modalidade", rotulo: "Modalidade de aplicação" },
  { seletor: "#elemento", rotulo: "Elemento" },
  { seletor: "#subelemento", rotulo: "Subelemento" },
];

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

function aguardarListagem() {
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
          !linha.classList.contains("tb-load"),
      ),
    );
}

function obterValorDoCampo(campo) {
  if (campo?.tagName === "SELECT") {
    return normalizarTexto(
      Array.from(campo.selectedOptions || [])
        .map((opcao) => opcao.textContent)
        .join(" ") || campo.value,
    );
  }

  return normalizarTexto(
    campo?.value || campo?.getAttribute("value") || campo?.textContent || "",
  );
}

function obterRotuloDoCampo(campo, rotuloPadrao) {
  const container = campo.closest(".campo") || campo.parentElement;
  const label = container?.querySelector("label");

  return normalizarTexto(label?.textContent || rotuloPadrao);
}

function obterEntradaDoCampo(label) {
  const container = label.closest(".campo") || label.parentElement;
  const entradaNoContainer = container?.querySelector(
    "textarea, input:not([type='hidden']), select",
  );

  if (entradaNoContainer) {
    return entradaNoContainer;
  }

  if (label.htmlFor) {
    return label.ownerDocument.getElementById(label.htmlFor);
  }

  return undefined;
}

function obterCamposDoDetalhamento($popup) {
  const campos = [];
  const camposAdicionados = new Set();

  function adicionarCampo(campo, rotuloPadrao) {
    if (!campo) return;

    const valor = obterValorDoCampo(campo);
    const rotulo = obterRotuloDoCampo(campo, rotuloPadrao);
    const chave = `${rotulo}::${valor}`;

    if (rotulo && valor && !camposAdicionados.has(chave)) {
      camposAdicionados.add(chave);
      campos.push({ label: rotulo, value: valor });
    }
  }

  // Primeiro lê os campos conhecidos do contrato HTML da Centi, mantendo a
  // ordem funcional apresentada nos demais testes do adaptador.
  CAMPOS_CENTI.forEach(({ seletor, rotulo }) => {
    adicionarCampo($popup[0].querySelector(seletor), rotulo);
  });

  // Captura também campos textuais que existam no detalhe, mas não tenham um
  // ID estável no portal, como observações ou informações complementares.
  Array.from($popup[0].querySelectorAll(".campo label")).forEach((label) => {
    adicionarCampo(obterEntradaDoCampo(label), label.textContent);
  });

  expect(campos, "campos no detalhamento").to.have.length.greaterThan(0);
  return campos;
}

function obterDetalhamentoDaPrimeiraDespesa() {
  return obterLinhasDeDados()
    .then((linhas) => {
      expect(
        linhas.length,
        "despesas disponíveis para exportação",
      ).to.be.at.least(1);

      const $linha = Cypress.$(linhas[0]);
      const $controleDetalhes = $linha.find(
        ".icon-file, td.colIcone, .colNumero",
      );

      expect(
        $controleDetalhes.length,
        "controle para abrir o detalhamento",
      ).to.be.greaterThan(0);
      cy.wrap($controleDetalhes.first()).click({ force: true });
    })
    .then(() =>
      cy
        .get(POPUP_DETALHES, { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .should(($popup) => {
          expect(
            obterCamposDoDetalhamento($popup),
            "campos carregados no detalhamento",
          ).to.have.length.greaterThan(0);
        })
        .then(($popup) => {
          const detalhamento = obterCamposDoDetalhamento($popup);

          cy.get(`${POPUP_DETALHES} #close`, {
            timeout: LISTAGEM_TIMEOUT,
          }).click({ force: true });
          cy.get(POPUP_DETALHES).should("not.exist");

          return cy.wrap(detalhamento, { log: false });
        }),
    );
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
    "formatos de exportação disponíveis",
  ).to.have.members(extensoesEsperadas);
  expect(
    formatosDisponiveis,
    "quantidade de formatos de exportação",
  ).to.have.length(extensoesEsperadas.length);
}

function validarArquivoExportado(formato, detalhamento) {
  cy.task(
    "assertDownloadedFileContains",
    {
      fileName: `${NOME_ARQUIVO_EXPORTACAO}.${formato}`,
      expectedFields: detalhamento,
      adaptador: "centi",
    },
    { timeout: LISTAGEM_TIMEOUT },
  ).then(({ tamanho, camposComparados }) => {
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

      cy.log(`[${formato.toUpperCase()}] ${mensagem}`);
      Cypress.log({
        name: `COMPARAÇÃO ${formato.toUpperCase()}`,
        message: mensagem,
        consoleProps: () => ({
          arquivo: `${NOME_ARQUIVO_EXPORTACAO}.${formato}`,
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
  cy.get("#exportar .btt_options a:visible")
    .contains(new RegExp(`^${texto}$`, "i"))
    .click({ force: true });

  validarArquivoExportado(formato, detalhamento);
  cy.log(`[${DESPESAS_NOME}] arquivo ${formato} exportado`);
}

describe(`Portal: ${DESPESAS_NOME} - exportações`, () => {
  beforeEach(() => {
    cy.visitPortal(DESPESAS_PATH);
    aguardarListagem();
  });

  FORMATOS_ESPERADOS.forEach(({ nome, extensao }) => {
    it(`exporta ${nome} e compara todos os campos com o detalhamento`, () => {
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
