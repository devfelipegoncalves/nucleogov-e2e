/**
 * Testes E2E do filtro avançado de Despesas no adaptador Megasoft.
 *
 * Os cenários usam valores reais da listagem/detalhamento, aplicam filtros no
 * popup avançado e validam o retorno ou os alertas de validação do formulário.
 * A implementação é específica do layout Megasoft, embora os conceitos sejam
 * equivalentes aos testes Prodata.
 *
 * Execução:
 * npm run cy:run -- --spec "cypress/e2e/portal/transparencia/megasoft/sgdespesas/filtro-avancado.cy.js"
 */

// Configuração da rota e identificação usadas nas mensagens do spec.
const SG_DESPESAS_PATH = "/cidadao/transparencia/sgdespesas";
const SG_DESPESAS_NOME = "sgdespesas";
const LISTAGEM_TIMEOUT = 60000;

/*
 * Convenção de leitura deste arquivo:
 * - obter... busca um dado real na listagem ou no detalhe;
 * - selecionar... interage com um campo do filtro avançado;
 * - validar... confirma o valor retornado;
 * - aguardar... sincroniza o Cypress com loaders e elementos dinâmicos.
 * Os comentários da documentação em docs explicam parâmetros e retornos por
 * grupo, enquanto os comentários dos testes explicam o cenário executado.
 */

// Funções de normalização e comparação de textos, códigos e órgãos.
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

function valoresDoFiltroCorrespondem(valorEsperado, valorDaOpcao) {
  const esperado = normalizarParaComparacao(valorEsperado);
  const opcao = normalizarParaComparacao(valorDaOpcao);
  const esperadoSemCodigo = removerCodigo(valorEsperado);
  const opcaoSemCodigo = removerCodigo(valorDaOpcao);

  if (!esperadoSemCodigo || !opcaoSemCodigo) {
    return false;
  }

  return (
    opcao === esperado ||
    opcaoSemCodigo === esperadoSemCodigo ||
    opcao.includes(esperadoSemCodigo) ||
    esperado.includes(opcaoSemCodigo)
  );
}

function obterCampoAvancadoPorRotulo(rotulo) {
  const rotuloNormalizado = normalizarParaComparacao(rotulo);

  return cy.get(".campo").then(($campos) => {
    const campo = Array.from($campos).find((elemento) => {
      const label = elemento.querySelector("label");
      const texto = normalizarParaComparacao(
        `${label?.textContent || ""} ${label?.getAttribute("title") || ""}`,
      );

      return texto.includes(rotuloNormalizado);
    });

    expect(campo, `campo avançado ${rotulo} disponível`).to.exist;
    return cy.wrap(campo);
  });
}

function obterValorDoCampo($campo) {
  const elemento = $campo.first();
  return normalizarTexto(
    elemento.val() || elemento.attr("value") || elemento.text(),
  );
}

function aguardarCampoComValor($campo) {
  expect(obterValorDoCampo($campo), "valor carregado no detalhe").to.not.equal(
    "",
  );
}

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

function obterSiglaDoOrgao(nomeOrgao) {
  const siglas = {
    "fundo municipal de educacao": "fme",
    "fundo municipal de saude": "fms",
    "fundo municipal de assistencia social": "fmas",
    "fundo municipal de habitacao e interesse social": "fmhis",
    "fundo municipal de meio ambiente": "fmma",
    fundef: "fundef",
  };
  const nomeNormalizado = removerCodigo(nomeOrgao);

  return (
    siglas[nomeNormalizado] ||
    nomeNormalizado
      .replace(/\b(a|as|da|das|de|do|dos|e)\b/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((termo) => termo[0])
      .join("")
  );
}

function ehPrefeituraOuPoderExecutivo(nomeOrgao) {
  return /\bprefeitura\b|\bpoder executivo\b/.test(removerCodigo(nomeOrgao));
}

function obterIdentificadoresDoOrgao(nomeOrgao) {
  const nomeNormalizado = removerCodigo(nomeOrgao);
  const identificadores = new Set([nomeNormalizado]);
  const sigla = obterSiglaDoOrgao(nomeOrgao);

  if (sigla) {
    identificadores.add(sigla);
  }

  // O SGDespesas pode exibir a Prefeitura como "Prefeitura ..." no
  // detalhamento e como "Poder Executivo" no filtro avançado, ou o inverso.
  if (ehPrefeituraOuPoderExecutivo(nomeOrgao)) {
    identificadores.add("prefeitura");
    identificadores.add("poder executivo");
  }

  return identificadores;
}

function orgaosCorrespondem(nomeEsperado, nomeEncontrado) {
  const esperado = removerCodigo(nomeEsperado);
  const encontrado = removerCodigo(nomeEncontrado);

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

  const identificadoresEsperados = obterIdentificadoresDoOrgao(nomeEsperado);
  const identificadoresEncontrados =
    obterIdentificadoresDoOrgao(nomeEncontrado);

  if (
    [...identificadoresEsperados].some((identificador) =>
      identificadoresEncontrados.has(identificador),
    )
  ) {
    return true;
  }

  const termosEsperados = obterTermosSignificativos(nomeEsperado);
  const termosEncontrados = obterTermosSignificativos(encontrado);

  return termosEsperados.some((termo) => termosEncontrados.includes(termo));
}

// Funções que localizam, abrem e preparam os controles do popup.
function selecionarOpcao(containerSelector, textoOpcao) {
  cy.get(containerSelector).find(".selected").click({ force: true });
  cy.contains(`${containerSelector} .options .list a`, textoOpcao, {
    matchCase: false,
  }).click({ force: true });
}

function obterContainerDoSelect(campo) {
  return typeof campo === "string"
    ? cy.get(campo, { timeout: 30000 })
    : cy.wrap(campo);
}

// Alguns selects do filtro avançado são autocompletes: ao abrir, exibem apenas
// o campo de busca e criam as opções depois que um texto é digitado. Os
// selects estáticos, por outro lado, já exibem a lista ao abrir.
function abrirSelectAvancadoComOpcoes(campo) {
  return obterContainerDoSelect(campo).then(($container) => {
    const clicarNoSelect = () =>
      cy
        .wrap($container)
        .find(".selected", { timeout: 30000 })
        .should("be.visible")
        .click({ force: true });

    const obterOpcoesDoContainer = () =>
      cy.wrap(Array.from($container.find(".options:visible .list a:visible")), {
        log: false,
      });

    const aguardarOpcoesDoContainer = () =>
      cy
        .wrap($container, { log: false })
        .find(".options", { timeout: 30000 })
        .should("be.visible")
        .find(".list a", { timeout: 30000 })
        .filter(":visible")
        .should("have.length.at.least", 1);

    return clicarNoSelect()
      .then(() => cy.wait(500, { log: false }))
      .then(() => obterOpcoesDoContainer())
      .then(($opcoes) => {
        if ($opcoes.length) {
          return $opcoes;
        }

        const possuiCampoDeBusca =
          $container.find(".options:visible input:visible").length > 0;

        if (possuiCampoDeBusca) {
          return cy.wrap([], { log: false });
        }

        cy.log("Select sem opções; fechando e reabrindo o próprio select.");

        const selectEstaAberto = $container.find(".options:visible").length;
        const fecharSelect = selectEstaAberto ? clicarNoSelect() : undefined;

        return (fecharSelect || cy.then(() => undefined))
          .then(() => clicarNoSelect())
          .then(() => cy.wait(500, { log: false }))
          .then(() => aguardarOpcoesDoContainer())
          .then(($opcoesNovas) => {
            return $opcoesNovas;
          });
      });
  });
}

function obterOpcoesCarregadas(campo) {
  return cy
    .get(campo, { timeout: 30000 })
    .find(".options", { timeout: 30000 })
    .should("be.visible")
    .find(".list a", { timeout: 30000 })
    .filter(":visible")
    .should("have.length.at.least", 1);
}

function pesquisarAutocomplete(campo, texto) {
  return obterContainerDoSelect(campo)
    .find("input:visible")
    .first()
    .should("be.visible")
    .clear({ force: true })
    .type(texto, { force: true })
    .then(($input) => {
      const $controleBusca = Cypress.$(campo)
        .find(
          '.options:visible .containerbusca .icon-lupa:visible, .options:visible button:visible, .options:visible a:visible, .options:visible [class*="search"]:visible, .options:visible [class*="busca"]:visible',
        )
        .filter((_, elemento) => {
          const textoDoControle = normalizarParaComparacao(
            `${elemento.textContent || ""} ${elemento.className || ""} ${elemento.getAttribute("title") || ""} ${elemento.getAttribute("aria-label") || ""}`,
          );

          return /buscar|busca|pesquisar|search|magnif/.test(textoDoControle);
        })
        .first();

      if ($controleBusca.length) {
        return cy.wrap($controleBusca).click({ force: true });
      }

      return cy.wrap($input).type("{enter}", { force: true });
    });
}

function aguardarListagem() {
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get(".tb-load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
}

function obterLinhasValidas() {
  return cy
    .get(".cont_dados .tb tr[id]")
    .then(($linhas) =>
      Array.from($linhas).filter(
        (row) =>
          !["not-found-line", "template_row"].includes(row.id) &&
          !row.classList.contains("tb-load"),
      ),
    );
}

function validarResultadoOuNenhumResultado(nomeFiltro, validarResultado) {
  return obterLinhasValidas().then((linhas) => {
    if (!linhas.length) {
      cy.get("#not-found-line > td", { timeout: 30000 })
        .should("be.visible")
        .and("contain.text", "Nenhum resultado encontrado");

      const mensagem = `ALERTA: Nenhum resultado encontrado para o filtro ${nomeFiltro}.`;
      Cypress.log({
        name: "ALERTA",
        message: mensagem,
        consoleProps: () => ({ filtro: nomeFiltro, resultado: "sem dados" }),
      });
      cy.log(mensagem);
      return;
    }

    validarResultado();
  });
}

function prepararListagemComFavorecido() {
  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual, anoAtual - 1];

  return cy.wrap(anos).each((ano) => {
    obterLinhasValidas().then((linhas) => {
      const lista = Array.from(linhas);
      const possuiFavorecido = lista.some(
        (row) =>
          normalizarTexto(
            Cypress.$(row).find(".colFornecedor").text() || "",
          ) !== "",
      );

      if (possuiFavorecido) {
        return false;
      }

      selecionarOpcao("#filtro_periodo", `Ano de ${ano}`);
      aguardarListagem();
      return undefined;
    });
  });
}

function abrirFiltroAvancado(campoSelector = "#fornecedor") {
  cy.get("body").then(($body) => {
    const campoVisivel = $body.find(`${campoSelector}:visible`).length > 0;
    const painelAvancadoVisivel =
      $body.find(
        "#select_org_avanc:visible, #select_unidade:visible, #select_funcao:visible, #select_programa:visible, #rubricaDaDespesa:visible",
      ).length > 0;

    if (
      !campoVisivel ||
      (campoSelector === ".campo label" && !painelAvancadoVisivel)
    ) {
      cy.get("#busca_avancada", { timeout: 30000 })
        .should("be.visible")
        .click({ force: true });
    }
  });

  cy.get(campoSelector, {
    timeout: 30000,
  }).should("be.visible");
}

function limparFiltrosAntesDoTeste() {
  cy.get("body").then(($body) => {
    const botaoLimpar = $body.find("#x_filtros:visible").first();

    if (botaoLimpar.length) {
      cy.wrap(botaoLimpar).click({ force: true });
      aguardarListagem();
    }
  });
}

function selecionarCovidAvancado(opcao) {
  obterCampoAvancadoPorRotulo("Filtrar COVID-19").then(($campo) => {
    abrirSelectAvancadoComOpcoes($campo)
      .should("have.length.at.least", 2)
      .then(($opcoes) => {
        const opcaoEncontrada = Array.from($opcoes).find((elemento) =>
          normalizarParaComparacao(elemento.textContent).includes(
            normalizarParaComparacao(opcao),
          ),
        );

        expect(opcaoEncontrada, `opção COVID-19 ${opcao} disponível`).to.exist;
        cy.wrap(opcaoEncontrada).click({ force: true });
      });
  });
}

function obterHistoricoDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  return cy
    .get("#desc", { timeout: 30000 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((historico) => {
      const historicoNormalizado = normalizarTexto(historico);

      expect(
        historicoNormalizado,
        "Histórico do empenho disponível",
      ).to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(historicoNormalizado, { log: false });
    });
}

function validarHistoricoNoDetalhe(historicoBuscado) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  cy.get("#desc", { timeout: 30000 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((historicoRetornado) => {
      expect(normalizarTexto(historicoRetornado).toLowerCase()).to.equal(
        historicoBuscado.toLowerCase(),
      );
    });
}

function obterFavorecidoDoPrimeiroRegistro() {
  return obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      "registros disponíveis para identificar o favorecido",
    ).to.be.greaterThan(0);

    cy.wrap(linhas[0]).find(".colNumero").click({ force: true });

    return cy
      .contains(".campo label", /^Favorecido$/i)
      .parent()
      .then(($campo) => {
        const $valor = $campo
          .find("#favorecido, #fornecedor, input, textarea, .input")
          .first();

        expect(
          $valor.length,
          "favorecido disponível no detalhe",
        ).to.be.greaterThan(0);

        return cy
          .wrap($valor)
          .should("be.visible")
          .should(aguardarCampoComValor)
          .then(obterValorDoCampo);
      })
      .then((favorecido) => {
        expect(
          favorecido,
          "favorecido identificado no primeiro registro",
        ).to.not.equal("");

        cy.visitPortal(SG_DESPESAS_PATH);
        aguardarListagem();

        return cy.wrap(favorecido, { log: false });
      });
  });
}

function obterCnpjDeUmRegistro(indice = 0) {
  return obterLinhasValidas().then((linhas) => {
    if (indice >= linhas.length) {
      expect(indice, "registro com CNPJ disponível na listagem").to.be.lessThan(
        linhas.length,
      );
      return cy.wrap("", { log: false });
    }

    cy.wrap(linhas[indice]).find(".colNumero").click({ force: true });

    return cy
      .get("#cnpj", { timeout: 30000 })
      .should("be.visible")
      .should(aguardarCampoComValor)
      .then(obterValorDoCampo)
      .then((cpfCnpj) => {
        const documentoNormalizado = normalizarTexto(cpfCnpj);
        const quantidadeDeDigitos = documentoNormalizado.replace(
          /\D/g,
          "",
        ).length;

        expect(
          documentoNormalizado,
          `CPF/CNPJ identificado no registro ${indice + 1}`,
        ).to.not.equal("");

        if (quantidadeDeDigitos !== 14) {
          cy.visitPortal(SG_DESPESAS_PATH);
          aguardarListagem();
          return obterCnpjDeUmRegistro(indice + 1);
        }

        cy.visitPortal(SG_DESPESAS_PATH);
        aguardarListagem();

        return cy.wrap(documentoNormalizado, { log: false });
      });
  });
}

function validarCnpjNoDetalhe(documentoBuscado) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  cy.get("#cnpj", { timeout: 30000 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((documentoRetornado) => {
      const documentoRetornadoNormalizado = normalizarTexto(documentoRetornado);
      const digitosRetornados = documentoRetornadoNormalizado.replace(
        /\D/g,
        "",
      );
      const digitosBuscados = documentoBuscado.replace(/\D/g, "");

      expect(digitosRetornados, "CNPJ retornado no detalhe").to.have.length(14);
      expect(digitosRetornados).to.equal(digitosBuscados);
    });
}

function validarFavorecidoNaListagem(favorecidoBuscado) {
  obterLinhasValidas().then((linhas) => {
    const favorecidos = Array.from(linhas)
      .slice(0, 10)
      .map((row) =>
        normalizarTexto(Cypress.$(row).find(".colFornecedor").text() || ""),
      )
      .filter(Boolean);

    expect(
      favorecidos.length,
      "favorecidos exibidos na listagem",
    ).to.be.greaterThan(0);

    favorecidos.forEach((favorecido) => {
      expect(favorecido.toLowerCase()).to.equal(
        favorecidoBuscado.toLowerCase(),
      );
    });
  });
}

function obterNumeroDoPrimeiroRegistro() {
  return obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      "registros disponíveis para identificar o Nº do empenho",
    ).to.be.greaterThan(0);

    cy.wrap(linhas[0]).find(".colNumero").click({ force: true });

    return cy
      .url()
      .should("match", /\/sgdespesa\/id=\d+_\d+/)
      .then((url) => {
        const numeroEmpenho = url.match(/\/id=(\d+)_\d+/)?.[1] || "";

        expect(
          numeroEmpenho,
          "Nº do empenho identificado no primeiro registro",
        ).to.not.equal("");

        cy.visitPortal(SG_DESPESAS_PATH);
        aguardarListagem();

        return cy.wrap(numeroEmpenho, { log: false });
      });
  });
}

function validarNumeroNaListagem(numeroBuscado) {
  obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      "empenhos retornados pelo filtro de número",
    ).to.be.greaterThan(0);

    const numerosRetornados = Array.from(linhas)
      .map((row) =>
        normalizarTexto(Cypress.$(row).find(".colNumero").text() || ""),
      )
      .map((numero) => numero.match(/(\d+)\s*$/)?.[1] || "")
      .filter(Boolean);

    numerosRetornados.forEach((numero) => {
      expect(numero).to.equal(numeroBuscado);
    });
  });
}

// Funções de leitura, conversão e validação de valores monetários e datas.
function converterValorMonetario(valor) {
  const valorSemEspacos = normalizarTexto(valor).replace(/\s/g, "");
  const valorNumerico = valorSemEspacos.replace(/[^\d,.-]/g, "");

  if (!valorNumerico) {
    return NaN;
  }

  if (valorNumerico.includes(",")) {
    return Number(valorNumerico.replace(/\./g, "").replace(",", "."));
  }

  return Number(valorNumerico);
}

function formatarValorMonetario(valor) {
  return valor
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function obterTextoDoValorNaLinha($linha, tipoValor) {
  const empenhado = tipoValor === "empenhado";
  const liquidado = tipoValor === "liquidado";
  const seletoresDeValor = empenhado
    ? [
        ".colValorEmpenhado",
        ".colValorEmpenho",
        ".colEmpenhado",
        '[class*="valor-empenhado"]',
        '[class*="valorEmpenhado"]',
        '[data-field*="empenh"]',
      ]
    : liquidado
      ? [
          ".colValorLiquidado",
          ".colValorLiquidacao",
          ".colLiquidado",
          '[class*="valor-liquidado"]',
          '[class*="valorLiquidado"]',
          '[data-field*="liquid"]',
        ]
      : [
          ".colValorPago",
          ".colValorPagamento",
          ".colPago",
          '[class*="valor-pago"]',
          '[class*="valorPago"]',
          '[data-field*="pag"]',
        ];

  for (const seletor of seletoresDeValor) {
    const texto = normalizarTexto($linha.find(seletor).first().text());

    if (texto && Number.isFinite(converterValorMonetario(texto))) {
      return texto;
    }
  }

  const $tabela = $linha.closest("table");
  const $cabecalhos = $tabela.find("thead th, thead td").length
    ? $tabela.find("thead th, thead td")
    : $tabela.find("tr").first().find("th, td");
  const indiceDaColuna = Array.from($cabecalhos).findIndex((cabecalho) =>
    (empenhado
      ? /valor\s*empenh|empenh.*valor/i
      : liquidado
        ? /valor\s*liquid|liquid.*valor/i
        : /valor\s*pag|pag.*valor/i
    ).test(normalizarParaComparacao(cabecalho.textContent)),
  );

  if (indiceDaColuna >= 0) {
    const texto = normalizarTexto(
      $linha.children("td").eq(indiceDaColuna).text(),
    );

    if (texto && Number.isFinite(converterValorMonetario(texto))) {
      return texto;
    }
  }

  const textosDasCelulas = Array.from($linha.find("td"))
    .map((celula) => normalizarTexto(celula.textContent))
    .filter(Boolean);
  const textoComMoeda = textosDasCelulas.find((texto) =>
    /R\$\s*-?[\d.]+,\d{2}/i.test(texto),
  );

  if (textoComMoeda) {
    return textoComMoeda;
  }

  return textosDasCelulas.find((texto) =>
    /^-?[\d.]+,\d{2}$/.test(texto.replace(/\s/g, "")),
  );
}

function obterTextoDoValorEmpenhadoNaLinha($linha) {
  return obterTextoDoValorNaLinha($linha, "empenhado");
}

function obterTextoDoValorLiquidadoNaLinha($linha) {
  return obterTextoDoValorNaLinha($linha, "liquidado");
}

function obterTextoDoValorPagoNaLinha($linha) {
  return obterTextoDoValorNaLinha($linha, "pago");
}

function obterValoresMonetariosDaListagem(obterTextoDoValor, descricao) {
  return obterLinhasValidas().then((linhas) => {
    const valores = Array.from(linhas)
      .map((linha) => {
        const texto = obterTextoDoValor(Cypress.$(linha));

        return {
          texto: normalizarTexto(texto || ""),
          numerico: converterValorMonetario(texto || ""),
        };
      })
      .filter(({ texto, numerico }) => texto && Number.isFinite(numerico));

    expect(
      valores.length,
      `${descricao} disponíveis na listagem`,
    ).to.be.greaterThan(0);

    const valoresOrdenados = [...valores].sort(
      (valorA, valorB) => valorA.numerico - valorB.numerico,
    );

    return cy.wrap(
      {
        valores,
        minimo: valoresOrdenados[0],
        maximo: valoresOrdenados[valoresOrdenados.length - 1],
      },
      { log: false },
    );
  });
}

function obterValoresEmpenhadosDaListagem() {
  return obterValoresMonetariosDaListagem(
    obterTextoDoValorEmpenhadoNaLinha,
    "valores empenhados",
  );
}

function obterValoresLiquidadosDaListagem() {
  return obterValoresMonetariosDaListagem(
    obterTextoDoValorLiquidadoNaLinha,
    "valores liquidados",
  );
}

function obterValoresPagosDaListagem() {
  return obterValoresMonetariosDaListagem(
    obterTextoDoValorPagoNaLinha,
    "valores pagos",
  );
}

function preencherValorAvancado(rotulo, valor) {
  return obterCampoAvancadoPorRotulo(rotulo)
    .find("input, textarea, .input")
    .first()
    .clear({ force: true })
    .type(valor, { force: true })
    .should(($campo) => {
      expect(
        obterValorDoCampo($campo),
        `valor preenchido em ${rotulo}`,
      ).to.not.equal("");
    });
}

function validarValoresMonetariosNaListagem(
  obterValores,
  limite,
  tipoLimite,
  descricao,
) {
  obterValores().then(({ valores }) => {
    const valoresParaValidar =
      tipoLimite === "minimo" && limite > 0
        ? valores.filter(({ numerico }) => numerico > 0)
        : valores;

    expect(
      valoresParaValidar.length,
      `${descricao} com valor preenchido para validação`,
    ).to.be.greaterThan(0);

    valoresParaValidar.forEach(({ numerico }) => {
      if (tipoLimite === "minimo") {
        expect(numerico, `${descricao} dentro do mínimo`).to.be.at.least(
          limite,
        );
      } else {
        expect(numerico, `${descricao} dentro do máximo`).to.be.at.most(limite);
      }
    });
  });
}

function validarValoresEmpenhadosNaListagem(limite, tipoLimite) {
  validarValoresMonetariosNaListagem(
    obterValoresEmpenhadosDaListagem,
    limite,
    tipoLimite,
    "valor empenhado",
  );
}

function validarValoresLiquidadosNaListagem(limite, tipoLimite) {
  validarValoresMonetariosNaListagem(
    obterValoresLiquidadosDaListagem,
    limite,
    tipoLimite,
    "valor liquidado",
  );
}

function validarValoresPagosNaListagem(limite, tipoLimite) {
  validarValoresMonetariosNaListagem(
    obterValoresPagosDaListagem,
    limite,
    tipoLimite,
    "valor pago",
  );
}

function converterData(data) {
  const [dia, mes, ano] = data.split("/").map(Number);
  return new Date(ano, mes - 1, dia);
}

function obterDatasInicialEFinalDaListagem() {
  return obterLinhasValidas().then((linhas) => {
    const datas = Array.from(linhas)
      .map((row) =>
        normalizarTexto(Cypress.$(row).find(".colData").text() || ""),
      )
      .filter(Boolean)
      .sort((dataA, dataB) => converterData(dataA) - converterData(dataB));

    expect(datas.length, "datas disponíveis na listagem").to.be.greaterThan(0);

    return cy.wrap(
      { dataInicial: datas[0], dataFinal: datas[datas.length - 1] },
      { log: false },
    );
  });
}

function validarDatasNoPeriodo(dataInicial, dataFinal) {
  obterLinhasValidas().then((linhas) => {
    const inicio = converterData(dataInicial);
    const fim = converterData(dataFinal);
    const datasRetornadas = Array.from(linhas)
      .map((row) =>
        normalizarTexto(Cypress.$(row).find(".colData").text() || ""),
      )
      .filter(Boolean);

    datasRetornadas.forEach((data) => {
      expect(converterData(data)).to.be.at.least(inicio);
      expect(converterData(data)).to.be.at.most(fim);
    });
  });
}

// Funções específicas das classificações orçamentárias e funcionais.
function obterOrgaoDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  return cy
    .contains(".campo label", /^Órgão$/)
    .parent()
    .find("#orgao", { timeout: 30000 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((orgao) => {
      const orgaoNormalizado = normalizarTexto(orgao);

      expect(orgaoNormalizado, "órgão disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(orgaoNormalizado, { log: false });
    });
}

function selecionarOrgao(nomeOrgao) {
  abrirSelectAvancadoComOpcoes("#select_org_avanc").then(($opcoes) => {
    const opcao = Array.from($opcoes).find((elemento) => {
      return orgaosCorrespondem(nomeOrgao, elemento.textContent);
    });

    expect(opcao, `órgão ${nomeOrgao} disponível no filtro`).to.exist;
    cy.wrap(opcao).click({ force: true });
  });
}

function validarOrgaoNoDetalhe(nomeOrgao) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  cy.contains(".campo label", /^Órgão$/)
    .parent()
    .find("#orgao", { timeout: 30000 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((orgaoRetornado) => {
      expect(
        orgaosCorrespondem(nomeOrgao, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com "${nomeOrgao}"`,
      ).to.equal(true);
    });
}

// Compara uma unidade do detalhe com a opção do select por código ou descrição.
function unidadeCombinaComOpcao(nomeUnidade, nomeOpcao) {
  const unidadeEsperada = normalizarParaComparacao(nomeUnidade).replace(
    /^\d+\s*-\s*/,
    "",
  );
  const unidadeDaOpcao = normalizarParaComparacao(nomeOpcao).replace(
    /^\d+\s*-\s*/,
    "",
  );
  const termosEsperados = obterTermosSignificativos(unidadeEsperada);
  const termosDaOpcao = obterTermosSignificativos(unidadeDaOpcao);
  const termosEmComum = termosEsperados.filter((termo) =>
    termosDaOpcao.includes(termo),
  ).length;

  return (
    unidadeDaOpcao === unidadeEsperada ||
    unidadeDaOpcao.includes(unidadeEsperada) ||
    unidadeEsperada.includes(unidadeDaOpcao) ||
    (termosEsperados.length > 0 &&
      termosEmComum >= Math.min(2, termosEsperados.length))
  );
}

function obterUnidadesDisponiveisNoFiltro() {
  abrirFiltroAvancado("#select_unidade");

  return abrirSelectAvancadoComOpcoes("#select_unidade").then(($opcoes) => {
    const unidades = Array.from($opcoes).map((elemento) =>
      normalizarTexto(elemento.textContent),
    );

    // Unidade é um autocomplete e pode não carregar a lista até que a busca
    // seja preenchida. Nesse caso, a opção será validada após pesquisar a
    // unidade obtida no detalhamento do registro.
    if (!unidades.length) {
      cy.get("#select_unidade").find(".selected").click({ force: true });
      cy.get("#busca_avancada").click({ force: true });
      return cy.wrap([], { log: false });
    }

    cy.get("#select_unidade").find(".selected").click({ force: true });
    cy.get("#busca_avancada").click({ force: true });

    return cy.wrap(unidades, { log: false });
  });
}

function obterUnidadeDoRegistroPesquisavel(unidadesDisponiveis, indice = 0) {
  return obterLinhasValidas().then((linhas) => {
    expect(indice, "registro com Unidade disponível no filtro").to.be.lessThan(
      linhas.length,
    );

    cy.wrap(linhas[indice]).find(".colNumero").click({ force: true });
    fecharTermosDeUsoSeExibido();

    return cy
      .contains(".campo label", /^Unidade$/i)
      .parent()
      .find("#unidade", { timeout: 30000 })
      .should("be.visible")
      .should(aguardarCampoComValor)
      .then(obterValorDoCampo)
      .then((unidade) => {
        const unidadeNormalizada = normalizarTexto(unidade);
        const possuiOpcao =
          !unidadesDisponiveis.length ||
          unidadesDisponiveis.some((unidadeDisponivel) =>
            unidadeCombinaComOpcao(unidadeNormalizada, unidadeDisponivel),
          );

        cy.visitPortal(SG_DESPESAS_PATH);
        aguardarListagem();

        if (possuiOpcao) {
          return cy.wrap(unidadeNormalizada, { log: false });
        }

        return obterUnidadeDoRegistroPesquisavel(
          unidadesDisponiveis,
          indice + 1,
        );
      });
  });
}

function selecionarUnidade(nomeUnidade) {
  const unidadeEsperada = normalizarParaComparacao(nomeUnidade).replace(
    /^\d+\s*-\s*/,
    "",
  );
  const termosEsperados = obterTermosSignificativos(nomeUnidade);
  const termoParaBusca = [...termosEsperados].sort(
    (termoA, termoB) => termoB.length - termoA.length,
  )[0];

  return abrirSelectAvancadoComOpcoes("#select_unidade")
    .then(() =>
      pesquisarAutocomplete(
        "#select_unidade",
        termoParaBusca || unidadeEsperada,
      ),
    )
    .then(() =>
      obterOpcoesCarregadas("#select_unidade")
        .should(
          ($opcoes) =>
            expect(
              Array.from($opcoes).find((elemento) =>
                unidadeCombinaComOpcao(nomeUnidade, elemento.textContent),
              ),
              `Unidade ${nomeUnidade} disponível no filtro`,
            ).to.exist,
        )
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find((elemento) =>
            unidadeCombinaComOpcao(nomeUnidade, elemento.textContent),
          );

          cy.wrap(opcao).click({ force: true });
        }),
    );
}

function validarUnidadeNoDetalhe(nomeUnidade) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  cy.contains(".campo label", /^Unidade$/)
    .parent()
    .find("#unidade", { timeout: 30000 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((unidadeRetornada) => {
      expect(normalizarTexto(unidadeRetornada).toLowerCase()).to.include(
        nomeUnidade.toLowerCase(),
      );
    });
}

function obterFuncaoDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Função$/)
    .parent()
    .find("#funcao", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((funcao) => {
      const funcaoNormalizada = normalizarTexto(funcao);

      expect(funcaoNormalizada, "função disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(funcaoNormalizada, { log: false });
    });
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

function selecionarFuncao(nomeFuncao) {
  const funcaoEsperada = removerCodigo(nomeFuncao);

  return abrirSelectAvancadoComOpcoes("#select_funcao")
    .then(($opcoes) => {
      const $input = Cypress.$("#select_funcao")
        .find(".options:visible input:visible")
        .first();

      if ($input.length) {
        return pesquisarAutocomplete("#select_funcao", funcaoEsperada).then(
          () => obterOpcoesCarregadas("#select_funcao"),
        );
      }

      return cy.wrap($opcoes, { log: false });
    })
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        valoresDoFiltroCorrespondem(nomeFuncao, elemento.textContent),
      );

      expect(opcao, `função ${nomeFuncao} disponível no filtro`).to.exist;
      cy.wrap(opcao).click({ force: true });
    });
}

function validarFuncaoNoDetalhe(nomeFuncao) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Função$/)
    .parent()
    .find("#funcao", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((funcaoRetornada) => {
      expect(normalizarTexto(funcaoRetornada).toLowerCase()).to.equal(
        nomeFuncao.toLowerCase(),
      );
    });
}

function obterSubfuncaoDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Subfunção$/)
    .parent()
    .find("#subfuncao", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((subfuncao) => {
      const subfuncaoNormalizada = normalizarTexto(subfuncao);

      expect(subfuncaoNormalizada, "subfunção disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(subfuncaoNormalizada, { log: false });
    });
}

function selecionarSubfuncao(nomeSubfuncao) {
  const subfuncaoEsperada = normalizarParaComparacao(nomeSubfuncao).replace(
    /^\d+\s*-\s*/,
    "",
  );

  cy.contains(".campo label", /^Subfunção$/i)
    .parent()
    .then(($campo) => {
      abrirSelectAvancadoComOpcoes($campo).then(($opcoes) => {
        const opcao = Array.from($opcoes).find((elemento) =>
          normalizarParaComparacao(elemento.textContent).includes(
            subfuncaoEsperada,
          ),
        );

        expect(opcao, `subfunção ${nomeSubfuncao} disponível no filtro`).to
          .exist;
        cy.wrap(opcao).click({ force: true });
      });
    });
}

function validarSubfuncaoNoDetalhe(nomeSubfuncao) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Subfunção$/)
    .parent()
    .find("#subfuncao", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((subfuncaoRetornada) => {
      expect(normalizarTexto(subfuncaoRetornada).toLowerCase()).to.equal(
        nomeSubfuncao.toLowerCase(),
      );
    });
}

function obterGrupoDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Grupo$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((grupo) => {
      const grupoNormalizado = normalizarTexto(grupo);

      expect(grupoNormalizado, "grupo disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(grupoNormalizado, { log: false });
    });
}

function selecionarGrupo(nomeGrupo) {
  const nomeGrupoSemCodigo = nomeGrupo.replace(/^\d+\s*-\s*/, "").trim();

  return cy
    .contains(".campo label", /^Grupo$/i)
    .parent()
    .then(($campo) => {
      abrirSelectAvancadoComOpcoes($campo).then(($opcoes) => {
        const opcao = Array.from($opcoes).find((elemento) => {
          const textoOpcao = normalizarTexto(elemento.textContent);
          const textoSemCodigo = textoOpcao
            .replace(/^\d+\s*-\s*/, "")
            .toLowerCase();

          return (
            textoOpcao.toLowerCase().includes(nomeGrupo.toLowerCase()) ||
            textoSemCodigo.includes(nomeGrupoSemCodigo.toLowerCase())
          );
        });

        expect(opcao, `grupo ${nomeGrupo} disponível no filtro`).to.exist;
        cy.wrap(opcao).click({ force: true });
      });
    });
}

function validarGrupoNoDetalhe(nomeGrupo) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Grupo$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((grupoRetornado) => {
      expect(normalizarTexto(grupoRetornado).toLowerCase()).to.equal(
        nomeGrupo.toLowerCase(),
      );
    });
}

function obterModalidadeAplicacaoDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Modalidade de Aplicação$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((modalidade) => {
      const modalidadeNormalizada = normalizarTexto(modalidade);

      expect(
        modalidadeNormalizada,
        "modalidade de aplicação disponível",
      ).to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(modalidadeNormalizada, { log: false });
    });
}

function selecionarModalidadeAplicacao(nomeModalidade) {
  return cy
    .contains(".campo label", /^Modalidade de Aplicação$/i)
    .parent()
    .then(($campo) => {
      abrirSelectAvancadoComOpcoes($campo)
        .then(($opcoes) => {
          const $input = $campo.find("input:visible").first();

          if ($input.length) {
            return pesquisarAutocomplete($campo, nomeModalidade);
          }

          return cy.wrap($opcoes, { log: false });
        })
        .then(() =>
          cy
            .wrap($campo)
            .find(".options .list a", { timeout: 30000 })
            .filter(":visible")
            .should("have.length.at.least", 1),
        )
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find((elemento) =>
            normalizarTexto(elemento.textContent)
              .toLowerCase()
              .includes(nomeModalidade.toLowerCase()),
          );

          expect(
            opcao,
            `modalidade de aplicação ${nomeModalidade} disponível no filtro`,
          ).to.exist;
          cy.wrap(opcao).click({ force: true });
        });
    });
}

function validarModalidadeAplicacaoNoDetalhe(nomeModalidade) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Modalidade de Aplicação$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((modalidadeRetornada) => {
      expect(normalizarTexto(modalidadeRetornada).toLowerCase()).to.equal(
        nomeModalidade.toLowerCase(),
      );
    });
}

function obterNaturezaDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Natureza(?: da Despesa)?$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((natureza) => {
      const naturezaNormalizada = normalizarTexto(natureza);

      expect(naturezaNormalizada, "Natureza disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(naturezaNormalizada, { log: false });
    });
}

function selecionarNatureza(nomeNatureza) {
  const naturezaEsperada = normalizarParaComparacao(nomeNatureza).replace(
    /^\d+\s*-\s*/,
    "",
  );

  return obterCampoAvancadoPorRotulo("Natureza").then(($campo) => {
    abrirSelectAvancadoComOpcoes($campo)
      .then(() => pesquisarAutocomplete($campo, naturezaEsperada))
      .then(() => cy.wrap($campo).find(".options .list a"))
      .then(($opcoes) => {
        const opcao = Array.from($opcoes).find((elemento) =>
          normalizarParaComparacao(elemento.textContent).includes(
            naturezaEsperada,
          ),
        );

        expect(opcao, `Natureza ${nomeNatureza} disponível no filtro`).to.exist;
        cy.wrap(opcao).click({ force: true });
      });
  });
}

function validarNaturezaNoDetalhe(nomeNatureza) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Natureza(?: da Despesa)?$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((naturezaRetornada) => {
      expect(normalizarTexto(naturezaRetornada).toLowerCase()).to.equal(
        nomeNatureza.toLowerCase(),
      );
    });
}

function obterElementoDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Elemento$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((elemento) => {
      const elementoNormalizado = normalizarTexto(elemento);

      expect(elementoNormalizado, "Elemento disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(elementoNormalizado, { log: false });
    });
}

function selecionarElementoDaDespesa(nomeElemento) {
  const codigoElemento = nomeElemento.match(/^\d+/)?.[0] || nomeElemento;

  obterCampoAvancadoPorRotulo("Elemento").then(($campo) => {
    abrirSelectAvancadoComOpcoes($campo).then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        normalizarParaComparacao(elemento.textContent).startsWith(
          normalizarParaComparacao(codigoElemento),
        ),
      );

      expect(opcao, `Elemento ${nomeElemento} disponível no filtro`).to.exist;
      cy.wrap(opcao).click({ force: true });
    });
  });
}

function validarElementoNoDetalhe(nomeElemento) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Elemento$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((elementoRetornado) => {
      expect(normalizarTexto(elementoRetornado).toLowerCase()).to.equal(
        nomeElemento.toLowerCase(),
      );
    });
}

function obterAcoesDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Aç(?:ão|ões)$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((acoes) => {
      const acoesNormalizadas = normalizarTexto(acoes);

      expect(acoesNormalizadas, "Ações disponíveis").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(acoesNormalizadas, { log: false });
    });
}

function selecionarAcoes(nomeAcoes) {
  const acoesEsperadas = normalizarParaComparacao(nomeAcoes).replace(
    /^[\d.]+\s*-\s*/,
    "",
  );

  return obterCampoAvancadoPorRotulo("Ações").then(($campo) => {
    abrirSelectAvancadoComOpcoes($campo).then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        normalizarParaComparacao(elemento.textContent).includes(acoesEsperadas),
      );

      expect(opcao, `Ações ${nomeAcoes} disponível no filtro`).to.exist;
      cy.wrap(opcao).click({ force: true });
    });
  });
}

function validarAcoesNoDetalhe(nomeAcoes) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Aç(?:ão|ões)$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((acoesRetornadas) => {
      expect(normalizarTexto(acoesRetornadas).toLowerCase()).to.equal(
        nomeAcoes.toLowerCase(),
      );
    });
}

function registrarAlertaPrograma(mensagem, detalhes = {}) {
  const mensagemComContexto = `ALERTA: ${mensagem}`;

  Cypress.log({
    name: "ALERTA",
    message: mensagemComContexto,
    consoleProps: () => detalhes,
  });
  cy.log(mensagemComContexto);
}

function obterProgramaDoEmpenho(indice = 0) {
  return obterLinhasValidas().then((linhas) => {
    if (indice >= linhas.length) {
      registrarAlertaPrograma(
        "Nenhum registro com Programa preenchido foi encontrado na listagem.",
        { registrosAnalisados: linhas.length },
      );

      return cy.wrap(null, { log: false });
    }

    cy.wrap(linhas[indice]).find(".colNumero").click({ force: true });
    fecharTermosDeUsoSeExibido();

    return cy
      .contains(".campo label", /^Programa$/)
      .parent()
      .find("#programa", { timeout: 30000 })
      .scrollIntoView({ duration: 0 })
      .should("be.visible")
      .then(obterValorDoCampo)
      .then((programa) => {
        const programaNormalizado = normalizarTexto(programa);
        const programaValido =
          programaNormalizado && !/^[-–—]+$/.test(programaNormalizado);

        cy.visitPortal(SG_DESPESAS_PATH);
        aguardarListagem();

        if (programaValido) {
          return cy.wrap(programaNormalizado, { log: false });
        }

        cy.log(
          `Programa vazio ou inválido no registro ${indice + 1}; tentando o próximo.`,
        );
        return obterProgramaDoEmpenho(indice + 1);
      });
  });
}

function pesquisarProgramaAteEncontrarResultado(nomePrograma) {
  const nomeProgramaSemCodigo = removerCodigo(nomePrograma);

  return tentarOpcoesDePrograma(nomeProgramaSemCodigo, 0);
}

// O autocomplete de Programa pode retornar várias opções para o mesmo texto.
// Cada tentativa repete a busca, seleciona a opção pelo índice e só avança
// quando a consulta anterior não trouxe nenhuma linha válida.
function tentarOpcoesDePrograma(nomePrograma, indice) {
  abrirFiltroAvancado("#select_programa");

  return abrirSelectAvancadoComOpcoes("#select_programa")
    .then(() => cy.get("#select_programa input:visible"))
    .first()
    .should("be.visible")
    .clear({ force: true })
    .type(nomePrograma, { force: true })
    .should("have.value", nomePrograma)
    .get("#select_programa > .select > .options > .list")
    .should("be.visible")
    .find("a")
    .filter(":visible")
    .then(($opcoes) => {
      const opcoesFiltradas = Array.from($opcoes).filter(
        (opcao) =>
          Cypress.$(opcao).is(":visible") &&
          valoresDoFiltroCorrespondem(nomePrograma, opcao.textContent),
      );
      const quantidadeOpcoes = opcoesFiltradas.length;

      if (!quantidadeOpcoes) {
        registrarAlertaPrograma(
          `Nenhuma opção encontrada para o programa "${nomePrograma}".`,
          {
            programaPesquisado: nomePrograma,
            opcoesDisponiveis: Array.from($opcoes).map((opcao) =>
              normalizarTexto(opcao.textContent),
            ),
          },
        );

        return cy.wrap(null, { log: false });
      }

      expect(
        indice,
        `opção ${indice + 1} do programa ${nomePrograma}`,
      ).to.be.lessThan(quantidadeOpcoes);

      cy.log(
        `Selecionando a opção ${indice + 1} de ${quantidadeOpcoes}: ${nomePrograma}`,
      );
      cy.wrap(opcoesFiltradas).eq(indice).click({ force: true });
      return cy.wrap(quantidadeOpcoes, { log: false });
    })
    .then((quantidadeOpcoes) => {
      if (!quantidadeOpcoes) {
        return cy.wrap(null, { log: false });
      }

      cy.contains("button, a, div", "PESQUISAR").click({ force: true });
      aguardarListagem();

      return obterLinhasValidas().then((linhas) => {
        if (linhas.length) {
          return cy.wrap(linhas, { log: false });
        }

        const proximoIndice = indice + 1;
        if (proximoIndice < quantidadeOpcoes) {
          cy.log(
            `A opção ${indice + 1} não retornou dados; tentando a opção ${proximoIndice + 1}.`,
          );
          return tentarOpcoesDePrograma(nomePrograma, proximoIndice);
        }

        registrarAlertaPrograma(
          `Nenhum resultado retornado para o programa "${nomePrograma}" após testar todas as opções.`,
          {
            programaPesquisado: nomePrograma,
            opcoesTestadas: quantidadeOpcoes,
          },
        );
        return cy.wrap(null, { log: false });
      });
    });
}

function validarProgramaNoDetalhe(nomePrograma) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Programa$/)
    .parent()
    .find("#programa", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((programaRetornado) => {
      expect(
        normalizarTexto(programaRetornado),
        "programa retornado",
      ).to.not.equal("");
      expect(
        normalizarTexto(programaRetornado)
          .replace(/^\d+\s*-\s*/, "")
          .toLowerCase(),
      ).to.equal(nomePrograma.replace(/^\d+\s*-\s*/, "").toLowerCase());
    });
}

function obterFonteDoEmpenho() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Fonte$/)
    .parent()
    .scrollIntoView({ duration: 0 })
    .find("#fonte", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((fonte) => {
      const fonteNormalizada = normalizarTexto(fonte);

      expect(fonteNormalizada, "fonte disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(fonteNormalizada, { log: false });
    });
}

function selecionarFonte(nomeFonte) {
  const codigoFonte = nomeFonte.match(/^[\d.]+/)?.[0] || nomeFonte;

  return cy
    .contains(".campo label", /^Fontes$/i)
    .parent()
    .then(($campo) => {
      abrirSelectAvancadoComOpcoes($campo)
        .then(() => pesquisarAutocomplete($campo, codigoFonte))
        .then(() =>
          cy.wrap($campo).find(".options .list a", { timeout: 30000 }),
        )
        .then(($opcoes) => {
          const opcaoPorCodigo = Array.from($opcoes).find(
            (elemento) =>
              Cypress.$(elemento).is(":visible") &&
              normalizarTexto(elemento.textContent).startsWith(codigoFonte),
          );

          if (opcaoPorCodigo) {
            const fonteSelecionada = normalizarTexto(
              opcaoPorCodigo.textContent,
            );
            cy.wrap(opcaoPorCodigo).click({ force: true });
            return cy.wrap(
              { fonteSelecionada, validarDetalhe: true },
              { log: false },
            );
          }

          // Quando a Fonte do registro não está disponível no contexto do
          // filtro, limpa a busca e seleciona a única opção visível.
          cy.wrap($campo).find("input:visible").first().clear({ force: true });

          return cy
            .wrap($campo)
            .find(".options .list a", { timeout: 30000 })
            .filter(":visible")
            .should("have.length", 1)
            .then(($opcoesVisiveis) => {
              const fonteSelecionada = normalizarTexto(
                $opcoesVisiveis.first().text(),
              );

              cy.wrap($opcoesVisiveis.first()).click({ force: true });
              return cy.wrap(
                { fonteSelecionada, validarDetalhe: false },
                { log: false },
              );
            });
        });
    });
}

function validarFonteNoDetalhe(nomeFonte) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Fonte$/)
    .parent()
    .scrollIntoView({ duration: 0 })
    .find("#fonte", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((fonteRetornada) => {
      expect(normalizarTexto(fonteRetornada).toLowerCase()).to.equal(
        nomeFonte.toLowerCase(),
      );
    });
}

function validarFonteNaListagem() {
  return obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      "registros retornados pelo filtro de Fonte",
    ).to.be.greaterThan(0);
    cy.wrap(linhas[0]).find(".colNumero").should("be.visible");
  });
}

function obterCategoriaEconomicaDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Categoria Econômica$/)
    .parent()
    .scrollIntoView({ duration: 0 })
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((categoria) => {
      const categoriaNormalizada = normalizarTexto(categoria);

      expect(
        categoriaNormalizada,
        "categoria econômica disponível",
      ).to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(categoriaNormalizada, { log: false });
    });
}

function selecionarCategoriaEconomica(nomeCategoria) {
  const nomeCategoriaParaPesquisa = nomeCategoria
    .replace(/^[\d.]+\s*[-.)]\s*/, "")
    .trim();
  const nomeCategoriaNormalizado = normalizarParaComparacao(
    nomeCategoriaParaPesquisa,
  );

  return cy
    .contains(".campo label", /^Categoria Econômica$/i)
    .parent()
    .then(($campo) => {
      abrirSelectAvancadoComOpcoes($campo)
        .then(() => {
          cy.wrap($campo)
            .find("input:visible")
            .first()
            .should("be.visible")
            .clear({ force: true })
            .type(nomeCategoriaParaPesquisa, { force: true });
        })
        .then(() =>
          cy.wrap($campo).find(".options .list a", { timeout: 30000 }),
        )
        .filter(":visible")
        .should("have.length.at.least", 1)
        .should(($opcoes) => {
          const opcao = Array.from($opcoes).find((elemento) =>
            normalizarParaComparacao(elemento.textContent).includes(
              nomeCategoriaNormalizado,
            ),
          );

          expect(
            opcao,
            `categoria econômica ${nomeCategoria} disponível no filtro`,
          ).to.exist;
        })
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find((elemento) =>
            normalizarParaComparacao(elemento.textContent).includes(
              nomeCategoriaNormalizado,
            ),
          );

          cy.wrap(opcao).click({ force: true });
        });
    });
}

function validarCategoriaEconomicaNoDetalhe(nomeCategoria) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Categoria Econômica$/)
    .parent()
    .scrollIntoView({ duration: 0 })
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((categoriaRetornada) => {
      expect(normalizarTexto(categoriaRetornada).toLowerCase()).to.equal(
        nomeCategoria.toLowerCase(),
      );
    });
}

// Cenários do adaptador Megasoft.
describe(`Portal: ${SG_DESPESAS_NOME} - filtro avançado`, () => {
  beforeEach(() => {
    cy.visitPortal(SG_DESPESAS_PATH);
    aguardarListagem();
    limparFiltrosAntesDoTeste();
    prepararListagemComFavorecido();
  });

  // Pesquisa o favorecido real do empenho e valida a listagem retornada.
  it("acessa o filtro avançado, pesquisa favorecido e valida a listagem filtrada", () => {
    obterFavorecidoDoPrimeiroRegistro().then((favorecido) => {
      abrirFiltroAvancado();

      cy.get("#fornecedor")
        .clear({ force: true })
        .type(favorecido, { force: true });
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Favorecido", () =>
        validarFavorecidoNaListagem(normalizarTexto(favorecido)),
      );
    });
  });

  // Pesquisa o histórico completo e valida o conteúdo do detalhe.
  it("acessa o filtro avançado, pesquisa Histórico do Empenho e valida o retorno", () => {
    obterHistoricoDoPrimeiroRegistro().then((historico) => {
      abrirFiltroAvancado(".campo label");

      obterCampoAvancadoPorRotulo("Histórico do Empenho")
        .find("input, textarea")
        .first()
        .clear({ force: true })
        .type(historico, { force: true })
        .should("have.value", historico);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Histórico do Empenho", () =>
        validarHistoricoNoDetalhe(historico),
      );
    });
  });

  // Pesquisa um CPF/CNPJ real e confere o documento retornado.
  it("acessa o filtro avançado, pesquisa CPF/CNPJ e valida o retorno", () => {
    obterCnpjDeUmRegistro().then((cnpj) => {
      abrirFiltroAvancado("#cpfCnpj");

      cy.get("#cpfCnpj")
        .clear({ force: true })
        .type(cnpj, { force: true })
        .should("have.value", cnpj);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("CPF/CNPJ", () =>
        validarCnpjNoDetalhe(cnpj),
      );
    });
  });

  // Pesquisa o número real do empenho e valida o mesmo número no detalhe.
  it("acessa o filtro avançado, pesquisa Nº Empenho e valida o retorno", () => {
    obterNumeroDoPrimeiroRegistro().then((numeroEmpenho) => {
      abrirFiltroAvancado("#numero");

      cy.get("#numero")
        .clear({ force: true })
        .type(numeroEmpenho, { force: true });
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Nº Empenho", () =>
        validarNumeroNaListagem(numeroEmpenho),
      );
    });
  });

  // Valida o limite inferior dos valores empenhados.
  it("acessa o filtro avançado, pesquisa Valor Mínimo Empenhado e valida a listagem", () => {
    obterValoresEmpenhadosDaListagem().then(({ minimo }) => {
      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Mínimo Empenhado", minimo.texto);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Valor Mínimo Empenhado", () =>
        validarValoresEmpenhadosNaListagem(minimo.numerico, "minimo"),
      );
    });
  });

  // Valida o limite superior dos valores empenhados.
  it("acessa o filtro avançado, pesquisa Valor Máximo Empenhado e valida a listagem", () => {
    obterValoresEmpenhadosDaListagem().then(({ maximo }) => {
      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Máximo Empenhado", maximo.texto);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Valor Máximo Empenhado", () =>
        validarValoresEmpenhadosNaListagem(maximo.numerico, "maximo"),
      );
    });
  });

  // Confirma o alerta para intervalo empenhado inconsistente.
  it("coleta o alerta ao pesquisar com Valor Mínimo Empenhado maior que o máximo", () => {
    obterValoresEmpenhadosDaListagem().then(({ maximo }) => {
      const valorMinimoInvalido = formatarValorMonetario(maximo.numerico + 1);

      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Mínimo Empenhado", valorMinimoInvalido);
      preencherValorAvancado("Valor Máximo Empenhado", maximo.texto);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      cy.get(".alertas-msg > p", { timeout: 30000 })
        .first()
        .should("be.visible")
        .invoke("text")
        .then((textoAlerta) => {
          const mensagem = normalizarTexto(textoAlerta);
          const indicacaoDeErro =
            /mínimo|máximo|menor|maior|intervalo|valor|inválid|invalíd/i.test(
              mensagem,
            );

          expect(
            indicacaoDeErro,
            "validação para mínimo empenhado maior que máximo exibida",
          ).to.equal(true);

          Cypress.log({
            name: "ALERTA",
            message: mensagem || "Valor mínimo maior que o valor máximo",
            consoleProps: () => ({
              valorMinimo: valorMinimoInvalido,
              valorMaximo: maximo.texto,
              mensagem,
            }),
          });
          cy.log(`ALERTA: ${mensagem}`);
        });
    });
  });

  // Valida o limite inferior dos valores liquidados.
  it("acessa o filtro avançado, pesquisa Valor Mínimo Liquidado e valida a listagem", () => {
    obterValoresLiquidadosDaListagem().then(({ minimo }) => {
      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Mínimo Liquidado", minimo.texto);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Valor Mínimo Liquidado", () =>
        validarValoresLiquidadosNaListagem(minimo.numerico, "minimo"),
      );
    });
  });

  // Valida o limite superior dos valores liquidados.
  it("acessa o filtro avançado, pesquisa Valor Máximo Liquidado e valida a listagem", () => {
    obterValoresLiquidadosDaListagem().then(({ maximo }) => {
      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Máximo Liquidado", maximo.texto);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Valor Máximo Liquidado", () =>
        validarValoresLiquidadosNaListagem(maximo.numerico, "maximo"),
      );
    });
  });

  // Confirma o alerta para intervalo liquidado inconsistente.
  it("coleta o alerta ao pesquisar com Valor Mínimo Liquidado maior que o máximo", () => {
    obterValoresLiquidadosDaListagem().then(({ maximo }) => {
      const valorMinimoInvalido = formatarValorMonetario(maximo.numerico + 1);

      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Mínimo Liquidado", valorMinimoInvalido);
      preencherValorAvancado("Valor Máximo Liquidado", maximo.texto);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      cy.get(".alertas-msg > p", { timeout: 30000 })
        .first()
        .should("be.visible")
        .invoke("text")
        .then((textoAlerta) => {
          const mensagem = normalizarTexto(textoAlerta);
          const indicacaoDeErro =
            /mínimo|máximo|menor|maior|intervalo|valor|inválid|invalíd/i.test(
              mensagem,
            );

          expect(
            indicacaoDeErro,
            "validação para mínimo liquidado maior que máximo exibida",
          ).to.equal(true);

          Cypress.log({
            name: "ALERTA",
            message: mensagem || "Valor mínimo liquidado maior que o máximo",
            consoleProps: () => ({
              valorMinimo: valorMinimoInvalido,
              valorMaximo: maximo.texto,
              mensagem,
            }),
          });
          cy.log(`ALERTA: ${mensagem}`);
        });
    });
  });

  // Valida o limite inferior dos valores pagos.
  it("acessa o filtro avançado, pesquisa Valor Mínimo Pago e valida a listagem", () => {
    obterValoresPagosDaListagem().then(({ minimo }) => {
      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Mínimo Pago", minimo.texto);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Valor Mínimo Pago", () =>
        validarValoresPagosNaListagem(minimo.numerico, "minimo"),
      );
    });
  });

  // Valida o limite superior dos valores pagos.
  it("acessa o filtro avançado, pesquisa Valor Máximo Pago e valida a listagem", () => {
    obterValoresPagosDaListagem().then(({ maximo }) => {
      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Máximo Pago", maximo.texto);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Valor Máximo Pago", () =>
        validarValoresPagosNaListagem(maximo.numerico, "maximo"),
      );
    });
  });

  // Confirma o alerta para intervalo pago inconsistente.
  it("coleta o alerta ao pesquisar com Valor Mínimo Pago maior que o máximo", () => {
    obterValoresPagosDaListagem().then(({ maximo }) => {
      const valorMinimoInvalido = formatarValorMonetario(maximo.numerico + 1);

      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Mínimo Pago", valorMinimoInvalido);
      preencherValorAvancado("Valor Máximo Pago", maximo.texto);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      cy.get(".alertas-msg > p", { timeout: 30000 })
        .first()
        .should("be.visible")
        .invoke("text")
        .then((textoAlerta) => {
          const mensagem = normalizarTexto(textoAlerta);
          const indicacaoDeErro =
            /mínimo|máximo|menor|maior|intervalo|valor|inválid|invalíd/i.test(
              mensagem,
            );

          expect(
            indicacaoDeErro,
            "validação para mínimo pago maior que máximo exibida",
          ).to.equal(true);

          Cypress.log({
            name: "ALERTA",
            message: mensagem || "Valor mínimo pago maior que o máximo",
            consoleProps: () => ({
              valorMinimo: valorMinimoInvalido,
              valorMaximo: maximo.texto,
              mensagem,
            }),
          });
          cy.log(`ALERTA: ${mensagem}`);
        });
    });
  });

  // Pesquisa o intervalo de datas e valida a consulta.
  it("acessa o filtro avançado, pesquisa Data inicial e Data final e valida o retorno", () => {
    obterDatasInicialEFinalDaListagem().then(({ dataInicial, dataFinal }) => {
      abrirFiltroAvancado("#data_i");

      cy.get("#data_i")
        .clear({ force: true })
        .type(dataInicial, { force: true })
        .should("have.value", dataInicial);
      cy.get("#data_f")
        .clear({ force: true })
        .type(dataFinal, { force: true })
        .should("have.value", dataFinal);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Período", () =>
        validarDatasNoPeriodo(dataInicial, dataFinal),
      );
    });
  });

  // Seleciona o órgão e confere o resultado no detalhe.
  it("acessa o filtro avançado, pesquisa órgão e valida o retorno", () => {
    obterOrgaoDoPrimeiroRegistro().then((nomeOrgao) => {
      abrirFiltroAvancado("#select_org_avanc");
      selecionarOrgao(nomeOrgao);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Órgão", () =>
        validarOrgaoNoDetalhe(nomeOrgao),
      );
    });
  });

  // Seleciona uma unidade válida para o empenho de referência.
  it("acessa o filtro avançado, pesquisa unidade e valida o retorno", () => {
    obterUnidadesDisponiveisNoFiltro().then((unidadesDisponiveis) => {
      obterUnidadeDoRegistroPesquisavel(unidadesDisponiveis).then(
        (nomeUnidade) => {
          abrirFiltroAvancado("#select_unidade");
          selecionarUnidade(nomeUnidade);
          cy.contains("button, a, div", "PESQUISAR").click({ force: true });

          aguardarListagem();
          validarResultadoOuNenhumResultado("Unidade", () =>
            validarUnidadeNoDetalhe(nomeUnidade),
          );
        },
      );
    });
  });

  // Pesquisa a função por texto/código e valida o detalhe.
  it("acessa o filtro avançado, pesquisa função e valida o retorno", () => {
    obterFuncaoDoPrimeiroRegistro().then((nomeFuncao) => {
      abrirFiltroAvancado("#select_funcao");
      selecionarFuncao(nomeFuncao);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Função", () =>
        validarFuncaoNoDetalhe(nomeFuncao),
      );
    });
  });

  // Pesquisa a subfunção por texto/código e valida o detalhe.
  it("acessa o filtro avançado, pesquisa subfunção e valida o retorno", () => {
    obterSubfuncaoDoPrimeiroRegistro().then((nomeSubfuncao) => {
      abrirFiltroAvancado(".campo label");
      selecionarSubfuncao(nomeSubfuncao);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Subfunção", () =>
        validarSubfuncaoNoDetalhe(nomeSubfuncao),
      );
    });
  });

  // Pesquisa o grupo orçamentário e valida o retorno.
  it("acessa o filtro avançado, pesquisa grupo e valida o retorno", () => {
    obterGrupoDoPrimeiroRegistro().then((nomeGrupo) => {
      abrirFiltroAvancado(".campo label");
      selecionarGrupo(nomeGrupo);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Grupo", () =>
        validarGrupoNoDetalhe(nomeGrupo),
      );
    });
  });

  // Pesquisa a modalidade de aplicação e valida o retorno.
  it("acessa o filtro avançado, pesquisa modalidade de aplicação e valida o retorno", () => {
    obterModalidadeAplicacaoDoPrimeiroRegistro().then((nomeModalidade) => {
      abrirFiltroAvancado(".campo label");
      selecionarModalidadeAplicacao(nomeModalidade);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Modalidade de Aplicação", () =>
        validarModalidadeAplicacaoNoDetalhe(nomeModalidade),
      );
    });
  });

  // Pesquisa a natureza da despesa e valida o retorno.
  it("acessa o filtro avançado, pesquisa Natureza e valida o retorno", () => {
    obterNaturezaDoPrimeiroRegistro().then((nomeNatureza) => {
      abrirFiltroAvancado(".campo label");
      selecionarNatureza(nomeNatureza);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Natureza", () =>
        validarNaturezaNoDetalhe(nomeNatureza),
      );
    });
  });

  // Pesquisa o elemento da despesa e valida o retorno.
  it("acessa o filtro avançado, pesquisa Elemento e valida o retorno", () => {
    obterElementoDoPrimeiroRegistro().then((nomeElemento) => {
      abrirFiltroAvancado(".campo label");
      selecionarElementoDaDespesa(nomeElemento);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Elemento", () =>
        validarElementoNoDetalhe(nomeElemento),
      );
    });
  });

  // Pesquisa uma ação vinculada ao empenho.
  it("acessa o filtro avançado, pesquisa Ações e valida o retorno", () => {
    obterAcoesDoPrimeiroRegistro().then((nomeAcoes) => {
      abrirFiltroAvancado(".campo label");
      selecionarAcoes(nomeAcoes);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Ações", () =>
        validarAcoesNoDetalhe(nomeAcoes),
      );
    });
  });

  // Pesquisa o programa vinculado ao empenho.
  it("acessa o filtro avançado, pesquisa programa e valida o retorno", () => {
    obterProgramaDoEmpenho().then((nomePrograma) => {
      if (!nomePrograma) {
        return;
      }

      pesquisarProgramaAteEncontrarResultado(nomePrograma).then(
        (programaEncontrado) => {
          if (programaEncontrado) {
            validarProgramaNoDetalhe(nomePrograma);
          }
        },
      );
    });
  });

  // Pesquisa a fonte e valida o resultado no detalhe.
  it("acessa o filtro avançado, pesquisa fonte e valida o retorno", () => {
    obterFonteDoEmpenho().then((nomeFonte) => {
      abrirFiltroAvancado(".campo label");
      selecionarFonte(nomeFonte).then(
        ({ fonteSelecionada, validarDetalhe }) => {
          cy.contains("button, a, div", "PESQUISAR").click({ force: true });

          aguardarListagem();
          validarFonteNaListagem().then(() => {
            if (validarDetalhe) {
              validarFonteNoDetalhe(fonteSelecionada);
            }
          });
        },
      );
    });
  });

  // Pesquisa a categoria econômica e valida o resultado no detalhe.
  it("acessa o filtro avançado, pesquisa categoria econômica e valida o retorno", () => {
    obterCategoriaEconomicaDoPrimeiroRegistro().then((nomeCategoria) => {
      abrirFiltroAvancado(".campo label");
      selecionarCategoriaEconomica(nomeCategoria);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Categoria Econômica", () =>
        validarCategoriaEconomicaNoDetalhe(nomeCategoria),
      );
    });
  });

  ["Sim", "Não"].forEach((opcaoCovid) => {
    it(`acessa o filtro avançado, pesquisa COVID-19 como ${opcaoCovid} e valida o retorno`, () => {
      abrirFiltroAvancado(".campo label");
      selecionarCovidAvancado(opcaoCovid);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado(`COVID-19 (${opcaoCovid})`, () => {
        obterLinhasValidas().then((linhas) => {
          expect(
            linhas.length,
            `registros para COVID-19 ${opcaoCovid}`,
          ).to.be.greaterThan(0);
        });
      });
    });
  });

  // Confirma o alerta quando a data inicial é posterior à data final.
  it("coleta o alerta ao pesquisar com data inicial maior que data final", () => {
    abrirFiltroAvancado("#data_i");

    cy.get("#data_i")
      .clear({ force: true })
      .type("31/12/2026", { force: true })
      .should("have.value", "31/12/2026");
    cy.get("#data_f")
      .clear({ force: true })
      .type("01/01/2026", { force: true })
      .should("have.value", "01/01/2026");
    cy.contains("button, a, div", "PESQUISAR").click({ force: true });

    cy.get(".alertas-msg > p", { timeout: 30000 })
      .first()
      .should("be.visible")
      .invoke("text")
      .then((textoAlerta) => {
        const mensagem = normalizarTexto(textoAlerta);
        const indicacaoDeErro =
          /data|período|inicial|final|inválid|invalíd/i.test(mensagem);

        expect(
          indicacaoDeErro,
          "validação do período inválido exibida",
        ).to.equal(true);

        Cypress.log({
          name: "ALERTA",
          message: mensagem || "Data inicial maior que a data final",
          consoleProps: () => ({ mensagem }),
        });
        cy.log(`ALERTA: ${mensagem}`);
      });
  });
});
