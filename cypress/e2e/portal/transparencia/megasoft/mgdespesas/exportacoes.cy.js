// A rota e o nome podem ser sobrescritos para executar o mesmo fluxo em uma
// variação compatível do portal MegaSoft.
const DESPESAS_PATH =
  Cypress.env("DESPESAS_PATH") || "/cidadao/transparencia/mgdespesas";
const DESPESAS_NOME = Cypress.env("DESPESAS_NOME") || "mgdespesas";
const LISTAGEM_TIMEOUT = 60000;
const NOME_ARQUIVO_EXPORTACAO =
  Cypress.env("DESPESAS_EXPORTACAO_NOME") ||
  (DESPESAS_NOME === "sgdespesas"
    ? "relatório-despesas"
    : "relatorio-despesas");

// Cada item gera um it independente. A extensão também define o nome do
// arquivo esperado no diretório configurado em downloadsFolder.
const FORMATOS_ESPERADOS = [
  { nome: "HTML", extensao: "html" },
  { nome: "CSV", extensao: "csv" },
  { nome: "XLS", extensao: "xls" },
  { nome: "TXT", extensao: "txt" },
  { nome: "JSON", extensao: "json" },
  { nome: "XML", extensao: "xml" },
];

function normalizarTexto(texto = "") {
  // Evita que quebras de linha e espaços visuais interfiram na comparação.
  return texto.replace(/\s+/g, " ").trim();
}

function aguardarListagem() {
  // A tabela é carregada por chamadas assíncronas depois da visita à página.
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

function obterLinhasDeDados() {
  // Ignora as linhas de template e de estado vazio para garantir uma despesa
  // real como massa de dados do cenário.
  return cy
    .get(".cont_dados .tb tr[id]")
    .then(($linhas) =>
      Array.from($linhas).filter(
        (linha) =>
          !["not-found-line", "template_row"].includes(linha.id) &&
          !linha.classList.contains("tb-load"),
      ),
    );
}

function obterCamposDoDetalhamento($popup) {
  // Guarda o label e o valor de todos os campos do popup, inclusive os vazios.
  // A comparação posterior considera apenas os valores efetivamente preenchidos.
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

  expect(campos, "campos no detalhamento").to.have.length.greaterThan(0);
  return campos;
}

function obterTextoDaColuna($linha, seletores) {
  for (const seletor of seletores) {
    const $celula = $linha.find(seletor).first();

    if ($celula.length) {
      const texto = normalizarTexto($celula.attr("title") || $celula.text());

      if (texto) return texto;
    }
  }

  return "";
}

function obterCamposDoMovimentoDaListagem($linha) {
  const movimento = obterTextoDaColuna($linha, [
    ".colNomeMovimento",
    ".colMovimento",
    ".colTipoMovimento",
    ".colTipo",
  ]).toLowerCase();
  const descricao = obterTextoDaColuna($linha, [
    ".colDescricao",
    ".colDescrição",
    ".colDesc",
  ]);
  const seletoresDeValor = movimento.includes("liquid")
    ? [".colValorLiquidado", ".colValorLiquidacao", ".colLiquidado"]
    : movimento.includes("pag")
      ? [".colValorPago", ".colValorPagamento", ".colPago"]
      : [".colValorEmpenhado", ".colValorEmpenho", ".colEmpenhado"];
  const valor = obterTextoDaColuna($linha, seletoresDeValor).replace(
    /^[+-]\s*/,
    "",
  );
  const descricaoExportavel = descricao
    .split(/\s+/)
    .slice(0, 8)
    .join(" ");

  return [
    descricaoExportavel.length > 10 && {
      label: "Descrição",
      value: descricaoExportavel,
    },
    valor && { label: "Valor", value: valor },
  ].filter(Boolean);
}

function obterDetalhamentoDaPrimeiraDespesa() {
  // 1. Abre o detalhamento da primeira despesa disponível na listagem.
  let camposDoMovimento = [];

  cy.get(".cont_dados .tb tr[id]")
    .filter(
      (_, linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        !linha.classList.contains("tb-load"),
    )
    .first()
    .then(($linha) => {
      camposDoMovimento = obterCamposDoMovimentoDaListagem($linha);

      // MGDespesas usa a coluna de ícone; SGDespesas usa o número da
      // despesa como gatilho do mesmo popup de detalhamento.
      const $gatilho = $linha.find("td.colIcone, .colNumero").first();

      expect(
        $gatilho.length,
        "gatilho do detalhamento na primeira despesa",
      ).to.equal(1);

      cy.wrap($gatilho).trigger("mousedown", { which: 1, force: true });
    });

  return cy
    .get("body", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .should(($body) => {
      const popupVisivel = $body.find("#popdetalhes:visible").length > 0;
      const paginaDeDetalhamento = $body.find("#orgao:visible").length > 0;
      const $detalhamento = $body.find("#popdetalhes:visible").length
        ? $body.find("#popdetalhes:visible")
        : $body;

      expect(
        popupVisivel || paginaDeDetalhamento,
        "detalhamento carregado",
      ).to.equal(true);
      expect(
        obterCamposDoDetalhamento($detalhamento),
        "campos carregados no detalhamento",
      ).to.have.length.greaterThan(0);
    })
    .then(($body) => {
      const $popup = $body.find("#popdetalhes:visible");
      const $detalhamento = $popup.length ? $popup : $body;
      const camposDoDetalhamento = obterCamposDoDetalhamento($detalhamento);
      const camposExportados = $popup.length
        ? camposDoDetalhamento
        : camposDoDetalhamento.filter(
            ({ label }) =>
              !/^(descrição\s*\/\s*histórico|valor empenhado)$/i.test(label),
          );

      expect(
        camposExportados,
        "campos carregados no detalhamento",
      ).to.have.length.greaterThan(0);

      // O popup pode aparecer antes de seus campos terminarem de carregar;
      // a coleta ocorre somente após os labels existirem.
      const detalhamento = [...camposExportados, ...camposDoMovimento];

      // 2. Fecha o popup ou retorna da página de detalhe e deixa a tela
      // pronta para a exportação.
      if ($popup.length) {
        cy.get("#popdetalhes #close").click({ force: true });
        cy.get("#popdetalhes").should("not.exist");
      } else {
        cy.visitPortal(DESPESAS_PATH);
        aguardarListagem();
      }

      return cy.wrap(detalhamento, { log: false });
    });
}

function obterFormato(texto) {
  // Converte o texto mostrado no menu para a extensão usada no download.
  const formato = normalizarTexto(texto).toLowerCase();

  if (formato.includes("csv")) return "csv";
  if (formato.includes("pdf")) return "pdf";
  if (formato.includes("txt")) return "txt";
  if (formato.includes("excel") || formato.includes("xls")) return "xls";
  if (formato.includes("json")) return "json";
  if (formato.includes("xml")) return "xml";
  if (formato.includes("html")) return "html";

  return "arquivo";
}

function obterOpcoesDeExportacao() {
  // Abre o botão e captura os formatos realmente disponibilizados pelo portal.
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
  // Garante que existe um it correspondente para cada formato encontrado.
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
  // O task Node abre o arquivo, espera seu download terminar e compara todos
  // os valores preenchidos do detalhamento com o conteúdo exportado.
  cy.task(
    "assertDownloadedFileContains",
    {
      fileName: `${NOME_ARQUIVO_EXPORTACAO}.${formato}`,
      expectedFields: detalhamento,
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

    // Mostra no painel do cy:open o resultado individual de cada comparação.
    cy.log(
      `[${formato.toUpperCase()}] arquivo aberto: ${NOME_ARQUIVO_EXPORTACAO}.${formato}`,
    );
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
  // 3. Seleciona somente o formato deste it.
  cy.task("removeDownloadedFiles", {
    fileNames: [`${NOME_ARQUIVO_EXPORTACAO}.${formato}`],
  }).then(() => {
    cy.get("#exportar .btt_options a:visible")
      .contains(new RegExp(`^${texto}$`, "i"))
      .click({ force: true });
    validarArquivoExportado(formato, detalhamento);
  });

  // 4 e 5. O arquivo foi aberto e comparado antes de o it ser concluído.
  cy.log(`[${DESPESAS_NOME}] arquivo ${formato} exportado`);
}

describe(`Portal: ${DESPESAS_NOME} - exportações`, () => {
  beforeEach(() => {
    // Cada formato começa com uma visita nova para manter os its isolados.
    cy.visitPortal(DESPESAS_PATH);
    aguardarListagem();
  });

  FORMATOS_ESPERADOS.forEach(({ nome, extensao }) => {
    // A criação dos its é síncrona; a descoberta dos dados e a exportação
    // acontecem somente durante a execução de cada teste.
    it(`exporta ${nome} e compara todos os campos com o detalhamento`, () => {
      // 1. Acessa a primeira despesa e guarda todos os campos do detalhamento.
      obterLinhasDeDados().then((linhas) => {
        expect(
          linhas.length,
          "despesas disponíveis para exportação",
        ).to.be.at.least(1);
      });

      obterDetalhamentoDaPrimeiraDespesa().then((detalhamento) => {
        // 2. Fecha o detalhamento e retorna à listagem antes da consulta.
        obterOpcoesDeExportacao().then((opcoes) => {
          validarFormatosDisponiveis(opcoes);

          const opcao = opcoes.find(
            (texto) => obterFormato(texto) === extensao,
          );
          expect(opcao, `opção ${nome} disponível para exportação`).to.exist;

          // 3 a 5. Baixa, abre e compara o formato deste it.
          exportarOpcao(opcao, extensao, detalhamento);
        });
      });
    });
  });
});
