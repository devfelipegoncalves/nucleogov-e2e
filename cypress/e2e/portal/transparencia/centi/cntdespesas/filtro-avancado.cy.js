const DESPESAS_PATH =
  Cypress.env("DESPESAS_PATH") || "/cidadao/transparencia/cntdespesas";
const DESPESAS_NOME = Cypress.env("DESPESAS_NOME") || "cntdespesas";

const SELETOR_LINHAS_VALIDAS = ".cont_dados .tb tr[id]";
const SELETOR_POPUP_DETALHES = "#pop_detalhes";

function normalizarTexto(texto = "") {
  return texto.replace(/\s+/g, " ").trim();
}

function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizarDocumento(documento = "") {
  return normalizarTexto(documento).replace(/\D/g, "");
}

function identificarTipoDocumento(documento) {
  const documentoNormalizado = normalizarTexto(documento).replace(/\s/g, "");
  const caracteresDoDocumento = documentoNormalizado.replace(/[^\d*Xx]/g, "");
  const mascaraCpf =
    /^(?:\d{3}|[*Xx]{3})\.(?:\d{3}|[*Xx]{3})\.(?:\d{3}|[*Xx]{3})-(?:\d{2}|[*Xx]{2})$/;
  const mascaraCnpj =
    /^(?:\d{2}|[*Xx]{2})\.(?:\d{3}|[*Xx]{3})\.(?:\d{3}|[*Xx]{3})\/(?:\d{4}|[*Xx]{4})-(?:\d{2}|[*Xx]{2})$/;
  const quantidadeDeDigitos = normalizarDocumento(documento).length;

  if (
    caracteresDoDocumento.length === 11 ||
    quantidadeDeDigitos === 11 ||
    mascaraCpf.test(documentoNormalizado)
  ) {
    return "CPF";
  }

  if (
    caracteresDoDocumento.length === 14 ||
    quantidadeDeDigitos === 14 ||
    mascaraCnpj.test(documentoNormalizado)
  ) {
    return "CNPJ";
  }

  return "";
}

function removerCodigo(texto = "") {
  return normalizarParaComparacao(texto).replace(/^[\d.]+\s*[-.)]\s*/, "");
}

function valoresCorrespondem(valorEsperado, valorEncontrado) {
  const esperado = removerCodigo(valorEsperado);
  const encontrado = removerCodigo(valorEncontrado);

  return Boolean(
    esperado &&
    encontrado &&
    (esperado === encontrado ||
      esperado.includes(encontrado) ||
      encontrado.includes(esperado)),
  );
}

function obterTermosSignificativos(texto) {
  const termosIgnorados = new Set([
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
    "orgao",
    "poder",
    "prefeitura",
  ]);

  return normalizarParaComparacao(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((termo) => termo.length > 2 && !termosIgnorados.has(termo));
}

function orgaosCorrespondem(orgaoEsperado, orgaoEncontrado) {
  const esperado = normalizarParaComparacao(orgaoEsperado);
  const encontrado = normalizarParaComparacao(orgaoEncontrado);

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

  const termosEsperados = obterTermosSignificativos(orgaoEsperado);
  const termosEncontrados = obterTermosSignificativos(orgaoEncontrado);

  return termosEsperados.some((termo) => termosEncontrados.includes(termo));
}

function obterLinhasValidas() {
  return cy
    .get(SELETOR_LINHAS_VALIDAS, { timeout: 30000 })
    .filter(
      (_, linha) => !["not-found-line", "template_row"].includes(linha.id),
    );
}

function aguardarListagem() {
  cy.get(".loader", { timeout: 30000 }).should("not.exist");
  cy.get(".cont_dados", { timeout: 30000 }).should("be.visible");
  cy.get(".tb-load", { timeout: 30000 }).should("not.exist");
  obterLinhasValidas().should("have.length.at.least", 1);
}

function obterValorDoCampo($campo) {
  const campo = $campo.first();
  return normalizarTexto(
    campo.val() || campo.attr("value") || campo.text() || "",
  );
}

function obterCampoAvancadoPorRotulo(rotulo) {
  const rotuloNormalizado = normalizarParaComparacao(rotulo);

  return cy.get(".campo", { timeout: 30000 }).then(($campos) => {
    const campo = Array.from($campos).find((elemento) => {
      const label = elemento.querySelector("label");
      const textoDoRotulo = normalizarParaComparacao(
        `${label?.textContent || ""} ${label?.getAttribute("title") || ""}`,
      );

      return (
        Cypress.$(elemento).is(":visible") &&
        textoDoRotulo.includes(rotuloNormalizado)
      );
    });

    expect(campo, `campo avançado ${rotulo} disponível`).to.exist;
    return cy.wrap(campo);
  });
}

function obterCredorDaListagem() {
  return obterLinhasValidas().then((linhas) => {
    const credores = Array.from(linhas)
      .map((linha) =>
        normalizarTexto(Cypress.$(linha).find(".colCredor").text()),
      )
      .filter(Boolean);

    expect(
      credores.length,
      "credores disponíveis na listagem",
    ).to.be.greaterThan(0);

    return cy.wrap(credores[0], { log: false });
  });
}

function obterAnoDoDetalhamento() {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 }).should("be.visible");

  return cy
    .get("#data", { timeout: 30000 })
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const data = obterValorDoCampo($campo);
      const ano = data.match(/\b(?:19|20)\d{2}\b/)?.[0];

      expect(ano, "ano disponível no campo #data").to.not.equal(undefined);
      fecharDetalhe();

      return cy.wrap(ano, { log: false });
    });
}

function fecharDetalhe() {
  cy.get(`${SELETOR_POPUP_DETALHES} #close`, { timeout: 30000 }).click({
    force: true,
  });
  cy.get(SELETOR_POPUP_DETALHES).should("not.exist");
}

function acessarPrimeiroRegistro() {
  return obterLinhasValidas()
    .first()
    .find(".icon-file")
    .should("exist")
    .should("be.visible")
    .click({ force: true });
}

function obterCnpjDoRegistro(indice = 0) {
  return obterLinhasValidas().then((linhas) => {
    expect(
      indice,
      "registro disponível para identificar um CNPJ",
    ).to.be.lessThan(linhas.length);

    cy.wrap(linhas[indice]).find(".icon-file").click({ force: true });

    return cy
      .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
      .should("be.visible")
      .find("#cpf_cnpj")
      .first()
      .should("exist")
      .scrollIntoView({ duration: 300 })
      .should("be.visible")
      .then(($campo) => {
        const documento = obterValorDoCampo($campo);
        const tipoDocumento = identificarTipoDocumento(documento);

        fecharDetalhe();

        if (documento) {
          expect(
            tipoDocumento,
            `valor do documento do registro ${indice + 1} identificado como CPF ou CNPJ`,
          ).to.be.oneOf(["CPF", "CNPJ"]);
        }

        if (tipoDocumento === "CNPJ") {
          return cy.wrap(documento, { log: false });
        }

        return obterCnpjDoRegistro(indice + 1);
      });
  });
}

function obterNumeroDoDetalheAberto() {
  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .then(($popup) => {
      const labels = Array.from($popup.find("label"));
      const obterTextoDoLabel = (label) =>
        normalizarParaComparacao(label.textContent);
      const possuiEntrada = (label) =>
        Boolean(label.closest(".campo")?.querySelector("input, textarea"));

      const label =
        labels.find(
          (item) =>
            possuiEntrada(item) &&
            /(?:numero|nº|no).*empenho|empenho.*(?:numero|nº|no)/.test(
              obterTextoDoLabel(item),
            ),
        ) ||
        labels.find(
          (item) =>
            possuiEntrada(item) && obterTextoDoLabel(item) === "empenho",
        ) ||
        labels.find(
          (item) =>
            possuiEntrada(item) &&
            obterTextoDoLabel(item).includes("empenho") &&
            !obterTextoDoLabel(item).includes("historico"),
        );

      expect(label, "campo Número do Empenho disponível no detalhamento").to
        .exist;

      const entrada = label.closest(".campo")?.querySelector("input, textarea");
      const numero = obterValorDoCampo(Cypress.$(entrada));

      expect(
        numero,
        "número do empenho disponível no detalhamento",
      ).to.not.equal("");

      return numero;
    });
}

function obterNumeroDoDetalhamento() {
  acessarPrimeiroRegistro();

  return obterNumeroDoDetalheAberto().then((numero) => {
    fecharDetalhe();
    return cy.wrap(numero, { log: false });
  });
}

function obterValoresEmpenhadosDosDetalhamentos(limite = 5) {
  return obterLinhasValidas().then((linhas) => {
    const quantidade = Math.min(limite, linhas.length);
    const indices = Array.from({ length: quantidade }, (_, indice) => indice);
    const valores = [];

    expect(
      indices.length,
      "empenhos disponíveis para verificar valores empenhados",
    ).to.be.greaterThan(0);

    return cy.wrap(indices).each((indice) => {
      cy.wrap(linhas[indice]).find(".icon-file").click({ force: true });

      return cy
        .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
        .should("be.visible")
        .find("#valor_empenhado")
        .first()
        .should("exist")
        .then(($campo) => {
          valores.push(obterValorDoCampo($campo));
          fecharDetalhe();
        });
    }).then(() => {
      const valoresUnicos = [...new Set(valores)].filter(Boolean);

      expect(
        valoresUnicos.length,
        "valores empenhados disponíveis nos detalhamentos",
      ).to.be.greaterThan(0);

      return cy.wrap(valoresUnicos, { log: false });
    });
  });
}

function obterValoresLiquidadosDosDetalhamentos(limite = 5) {
  return obterLinhasValidas().then((linhas) => {
    const quantidade = Math.min(limite, linhas.length);
    const indices = Array.from({ length: quantidade }, (_, indice) => indice);
    const valores = [];

    expect(
      indices.length,
      "empenhos disponíveis para verificar valores liquidados",
    ).to.be.greaterThan(0);

    return cy.wrap(indices).each((indice) => {
      cy.wrap(linhas[indice]).find(".icon-file").click({ force: true });

      return cy
        .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
        .should("be.visible")
        .find("#liquidacao")
        .first()
        .should("exist")
        .then(($campo) => {
          valores.push(obterValorDoCampo($campo));
          fecharDetalhe();
        });
    }).then(() => {
      const valoresUnicos = [...new Set(valores)].filter(Boolean);

      expect(
        valoresUnicos.length,
        "valores liquidados disponíveis nos detalhamentos",
      ).to.be.greaterThan(0);

      return cy.wrap(valoresUnicos, { log: false });
    });
  });
}

function obterValoresPagosDosDetalhamentos(limite = 5) {
  return obterLinhasValidas().then((linhas) => {
    const quantidade = Math.min(limite, linhas.length);
    const indices = Array.from({ length: quantidade }, (_, indice) => indice);
    const valores = [];

    expect(
      indices.length,
      "empenhos disponíveis para verificar valores pagos",
    ).to.be.greaterThan(0);

    return cy.wrap(indices).each((indice) => {
      cy.wrap(linhas[indice]).find(".icon-file").click({ force: true });

      return cy
        .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
        .should("be.visible")
        .find("#pagamento")
        .first()
        .should("exist")
        .then(($campo) => {
          valores.push(obterValorDoCampo($campo));
          fecharDetalhe();
        });
    }).then(() => {
      const valoresUnicos = [...new Set(valores)].filter(Boolean);

      expect(
        valoresUnicos.length,
        "valores pagos disponíveis nos detalhamentos",
      ).to.be.greaterThan(0);

      return cy.wrap(valoresUnicos, { log: false });
    });
  });
}

function obterCampoLicitacaoDoDetalheAberto() {
  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .then(($popup) => {
      const entradaDireta = $popup
        .find("#licitacao, #processo_licitatorio, #processoLicitatorio")
        .first();

      if (entradaDireta.length) {
        return obterValorDoCampo(entradaDireta);
      }

      const label = Array.from($popup.find("label")).find((item) => {
        const texto = normalizarParaComparacao(item.textContent);

        return (
          /(?:processo|procedimento).*licit|licit.*(?:processo|procedimento)/.test(
            texto,
          ) || texto === "licitacao"
        );
      });

      if (!label) {
        return "";
      }

      const campo = label.closest(".campo") || label.parentElement;
      const entradaPorCampo = campo?.querySelector("input, textarea, select");
      const entradaPorFor = label.htmlFor
        ? Array.from($popup.find("input, textarea, select")).find(
            (elemento) => elemento.id === label.htmlFor,
          )
        : undefined;
      const entrada = entradaPorCampo || entradaPorFor;

      return entrada ? obterValorDoCampo(Cypress.$(entrada)) : "";
    });
}

function extrairNumeroDoProcessoLicitatorio(texto) {
  return normalizarTexto(texto)
    .match(/\b\d{1,6}\s*\/\s*(?:19|20)\d{2}\b/)?.[0]
    ?.replace(/\s/g, "");
}

function obterProcessoLicitatorioDoDetalhamento(indice = 0) {
  return obterLinhasValidas().then((linhas) => {
    if (indice >= linhas.length) {
      expect(
        indice,
        "todos os registros foram verificados sem encontrar um processo licitatório",
      ).to.be.lessThan(linhas.length);
    }

    cy.wrap(linhas[indice]).find(".icon-file").click({ force: true });

    return obterCampoLicitacaoDoDetalheAberto().then((valor) => {
      const numeroProcesso = extrairNumeroDoProcessoLicitatorio(valor);

      fecharDetalhe();

      if (numeroProcesso) {
        return cy.wrap(numeroProcesso, { log: false });
      }

      return obterProcessoLicitatorioDoDetalhamento(indice + 1);
    });
  });
}

function obterOrgaoDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#orgao")
    .first()
    .should("be.visible")
    .then(($campo) => {
      const orgao = obterValorDoCampo($campo);

      expect(orgao, "órgão disponível no detalhe do registro").to.not.equal("");
      fecharDetalhe();

      return cy.wrap(orgao, { log: false });
    });
}

function obterAcaoDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#acao")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const acao = obterValorDoCampo($campo);

      expect(acao, "ação disponível no detalhe do registro").to.not.equal("");
      fecharDetalhe();

      return cy.wrap(acao, { log: false });
    });
}

function obterUnidadeDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#unidade")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const unidade = obterValorDoCampo($campo);

      expect(unidade, "unidade disponível no detalhe do registro").to.not.equal(
        "",
      );
      fecharDetalhe();

      return cy.wrap(unidade, { log: false });
    });
}

function obterFuncaoDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#funcao")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const funcao = obterValorDoCampo($campo);

      expect(funcao, "função disponível no detalhe do registro").to.not.equal(
        "",
      );
      fecharDetalhe();

      return cy.wrap(funcao, { log: false });
    });
}

function obterSubfuncaoDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#subfuncao")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const subfuncao = obterValorDoCampo($campo);

      expect(
        subfuncao,
        "sub-função disponível no detalhe do registro",
      ).to.not.equal("");
      fecharDetalhe();

      return cy.wrap(subfuncao, { log: false });
    });
}

function obterProgramaDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#programa")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const programa = obterValorDoCampo($campo);

      expect(
        programa,
        "programa disponível no detalhe do registro",
      ).to.not.equal("");
      fecharDetalhe();

      return cy.wrap(programa, { log: false });
    });
}

function obterFonteDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#fonte")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const fonte = obterValorDoCampo($campo);

      expect(fonte, "fonte disponível no detalhe do registro").to.not.equal("");
      fecharDetalhe();

      return cy.wrap(fonte, { log: false });
    });
}

function obterGrupoDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#grupo")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const grupo = obterValorDoCampo($campo);

      expect(grupo, "grupo disponível no detalhe do registro").to.not.equal("");
      fecharDetalhe();

      return cy.wrap(grupo, { log: false });
    });
}

function obterModalidadeAplicacaoDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#modalidade")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const modalidade = obterValorDoCampo($campo);

      expect(
        modalidade,
        "modalidade de aplicação disponível no detalhe do registro",
      ).to.not.equal("");
      fecharDetalhe();

      return cy.wrap(modalidade, { log: false });
    });
}

function obterElementoDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#elemento")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const elemento = obterValorDoCampo($campo);

      expect(
        elemento,
        "elemento disponível no detalhe do registro",
      ).to.not.equal("");
      fecharDetalhe();

      return cy.wrap(elemento, { log: false });
    });
}

function obterCategoriaEconomicaDoRegistro() {
  acessarPrimeiroRegistro();

  return cy
    .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#categoria")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const categoria = obterValorDoCampo($campo);

      expect(
        categoria,
        "categoria econômica disponível no detalhe do registro",
      ).to.not.equal("");
      fecharDetalhe();

      return cy.wrap(categoria, { log: false });
    });
}

function abrirFiltroAvancado() {
  cy.get("#busca-a", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy.get("#b_org", { timeout: 30000 }).should("be.visible");
}

function selecionarOrgaoNoFiltroAvancado(orgaoEsperado) {
  cy.get("#b_org .selected", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#b_org .options", { timeout: 30000 })
    .should("be.visible")
    .find(".list a", { timeout: 30000 })
    .filter(":visible")
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        orgaosCorrespondem(orgaoEsperado, elemento.textContent),
      );

      expect(
        opcao,
        `órgão do registro "${orgaoEsperado}" disponível no filtro avançado`,
      ).to.exist;

      const orgaoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get("#b_org .selected", { timeout: 30000 }).should(
        "contain",
        orgaoSelecionado,
      );

      return cy.wrap(orgaoSelecionado, { log: false });
    });
}

function preencherCredorNoFiltroAvancado(credorEsperado) {
  return obterCampoAvancadoPorRotulo("Credor").then(($campo) => {
    const $entrada = $campo.find("input, textarea").filter(":visible").first();

    expect(
      $entrada.length,
      "campo textual de credor disponível",
    ).to.be.greaterThan(0);

    return cy
      .wrap($entrada)
      .should("be.visible")
      .click({ force: true })
      .clear({ force: true })
      .type(credorEsperado, { force: true })
      .should("have.value", credorEsperado)
      .then(() => cy.wrap(credorEsperado, { log: false }));
  });
}

function preencherCpfCnpjNoFiltroAvancado(documentoEsperado) {
  return obterCampoAvancadoPorRotulo("CPF/CNPJ").then(($campo) => {
    const $entrada = $campo.find("input, textarea").filter(":visible").first();

    expect(
      $entrada.length,
      "campo textual de CPF/CNPJ disponível",
    ).to.be.greaterThan(0);

    return cy
      .wrap($entrada)
      .should("be.visible")
      .click({ force: true })
      .clear({ force: true })
      .type(documentoEsperado, { force: true })
      .then(($input) => {
        expect(
          normalizarDocumento($input.val()),
          "CPF/CNPJ preenchido no filtro avançado",
        ).to.equal(normalizarDocumento(documentoEsperado));
      });
  });
}

function preencherNumeroNoFiltroAvancado(numeroEsperado) {
  return obterCampoAvancadoPorRotulo("Empenho")
    .find("input, textarea")
    .filter(":visible")
    .first()
    .should("be.visible")
    .clear({ force: true })
    .type(numeroEsperado, { force: true })
    .should("have.value", numeroEsperado);
}

function preencherValoresEmpenhadosNoFiltroAvancado(valorEsperado) {
  return obterCampoAvancadoPorRotulo("Valores Empenhados").then(($campo) => {
    const $entradas = $campo.find("input, textarea").filter(":visible");

    expect(
      $entradas.length,
      "limites de valores empenhados disponíveis no filtro avançado",
    ).to.be.at.least(2);

    return cy
      .wrap($entradas.eq(0))
      .should("be.visible")
      .clear({ force: true })
      .type(valorEsperado, { force: true })
      .then(() =>
        cy
          .wrap($entradas.eq(1))
          .should("be.visible")
          .clear({ force: true })
          .type(valorEsperado, { force: true }),
      )
      .then(() => {
        expect(
          obterValorDoCampo($entradas.eq(0)),
          "valor mínimo empenhado preenchido no filtro avançado",
        ).to.equal(valorEsperado);
        expect(
          obterValorDoCampo($entradas.eq(1)),
          "valor máximo empenhado preenchido no filtro avançado",
        ).to.equal(valorEsperado);

        return cy.wrap(valorEsperado, { log: false });
      });
  });
}

function preencherValoresLiquidadosNoFiltroAvancado(valorEsperado) {
  return obterCampoAvancadoPorRotulo("Valores Liquidados").then(($campo) => {
    const $entradas = $campo.find("input, textarea").filter(":visible");

    expect(
      $entradas.length,
      "limites de valores liquidados disponíveis no filtro avançado",
    ).to.be.at.least(2);

    return cy
      .wrap($entradas.eq(0))
      .should("be.visible")
      .clear({ force: true })
      .type(valorEsperado, { force: true })
      .then(() =>
        cy
          .wrap($entradas.eq(1))
          .should("be.visible")
          .clear({ force: true })
          .type(valorEsperado, { force: true }),
      )
      .then(() => {
        expect(
          obterValorDoCampo($entradas.eq(0)),
          "valor mínimo liquidado preenchido no filtro avançado",
        ).to.equal(valorEsperado);
        expect(
          obterValorDoCampo($entradas.eq(1)),
          "valor máximo liquidado preenchido no filtro avançado",
        ).to.equal(valorEsperado);

        return cy.wrap(valorEsperado, { log: false });
      });
  });
}

function preencherValoresPagosNoFiltroAvancado(valorEsperado) {
  return obterCampoAvancadoPorRotulo("Valores Pagos").then(($campo) => {
    const $entradas = $campo.find("input, textarea").filter(":visible");

    expect(
      $entradas.length,
      "limites de valores pagos disponíveis no filtro avançado",
    ).to.be.at.least(2);

    return cy
      .wrap($entradas.eq(0))
      .should("be.visible")
      .clear({ force: true })
      .type(valorEsperado, { force: true })
      .then(() =>
        cy
          .wrap($entradas.eq(1))
          .should("be.visible")
          .clear({ force: true })
          .type(valorEsperado, { force: true }),
      )
      .then(() => {
        expect(
          obterValorDoCampo($entradas.eq(0)),
          "valor mínimo pago preenchido no filtro avançado",
        ).to.equal(valorEsperado);
        expect(
          obterValorDoCampo($entradas.eq(1)),
          "valor máximo pago preenchido no filtro avançado",
        ).to.equal(valorEsperado);

        return cy.wrap(valorEsperado, { log: false });
      });
  });
}

function selecionarLicitacaoNoFiltroAvancado(numeroProcesso, indice = 0) {
  return obterCampoAvancadoPorRotulo("Procedimento Licitatório")
    .find("input, textarea")
    .filter(":visible")
    .first()
    .should("be.visible")
    .clear({ force: true })
    .type(numeroProcesso, { force: true })
    .then(() =>
      cy
        .get("ul.ui-autocomplete:visible", { timeout: 30000 })
        .should("be.visible")
        .find("li.ui-menu-item .ui-menu-item-wrapper", { timeout: 30000 })
        .should("have.length.at.least", 1)
        .filter(":visible")
        .then(($opcoes) => {
          expect(
            indice,
            `opção de licitação ${indice + 1} disponível no filtro`,
          ).to.be.lessThan($opcoes.length);

          const opcao = $opcoes.eq(indice);
          const licitacaoSelecionada = normalizarTexto(opcao.text());

          cy.wrap(opcao).click({ force: true });
          return cy.wrap(
            {
              indice,
              totalOpcoes: $opcoes.length,
              texto: licitacaoSelecionada,
            },
            { log: false },
          );
        }),
    );
}

function obterQuantidadeDeRegistrosSemRetry() {
  return cy.get("body").then(($body) =>
    $body
      .find(SELETOR_LINHAS_VALIDAS)
      .filter(
        (_, linha) => !["not-found-line", "template_row"].includes(linha.id),
      ).length,
  );
}

function selecionarLicitacaoComResultado(numeroProcesso, indice = 0) {
  abrirFiltroAvancado();

  return selecionarLicitacaoNoFiltroAvancado(numeroProcesso, indice)
    .then((licitacaoSelecionada) => {
      pesquisarFiltroAvancadoComOuSemResultado();

      return obterQuantidadeDeRegistrosSemRetry().then((quantidade) => {
        if (quantidade > 0) {
          return cy.wrap(licitacaoSelecionada, { log: false });
        }

        const proximoIndice = indice + 1;

        expect(
          proximoIndice,
          "próxima opção de licitação disponível após resultado vazio",
        ).to.be.lessThan(licitacaoSelecionada.totalOpcoes);

        return selecionarLicitacaoComResultado(numeroProcesso, proximoIndice);
      });
    });
}

function selecionarAnoNoFiltroAvancado(anoEsperado) {
  return obterCampoAvancadoPorRotulo("Ano").then(($campo) => {
    cy.wrap($campo)
      .find(".selected", { timeout: 30000 })
      .should("be.visible")
      .click({ force: true });

    return cy
      .wrap($campo)
      .find(".options", { timeout: 30000 })
      .should("be.visible")
      .find("input#search", { timeout: 30000 })
      .should("be.visible")
      .clear({ force: true })
      .type(anoEsperado, { force: true })
      .then(() =>
        cy
          .wrap($campo)
          .find(".options .list a", { timeout: 30000 })
          .filter(":visible")
          .then(($opcoes) => {
            const opcao = Array.from($opcoes).find((elemento) =>
              valoresCorrespondem(anoEsperado, elemento.textContent),
            );

            expect(opcao, `ano "${anoEsperado}" disponível após a busca`).to
              .exist;

            const anoSelecionado = normalizarTexto(opcao.textContent);
            cy.wrap(opcao).click({ force: true });

            return cy
              .wrap($campo)
              .find(".selected", { timeout: 30000 })
              .should("contain", anoSelecionado)
              .then(() => cy.wrap(anoEsperado, { log: false }));
          }),
      );
  });
}

function selecionarValorEmpenhadoComResultado(valores, indice = 0) {
  expect(
    indice,
    "valor empenhado disponível para tentativa no filtro",
  ).to.be.lessThan(valores.length);

  abrirFiltroAvancado();

  return preencherValoresEmpenhadosNoFiltroAvancado(valores[indice]).then(
    (valorSelecionado) => {
      pesquisarFiltroAvancadoComOuSemResultado();

      return obterQuantidadeDeRegistrosSemRetry().then((quantidade) => {
        if (quantidade > 0) {
          return cy.wrap(valorSelecionado, { log: false });
        }

        return selecionarValorEmpenhadoComResultado(valores, indice + 1);
      });
    },
  );
}

function selecionarCovidNoFiltroAvancado(opcaoEsperada) {
  return obterCampoAvancadoPorRotulo("COVID-19").then(($campo) => {
    cy.wrap($campo)
      .find(".selected", { timeout: 30000 })
      .should("be.visible")
      .click({ force: true });

    return cy
      .wrap($campo)
      .find(".options", { timeout: 30000 })
      .should("be.visible")
      .find(".list a", { timeout: 30000 })
      .filter(":visible")
      .then(($opcoes) => {
        const opcao = Array.from($opcoes).find(
          (elemento) =>
            normalizarParaComparacao(elemento.textContent) ===
            normalizarParaComparacao(opcaoEsperada),
        );

        expect(
          opcao,
          `opção COVID-19 "${opcaoEsperada}" disponível no filtro avançado`,
        ).to.exist;

        const opcaoSelecionada = normalizarTexto(opcao.textContent);
        cy.wrap(opcao).click({ force: true });

        return cy
          .wrap($campo)
          .find(".selected", { timeout: 30000 })
          .should("contain", opcaoSelecionada)
          .then(() => cy.wrap(opcaoSelecionada, { log: false }));
      });
  });
}

function selecionarValorLiquidadoComResultado(valores, indice = 0) {
  expect(
    indice,
    "valor liquidado disponível para tentativa no filtro",
  ).to.be.lessThan(valores.length);

  abrirFiltroAvancado();

  return preencherValoresLiquidadosNoFiltroAvancado(valores[indice]).then(
    (valorSelecionado) => {
      pesquisarFiltroAvancadoComOuSemResultado();

      return obterQuantidadeDeRegistrosSemRetry().then((quantidade) => {
        if (quantidade > 0) {
          return cy.wrap(valorSelecionado, { log: false });
        }

        return selecionarValorLiquidadoComResultado(valores, indice + 1);
      });
    },
  );
}

function selecionarValorPagoComResultado(valores, indice = 0) {
  expect(
    indice,
    "valor pago disponível para tentativa no filtro",
  ).to.be.lessThan(valores.length);

  abrirFiltroAvancado();

  return preencherValoresPagosNoFiltroAvancado(valores[indice]).then(
    (valorSelecionado) => {
      pesquisarFiltroAvancadoComOuSemResultado();

      return obterQuantidadeDeRegistrosSemRetry().then((quantidade) => {
        if (quantidade > 0) {
          return cy.wrap(valorSelecionado, { log: false });
        }

        return selecionarValorPagoComResultado(valores, indice + 1);
      });
    },
  );
}

function selecionarAcaoNoFiltroAvancado(acaoEsperada) {
  cy.get("#b_ac .selected", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#b_ac .options", { timeout: 30000 })
    .should("be.visible")
    .find("input#search", { timeout: 30000 })
    .should("be.visible")
    .clear({ force: true })
    .type(acaoEsperada, { force: true })
    .should("have.value", acaoEsperada)
    .then(() =>
      cy.get("#b_ac .options .list a", { timeout: 30000 }).then(($opcoes) => {
        const correspondeAAcao = (elemento) =>
          normalizarParaComparacao(elemento.textContent) ===
          normalizarParaComparacao(acaoEsperada);
        const opcoes = Array.from($opcoes);
        const opcao =
          opcoes.find(
            (elemento) =>
              Cypress.$(elemento).is(":visible") && correspondeAAcao(elemento),
          ) || opcoes.find(correspondeAAcao);

        expect(
          opcao,
          `ação do registro "${acaoEsperada}" disponível após a busca`,
        ).to.exist;

        const acaoSelecionada = normalizarTexto(opcao.textContent);
        const comandoClique = cy
          .wrap(opcao)
          .scrollIntoView({ duration: 300, offset: { top: -80 } })
          .should("be.visible")
          .click({ force: true });

        return comandoClique.then(() => {
          cy.get("#b_ac .selected", { timeout: 30000 }).should(
            "contain",
            acaoSelecionada,
          );

          return cy.wrap(acaoSelecionada, { log: false });
        });
      }),
    );
}

function selecionarUnidadeNoFiltroAvancado(unidadeEsperada) {
  cy.get("#select_unidade .selected", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#select_unidade .options", { timeout: 30000 })
    .should("be.visible")
    .find("input#search", { timeout: 30000 })
    .should("be.visible")
    .clear({ force: true })
    .type(unidadeEsperada, { force: true })
    .should("have.value", unidadeEsperada)
    .then(() =>
      cy
        .get("#select_unidade .options .list a", { timeout: 30000 })
        .then(($opcoes) => {
          const correspondeAUnidade = (elemento) =>
            normalizarParaComparacao(elemento.textContent) ===
            normalizarParaComparacao(unidadeEsperada);
          const opcoes = Array.from($opcoes);
          const opcao =
            opcoes.find(
              (elemento) =>
                Cypress.$(elemento).is(":visible") &&
                correspondeAUnidade(elemento),
            ) || opcoes.find(correspondeAUnidade);

          expect(
            opcao,
            `unidade do registro "${unidadeEsperada}" disponível após a busca`,
          ).to.exist;

          const unidadeSelecionada = normalizarTexto(opcao.textContent);
          const comandoClique = cy
            .wrap(opcao)
            .scrollIntoView({ duration: 300, offset: { top: -80 } })
            .should("be.visible")
            .click({ force: true });

          return comandoClique.then(() => {
            cy.get("#select_unidade .selected", { timeout: 30000 }).should(
              "contain",
              unidadeSelecionada,
            );

            return cy.wrap(unidadeSelecionada, { log: false });
          });
        }),
    );
}

function selecionarFuncaoNoFiltroAvancado(funcaoEsperada) {
  cy.get("#b_fun .selected", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#b_fun .options", { timeout: 30000 })
    .should("be.visible")
    .find("input#search", { timeout: 30000 })
    .should("be.visible")
    .clear({ force: true })
    .type(funcaoEsperada, { force: true })
    .should("have.value", funcaoEsperada)
    .then(() =>
      cy.get("#b_fun .options .list a", { timeout: 30000 }).then(($opcoes) => {
        const correspondeAFuncao = (elemento) =>
          normalizarParaComparacao(elemento.textContent) ===
          normalizarParaComparacao(funcaoEsperada);
        const opcoes = Array.from($opcoes);
        const opcao =
          opcoes.find(
            (elemento) =>
              Cypress.$(elemento).is(":visible") &&
              correspondeAFuncao(elemento),
          ) || opcoes.find(correspondeAFuncao);

        expect(
          opcao,
          `função do registro "${funcaoEsperada}" disponível após a busca`,
        ).to.exist;

        const funcaoSelecionada = normalizarTexto(opcao.textContent);
        const comandoClique = cy
          .wrap(opcao)
          .scrollIntoView({ duration: 300, offset: { top: -80 } })
          .should("be.visible")
          .click({ force: true });

        return comandoClique.then(() => {
          cy.get("#b_fun .selected", { timeout: 30000 }).should(
            "contain",
            funcaoSelecionada,
          );

          return cy.wrap(funcaoSelecionada, { log: false });
        });
      }),
    );
}

function selecionarSubfuncaoNoFiltroAvancado(subfuncaoEsperada) {
  cy.get("#b_subfun .selected", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#b_subfun .options", { timeout: 30000 })
    .should("be.visible")
    .find("input#search", { timeout: 30000 })
    .should("be.visible")
    .clear({ force: true })
    .type(subfuncaoEsperada, { force: true })
    .should("have.value", subfuncaoEsperada)
    .then(() =>
      cy
        .get("#b_subfun .options .list a", { timeout: 30000 })
        .then(($opcoes) => {
          const correspondeASubfuncao = (elemento) =>
            normalizarParaComparacao(elemento.textContent) ===
            normalizarParaComparacao(subfuncaoEsperada);
          const opcoes = Array.from($opcoes);
          const opcao =
            opcoes.find(
              (elemento) =>
                Cypress.$(elemento).is(":visible") &&
                correspondeASubfuncao(elemento),
            ) || opcoes.find(correspondeASubfuncao);

          expect(
            opcao,
            `sub-função do registro "${subfuncaoEsperada}" disponível após a busca`,
          ).to.exist;

          const subfuncaoSelecionada = normalizarTexto(opcao.textContent);
          const comandoClique = cy
            .wrap(opcao)
            .scrollIntoView({ duration: 300, offset: { top: -80 } })
            .should("be.visible")
            .click({ force: true });

          return comandoClique.then(() => {
            cy.get("#b_subfun .selected", { timeout: 30000 }).should(
              "contain",
              subfuncaoSelecionada,
            );

            return cy.wrap(subfuncaoSelecionada, { log: false });
          });
        }),
    );
}

function selecionarProgramaNoFiltroAvancado(programaEsperado) {
  cy.get("#select_programa .selected", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#select_programa .options", { timeout: 30000 })
    .should("be.visible")
    .find("input#search", { timeout: 30000 })
    .should("be.visible")
    .clear({ force: true })
    .type(programaEsperado, { force: true })
    .should("have.value", programaEsperado)
    .then(() =>
      cy
        .get("#select_programa .options .list a", { timeout: 30000 })
        .then(($opcoes) => {
          const correspondeAPrograma = (elemento) =>
            normalizarParaComparacao(elemento.textContent) ===
            normalizarParaComparacao(programaEsperado);
          const opcoes = Array.from($opcoes);
          const opcao =
            opcoes.find(
              (elemento) =>
                Cypress.$(elemento).is(":visible") &&
                correspondeAPrograma(elemento),
            ) || opcoes.find(correspondeAPrograma);

          expect(
            opcao,
            `programa do registro "${programaEsperado}" disponível após a busca`,
          ).to.exist;

          const programaSelecionado = normalizarTexto(opcao.textContent);
          const comandoClique = cy
            .wrap(opcao)
            .scrollIntoView({ duration: 300, offset: { top: -80 } })
            .should("be.visible")
            .click({ force: true });

          return comandoClique.then(() => {
            cy.get("#select_programa .selected", { timeout: 30000 }).should(
              "contain",
              programaSelecionado,
            );

            return cy.wrap(programaSelecionado, { log: false });
          });
        }),
    );
}

function selecionarFonteNoFiltroAvancado(fonteEsperada) {
  cy.get("#select_fonte .selected", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#select_fonte .options", { timeout: 30000 })
    .should("be.visible")
    .find("input#search", { timeout: 30000 })
    .should("be.visible")
    .clear({ force: true })
    .type(fonteEsperada, { force: true })
    .should("have.value", fonteEsperada)
    .then(() =>
      cy
        .get("#select_fonte .options .list a", { timeout: 30000 })
        .then(($opcoes) => {
          const correspondeAFonte = (elemento) =>
            normalizarParaComparacao(elemento.textContent) ===
            normalizarParaComparacao(fonteEsperada);
          const opcoes = Array.from($opcoes);
          const opcao =
            opcoes.find(
              (elemento) =>
                Cypress.$(elemento).is(":visible") &&
                correspondeAFonte(elemento),
            ) || opcoes.find(correspondeAFonte);

          expect(
            opcao,
            `fonte do registro "${fonteEsperada}" disponível após a busca`,
          ).to.exist;

          const fonteSelecionada = normalizarTexto(opcao.textContent);
          const comandoClique = cy
            .wrap(opcao)
            .scrollIntoView({ duration: 300, offset: { top: -80 } })
            .should("be.visible")
            .click({ force: true });

          return comandoClique.then(() => {
            cy.get("#select_fonte .selected", { timeout: 30000 }).should(
              "contain",
              fonteSelecionada,
            );

            return cy.wrap(fonteSelecionada, { log: false });
          });
        }),
    );
}

function selecionarCategoriaEconomicaNoFiltroAvancado(categoriaEsperada) {
  cy.get("#select_categoria_economica .selected", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#select_categoria_economica .options", { timeout: 30000 })
    .should("be.visible")
    .find("input#search", { timeout: 30000 })
    .should("be.visible")
    .clear({ force: true })
    .type(categoriaEsperada, { force: true })
    .should("have.value", categoriaEsperada)
    .then(() =>
      cy
        .get("#select_categoria_economica .options .list a", {
          timeout: 30000,
        })
        .then(($opcoes) => {
          const correspondeACategoria = (elemento) =>
            normalizarParaComparacao(elemento.textContent) ===
            normalizarParaComparacao(categoriaEsperada);
          const opcoes = Array.from($opcoes);
          const opcao =
            opcoes.find(
              (elemento) =>
                Cypress.$(elemento).is(":visible") &&
                correspondeACategoria(elemento),
            ) || opcoes.find(correspondeACategoria);

          expect(
            opcao,
            `categoria econômica do registro "${categoriaEsperada}" disponível após a busca`,
          ).to.exist;

          const categoriaSelecionada = normalizarTexto(opcao.textContent);
          const comandoClique = cy
            .wrap(opcao)
            .scrollIntoView({ duration: 300, offset: { top: -80 } })
            .should("be.visible")
            .click({ force: true });

          return comandoClique.then(() => {
            cy.get("#select_categoria_economica .selected", {
              timeout: 30000,
            }).should("contain", categoriaSelecionada);

            return cy.wrap(categoriaSelecionada, { log: false });
          });
        }),
    );
}

function selecionarGrupoNoFiltroAvancado(grupoEsperado) {
  return cy
    .contains(".campo label", /^Grupo$/i)
    .parent()
    .then(($campo) => {
      cy.wrap($campo)
        .find(".selected", { timeout: 30000 })
        .should("be.visible")
        .click({ force: true });

      return cy
        .wrap($campo)
        .find(".options", { timeout: 30000 })
        .should("be.visible")
        .find("input#search", { timeout: 30000 })
        .should("be.visible")
        .clear({ force: true })
        .type(grupoEsperado, { force: true })
        .should("have.value", grupoEsperado)
        .then(() =>
          cy
            .wrap($campo)
            .find(".options .list a", { timeout: 30000 })
            .filter(":visible")
            .then(($opcoes) => {
              const opcao = Array.from($opcoes).find((elemento) =>
                valoresCorrespondem(grupoEsperado, elemento.textContent),
              );

              expect(
                opcao,
                `grupo do registro "${grupoEsperado}" disponível após a busca`,
              ).to.exist;

              const grupoSelecionado = normalizarTexto(opcao.textContent);
              cy.wrap(opcao).click({ force: true });

              return cy
                .wrap($campo)
                .find(".selected", { timeout: 30000 })
                .should("contain", grupoSelecionado)
                .then(() => cy.wrap(grupoSelecionado, { log: false }));
            }),
        );
    });
}

function selecionarModalidadeAplicacaoNoFiltroAvancado(modalidadeEsperada) {
  cy.get("#select_modalidade .selected", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#select_modalidade .options", { timeout: 30000 })
    .should("be.visible")
    .find("input#search", { timeout: 30000 })
    .should("be.visible")
    .clear({ force: true })
    .type(modalidadeEsperada, { force: true })
    .should("have.value", modalidadeEsperada)
    .then(() =>
      cy
        .get("#select_modalidade .options .list a", { timeout: 30000 })
        .filter(":visible")
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find((elemento) =>
            valoresCorrespondem(modalidadeEsperada, elemento.textContent),
          );

          expect(
            opcao,
            `modalidade de aplicação do registro "${modalidadeEsperada}" disponível após a busca`,
          ).to.exist;

          const modalidadeSelecionada = normalizarTexto(opcao.textContent);
          cy.wrap(opcao).click({ force: true });

          return cy
            .get("#select_modalidade .selected", { timeout: 30000 })
            .should("contain", modalidadeSelecionada)
            .then(() => cy.wrap(modalidadeSelecionada, { log: false }));
        }),
    );
}

function selecionarElementoNoFiltroAvancado(elementoEsperado) {
  cy.get("#select_elemento .selected", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#select_elemento .options", { timeout: 30000 })
    .should("be.visible")
    .find("input#search", { timeout: 30000 })
    .should("be.visible")
    .clear({ force: true })
    .type(elementoEsperado, { force: true })
    .should("have.value", elementoEsperado)
    .then(() =>
      cy
        .get("#select_elemento .options .list a", { timeout: 30000 })
        .filter(":visible")
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find((elemento) =>
            valoresCorrespondem(elementoEsperado, elemento.textContent),
          );

          expect(
            opcao,
            `elemento do registro "${elementoEsperado}" disponível após a busca`,
          ).to.exist;

          const elementoSelecionado = normalizarTexto(opcao.textContent);
          cy.wrap(opcao).click({ force: true });

          return cy
            .get("#select_elemento .selected", { timeout: 30000 })
            .should("contain", elementoSelecionado)
            .then(() => cy.wrap(elementoSelecionado, { log: false }));
        }),
    );
}

function pesquisarFiltroAvancado() {
  cy.get("#b_search", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  cy.get("#b_org", { timeout: 30000 }).should("not.exist");
  aguardarListagem();
}

function aguardarListagemComOuSemResultado() {
  cy.get(".loader", { timeout: 30000 }).should("not.exist");
  cy.get(".cont_dados", { timeout: 30000 }).should("be.visible");
  cy.get(".tb-load", { timeout: 30000 }).should("not.exist");
}

function pesquisarFiltroAvancadoComOuSemResultado() {
  cy.get("#b_search", { timeout: 30000 })
    .should("be.visible")
    .click({ force: true });

  cy.get("#b_org", { timeout: 30000 }).should("not.exist");
  aguardarListagemComOuSemResultado();
}

function validarCredorNoResultado(credorEsperado) {
  obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      "registros retornados pelo filtro de credor",
    ).to.be.greaterThan(0);

    Array.from(linhas).forEach((linha) => {
      const credorRetornado = normalizarTexto(
        Cypress.$(linha).find(".colCredor").text(),
      );

      expect(credorRetornado, "credor disponível no resultado").to.not.equal(
        "",
      );
      expect(
        valoresCorrespondem(credorEsperado, credorRetornado),
        `credor retornado "${credorRetornado}" compatível com "${credorEsperado}"`,
      ).to.equal(true);
    });
  });
}

function validarNumeroNoResultado(numeroEsperado) {
  return obterLinhasValidas()
    .then((linhas) => {
      expect(
        linhas.length,
        "registros retornados pelo filtro de número do empenho",
      ).to.be.greaterThan(0);
    })
    .then(() => {
      acessarPrimeiroRegistro();

      return obterNumeroDoDetalheAberto()
        .then((numeroRetornado) => {
          expect(
            numeroRetornado,
            "número do empenho retornado compatível com o pesquisado",
          ).to.equal(numeroEsperado);
        })
        .then(() => fecharDetalhe());
    });
}

function validarValorEmpenhadoNoResultado(valorEsperado) {
  return obterLinhasValidas()
    .then((linhas) => {
      expect(
        linhas.length,
        "registros retornados pelo filtro de valor empenhado",
      ).to.be.greaterThan(0);
    })
    .then(() => {
      acessarPrimeiroRegistro();

      return cy
        .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
        .should("be.visible")
        .find("#valor_empenhado")
        .first()
        .should("exist")
        .then(($campo) => {
          const valorRetornado = obterValorDoCampo($campo);

          expect(
            valorRetornado,
            "valor empenhado disponível no detalhamento do resultado",
          ).to.equal(valorEsperado);
        })
        .then(() => fecharDetalhe());
    });
}

function validarValorLiquidadoNoResultado(valorEsperado) {
  return obterLinhasValidas()
    .then((linhas) => {
      expect(
        linhas.length,
        "registros retornados pelo filtro de valor liquidado",
      ).to.be.greaterThan(0);
    })
    .then(() => {
      acessarPrimeiroRegistro();

      return cy
        .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
        .should("be.visible")
        .find("#liquidacao")
        .first()
        .should("exist")
        .then(($campo) => {
          const valorRetornado = obterValorDoCampo($campo);

          expect(
            valorRetornado,
            "valor liquidado disponível no detalhamento do resultado",
          ).to.equal(valorEsperado);
        })
        .then(() => fecharDetalhe());
    });
}

function validarValorPagoNoResultado(valorEsperado) {
  return obterLinhasValidas()
    .then((linhas) => {
      expect(
        linhas.length,
        "registros retornados pelo filtro de valor pago",
      ).to.be.greaterThan(0);
    })
    .then(() => {
      acessarPrimeiroRegistro();

      return cy
        .get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
        .should("be.visible")
        .find("#pagamento")
        .first()
        .should("exist")
        .then(($campo) => {
          const valorRetornado = obterValorDoCampo($campo);

          expect(
            valorRetornado,
            "valor pago disponível no detalhamento do resultado",
          ).to.equal(valorEsperado);
        })
        .then(() => fecharDetalhe());
    });
}

function validarCpfCnpjNoResultado(documentoEsperado) {
  expect(
    normalizarDocumento(documentoEsperado),
    "documento usado no filtro deve ser um CNPJ",
  ).to.have.length(14);

  obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      "registros retornados pelo filtro de CPF/CNPJ",
    ).to.be.greaterThan(0);
  });

  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#cpf_cnpj")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const documentoRetornado = obterValorDoCampo($campo);

      expect(
        documentoRetornado,
        "CPF/CNPJ disponível no resultado",
      ).to.not.equal("");
      expect(
        normalizarDocumento(documentoRetornado),
        "CPF/CNPJ retornado compatível com o pesquisado",
      ).to.equal(normalizarDocumento(documentoEsperado));
    })
    .then(() => fecharDetalhe());
}

function validarAnoNoResultado(anoEsperado) {
  obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      "registros retornados pelo filtro de ano",
    ).to.be.greaterThan(0);
  });

  acessarPrimeiroRegistro();

  cy.get("#data", { timeout: 30000 })
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const dataRetornada = obterValorDoCampo($campo);
      const anoRetornado = dataRetornada.match(/\b(?:19|20)\d{2}\b/)?.[0];

      expect(
        anoRetornado,
        "ano disponível no campo #data do resultado",
      ).to.not.equal(undefined);
      expect(
        anoRetornado,
        `data "${dataRetornada}" compatível com o ano pesquisado`,
      ).to.equal(anoEsperado);
    })
    .then(() => fecharDetalhe());
}

function validarResultadoCovidNoFiltroAvancado(opcaoCovid) {
  cy.get("body", { timeout: 30000 }).then(($body) => {
    const linhas = $body
      .find(SELETOR_LINHAS_VALIDAS)
      .toArray()
      .filter(
        (linha) => !["not-found-line", "template_row"].includes(linha.id),
      );

    if (linhas.length > 0) {
      expect(
        linhas.length,
        `registros retornados para COVID-19 ${opcaoCovid}`,
      ).to.be.greaterThan(0);
      return;
    }

    cy.get("#not-found-line", { timeout: 30000 })
      .should("be.visible")
      .and("contain.text", "Nenhum resultado encontrado");
  });
}

function validarLicitacaoNoResultado(licitacaoEsperada) {
  const numeroEsperado = extrairNumeroDoProcessoLicitatorio(licitacaoEsperada);

  expect(
    numeroEsperado,
    "número do processo disponível na licitação selecionada",
  ).to.not.equal(undefined);

  return obterLinhasValidas()
    .then((linhas) => {
      expect(
        linhas.length,
        "registros retornados pelo filtro de procedimento licitatório",
      ).to.be.greaterThan(0);
    })
    .then(() => {
      acessarPrimeiroRegistro();

      return obterCampoLicitacaoDoDetalheAberto()
        .then((licitacaoRetornada) => {
          const numeroRetornado =
            extrairNumeroDoProcessoLicitatorio(licitacaoRetornada);

          expect(
            numeroRetornado,
            "número do processo disponível no detalhe do resultado",
          ).to.equal(numeroEsperado);
        })
        .then(() => fecharDetalhe());
    });
}

function validarOrgaoNoResultado(orgaoEsperado) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#orgao")
    .first()
    .should("be.visible")
    .then(($campo) => {
      const orgaoRetornado = obterValorDoCampo($campo);

      expect(orgaoRetornado, "órgão disponível no resultado").to.not.equal("");
      expect(
        orgaosCorrespondem(orgaoEsperado, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com "${orgaoEsperado}"`,
      ).to.equal(true);
    })
    .then(() => fecharDetalhe());
}

function validarAcaoNoResultado(acaoEsperada) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#acao")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const acaoRetornada = obterValorDoCampo($campo);

      expect(acaoRetornada, "ação disponível no resultado").to.not.equal("");
      expect(
        normalizarParaComparacao(acaoRetornada),
        `ação retornada compatível com "${acaoEsperada}"`,
      ).to.equal(normalizarParaComparacao(acaoEsperada));
    })
    .then(() => fecharDetalhe());
}

function validarUnidadeNoResultado(unidadeEsperada) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#unidade")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const unidadeRetornada = obterValorDoCampo($campo);

      expect(unidadeRetornada, "unidade disponível no resultado").to.not.equal(
        "",
      );
      expect(
        normalizarParaComparacao(unidadeRetornada),
        `unidade retornada compatível com "${unidadeEsperada}"`,
      ).to.equal(normalizarParaComparacao(unidadeEsperada));
    })
    .then(() => fecharDetalhe());
}

function validarFuncaoNoResultado(funcaoEsperada) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#funcao")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const funcaoRetornada = obterValorDoCampo($campo);

      expect(funcaoRetornada, "função disponível no resultado").to.not.equal(
        "",
      );
      expect(
        normalizarParaComparacao(funcaoRetornada),
        `função retornada compatível com "${funcaoEsperada}"`,
      ).to.equal(normalizarParaComparacao(funcaoEsperada));
    })
    .then(() => fecharDetalhe());
}

function validarSubfuncaoNoResultado(subfuncaoEsperada) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#subfuncao")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const subfuncaoRetornada = obterValorDoCampo($campo);

      expect(
        subfuncaoRetornada,
        "sub-função disponível no resultado",
      ).to.not.equal("");
      expect(
        normalizarParaComparacao(subfuncaoRetornada),
        `sub-função retornada compatível com "${subfuncaoEsperada}"`,
      ).to.equal(normalizarParaComparacao(subfuncaoEsperada));
    })
    .then(() => fecharDetalhe());
}

function validarProgramaNoResultado(programaEsperado) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#programa")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const programaRetornado = obterValorDoCampo($campo);

      expect(
        programaRetornado,
        "programa disponível no resultado",
      ).to.not.equal("");
      expect(
        normalizarParaComparacao(programaRetornado),
        `programa retornado compatível com "${programaEsperado}"`,
      ).to.equal(normalizarParaComparacao(programaEsperado));
    })
    .then(() => fecharDetalhe());
}

function validarFonteNoResultado(fonteEsperada) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#fonte")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const fonteRetornada = obterValorDoCampo($campo);

      expect(fonteRetornada, "fonte disponível no resultado").to.not.equal("");
      expect(
        normalizarParaComparacao(fonteRetornada),
        `fonte retornada compatível com "${fonteEsperada}"`,
      ).to.equal(normalizarParaComparacao(fonteEsperada));
    })
    .then(() => fecharDetalhe());
}

function validarGrupoNoResultado(grupoEsperado) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#grupo")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const grupoRetornado = obterValorDoCampo($campo);

      expect(grupoRetornado, "grupo disponível no resultado").to.not.equal("");
      expect(
        valoresCorrespondem(grupoEsperado, grupoRetornado),
        `grupo retornado "${grupoRetornado}" compatível com "${grupoEsperado}"`,
      ).to.equal(true);
    })
    .then(() => fecharDetalhe());
}

function validarModalidadeAplicacaoNoResultado(modalidadeEsperada) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#modalidade")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const modalidadeRetornada = obterValorDoCampo($campo);

      expect(
        modalidadeRetornada,
        "modalidade de aplicação disponível no resultado",
      ).to.not.equal("");
      expect(
        valoresCorrespondem(modalidadeEsperada, modalidadeRetornada),
        `modalidade retornada "${modalidadeRetornada}" compatível com "${modalidadeEsperada}"`,
      ).to.equal(true);
    })
    .then(() => fecharDetalhe());
}

function validarElementoNoResultado(elementoEsperado) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#elemento")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const elementoRetornado = obterValorDoCampo($campo);

      expect(
        elementoRetornado,
        "elemento disponível no resultado",
      ).to.not.equal("");
      expect(
        valoresCorrespondem(elementoEsperado, elementoRetornado),
        `elemento retornado "${elementoRetornado}" compatível com "${elementoEsperado}"`,
      ).to.equal(true);
    })
    .then(() => fecharDetalhe());
}

function validarCategoriaEconomicaNoResultado(categoriaEsperada) {
  acessarPrimeiroRegistro();

  cy.get(SELETOR_POPUP_DETALHES, { timeout: 30000 })
    .should("be.visible")
    .find("#categoria")
    .first()
    .should("exist")
    .scrollIntoView({ duration: 300 })
    .should("be.visible")
    .then(($campo) => {
      const categoriaRetornada = obterValorDoCampo($campo);

      expect(
        categoriaRetornada,
        "categoria econômica disponível no resultado",
      ).to.not.equal("");
      expect(
        normalizarParaComparacao(categoriaRetornada),
        `categoria econômica retornada compatível com "${categoriaEsperada}"`,
      ).to.equal(normalizarParaComparacao(categoriaEsperada));
    })
    .then(() => fecharDetalhe());
}

describe(`Portal: ${DESPESAS_NOME} - filtro avançado`, () => {
  beforeEach(() => {
    cy.visitPortal(DESPESAS_PATH);
    cy.get(".filtro", { timeout: 30000 }).should("be.visible");
    aguardarListagem();
  });

  it("filtra por órgão e valida o órgão no detalhe do resultado", () => {
    obterOrgaoDoRegistro()
      .then((orgao) => {
        abrirFiltroAvancado();
        return selecionarOrgaoNoFiltroAvancado(orgao);
      })
      .then((orgaoSelecionado) => {
        pesquisarFiltroAvancado();
        validarOrgaoNoResultado(orgaoSelecionado);
      });
  });

  it("filtra por credor usando a busca do filtro avançado e valida a listagem", () => {
    let credorBuscado;

    obterCredorDaListagem()
      .then((credor) => {
        credorBuscado = credor;
        abrirFiltroAvancado();
        return preencherCredorNoFiltroAvancado(credor);
      })
      .then(() => {
        pesquisarFiltroAvancado();
        validarCredorNoResultado(credorBuscado);
      });
  });

  it("filtra por CPF/CNPJ e valida o documento no resultado da listagem", () => {
    let documentoBuscado;

    obterCnpjDoRegistro()
      .then((cnpj) => {
        documentoBuscado = cnpj;
        abrirFiltroAvancado();
        return preencherCpfCnpjNoFiltroAvancado(cnpj);
      })
      .then(() => {
        pesquisarFiltroAvancado();
        validarCpfCnpjNoResultado(documentoBuscado);
      });
  });

  it("filtra por número do empenho e valida o número no detalhe do resultado", () => {
    let numeroBuscado;

    obterNumeroDoDetalhamento()
      .then((numero) => {
        numeroBuscado = numero;
        abrirFiltroAvancado();
        return preencherNumeroNoFiltroAvancado(numero);
      })
      .then(() => {
        pesquisarFiltroAvancado();
        return validarNumeroNoResultado(numeroBuscado);
      });
  });

  it("filtra por valores empenhados e valida o valor no detalhe do resultado", () => {
    obterValoresEmpenhadosDosDetalhamentos().then((valoresEmpenhados) =>
      selecionarValorEmpenhadoComResultado(valoresEmpenhados).then(
        (valorEmpenhado) => validarValorEmpenhadoNoResultado(valorEmpenhado),
      ),
    );
  });

  it("filtra por valores liquidados e valida o valor no detalhe do resultado", () => {
    obterValoresLiquidadosDosDetalhamentos().then((valoresLiquidados) =>
      selecionarValorLiquidadoComResultado(valoresLiquidados).then(
        (valorLiquidado) => validarValorLiquidadoNoResultado(valorLiquidado),
      ),
    );
  });

  it("filtra por valores pagos e valida o valor no detalhe do resultado", () => {
    obterValoresPagosDosDetalhamentos().then((valoresPagos) =>
      selecionarValorPagoComResultado(valoresPagos).then(
        (valorPago) => validarValorPagoNoResultado(valorPago),
      ),
    );
  });

  it("filtra por procedimento licitatório e valida uma licitação retornada", () => {
    obterProcessoLicitatorioDoDetalhamento()
      .then((numeroProcesso) =>
        selecionarLicitacaoComResultado(numeroProcesso),
      )
      .then((licitacaoSelecionada) =>
        validarLicitacaoNoResultado(licitacaoSelecionada.texto),
      );
  });

  it("filtra por ano usando a busca do filtro avançado e valida a listagem", () => {
    let anoBuscado;

    obterAnoDoDetalhamento()
      .then((ano) => {
        anoBuscado = ano;
        abrirFiltroAvancado();
        return selecionarAnoNoFiltroAvancado(ano);
      })
      .then(() => {
        pesquisarFiltroAvancado();
        validarAnoNoResultado(anoBuscado);
      });
  });

  it("filtra COVID-19 como Sim e valida dados ou mensagem de ausência", () => {
    abrirFiltroAvancado();
    selecionarCovidNoFiltroAvancado("Sim");
    pesquisarFiltroAvancadoComOuSemResultado();
    validarResultadoCovidNoFiltroAvancado("Sim");
  });

  it("filtra COVID-19 como Não e valida dados ou mensagem de ausência", () => {
    abrirFiltroAvancado();
    selecionarCovidNoFiltroAvancado("Não");
    pesquisarFiltroAvancadoComOuSemResultado();
    validarResultadoCovidNoFiltroAvancado("Não");
  });

  it("filtra por ação e valida a ação no detalhe do resultado", () => {
    obterAcaoDoRegistro()
      .then((acao) => {
        abrirFiltroAvancado();
        return selecionarAcaoNoFiltroAvancado(acao);
      })
      .then((acaoSelecionada) => {
        pesquisarFiltroAvancado();
        validarAcaoNoResultado(acaoSelecionada);
      });
  });

  it("filtra por unidade e valida a unidade no detalhe do resultado", () => {
    obterUnidadeDoRegistro()
      .then((unidade) => {
        abrirFiltroAvancado();
        return selecionarUnidadeNoFiltroAvancado(unidade);
      })
      .then((unidadeSelecionada) => {
        pesquisarFiltroAvancado();
        validarUnidadeNoResultado(unidadeSelecionada);
      });
  });

  it("filtra por função e valida a função no detalhe do resultado", () => {
    obterFuncaoDoRegistro()
      .then((funcao) => {
        abrirFiltroAvancado();
        return selecionarFuncaoNoFiltroAvancado(funcao);
      })
      .then((funcaoSelecionada) => {
        pesquisarFiltroAvancado();
        validarFuncaoNoResultado(funcaoSelecionada);
      });
  });

  it("filtra por sub-função e valida a sub-função no detalhe do resultado", () => {
    obterSubfuncaoDoRegistro()
      .then((subfuncao) => {
        abrirFiltroAvancado();
        return selecionarSubfuncaoNoFiltroAvancado(subfuncao);
      })
      .then((subfuncaoSelecionada) => {
        pesquisarFiltroAvancado();
        validarSubfuncaoNoResultado(subfuncaoSelecionada);
      });
  });

  it("filtra por programa e valida o programa no detalhe do resultado", () => {
    obterProgramaDoRegistro()
      .then((programa) => {
        abrirFiltroAvancado();
        return selecionarProgramaNoFiltroAvancado(programa);
      })
      .then((programaSelecionado) => {
        pesquisarFiltroAvancado();
        validarProgramaNoResultado(programaSelecionado);
      });
  });

  it("filtra por fonte e valida a fonte no detalhe do resultado", () => {
    obterFonteDoRegistro()
      .then((fonte) => {
        abrirFiltroAvancado();
        return selecionarFonteNoFiltroAvancado(fonte);
      })
      .then((fonteSelecionada) => {
        pesquisarFiltroAvancado();
        validarFonteNoResultado(fonteSelecionada);
      });
  });

  it("filtra por categoria econômica e valida no detalhe do resultado", () => {
    obterCategoriaEconomicaDoRegistro()
      .then((categoria) => {
        abrirFiltroAvancado();
        return selecionarCategoriaEconomicaNoFiltroAvancado(categoria);
      })
      .then((categoriaSelecionada) => {
        pesquisarFiltroAvancado();
        validarCategoriaEconomicaNoResultado(categoriaSelecionada);
      });
  });

  it("filtra por grupo usando a busca e valida o grupo no detalhe do resultado", () => {
    obterGrupoDoRegistro()
      .then((grupo) => {
        abrirFiltroAvancado();
        return selecionarGrupoNoFiltroAvancado(grupo);
      })
      .then((grupoSelecionado) => {
        pesquisarFiltroAvancado();
        validarGrupoNoResultado(grupoSelecionado);
      });
  });

  it("filtra por modalidade de aplicação usando a busca e valida o resultado", () => {
    obterModalidadeAplicacaoDoRegistro()
      .then((modalidade) => {
        abrirFiltroAvancado();
        return selecionarModalidadeAplicacaoNoFiltroAvancado(modalidade);
      })
      .then((modalidadeSelecionada) => {
        pesquisarFiltroAvancado();
        validarModalidadeAplicacaoNoResultado(modalidadeSelecionada);
      });
  });

  it("filtra por elemento usando a busca e valida o elemento no detalhe do resultado", () => {
    obterElementoDoRegistro()
      .then((elemento) => {
        abrirFiltroAvancado();
        return selecionarElementoNoFiltroAvancado(elemento);
      })
      .then((elementoSelecionado) => {
        pesquisarFiltroAvancado();
        validarElementoNoResultado(elementoSelecionado);
      });
  });
});
