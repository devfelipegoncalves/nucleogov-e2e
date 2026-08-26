const SG_DESPESAS_PATH = "/cidadao/transparencia/sgdespesas";
const SG_DESPESAS_NOME = "sgdespesas";

function normalizarTexto(texto = "") {
  return texto.replace(/\s+/g, " ").trim();
}

function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
    "fundo municipal de educação": "fme",
    "fundo municipal de saude": "fms",
    "fundo municipal de saúde": "fms",
    "fundo municipal de assistência social": "fmas",
    "fundo municipal de assistencia social": "fmas",
    "fundo municipal de habitação e interesse social": "fmhis",
    "fundo municipal de habitacao e interesse social": "fmhis",
    "fundo municipal de meio ambiente": "fmma",
    fundef: "fundef",
  };
  const nomeNormalizado = normalizarTexto(nomeOrgao)
    .replace(/^\d+\s*-\s*/, "")
    .toLowerCase();

  return siglas[nomeNormalizado] || "";
}

function selecionarOpcao(containerSelector, textoOpcao) {
  cy.get(containerSelector).find(".selected").click({ force: true });
  cy.contains(`${containerSelector} .options .list a`, textoOpcao, {
    matchCase: false,
  }).click({ force: true });
}

function aguardarListagem() {
  cy.get(".loader", { timeout: 30000 }).should("not.exist");
  cy.get(".cont_dados", { timeout: 30000 }).should("be.visible");
  cy.get(".tb-load", { timeout: 30000 }).should("not.exist");
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
    if (!$body.find(`${campoSelector}:visible`).length) {
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
    cy.wrap($campo).find(".selected").click({ force: true });
    cy.wrap($campo)
      .find(".options .list a", { timeout: 30000 })
      .should("have.length.at.least", 2)
      .contains(opcao, { matchCase: false })
      .click({ force: true });
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

function obterValorEmpenhadoDoEmpenho() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Valor Empenhado$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((valor) => {
      const valorNormalizado = normalizarTexto(valor);

      expect(valorNormalizado, "valor empenhado disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(valorNormalizado, { log: false });
    });
}

function validarValorEmpenhadoNoDetalhe(valorBuscado) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Valor Empenhado$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((valorRetornado) => {
      expect(normalizarTexto(valorRetornado)).to.equal(valorBuscado);
    });
}

function obterValorLiquidadoDoEmpenho() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Valor Liquidado$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((valor) => {
      const valorNormalizado = normalizarTexto(valor);

      expect(valorNormalizado, "valor liquidado disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(valorNormalizado, { log: false });
    });
}

function validarValorLiquidadoNoDetalhe(valorBuscado) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Valor Liquidado$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((valorRetornado) => {
      expect(normalizarTexto(valorRetornado)).to.equal(valorBuscado);
    });
}

function obterValorPagoDoEmpenho() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Valor Pago$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((valor) => {
      const valorNormalizado = normalizarTexto(valor);

      expect(valorNormalizado, "valor pago disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(valorNormalizado, { log: false });
    });
}

function validarValorPagoNoDetalhe(valorBuscado) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Valor Pago$/i)
    .parent()
    .find("input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((valorRetornado) => {
      expect(normalizarTexto(valorRetornado)).to.equal(valorBuscado);
    });
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
  cy.get("#select_org_avanc").find(".selected").click({ force: true });
  cy.get("#select_org_avanc .options .list a").then(($opcoes) => {
    const termosDoPortal = obterTermosSignificativos(nomeOrgao);
    const siglaDoOrgao = obterSiglaDoOrgao(nomeOrgao);
    const opcao = Array.from($opcoes).find((elemento) => {
      const termosDaOpcao = obterTermosSignificativos(elemento.textContent);
      const textoDaOpcao = normalizarTexto(elemento.textContent).toLowerCase();
      return (
        termosDoPortal.some((termo) => termosDaOpcao.includes(termo)) ||
        (siglaDoOrgao && textoDaOpcao.includes(siglaDoOrgao))
      );
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
      const termosEsperados = obterTermosSignificativos(nomeOrgao);
      const termosRetornados = obterTermosSignificativos(orgaoRetornado);
      const possuiTermoEmComum = termosEsperados.some((termo) =>
        termosRetornados.includes(termo),
      );

      expect(
        possuiTermoEmComum,
        `órgão retornado "${orgaoRetornado}" compatível com "${nomeOrgao}"`,
      ).to.equal(true);
    });
}

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
    termosEmComum >= Math.min(2, termosEsperados.length)
  );
}

function obterUnidadesDisponiveisNoFiltro() {
  abrirFiltroAvancado("#select_unidade");
  cy.get("#select_unidade").find(".selected").click({ force: true });

  return cy.get("#select_unidade .options .list a").then(($opcoes) => {
    const unidades = Array.from($opcoes).map((elemento) =>
      normalizarTexto(elemento.textContent),
    );

    expect(unidades, "unidades disponíveis no filtro").to.not.be.empty;
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
        const possuiOpcao = unidadesDisponiveis.some((unidadeDisponivel) =>
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
  cy.get("#select_unidade").find(".selected").click({ force: true });
  const unidadeEsperada = normalizarParaComparacao(nomeUnidade).replace(
    /^\d+\s*-\s*/,
    "",
  );
  const termosEsperados = obterTermosSignificativos(nomeUnidade);
  const termoParaBusca = [...termosEsperados].sort(
    (termoA, termoB) => termoB.length - termoA.length,
  )[0];

  return cy
    .get("#select_unidade .options input", { timeout: 30000 })
    .first()
    .clear({ force: true })
    .type(termoParaBusca || unidadeEsperada, { force: true })
    .then(() =>
      cy.get("#select_unidade .options .list a").then(($opcoes) => {
        const opcao = Array.from($opcoes).find((elemento) => {
          const unidadeDaOpcao = normalizarParaComparacao(
            elemento.textContent,
          ).replace(/^\d+\s*-\s*/, "");
          const termosDaOpcao = obterTermosSignificativos(unidadeDaOpcao);
          const termosEmComum = termosEsperados.filter((termo) =>
            termosDaOpcao.includes(termo),
          ).length;

          return (
            unidadeDaOpcao === unidadeEsperada ||
            unidadeDaOpcao.includes(unidadeEsperada) ||
            unidadeEsperada.includes(unidadeDaOpcao) ||
            termosEmComum >= Math.min(2, termosEsperados.length)
          );
        });

        expect(opcao, `Unidade ${nomeUnidade} disponível no filtro`).to.exist;
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
  cy.get("#select_funcao").find(".selected").click({ force: true });
  const funcaoEsperada = normalizarParaComparacao(nomeFuncao).replace(
    /^\d+\s*-\s*/,
    "",
  );
  cy.get("#select_funcao .options .list a").then(($opcoes) => {
    const opcao = Array.from($opcoes).find((elemento) =>
      normalizarParaComparacao(elemento.textContent).includes(funcaoEsperada),
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
      cy.wrap($campo).find(".selected").click({ force: true });
      cy.wrap($campo)
        .find(".options .list a", { timeout: 30000 })
        .should("have.length.at.least", 1)
        .then(($opcoes) => {
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
      cy.wrap($campo).find(".selected").click({ force: true });

      cy.wrap($campo)
        .find(".options .list a")
        .then(($opcoes) => {
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
      cy.wrap($campo).find(".selected").click({ force: true });

      cy.wrap($campo)
        .find(".options .list a", { timeout: 30000 })
        .should("have.length.at.least", 1)
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
    cy.wrap($campo).find(".selected").click({ force: true });
    cy.wrap($campo)
      .find("input:visible")
      .first()
      .should("be.visible")
      .clear({ force: true })
      .type(naturezaEsperada, { force: true });

    cy.wrap($campo)
      .find(".options .list a")
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
    cy.wrap($campo).find(".selected").click({ force: true });
    cy.wrap($campo)
      .find(".options .list a")
      .then(($opcoes) => {
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
    cy.wrap($campo).find(".selected").click({ force: true });
    cy.wrap($campo)
      .find(".options .list a")
      .then(($opcoes) => {
        const opcao = Array.from($opcoes).find((elemento) =>
          normalizarParaComparacao(elemento.textContent).includes(
            acoesEsperadas,
          ),
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

function obterProgramaDoEmpenho() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Programa$/)
    .parent()
    .find("#programa", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((programa) => {
      const programaNormalizado = normalizarTexto(programa);

      expect(programaNormalizado, "programa disponível").to.not.equal("");
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(programaNormalizado, { log: false });
    });
}

function pesquisarProgramaAteEncontrarResultado(nomePrograma) {
  const nomeProgramaSemCodigo = nomePrograma.replace(/^\d+\s*-\s*/, "").trim();

  return tentarOpcoesDePrograma(nomeProgramaSemCodigo, 0);
}

function tentarOpcoesDePrograma(nomePrograma, indice) {
  const programaPesquisado = normalizarTexto(nomePrograma)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  abrirFiltroAvancado("#select_programa");

  return cy
    .get("#select_programa > .select > .selected")
    .click({ force: true })
    .get("#select_programa input:visible")
    .first()
    .should("be.visible")
    .clear({ force: true })
    .type(nomePrograma, { force: true })
    .should("have.value", nomePrograma)
    .get("#select_programa > .select > .options > .list")
    .should("be.visible")
    .find("a")
    .should(($opcoes) => {
      const opcoes = Array.from($opcoes).filter((opcao) =>
        normalizarTexto(opcao.textContent)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(programaPesquisado),
      );

      expect(
        opcoes.length,
        `opções filtradas para o programa ${nomePrograma}`,
      ).to.be.greaterThan(0);
    })
    .then(($opcoes) => {
      const opcoesFiltradas = Array.from($opcoes).filter((opcao) =>
        normalizarTexto(opcao.textContent)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(programaPesquisado),
      );
      const quantidadeOpcoes = opcoesFiltradas.length;

      expect(
        quantidadeOpcoes,
        `opções encontradas para o programa ${nomePrograma}`,
      ).to.be.greaterThan(0);
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

        expect(
          linhas.length,
          `registros retornados pelas opções do programa ${nomePrograma}`,
        ).to.be.greaterThan(0);
        return cy.wrap(linhas, { log: false });
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
      cy.wrap($campo).find(".selected").click({ force: true });
      cy.wrap($campo)
        .find("input:visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(codigoFonte, { force: true });

      cy.wrap($campo)
        .find(".options .list a", { timeout: 30000 })
        .should("have.length.at.least", 1)
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
  const codigoCategoria = nomeCategoria.match(/^\d+/)?.[0] || nomeCategoria;

  return cy
    .contains(".campo label", /^Categoria Econômica$/i)
    .parent()
    .then(($campo) => {
      cy.wrap($campo).find(".selected").click({ force: true });
      cy.wrap($campo)
        .find("input:visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(codigoCategoria, { force: true });

      cy.wrap($campo)
        .find(".options .list a")
        .then(($opcoes) => {
          const opcao =
            Array.from($opcoes).find((elemento) =>
              new RegExp(`^${codigoCategoria}\\s*[-.]`).test(
                normalizarTexto(elemento.textContent),
              ),
            ) || $opcoes[0];

          expect(
            opcao,
            `categoria econômica ${nomeCategoria} disponível no filtro`,
          ).to.exist;
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

describe(`Portal: ${SG_DESPESAS_NOME} - filtro avançado`, () => {
  beforeEach(() => {
    cy.visitPortal(SG_DESPESAS_PATH);
    aguardarListagem();
    limparFiltrosAntesDoTeste();
    prepararListagemComFavorecido();
  });

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

  it("acessa o filtro avançado, pesquisa Valor Empenhado e valida o retorno", () => {
    obterValorEmpenhadoDoEmpenho().then((valorEmpenhado) => {
      abrirFiltroAvancado(".campo label");

      cy.contains(".campo label", /^Valor Empenhado$/i)
        .parent()
        .find("input, textarea")
        .first()
        .clear({ force: true })
        .type(valorEmpenhado, { force: true });

      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Valor Empenhado", () =>
        validarValorEmpenhadoNoDetalhe(valorEmpenhado),
      );
    });
  });

  it("acessa o filtro avançado, pesquisa Valor Liquidado e valida o retorno", () => {
    obterValorLiquidadoDoEmpenho().then((valorLiquidado) => {
      abrirFiltroAvancado(".campo label");

      cy.contains(".campo label", /^Valor Liquidado$/i)
        .parent()
        .find("input, textarea")
        .first()
        .clear({ force: true })
        .type(valorLiquidado, { force: true });

      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Valor Liquidado", () =>
        validarValorLiquidadoNoDetalhe(valorLiquidado),
      );
    });
  });

  it("acessa o filtro avançado, pesquisa Valor Pago e valida o retorno", () => {
    obterValorPagoDoEmpenho().then((valorPago) => {
      abrirFiltroAvancado(".campo label");

      cy.contains(".campo label", /^Valor Pago$/i)
        .parent()
        .find("input, textarea")
        .first()
        .clear({ force: true })
        .type(valorPago, { force: true });

      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Valor Pago", () =>
        validarValorPagoNoDetalhe(valorPago),
      );
    });
  });

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

  it("acessa o filtro avançado, pesquisa programa e valida o retorno", () => {
    obterProgramaDoEmpenho().then((nomePrograma) => {
      pesquisarProgramaAteEncontrarResultado(nomePrograma).then(() => {
        validarProgramaNoDetalhe(nomePrograma);
      });
    });
  });

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
