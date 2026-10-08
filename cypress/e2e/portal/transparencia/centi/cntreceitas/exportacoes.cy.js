/**
 * Testes das exportações do módulo CNTReceitas da Centi.
 *
 * Cada cenário coleta os campos preenchidos de vários detalhamentos,
 * exporta a listagem em um formato e compara os valores com o arquivo salvo.
 */

// Rota e nome do módulo podem ser substituídos por variáveis de ambiente.
const RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/cntreceitas";
const RECEITAS_NOME = Cypress.env("RECEITAS_NOME") || "cntreceitas";

// Exportações podem demorar para serem geradas e baixadas.
const LISTAGEM_TIMEOUT = 30000;
const POPUP_DETALHES = "#popmov";
const QUANTIDADE_DETALHAMENTOS = 5;

// O backend Centi pode utilizar nomes com ou sem acento no arquivo baixado.
const NOMES_ARQUIVOS_EXPORTACAO = [
  "relatório-receitas",
  "relatorio-receitas",
  "relatório-receita",
  "relatorio-receita",
];

// Formatos disponibilizados pelo menu de exportação do portal.
const FORMATOS_ESPERADOS = [
  { nome: "HTML", extensao: "html" },
  { nome: "CSV", extensao: "csv" },
  { nome: "XLS", extensao: "xls" },
  { nome: "TXT", extensao: "txt" },
  { nome: "JSON", extensao: "json" },
  { nome: "XML", extensao: "xml" },
];

// Nomes usados quando o mês do detalhe é exportado como número.
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

// Remove espaços duplicados e quebras de linha dos textos do DOM.
function normalizarTexto(texto = "") {
  return String(texto).replace(/\s+/g, " ").trim();
}

// Normaliza acentos e caixa para comparar valores entre detalhe e arquivo.
function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Obtém o valor de inputs, textareas, selects ou elementos textuais.
function obterValorDoCampo(campo) {
  if (!campo) return "";

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

// Retorna somente linhas reais da listagem, excluindo template e carregamento.
function obterLinhasDeDados() {
  return cy
    .get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .then(($linhas) =>
      Array.from($linhas).filter(
        (linha) =>
          !["not-found-line", "template_row"].includes(linha.id) &&
          !linha.classList.contains("tb-load") &&
          linha.querySelector(".colNumero, .colDescricao"),
      ),
    );
}

// Aguarda a listagem inicial terminar de carregar.
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

  return cy
    .get(".cont_dados .tb tr[id] .colIcone", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1);
}

// Localiza o campo associado ao label dentro do detalhamento.
function obterEntradaDoCampo(label) {
  const container = label.closest(".campo") || label.parentElement;
  const entrada = container?.querySelector(
    "textarea, input:not([type='hidden']), select",
  );

  if (entrada) return entrada;
  if (label.htmlFor) return label.ownerDocument.getElementById(label.htmlFor);

  return undefined;
}

// Coleta todos os campos preenchidos que aparecem no detalhamento da receita.
function obterCamposDoDetalhamento($popup) {
  const campos = [];
  const chavesAdicionadas = new Set();

  Array.from($popup[0].querySelectorAll("label")).forEach((label) => {
    const campo = obterEntradaDoCampo(label);
    const rotulo = normalizarTexto(label.textContent);
    const valor = obterValorDoCampo(campo);
    const chave = `${rotulo}::${valor}`;

    if (rotulo && valor && !chavesAdicionadas.has(chave)) {
      chavesAdicionadas.add(chave);
      campos.push({ label: rotulo, value: valor });
    }
  });

  expect(campos, "campos preenchidos no detalhamento").to.have.length.greaterThan(
    0,
  );
  return campos;
}

// Abre um registro, coleta seus campos e fecha o detalhamento.
function obterDetalhamentoDaReceita(linha, indice) {
  cy.wrap(linha)
    .find(".colIcone")
    .should("exist")
    .click({ force: true });

  return cy
    .get(POPUP_DETALHES, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($popup) => {
      const campos = obterCamposDoDetalhamento($popup);

      cy.log(
        `[${RECEITAS_NOME}] detalhamento ${indice + 1}: ${campos.length} campo(s) coletado(s)`,
      );
      campos.forEach(({ label, value }) => {
        Cypress.log({
          name: "CAMPO DO DETALHAMENTO",
          message: `Detalhamento ${indice + 1} — ${label}: "${value}"`,
          consoleProps: () => ({
            detalhamento: indice + 1,
            label,
            valor: value,
          }),
        });
      });

      cy.get(`${POPUP_DETALHES} #close`, {
        timeout: LISTAGEM_TIMEOUT,
      }).click({ force: true });
      cy.get(POPUP_DETALHES).should("not.exist");

      return cy.wrap(campos, { log: false });
    });
}

// Coleta vários registros para incluir campos opcionais na validação.
function obterDetalhamentosDasPrimeirasReceitas() {
  return obterLinhasDeDados().then((linhas) => {
    expect(linhas.length, "receitas disponíveis para exportação").to.be.at.least(
      2,
    );

    const linhasSelecionadas = Array.from(linhas).slice(
      0,
      QUANTIDADE_DETALHAMENTOS,
    );
    let cadeiaDeDetalhamentos = cy.wrap([], { log: false });

    linhasSelecionadas.forEach((linha, indice) => {
      cadeiaDeDetalhamentos = cadeiaDeDetalhamentos.then((detalhamentos) =>
        obterDetalhamentoDaReceita(linha, indice).then((campos) => {
          detalhamentos.push(campos);
          return detalhamentos;
        }),
      );
    });

    return cadeiaDeDetalhamentos.then((detalhamentos) => {
      expect(
        detalhamentos.length,
        "detalhamentos coletados para exportação",
      ).to.equal(linhasSelecionadas.length);

      return cy.wrap(detalhamentos, { log: false });
    });
  });
}

// Consolida campos iguais sem descartar valores diferentes de outros registros.
function consolidarCamposDosDetalhamentos(detalhamentos) {
  const camposConsolidados = [];
  const chavesAdicionadas = new Set();

  detalhamentos.flat().forEach((campo) => {
    const chave = `${normalizarParaComparacao(campo.label)}::${normalizarParaComparacao(campo.value)}`;

    if (!chavesAdicionadas.has(chave)) {
      chavesAdicionadas.add(chave);
      camposConsolidados.push(campo);
    }
  });

  expect(
    camposConsolidados,
    "campos consolidados dos detalhamentos",
  ).to.have.length.greaterThan(0);
  return camposConsolidados;
}

// Converte o texto do menu para a extensão usada no download.
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

// Abre o menu Exportar e retorna as opções disponíveis.
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

// Confirma que todos os formatos esperados aparecem no menu.
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

// Remove acentos e converte o mês para o número usado na exportação.
function prepararValorParaExportacao({ label, value }) {
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

  if (
    /valor|previsao|previsão|arrecad|acumulad/.test(labelNormalizado)
  ) {
    return normalizarTexto(value).replace(/^r\$\s*/i, "");
  }

  return value;
}

// Monta a estrutura esperada pela task que lê o arquivo baixado.
function prepararCamposParaExportacao(campos) {
  return campos.map((campo) => ({
    ...campo,
    value: prepararValorParaExportacao(campo),
  }));
}

// Gera os nomes aceitos para o arquivo de cada formato.
function nomesDosArquivos(formato) {
  return NOMES_ARQUIVOS_EXPORTACAO.map((nome) => `${nome}.${formato}`).filter(
    (nome, indice, nomes) => nomes.indexOf(nome) === indice,
  );
}

// Aguarda o arquivo e exige que todos os campos do detalhe estejam presentes.
function validarArquivoExportado(formato, detalhamentos) {
  const nomes = nomesDosArquivos(formato);
  const camposConsolidados = consolidarCamposDosDetalhamentos(detalhamentos);

  cy.task(
    "assertDownloadedFileContains",
    {
      fileName: nomes[0],
      fileNames: nomes.slice(1),
      expectedFields: prepararCamposParaExportacao(camposConsolidados),
      adaptador: "centi",
      reportarCamposAusentes: true,
    },
    { timeout: LISTAGEM_TIMEOUT },
  ).then(({ tamanho, camposComparados, camposAusentes, fileName }) => {
    expect(tamanho, `tamanho do arquivo ${formato} exportado`).to.be.greaterThan(
      0,
    );
    expect(
      camposComparados,
      `campos comparados no arquivo ${formato}`,
    ).to.have.length.greaterThan(0);
    expect(
      camposAusentes.join(", "),
      `campos ausentes no arquivo ${fileName || nomes.join(" ou ")}`,
    ).to.equal("");

    camposComparados.forEach(({ label, value, regra, encontrado }) => {
      cy.log(
        `[${formato.toUpperCase()}] ${label}: "${value}" → ${
          encontrado ? "ENCONTRADO" : "AUSENTE"
        }`,
      );
      Cypress.log({
        name: `COMPARAÇÃO ${formato.toUpperCase()}`,
        message: `${label}: "${value}" (${regra})`,
        consoleProps: () => ({
          arquivo: fileName,
          campo: label,
          valorDoDetalhamento: value,
          encontradoNoArquivo: encontrado,
          regra,
        }),
      });
    });
  });
}

// Limpa downloads antigos, clica no formato e inicia a validação.
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

  // Cada formato é independente para facilitar a identificação de falhas.
  FORMATOS_ESPERADOS.forEach(({ nome, extensao }) => {
    it(`exporta ${nome} e compara todos os campos com o detalhamento`, () => {
      obterDetalhamentosDasPrimeirasReceitas().then((detalhamentos) => {
        obterOpcoesDeExportacao().then((opcoes) => {
          validarFormatosDisponiveis(opcoes);

          const opcao = opcoes.find(
            (texto) => obterFormato(texto) === extensao,
          );
          expect(opcao, `opção ${nome} disponível para exportação`).to.exist;

          exportarOpcao(opcao, extensao, detalhamentos);
        });
      });
    });
  });
});
