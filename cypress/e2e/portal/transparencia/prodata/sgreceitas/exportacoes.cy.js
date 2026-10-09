/**
 * Testes de exportação do módulo SGReceitas da Prodata.
 *
 * Cada cenário filtra uma semana, verifica todos os resultados exibidos,
 * exporta a listagem em um formato e compara os valores com o arquivo baixado.
 */

const SG_RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/sgreceitas";
const SG_RECEITAS_NOME = Cypress.env("RECEITAS_NOME") || "sgreceitas";
const LISTAGEM_TIMEOUT = 60000;
const NOMES_ARQUIVOS_EXPORTACAO = [
  "relatorio-receitas",
  "relatório-receitas",
  "relatorio-receita",
  "relatório-receita",
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

// Converte o período mensal da listagem para o primeiro dia do mês.
function converterPeriodoDaListagem(texto) {
  const valor = normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const mes = MESES.findIndex((nome) =>
    valor.includes(
      nome.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    ),
  );
  const ano = Number(valor.match(/\b20\d{2}\b/)?.[0]);

  expect(mes, `mês válido no período "${texto}"`).to.be.at.least(0);
  expect(ano, `ano válido no período "${texto}"`).to.be.greaterThan(0);
  return new Date(ano, mes, 1);
}

// Formata datas para os campos de período do filtro avançado.
function formatarDataBrasileira(data) {
  return `${String(data.getDate()).padStart(2, "0")}/${String(
    data.getMonth() + 1,
  ).padStart(2, "0")}/${data.getFullYear()}`;
}

// Remove espaços duplicados e quebras de linha dos textos do portal.
function normalizarTexto(texto = "") {
  return String(texto).replace(/\s+/g, " ").trim();
}

// Normaliza acentos e caixa para comparar detalhe e arquivo exportado.
function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Aguarda a listagem e garante que nenhum carregador permaneça visível.
function aguardarListagem() {
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get("body", { timeout: LISTAGEM_TIMEOUT }).should(($body) => {
    expect($body.find(".loader:visible").length, "loader da listagem").to.equal(
      0,
    );
    expect(
      $body.find("#load:visible, .tb-load:visible").length,
      "loader da tabela",
    ).to.equal(0);
  });

  return cy
    .get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter(
      (_, linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        !linha.classList.contains("tb-load") &&
        linha.querySelector("td"),
    )
    .should("have.length.at.least", 1);
}

// Aplica uma janela de sete dias baseada no primeiro período disponível.
function filtrarListagemPorUmaSemana() {
  return aguardarListagem()
    .then(($linhas) => {
      const periodoTexto = Array.from($linhas)
        .map((linha) => normalizarTexto(Cypress.$(linha).find(".col8").text()))
        .find(Boolean);

      expect(periodoTexto, "período disponível para exportação").to.exist;

      const inicio = converterPeriodoDaListagem(periodoTexto);
      const fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);

      return cy.wrap(
        {
          dataInicial: formatarDataBrasileira(inicio),
          dataFinal: formatarDataBrasileira(fim),
        },
        { log: false },
      );
    })
    .then(({ dataInicial, dataFinal }) => {
      cy.get("#busca_avancada", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .click({ force: true });

      cy.get("#periodo_inicial", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(dataInicial, { force: true })
        .should("have.value", dataInicial);
      cy.get("#periodo_final", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(dataFinal, { force: true })
        .should("have.value", dataFinal);

      cy.log(
        `[${SG_RECEITAS_NOME}][exportação] período reduzido: ${dataInicial} a ${dataFinal}`,
      );
      cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .click({ force: true });

      return aguardarListagem();
    });
}

// Coleta todos os campos exibidos em cada resultado da listagem filtrada.
function obterCamposDosResultadosFiltrados() {
  const colunas = [
    ["Natureza", ".colCodigo"],
    ["Órgão", ".colOrgao"],
    ["Descrição", ".colDescricao"],
    ["Previsão Anual", ".col9"],
    ["Arrecadação no Mês", ".col10"],
  ];

  return aguardarListagem().then(($linhas) => {
    const linhas = Array.from($linhas);
    expect(linhas.length, "resultados no período semanal").to.be.greaterThan(1);

    const periodos = linhas.map((linha) =>
      converterPeriodoDaListagem(
        normalizarTexto(Cypress.$(linha).find(".col8").text()),
      ),
    );
    const periodoReferencia = periodos[0];

    periodos.forEach((periodo, indice) => {
      expect(
        periodo.getFullYear(),
        `ano do resultado ${indice + 1}`,
      ).to.equal(periodoReferencia.getFullYear());
      expect(
        periodo.getMonth(),
        `mês do resultado ${indice + 1}`,
      ).to.equal(periodoReferencia.getMonth());
    });

    const campos = linhas.flatMap((linha) =>
      colunas
        .map(([label, seletor]) => ({
          label,
          value: normalizarTexto(Cypress.$(linha).find(seletor).text()),
        }))
        .filter(({ value }) => value),
    );

    expect(campos, "campos dos resultados filtrados").to.have.length.greaterThan(
      0,
    );
    cy.log(
      `[${SG_RECEITAS_NOME}][exportação] ${linhas.length} resultado(s) verificado(s) no período filtrado`,
    );
    return cy.wrap([campos], { log: false });
  });
}

// Consolida os campos sem descartar valores diferentes de outros resultados.
function consolidarCamposDosResultados(resultados) {
  const camposConsolidados = [];
  const chavesAdicionadas = new Set();

  resultados.flat().forEach((campo) => {
    const chave = `${normalizarParaComparacao(campo.label)}::${normalizarParaComparacao(campo.value)}`;

    if (!chavesAdicionadas.has(chave)) {
      chavesAdicionadas.add(chave);
      camposConsolidados.push(campo);
    }
  });

  expect(camposConsolidados, "campos consolidados dos resultados").to.have
    .length.greaterThan(0);
  return camposConsolidados;
}

// Converte o texto do menu para a extensão do arquivo baixado.
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

// Abre o menu de exportação e retorna as opções disponíveis.
function obterOpcoesDeExportacao() {
  cy.get("#exportar", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("button.export, .export")
    .filter(":visible")
    .first()
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#exportar .btt_options a:visible", { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($opcoes) =>
      Array.from($opcoes)
        .map((opcao) => normalizarTexto(opcao.textContent))
        .filter(Boolean),
    );
}

// Confirma que o menu oferece todos os formatos cobertos pelo teste.
function validarFormatosDisponiveis(opcoes) {
  const formatosDisponiveis = opcoes.map(obterFormato);
  const extensoesEsperadas = FORMATOS_ESPERADOS.map(({ extensao }) => extensao);

  expect(formatosDisponiveis, "formatos de exportação disponíveis").to.have
    .members(extensoesEsperadas);
  expect(formatosDisponiveis, "quantidade de formatos de exportação").to.have
    .length(extensoesEsperadas.length);
}

// Ajusta diferenças esperadas entre detalhe e arquivo exportado.
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

  if (/valor|previsao|previsão|arrecad|acumulad/.test(labelNormalizado)) {
    return normalizarTexto(value).replace(/^r\$\s*/i, "");
  }

  return value;
}

// Monta os campos esperados pela task que lê o arquivo baixado.
function prepararCamposParaExportacao(campos) {
  return campos.map((campo) => ({
    ...campo,
    value: prepararValorParaExportacao(campo),
  }));
}

// Gera os nomes possíveis utilizados pelo backend de exportação.
function nomesDosArquivos(formato) {
  return NOMES_ARQUIVOS_EXPORTACAO.map((nome) => `${nome}.${formato}`).filter(
    (nome, indice, nomes) => nomes.indexOf(nome) === indice,
  );
}

// Aguarda o download e verifica todos os campos dos resultados filtrados.
function validarArquivoExportado(formato, resultados) {
  const nomes = nomesDosArquivos(formato);
  const campos = consolidarCamposDosResultados(resultados);

  cy.task(
    "assertDownloadedFileContains",
    {
      fileName: nomes[0],
      fileNames: nomes.slice(1),
      expectedFields: prepararCamposParaExportacao(campos),
      adaptador: "prodata",
      reportarCamposAusentes: true,
      timeoutMs: LISTAGEM_TIMEOUT * 5,
    },
    { timeout: LISTAGEM_TIMEOUT * 5 },
  ).then(({ tamanho, camposComparados, camposAusentes, fileName }) => {
      expect(
        tamanho,
        `tamanho do arquivo ${formato} exportado`,
      ).to.be.greaterThan(0);
      expect(camposComparados, `campos comparados no arquivo ${formato}`).to.have
        .length.greaterThan(0);
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

// Remove downloads antigos, inicia a exportação e valida o arquivo gerado.
function exportarOpcao(texto, formato, resultados) {
  const nomes = nomesDosArquivos(formato);
  const nomesParaLimpeza = nomes.flatMap((nome) => [nome, `${nome}.crdownload`]);

  cy.task("removeDownloadedFiles", { fileNames: nomesParaLimpeza }).then(() => {
    cy.get("#exportar .btt_options a:visible")
      .contains(new RegExp(`^${texto}$`, "i"))
      .click({ force: true });

    validarArquivoExportado(formato, resultados);
  });
}

describe(`Portal Prodata: ${SG_RECEITAS_NOME} - exportações`, () => {
  let resultadosCompartilhados;

  // Coleta os registros uma única vez para evitar repetir cinco navegações por formato.
  before(() => {
    cy.visitPortal(SG_RECEITAS_PATH);
    aguardarListagem();

    filtrarListagemPorUmaSemana()
      .then(() => obterCamposDosResultadosFiltrados())
      .then((resultados) => {
        resultadosCompartilhados = resultados;
      });
  });

  beforeEach(() => {
    cy.visitPortal(SG_RECEITAS_PATH);
    aguardarListagem();
    filtrarListagemPorUmaSemana();
  });

  // Cada formato fica em um teste independente para facilitar o diagnóstico.
  FORMATOS_ESPERADOS.forEach(({ nome, extensao }) => {
    it(`exporta ${nome} e compara os campos de vários resultados filtrados`, () => {
      expect(resultadosCompartilhados, "resultados compartilhados").to
        .exist;

      obterOpcoesDeExportacao().then((opcoes) => {
        validarFormatosDisponiveis(opcoes);

        const opcao = opcoes.find(
          (texto) => obterFormato(texto) === extensao,
        );
        expect(opcao, `opção ${nome} disponível para exportação`).to.exist;

        exportarOpcao(opcao, extensao, resultadosCompartilhados);
      });
    });
  });
});
