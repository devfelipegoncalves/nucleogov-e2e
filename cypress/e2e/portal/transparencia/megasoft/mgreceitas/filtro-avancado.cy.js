/**
 * Testes do filtro avançado da listagem de receitas do módulo
 * Megasoft/Fiorilli.
 */

const RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/mgreceitas";
const RECEITAS_NOME = Cypress.env("RECEITAS_NOME") || "mgreceitas";
const LISTAGEM_TIMEOUT = 60000;
const SELETOR_LINHAS = ".cont_dados .tb tr[id]";
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
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

function obterMes(texto) {
  if (texto && typeof texto === "object" && texto.numero && texto.nome) {
    return texto;
  }

  const textoNormalizado = normalizarParaComparacao(texto);
  const indicePorNome = MESES.findIndex((mes) =>
    textoNormalizado.includes(normalizarParaComparacao(mes)),
  );

  if (indicePorNome >= 0) {
    return { numero: indicePorNome + 1, nome: MESES[indicePorNome] };
  }

  const numero = Number(textoNormalizado.match(/\b(1[0-2]|[1-9])\b/)?.[1]);

  expect(numero, `mês válido no valor "${texto}"`).to.be.within(1, 12);
  return { numero, nome: MESES[numero - 1] };
}

function mesesCorrespondem(mesEsperado, mesRetornado) {
  const esperado = obterMes(mesEsperado);
  const retornado = obterMes(mesRetornado);

  return esperado.numero === retornado.numero;
}

function obterCodigoOrgao(texto) {
  return normalizarTexto(texto).match(/^\d+/)?.[0] || "";
}

function obterTermoPesquisaOrgao(texto) {
  const nomeOrgao = normalizarTexto(texto).replace(/^\d+\s*[-.)]\s*/, "");
  const termos = normalizarParaComparacao(nomeOrgao)
    .split(" ")
    .filter((termo) => termo.length > 2);

  return termos[termos.length - 1] || nomeOrgao;
}

function orgaosCorrespondem(orgaoEsperado, orgaoRetornado) {
  const esperado = normalizarParaComparacao(orgaoEsperado);
  const retornado = normalizarParaComparacao(orgaoRetornado);
  const codigoEsperado = obterCodigoOrgao(orgaoEsperado);
  const codigoRetornado = obterCodigoOrgao(orgaoRetornado);

  return (
    (codigoEsperado !== "" && codigoEsperado === codigoRetornado) ||
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

function obterLinhasValidas($body) {
  return $body
    .find(SELETOR_LINHAS)
    .toArray()
    .filter(
      (linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        linha.querySelector(".colNumero, .colDescricao"),
    );
}

function aguardarRetornoDoFiltro() {
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

function aguardarListagemInicial() {
  cy.get(".filtro", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  aguardarRetornoDoFiltro();
}

function abrirPrimeiroRegistro() {
  return cy.get("body").then(($body) => {
    const linha = obterLinhasValidas($body)[0];

    expect(linha, "primeira receita disponível na listagem").to.exist;
    cy.wrap(linha)
      .find(".colIcone")
      .should("exist")
      .trigger("mousedown", { which: 1, force: true });
  });
}

function obterValorDoDetalhamento(rotuloEsperado) {
  return cy
    .get("#popdetalhes", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .get("#popdetalhes .campo", { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($campos) => {
      const campo = Array.from($campos).find(
        (elemento) =>
          normalizarParaComparacao(
            elemento.querySelector("label")?.textContent,
          ) === normalizarParaComparacao(rotuloEsperado),
      );

      expect(campo, `campo ${rotuloEsperado} no detalhamento da receita`).to
        .exist;

      const valor = normalizarTexto(
        campo.querySelector(".input")?.textContent || "",
      );
      expect(
        valor,
        `${rotuloEsperado} disponível no detalhamento`,
      ).to.not.equal("");

      return valor;
    });
}

function fecharDetalhamento() {
  return cy
    .get("#popdetalhes #close", { timeout: LISTAGEM_TIMEOUT })
    .click({ force: true })
    .then(() => cy.get("#popdetalhes").should("not.exist"));
}

function obterOrgaoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamento("Órgão").then((orgao) => {
    return fecharDetalhamento().then(() => cy.wrap(orgao, { log: false }));
  });
}

function obterAnoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamento("Ano").then((ano) => {
    const anoNormalizado = normalizarTexto(ano);

    expect(anoNormalizado, "ano do primeiro registro").to.match(/^\d{4}$/);

    return fecharDetalhamento().then(() =>
      cy.wrap(anoNormalizado, { log: false }),
    );
  });
}

function obterMesDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamento("Mês").then((mes) => {
    const mesNormalizado = obterMes(mes);

    return fecharDetalhamento().then(() =>
      cy.wrap(mesNormalizado, { log: false }),
    );
  });
}

function categoriasCorrespondem(categoriaEsperada, categoriaRetornada) {
  const esperado = normalizarParaComparacao(categoriaEsperada);
  const retornado = normalizarParaComparacao(categoriaRetornada);

  return (
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

function obterTermoPesquisaCategoria(categoria) {
  const termos = normalizarTexto(categoria)
    .split(/\s+/)
    .filter((termo) => termo.replace(/[^\p{L}\p{N}]/gu, "").length > 2);

  return termos[termos.length - 1] || normalizarTexto(categoria);
}

function obterTermoPesquisaOrigem(origem) {
  return obterTermoPesquisaCategoria(origem);
}

function obterCategoriaEconomicaDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamento("Categoria Econômica").then((categoria) => {
    const categoriaNormalizada = normalizarTexto(categoria);

    expect(
      categoriaNormalizada,
      "categoria econômica do primeiro registro",
    ).to.not.equal("");

    return fecharDetalhamento().then(() =>
      cy.wrap(categoriaNormalizada, { log: false }),
    );
  });
}

function obterValorDoDetalhamentoComRotulos(rotulosEsperados) {
  const rotulosNormalizados = rotulosEsperados.map(normalizarParaComparacao);

  return cy
    .get("#popdetalhes", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .get("#popdetalhes .campo", { timeout: LISTAGEM_TIMEOUT })
    .should("have.length.at.least", 1)
    .then(($campos) => {
      const campos = Array.from($campos);
      const obterRotulo = (elemento) =>
        normalizarParaComparacao(elemento.querySelector("label")?.textContent);
      const campo =
        campos.find((elemento) =>
          rotulosNormalizados.includes(obterRotulo(elemento)),
        ) ||
        campos.find((elemento) => {
          const rotulo = obterRotulo(elemento);

          return rotulosNormalizados.some((rotuloEsperado) =>
            rotulo.includes(rotuloEsperado),
          );
        });

      expect(
        campo,
        `campo ${rotulosEsperados.join(" ou ")} no detalhamento da receita`,
      ).to.exist;

      const valor = normalizarTexto(
        campo.querySelector(".input")?.textContent || "",
      );
      expect(
        valor,
        `${rotulosEsperados.join(" ou ")} disponível no detalhamento`,
      ).to.not.equal("");

      return valor;
    });
}

function obterOrigemDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamentoComRotulos(["Origem"]).then((origem) => {
    const origemNormalizada = normalizarTexto(origem);

    expect(origemNormalizada, "origem do primeiro registro").to.not.equal("");

    return fecharDetalhamento().then(() =>
      cy.wrap(origemNormalizada, { log: false }),
    );
  });
}

function selecionarOrgaoNoFiltroAvancado(orgaoEsperado) {
  cy.get("#busca_avancada", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  cy.get("#select_org_avanc .selected", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  const termoPesquisa = obterTermoPesquisaOrgao(orgaoEsperado);
  cy.get("#select_org_avanc .options > .containerbusca > #search", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true })
    .should("have.value", termoPesquisa);

  return cy
    .get("#select_org_avanc .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const codigoEsperado = obterCodigoOrgao(orgaoEsperado);
      const esperado = normalizarParaComparacao(orgaoEsperado);
      const opcao = Array.from($opcoes).find((elemento) => {
        const texto = normalizarParaComparacao(elemento.textContent);
        const codigo = normalizarTexto(
          elemento.getAttribute("href") || "",
        ).replace(/^#/, "");

        return (
          (codigoEsperado !== "" && codigo === codigoEsperado) ||
          texto === esperado ||
          texto.includes(esperado) ||
          esperado.includes(texto)
        );
      });

      expect(
        opcao,
        `órgão do registro "${orgaoEsperado}" disponível no filtro avançado`,
      ).to.exist;

      const orgaoSelecionado = normalizarTexto(opcao.textContent);
      expect(
        orgaosCorrespondem(orgaoEsperado, orgaoSelecionado),
        `opção do filtro avançado "${orgaoSelecionado}" corresponde ao órgão "${orgaoEsperado}"`,
      ).to.equal(true);

      cy.wrap(opcao).click({ force: true });
      cy.get("#select_org_avanc .selected").should("contain", orgaoSelecionado);

      return cy.wrap({ orgaoEsperado, orgaoSelecionado }, { log: false });
    });
}

function executarBuscaAvancada() {
  cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });
  cy.get("#select_org_avanc", { timeout: LISTAGEM_TIMEOUT }).should(
    "not.exist",
  );
  return aguardarRetornoDoFiltro();
}

function abrirFiltroAvancado() {
  return cy
    .get("#busca_avancada", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });
}

function abrirSelectAnoNoFiltroAvancado() {
  return cy
    .get("#select_ano .selected", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });
}

function obterSeletorMesNoFiltroAvancado() {
  return cy.get("body").then(($body) => {
    const elemento = Array.from($body.find("[id]")).find((item) =>
      /select.*mes|mes.*select/i.test(item.id),
    );

    expect(elemento, "campo Mês no filtro avançado").to.exist;
    return `#${elemento.id}`;
  });
}

function abrirSelectMesNoFiltroAvancado() {
  return obterSeletorMesNoFiltroAvancado().then((seletor) =>
    cy
      .get(`${seletor} .selected`, { timeout: LISTAGEM_TIMEOUT })
      .should("be.visible")
      .click({ force: true })
      .then(() => seletor),
  );
}

function selecionarAnoNoFiltroAvancadoAberto(anoEsperado) {
  const ano = String(anoEsperado);

  cy.get("#select_ano .options > .containerbusca > #search", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .clear({ force: true })
    .type(ano, { force: true })
    .should("have.value", ano);

  return cy
    .get("#select_ano .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) => {
        const texto = normalizarTexto(elemento.textContent);
        const valor = normalizarTexto(
          elemento.getAttribute("href") || "",
        ).replace(/^#/, "");

        return texto === ano || valor === ano;
      });

      expect(opcao, `ano ${ano} disponível no filtro avançado`).to.exist;

      cy.wrap(opcao).click({ force: true });
      cy.get("#select_ano .selected").should("contain", ano);

      return cy.wrap({ anoEsperado: ano, anoSelecionado: ano }, { log: false });
    });
}

function selecionarAnoNoFiltroAvancado(anoEsperado) {
  abrirFiltroAvancado();
  abrirSelectAnoNoFiltroAvancado();
  return selecionarAnoNoFiltroAvancadoAberto(anoEsperado);
}

function selecionarOutroAnoNoFiltroAvancado(anoAtual) {
  abrirFiltroAvancado();
  abrirSelectAnoNoFiltroAvancado();

  return cy
    .get("#select_ano .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 2)
    .then(($opcoes) => {
      const anoAtualNormalizado = String(anoAtual);
      const outroAno = Array.from($opcoes)
        .map((elemento) => {
          const texto = normalizarTexto(elemento.textContent);
          const valor = normalizarTexto(
            elemento.getAttribute("href") || "",
          ).replace(/^#/, "");

          return /^\d{4}$/.test(valor) ? valor : texto;
        })
        .find((ano) => /^\d{4}$/.test(ano) && ano !== anoAtualNormalizado);

      expect(outroAno, `ano diferente de ${anoAtualNormalizado}`).to.exist;

      return selecionarAnoNoFiltroAvancadoAberto(outroAno);
    });
}

function selecionarMesNoFiltroAvancadoAberto(seletor, mesEsperado) {
  const mes = obterMes(mesEsperado);

  cy.get(`${seletor} .options > .containerbusca > #search`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .clear({ force: true })
    .type(mes.nome, { force: true })
    .should("have.value", mes.nome);

  return cy
    .get(`${seletor} .options .list a:visible`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        mesesCorrespondem(mes, elemento.textContent),
      );

      expect(opcao, `mês ${mes.nome} disponível no filtro avançado`).to.exist;

      const mesSelecionado = normalizarTexto(opcao.textContent);
      expect(
        mesesCorrespondem(mes, mesSelecionado),
        `opção do filtro avançado "${mesSelecionado}" corresponde ao mês "${mes.nome}"`,
      ).to.equal(true);

      cy.wrap(opcao).click({ force: true });
      cy.get(`${seletor} .selected`).should("contain", mesSelecionado);

      return cy.wrap({ mesEsperado: mes, mesSelecionado }, { log: false });
    });
}

function selecionarMesNoFiltroAvancado(mesEsperado) {
  abrirFiltroAvancado();
  return abrirSelectMesNoFiltroAvancado().then((seletor) =>
    selecionarMesNoFiltroAvancadoAberto(seletor, mesEsperado),
  );
}

function selecionarOutroMesNoFiltroAvancado(mesAtual) {
  abrirFiltroAvancado();

  return abrirSelectMesNoFiltroAvancado().then((seletor) =>
    cy
      .get(`${seletor} .options .list a:visible`, {
        timeout: LISTAGEM_TIMEOUT,
      })
      .should("have.length.at.least", 2)
      .then(($opcoes) => {
        const mesAtualNormalizado = obterMes(mesAtual);
        const outroMes = Array.from($opcoes)
          .map((elemento) => obterMes(elemento.textContent))
          .find((mes) => mes.numero !== mesAtualNormalizado.numero);

        expect(outroMes, `mês diferente de ${mesAtualNormalizado.nome}`).to
          .exist;

        return selecionarMesNoFiltroAvancadoAberto(seletor, outroMes);
      }),
  );
}

function obterSeletorCategoriaEconomicaNoFiltroAvancado() {
  return cy.get("body").then(($body) => {
    const elemento = Array.from($body.find("[id]")).find((item) =>
      /select.*categor|categor.*select/i.test(item.id),
    );

    expect(elemento, "campo Categoria Econômica no filtro avançado").to.exist;
    return `#${elemento.id}`;
  });
}

function abrirSelectCategoriaEconomicaNoFiltroAvancado() {
  return obterSeletorCategoriaEconomicaNoFiltroAvancado().then((seletor) =>
    cy
      .get(`${seletor} .selected`, { timeout: LISTAGEM_TIMEOUT })
      .should("be.visible")
      .click({ force: true })
      .then(() => seletor),
  );
}

function selecionarCategoriaEconomicaNoFiltroAvancadoAberto(
  seletor,
  categoriaEsperada,
) {
  const termoPesquisa = obterTermoPesquisaCategoria(categoriaEsperada);

  cy.get(`${seletor} .options > .containerbusca > #search`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true })
    .should("have.value", termoPesquisa);

  return cy
    .get(`${seletor} .options .list a:visible`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        categoriasCorrespondem(categoriaEsperada, elemento.textContent),
      );

      expect(
        opcao,
        `categoria econômica "${categoriaEsperada}" disponível no filtro avançado`,
      ).to.exist;

      const categoriaSelecionada = normalizarTexto(opcao.textContent);
      expect(
        categoriasCorrespondem(categoriaEsperada, categoriaSelecionada),
        `opção do filtro avançado "${categoriaSelecionada}" corresponde à categoria econômica "${categoriaEsperada}"`,
      ).to.equal(true);

      cy.wrap(opcao).click({ force: true });
      cy.get(`${seletor} .selected`).should("contain", categoriaSelecionada);

      return cy.wrap(
        { categoriaEsperada, categoriaSelecionada },
        { log: false },
      );
    });
}

function selecionarCategoriaEconomicaNoFiltroAvancado(categoriaEsperada) {
  abrirFiltroAvancado();
  return abrirSelectCategoriaEconomicaNoFiltroAvancado().then((seletor) =>
    selecionarCategoriaEconomicaNoFiltroAvancadoAberto(
      seletor,
      categoriaEsperada,
    ),
  );
}

function origensCorrespondem(origemEsperada, origemRetornada) {
  const esperado = normalizarParaComparacao(origemEsperada);
  const retornado = normalizarParaComparacao(origemRetornada);

  return (
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

function obterSeletorOrigemNoFiltroAvancado() {
  return cy.get("body").then(($body) => {
    const elemento = Array.from($body.find("[id]")).find((item) =>
      /select.*orig|orig.*select/i.test(item.id),
    );

    expect(elemento, "campo Origem no filtro avançado").to.exist;
    return `#${elemento.id}`;
  });
}

function abrirSelectOrigemNoFiltroAvancado() {
  return obterSeletorOrigemNoFiltroAvancado().then((seletor) =>
    cy
      .get(`${seletor} .selected`, { timeout: LISTAGEM_TIMEOUT })
      .should("be.visible")
      .click({ force: true })
      .then(() => seletor),
  );
}

function pesquisarAutocompleteDeSelect(seletor, termoPesquisa) {
  return cy
    .get(`${seletor} .options input:visible`, { timeout: LISTAGEM_TIMEOUT })
    .first()
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true })
    .should("have.value", termoPesquisa)
    .then(($input) => {
      const $controleBusca = Cypress.$(seletor)
        .find(
          '.options:visible .containerbusca .icon-lupa:visible, .options:visible button:visible, .options:visible [class*="search"]:visible, .options:visible [class*="busca"]:visible',
        )
        .filter((_, elemento) => {
          const textoDoControle = normalizarParaComparacao(
            `${elemento.textContent || ""} ${elemento.className || ""} ${elemento.getAttribute("title") || ""} ${elemento.getAttribute("aria-label") || ""}`,
          );

          return /buscar|busca|pesquisar|search|magnif|lupa/.test(
            textoDoControle,
          );
        })
        .first();

      if ($controleBusca.length) {
        const $alvoBusca = $controleBusca.is(".containerbusca")
          ? $controleBusca
              .find(
                'button, a, [class*="icon"], [class*="lupa"], [class*="search"]',
              )
              .filter(":visible")
              .first()
          : $controleBusca;

        return cy
          .wrap($alvoBusca.length ? $alvoBusca : $controleBusca)
          .click({ force: true });
      }

      return cy.wrap($input).type("{enter}", { force: true });
    });
}

function selecionarOrigemNoFiltroAvancadoAberto(seletor, origemEsperada) {
  const termoPesquisa = obterTermoPesquisaOrigem(origemEsperada);

  return pesquisarAutocompleteDeSelect(seletor, termoPesquisa).then(() =>
    cy
      .get(`${seletor} .options .list a:visible`, {
        timeout: LISTAGEM_TIMEOUT,
      })
      .should("have.length.at.least", 1)
      .then(($opcoes) => {
        const opcao = Array.from($opcoes).find((elemento) =>
          origensCorrespondem(origemEsperada, elemento.textContent),
        );

        expect(
          opcao,
          `origem "${origemEsperada}" disponível no filtro avançado`,
        ).to.exist;

        const origemSelecionada = normalizarTexto(opcao.textContent);
        expect(
          origensCorrespondem(origemEsperada, origemSelecionada),
          `opção do filtro avançado "${origemSelecionada}" corresponde à origem "${origemEsperada}"`,
        ).to.equal(true);

        cy.wrap(opcao).click({ force: true });
        cy.get(`${seletor} .selected`).should("contain", origemSelecionada);

        return cy.wrap({ origemEsperada, origemSelecionada }, { log: false });
      }),
  );
}

function selecionarOrigemNoFiltroAvancado(origemEsperada) {
  abrirFiltroAvancado();
  return abrirSelectOrigemNoFiltroAvancado().then((seletor) =>
    selecionarOrigemNoFiltroAvancadoAberto(seletor, origemEsperada),
  );
}

function especiesCorrespondem(especieEsperada, especieRetornada) {
  const esperado = normalizarParaComparacao(especieEsperada);
  const retornado = normalizarParaComparacao(especieRetornada);

  return (
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

function obterEspecieDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamento("Espécie").then((especie) => {
    const especieNormalizada = normalizarTexto(especie);

    expect(especieNormalizada, "espécie do primeiro registro").to.not.equal("");

    return fecharDetalhamento().then(() =>
      cy.wrap(especieNormalizada, { log: false }),
    );
  });
}

function obterSeletorEspecieNoFiltroAvancado() {
  return cy.get("body").then(($body) => {
    const elemento = Array.from($body.find("[id]")).find((item) =>
      /select.*espec|espec.*select/i.test(item.id),
    );

    expect(elemento, "campo Espécie no filtro avançado").to.exist;
    return `#${elemento.id}`;
  });
}

function abrirSelectEspecieNoFiltroAvancado() {
  return obterSeletorEspecieNoFiltroAvancado().then((seletor) =>
    cy
      .get(`${seletor} .selected`, { timeout: LISTAGEM_TIMEOUT })
      .should("be.visible")
      .click({ force: true })
      .then(() => seletor),
  );
}

function selecionarEspecieNoFiltroAvancadoAberto(seletor, especieEsperada) {
  const termoPesquisa = obterTermoPesquisaCategoria(especieEsperada);

  return pesquisarAutocompleteDeSelect(seletor, termoPesquisa).then(() =>
    cy
      .get(`${seletor} .options .list a:visible`, {
        timeout: LISTAGEM_TIMEOUT,
      })
      .should("have.length.at.least", 1)
      .then(($opcoes) => {
        const opcao = Array.from($opcoes).find((elemento) =>
          especiesCorrespondem(especieEsperada, elemento.textContent),
        );

        expect(
          opcao,
          `espécie "${especieEsperada}" disponível no filtro avançado`,
        ).to.exist;

        const especieSelecionada = normalizarTexto(opcao.textContent);
        expect(
          especiesCorrespondem(especieEsperada, especieSelecionada),
          `opção do filtro avançado "${especieSelecionada}" corresponde à espécie "${especieEsperada}"`,
        ).to.equal(true);

        cy.wrap(opcao).click({ force: true });
        cy.get(`${seletor} .selected`).should("contain", especieSelecionada);

        return cy.wrap({ especieEsperada, especieSelecionada }, { log: false });
      }),
  );
}

function selecionarEspecieNoFiltroAvancado(especieEsperada) {
  abrirFiltroAvancado();
  return abrirSelectEspecieNoFiltroAvancado().then((seletor) =>
    selecionarEspecieNoFiltroAvancadoAberto(seletor, especieEsperada),
  );
}

function detalhamentosCorrespondem(
  detalhamentoEsperado,
  detalhamentoRetornado,
) {
  const esperado = normalizarParaComparacao(detalhamentoEsperado);
  const retornado = normalizarParaComparacao(detalhamentoRetornado);

  return (
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

function obterDetalhamentoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamento("Detalhamento").then((detalhamento) => {
    const detalhamentoNormalizado = normalizarTexto(detalhamento);

    expect(
      detalhamentoNormalizado,
      "detalhamento do primeiro registro",
    ).to.not.equal("");

    return fecharDetalhamento().then(() =>
      cy.wrap(detalhamentoNormalizado, { log: false }),
    );
  });
}

function obterSeletorDetalhamentoNoFiltroAvancado() {
  return cy.get("body").then(($body) => {
    const elemento = Array.from($body.find("[id]")).find((item) =>
      /select.*detalh|detalh.*select/i.test(item.id),
    );

    expect(elemento, "campo Detalhamento no filtro avançado").to.exist;
    return `#${elemento.id}`;
  });
}

function abrirSelectDetalhamentoNoFiltroAvancado() {
  return obterSeletorDetalhamentoNoFiltroAvancado().then((seletor) =>
    cy
      .get(`${seletor} .selected`, { timeout: LISTAGEM_TIMEOUT })
      .should("be.visible")
      .click({ force: true })
      .then(() => seletor),
  );
}

function selecionarDetalhamentoNoFiltroAvancadoAberto(
  seletor,
  detalhamentoEsperado,
) {
  const termoPesquisa = obterTermoPesquisaCategoria(detalhamentoEsperado);

  return pesquisarAutocompleteDeSelect(seletor, termoPesquisa).then(() =>
    cy
      .get(`${seletor} .options .list a:visible`, {
        timeout: LISTAGEM_TIMEOUT,
      })
      .should("have.length.at.least", 1)
      .then(($opcoes) => {
        const opcao = Array.from($opcoes).find((elemento) =>
          detalhamentosCorrespondem(detalhamentoEsperado, elemento.textContent),
        );

        expect(
          opcao,
          `detalhamento "${detalhamentoEsperado}" disponível no filtro avançado`,
        ).to.exist;

        const detalhamentoSelecionado = normalizarTexto(opcao.textContent);
        expect(
          detalhamentosCorrespondem(
            detalhamentoEsperado,
            detalhamentoSelecionado,
          ),
          `opção do filtro avançado "${detalhamentoSelecionado}" corresponde ao detalhamento "${detalhamentoEsperado}"`,
        ).to.equal(true);

        cy.wrap(opcao).click({ force: true });
        cy.get(`${seletor} .selected`).should(
          "contain",
          detalhamentoSelecionado,
        );

        return cy.wrap(
          { detalhamentoEsperado, detalhamentoSelecionado },
          { log: false },
        );
      }),
  );
}

function selecionarDetalhamentoNoFiltroAvancado(detalhamentoEsperado) {
  abrirFiltroAvancado();
  return abrirSelectDetalhamentoNoFiltroAvancado().then((seletor) =>
    selecionarDetalhamentoNoFiltroAvancadoAberto(seletor, detalhamentoEsperado),
  );
}

function fontesCorrespondem(fonteEsperada, fonteRetornada) {
  const esperado = normalizarParaComparacao(fonteEsperada);
  const retornado = normalizarParaComparacao(fonteRetornada);

  return (
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

function obterFonteDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamento("Fonte").then((fonte) => {
    const fonteNormalizada = normalizarTexto(fonte);

    expect(fonteNormalizada, "Fonte do primeiro registro").to.not.equal("");

    return fecharDetalhamento().then(() =>
      cy.wrap(fonteNormalizada, { log: false }),
    );
  });
}

function obterSeletorFonteNoFiltroAvancado() {
  return cy.get("body").then(($body) => {
    const elemento = Array.from($body.find("[id]")).find((item) =>
      /select.*fonte|fonte.*select/i.test(item.id),
    );

    expect(elemento, "campo Fonte no filtro avançado").to.exist;
    return `#${elemento.id}`;
  });
}

function abrirSelectFonteNoFiltroAvancado() {
  return obterSeletorFonteNoFiltroAvancado().then((seletor) =>
    cy
      .get(`${seletor} .selected`, { timeout: LISTAGEM_TIMEOUT })
      .should("be.visible")
      .click({ force: true })
      .then(() => seletor),
  );
}

function selecionarFonteNoFiltroAvancadoAberto(seletor, fonteEsperada) {
  const termoPesquisa = obterTermoPesquisaCategoria(fonteEsperada);

  return pesquisarAutocompleteDeSelect(seletor, termoPesquisa).then(() =>
    cy
      .get(`${seletor} .options .list a:visible`, {
        timeout: LISTAGEM_TIMEOUT,
      })
      .should("have.length.at.least", 1)
      .then(($opcoes) => {
        const opcao = Array.from($opcoes).find((elemento) =>
          fontesCorrespondem(fonteEsperada, elemento.textContent),
        );

        expect(opcao, `Fonte "${fonteEsperada}" disponível no filtro avançado`)
          .to.exist;

        const fonteSelecionada = normalizarTexto(opcao.textContent);
        expect(
          fontesCorrespondem(fonteEsperada, fonteSelecionada),
          `opção do filtro avançado "${fonteSelecionada}" corresponde à Fonte "${fonteEsperada}"`,
        ).to.equal(true);

        cy.wrap(opcao).click({ force: true });
        cy.get(`${seletor} .selected`).should("contain", fonteSelecionada);

        return cy.wrap({ fonteEsperada, fonteSelecionada }, { log: false });
      }),
  );
}

function selecionarFonteNoFiltroAvancado(fonteEsperada) {
  abrirFiltroAvancado();
  return abrirSelectFonteNoFiltroAvancado().then((seletor) =>
    selecionarFonteNoFiltroAvancadoAberto(seletor, fonteEsperada),
  );
}

function normalizarValorMonetario(valor) {
  const texto = normalizarTexto(valor).replace(/[^\d,.-]/g, "");

  if (texto.includes(",")) {
    return Number(texto.replace(/\./g, "").replace(",", "."));
  }

  return Number(texto);
}

function valoresPrevistosCorrespondem(valorEsperado, valorRetornado) {
  const esperado = normalizarValorMonetario(valorEsperado);
  const retornado = normalizarValorMonetario(valorRetornado);

  if (Number.isFinite(esperado) && Number.isFinite(retornado)) {
    return Math.abs(esperado - retornado) < 0.01;
  }

  return (
    normalizarParaComparacao(valorEsperado) ===
    normalizarParaComparacao(valorRetornado)
  );
}

function obterValorPrevistoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamento("Valor Previsto").then((valor) => {
    const valorNormalizado = normalizarTexto(valor);

    expect(
      valorNormalizado,
      "Valor Previsto do primeiro registro",
    ).to.not.equal("");

    return fecharDetalhamento().then(() =>
      cy.wrap(valorNormalizado, { log: false }),
    );
  });
}

function obterCampoValorPrevistoNoFiltroAvancado() {
  return cy.get("body").then(($body) => {
    const campo = Array.from($body.find(".campo")).find((elemento) => {
      const rotulo = normalizarParaComparacao(
        elemento.querySelector("label")?.textContent,
      );

      return rotulo === "valor previsto";
    });
    const input = campo?.querySelector("input, textarea");

    expect(input, "campo Valor Previsto no filtro avançado").to.exist;
    return cy.wrap(Cypress.$(input), { log: false });
  });
}

function preencherValorPrevistoNoFiltroAvancado(valorEsperado) {
  const valorParaPesquisa = normalizarTexto(valorEsperado).replace(
    /[^\d,.-]/g,
    "",
  );

  abrirFiltroAvancado();
  return obterCampoValorPrevistoNoFiltroAvancado()
    .should("be.visible")
    .clear({ force: true })
    .type(valorParaPesquisa, { force: true })
    .should("have.value", valorParaPesquisa)
    .then(() => cy.wrap({ valorEsperado, valorParaPesquisa }, { log: false }));
}

function obterValorArrecadadoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamento("Valor Arrecadado").then((valor) => {
    const valorNormalizado = normalizarTexto(valor);

    expect(
      valorNormalizado,
      "Valor Arrecadado do primeiro registro",
    ).to.not.equal("");

    return fecharDetalhamento().then(() =>
      cy.wrap(valorNormalizado, { log: false }),
    );
  });
}

function obterCampoValorArrecadadoNoFiltroAvancado() {
  return cy.get("body").then(($body) => {
    const campo = Array.from($body.find(".campo")).find((elemento) => {
      const rotulo = normalizarParaComparacao(
        elemento.querySelector("label")?.textContent,
      );

      return rotulo === "valor arrecadado";
    });
    const input = campo?.querySelector("input, textarea");

    expect(input, "campo Valor Arrecadado no filtro avançado").to.exist;
    return cy.wrap(Cypress.$(input), { log: false });
  });
}

function preencherValorArrecadadoNoFiltroAvancado(valorEsperado) {
  const valorNumerico = normalizarValorMonetario(valorEsperado);
  const valorParaPesquisa = Number.isFinite(valorNumerico)
    ? valorNumerico.toFixed(2)
    : normalizarTexto(valorEsperado).replace(/[^\d,.-]/g, "");

  abrirFiltroAvancado();
  return obterCampoValorArrecadadoNoFiltroAvancado()
    .should("be.visible")
    .clear({ force: true })
    .type(valorParaPesquisa, { force: true })
    .then(($input) => {
      const valorDigitado = normalizarTexto($input.val());

      expect(
        valorDigitado,
        "Valor Arrecadado preenchido no filtro",
      ).to.not.equal("");
      return cy.wrap(
        { valorEsperado, valorParaPesquisa: valorDigitado },
        { log: false },
      );
    });
}

function obterValorAcumuladoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();
  return obterValorDoDetalhamento("Valor Acumulado").then((valor) => {
    const valorNormalizado = normalizarTexto(valor);

    expect(
      valorNormalizado,
      "Valor Acumulado do primeiro registro",
    ).to.not.equal("");

    return fecharDetalhamento().then(() =>
      cy.wrap(valorNormalizado, { log: false }),
    );
  });
}

function obterCampoValorAcumuladoNoFiltroAvancado() {
  return cy.get("body").then(($body) => {
    const campo = Array.from($body.find(".campo")).find((elemento) => {
      const rotulo = normalizarParaComparacao(
        elemento.querySelector("label")?.textContent,
      );

      return rotulo === "valor acumulado";
    });
    const input = campo?.querySelector("input, textarea");

    expect(input, "campo Valor Acumulado no filtro avançado").to.exist;
    return cy.wrap(Cypress.$(input), { log: false });
  });
}

function preencherValorAcumuladoNoFiltroAvancado(valorEsperado) {
  const valorNumerico = normalizarValorMonetario(valorEsperado);
  const valorParaPesquisa = Number.isFinite(valorNumerico)
    ? valorNumerico.toFixed(2)
    : normalizarTexto(valorEsperado).replace(/[^\d,.-]/g, "");

  abrirFiltroAvancado();
  return obterCampoValorAcumuladoNoFiltroAvancado()
    .should("be.visible")
    .clear({ force: true })
    .type(valorParaPesquisa, { force: true })
    .then(($input) => {
      const valorDigitado = normalizarTexto($input.val());

      expect(
        valorDigitado,
        "Valor Acumulado preenchido no filtro",
      ).to.not.equal("");
      return cy.wrap(
        { valorEsperado, valorParaPesquisa: valorDigitado },
        { log: false },
      );
    });
}

function validarOrgaoDoResultadoAvancado({ orgaoSelecionado }) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][filtro avançado][Órgão=${orgaoSelecionado}] ${mensagem}`;

      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Órgão",
          orgaoSelecionado,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      expect(
        linhas.length,
        `listagem retornou dados para o órgão ${orgaoSelecionado}`,
      ).to.be.greaterThan(0);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para o órgão ${orgaoSelecionado}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamento("Órgão").then((orgaoRetornado) => {
      expect(
        orgaosCorrespondem(orgaoSelecionado, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com a busca "${orgaoSelecionado}"`,
      ).to.equal(true);
      return fecharDetalhamento();
    });
  });
}

function validarAnoDoResultadoAvancado({ anoSelecionado }) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][filtro avançado][Ano=${anoSelecionado}] ${mensagem}`;

      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Ano",
          anoSelecionado,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      expect(
        linhas.length,
        `listagem retornou dados para o ano ${anoSelecionado}`,
      ).to.be.greaterThan(0);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para o ano ${anoSelecionado}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamento("Ano").then((anoRetornado) => {
      expect(
        normalizarTexto(anoRetornado),
        `ano retornado "${anoRetornado}" compatível com a busca "${anoSelecionado}"`,
      ).to.equal(String(anoSelecionado));
      return fecharDetalhamento();
    });
  });
}

function validarMesDoResultadoAvancado({ mesEsperado, mesSelecionado }) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][filtro avançado][Mês=${mesSelecionado}] ${mensagem}`;

      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Mês",
          mesSelecionado,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      expect(
        linhas.length,
        `listagem retornou dados para o mês ${mesSelecionado}`,
      ).to.be.greaterThan(0);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para o mês ${mesSelecionado}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamento("Mês").then((mesRetornado) => {
      expect(
        mesesCorrespondem(mesEsperado, mesRetornado),
        `mês retornado "${mesRetornado}" compatível com a busca "${mesSelecionado}"`,
      ).to.equal(true);
      return fecharDetalhamento();
    });
  });
}

function validarCategoriaEconomicaDoResultadoAvancado({
  categoriaEsperada,
  categoriaSelecionada,
}) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][filtro avançado][Categoria Econômica=${categoriaSelecionada}] ${mensagem}`;

      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Categoria Econômica",
          categoriaSelecionada,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      expect(
        linhas.length,
        `listagem retornou dados para a categoria econômica ${categoriaSelecionada}`,
      ).to.be.greaterThan(0);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para a categoria econômica ${categoriaSelecionada}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamento("Categoria Econômica").then(
      (categoriaRetornada) => {
        expect(
          categoriasCorrespondem(categoriaEsperada, categoriaRetornada),
          `categoria econômica retornada "${categoriaRetornada}" compatível com a busca "${categoriaSelecionada}"`,
        ).to.equal(true);
        return fecharDetalhamento();
      },
    );
  });
}

function validarOrigemDoResultadoAvancado({
  origemEsperada,
  origemSelecionada,
}) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][filtro avançado][Origem=${origemSelecionada}] ${mensagem}`;

      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Origem",
          origemSelecionada,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      expect(
        linhas.length,
        `listagem retornou dados para a origem ${origemSelecionada}`,
      ).to.be.greaterThan(0);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para a origem ${origemSelecionada}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamentoComRotulos(["Origem"]).then(
      (origemRetornada) => {
        expect(
          origensCorrespondem(origemEsperada, origemRetornada),
          `origem retornada "${origemRetornada}" compatível com a busca "${origemSelecionada}"`,
        ).to.equal(true);
        return fecharDetalhamento();
      },
    );
  });
}

function validarEspecieDoResultadoAvancado({
  especieEsperada,
  especieSelecionada,
}) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][filtro avançado][Espécie=${especieSelecionada}] ${mensagem}`;

      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Espécie",
          especieSelecionada,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      expect(
        linhas.length,
        `listagem retornou dados para a espécie ${especieSelecionada}`,
      ).to.be.greaterThan(0);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para a espécie ${especieSelecionada}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamento("Espécie").then((especieRetornada) => {
      expect(
        especiesCorrespondem(especieEsperada, especieRetornada),
        `espécie retornada "${especieRetornada}" compatível com a busca "${especieSelecionada}"`,
      ).to.equal(true);
      return fecharDetalhamento();
    });
  });
}

function validarDetalhamentoDoResultadoAvancado({
  detalhamentoEsperado,
  detalhamentoSelecionado,
}) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][filtro avançado][Detalhamento=${detalhamentoSelecionado}] ${mensagem}`;

      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Detalhamento",
          detalhamentoSelecionado,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      expect(
        linhas.length,
        `listagem retornou dados para o detalhamento ${detalhamentoSelecionado}`,
      ).to.be.greaterThan(0);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para o detalhamento ${detalhamentoSelecionado}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamento("Detalhamento").then(
      (detalhamentoRetornado) => {
        expect(
          detalhamentosCorrespondem(
            detalhamentoEsperado,
            detalhamentoRetornado,
          ),
          `detalhamento retornado "${detalhamentoRetornado}" compatível com a busca "${detalhamentoSelecionado}"`,
        ).to.equal(true);
        return fecharDetalhamento();
      },
    );
  });
}

function validarFonteDoResultadoAvancado({ fonteEsperada, fonteSelecionada }) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][filtro avançado][Fonte=${fonteSelecionada}] ${mensagem}`;

      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Fonte",
          fonteSelecionada,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      expect(
        linhas.length,
        `listagem retornou dados para a Fonte ${fonteSelecionada}`,
      ).to.be.greaterThan(0);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para a Fonte ${fonteSelecionada}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamento("Fonte").then((fonteRetornada) => {
      expect(
        fontesCorrespondem(fonteEsperada, fonteRetornada),
        `Fonte retornada "${fonteRetornada}" compatível com a busca "${fonteSelecionada}"`,
      ).to.equal(true);
      return fecharDetalhamento();
    });
  });
}

function validarValorPrevistoDoResultadoAvancado({
  valorEsperado,
  valorParaPesquisa,
}) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      const resultado = `[${RECEITAS_NOME}][filtro avançado][Valor Previsto=${valorParaPesquisa}] ${mensagem}`;

      console.log(resultado);
      Cypress.log({
        name: "ALERTA",
        message: resultado,
        consoleProps: () => ({
          filtro: "Valor Previsto",
          valorParaPesquisa,
          mensagem,
        }),
      });
      cy.task("log", resultado);
      cy.log(resultado);

      expect(mensagem, "mensagem da listagem sem resultado").to.contain(
        "Nenhum resultado encontrado",
      );
      expect(
        linhas.length,
        `listagem retornou dados para o Valor Previsto ${valorParaPesquisa}`,
      ).to.be.greaterThan(0);
      return;
    }

    expect(
      linhas.length,
      `registros retornados para o Valor Previsto ${valorParaPesquisa}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamento("Valor Previsto").then((valorRetornado) => {
      expect(
        valoresPrevistosCorrespondem(valorEsperado, valorRetornado),
        `Valor Previsto retornado "${valorRetornado}" compatível com a busca "${valorParaPesquisa}"`,
      ).to.equal(true);
      return fecharDetalhamento();
    });
  });
}

function validarValorArrecadadoDoResultadoAvancado({
  valorEsperado,
  valorParaPesquisa,
}) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    expect(
      linhas.length,
      `registros retornados para o Valor Arrecadado ${valorParaPesquisa}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamento("Valor Arrecadado").then(
      (valorRetornado) => {
        expect(
          valoresPrevistosCorrespondem(valorEsperado, valorRetornado),
          `Valor Arrecadado retornado "${valorRetornado}" compatível com a busca "${valorParaPesquisa}"`,
        ).to.equal(true);
        return fecharDetalhamento();
      },
    );
  });
}

function validarValorAcumuladoDoResultadoAvancado({
  valorEsperado,
  valorParaPesquisa,
}) {
  return cy.get("body").then(($body) => {
    const linhas = obterLinhasValidas($body);

    expect(
      linhas.length,
      `registros retornados para o Valor Acumulado ${valorParaPesquisa}`,
    ).to.be.greaterThan(0);

    abrirPrimeiroRegistro();
    return obterValorDoDetalhamento("Valor Acumulado").then(
      (valorRetornado) => {
        expect(
          valoresPrevistosCorrespondem(valorEsperado, valorRetornado),
          `Valor Acumulado retornado "${valorRetornado}" compatível com a busca "${valorParaPesquisa}"`,
        ).to.equal(true);
        return fecharDetalhamento();
      },
    );
  });
}

describe(`Portal: ${RECEITAS_NOME} - filtro avançado`, () => {
  beforeEach(() => {
    cy.visitPortal(RECEITAS_PATH);
    aguardarListagemInicial();
  });

  it("busca um órgão no filtro avançado e valida o resultado", () => {
    obterOrgaoDoPrimeiroRegistro()
      .then((orgaoEsperado) => selecionarOrgaoNoFiltroAvancado(orgaoEsperado))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarOrgaoDoResultadoAvancado(resultado));
  });

  it("busca dois anos no filtro avançado e valida os resultados", () => {
    obterAnoDoPrimeiroRegistro()
      .then((anoInicial) => selecionarAnoNoFiltroAvancado(anoInicial))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) =>
        validarAnoDoResultadoAvancado(resultado).then(() => resultado),
      )
      .then(({ anoSelecionado }) =>
        selecionarOutroAnoNoFiltroAvancado(anoSelecionado),
      )
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarAnoDoResultadoAvancado(resultado));
  });

  it("busca dois meses no filtro avançado e valida os resultados", () => {
    obterMesDoPrimeiroRegistro()
      .then((mesInicial) => selecionarMesNoFiltroAvancado(mesInicial))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) =>
        validarMesDoResultadoAvancado(resultado).then(() => resultado),
      )
      .then(({ mesEsperado }) =>
        selecionarOutroMesNoFiltroAvancado(mesEsperado),
      )
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarMesDoResultadoAvancado(resultado));
  });

  it("busca a categoria econômica no filtro avançado e valida o resultado", () => {
    obterCategoriaEconomicaDoPrimeiroRegistro()
      .then((categoria) =>
        selecionarCategoriaEconomicaNoFiltroAvancado(categoria),
      )
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) =>
        validarCategoriaEconomicaDoResultadoAvancado(resultado),
      );
  });

  it("busca a origem no filtro avançado e valida o resultado", () => {
    obterOrigemDoPrimeiroRegistro()
      .then((origem) => selecionarOrigemNoFiltroAvancado(origem))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarOrigemDoResultadoAvancado(resultado));
  });

  it("busca a espécie no filtro avançado e valida o resultado", () => {
    obterEspecieDoPrimeiroRegistro()
      .then((especie) => selecionarEspecieNoFiltroAvancado(especie))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarEspecieDoResultadoAvancado(resultado));
  });

  it("busca o detalhamento no filtro avançado e valida o resultado", () => {
    obterDetalhamentoDoPrimeiroRegistro()
      .then((detalhamento) =>
        selecionarDetalhamentoNoFiltroAvancado(detalhamento),
      )
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarDetalhamentoDoResultadoAvancado(resultado));
  });

  it("busca a Fonte no filtro avançado e valida o resultado", () => {
    obterFonteDoPrimeiroRegistro()
      .then((fonte) => selecionarFonteNoFiltroAvancado(fonte))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarFonteDoResultadoAvancado(resultado));
  });

  it("busca o Valor Previsto no filtro avançado e valida o resultado", () => {
    obterValorPrevistoDoPrimeiroRegistro()
      .then((valor) => preencherValorPrevistoNoFiltroAvancado(valor))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarValorPrevistoDoResultadoAvancado(resultado));
  });

  it("busca o Valor Arrecadado no filtro avançado e valida o resultado", () => {
    obterValorArrecadadoDoPrimeiroRegistro()
      .then((valor) => preencherValorArrecadadoNoFiltroAvancado(valor))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) =>
        validarValorArrecadadoDoResultadoAvancado(resultado),
      );
  });

  it("busca o Valor Acumulado no filtro avançado e valida o resultado", () => {
    obterValorAcumuladoDoPrimeiroRegistro()
      .then((valor) => preencherValorAcumuladoNoFiltroAvancado(valor))
      .then((resultado) => executarBuscaAvancada().then(() => resultado))
      .then((resultado) => validarValorAcumuladoDoResultadoAvancado(resultado));
  });
});
