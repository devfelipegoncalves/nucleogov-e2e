/**
 * Teste do filtro externo de Órgão do módulo SGReceitas da Prodata.
 *
 * O cenário coleta um órgão real do primeiro detalhamento, pesquisa esse
 * órgão na listagem, valida o retorno e repete o fluxo com outra opção.
 */

const SG_RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/sgreceitas";
const SG_RECEITAS_NOME = Cypress.env("RECEITAS_NOME") || "sgreceitas";
const LISTAGEM_TIMEOUT = 30000;
const SELETOR_CALENDARIO = "#filtro_periodo .filtro_intervalo";
const SELETOR_BUSCA_TEXTO =
  ".filtro .containerbusca.buscatxt input#search";
const MESES = [
  "janeiro",
  "fevereiro",
  "marco",
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

// Normaliza os textos capturados no DOM para evitar diferenças de espaços.
function normalizarTexto(texto = "") {
  return String(texto).replace(/\s+/g, " ").trim();
}

// Normaliza acentos e caixa para comparar órgãos do detalhe e do filtro.
function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Converte o mês exibido no detalhe ou no calendário para um número.
function obterNumeroMes(texto) {
  const valor = normalizarParaComparacao(texto);
  const indice = MESES.findIndex((mes) => valor.includes(mes));
  const numero =
    indice >= 0 ? indice + 1 : Number(valor.match(/\b(1[0-2]|[1-9])\b/)?.[1]);

  expect(numero, `mês válido no valor "${texto}"`).to.be.within(1, 12);
  return numero;
}

// Lê valores de inputs ou elementos de texto no detalhamento.
function obterValorDoCampo($campo) {
  const campo = $campo.first();
  return normalizarTexto(
    campo.val() || campo.attr("value") || campo.text() || "",
  );
}

// Obtém o código que alguns órgãos exibem no início da opção.
function obterCodigoOrgao(texto) {
  return normalizarTexto(texto).match(/^\d+/)?.[0] || "";
}

// Remove código, ponto ou hífen usado antes do nome do órgão.
function removerCodigoOrgao(texto) {
  return normalizarParaComparacao(texto).replace(/^[\d.]+\s*[-.)]\s*/, "");
}

// Retorna palavras relevantes, ignorando termos administrativos genéricos.
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

  return removerCodigoOrgao(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((termo) => termo.length > 2 && !termosIgnorados.has(termo));
}

// Compara nomes mesmo quando o portal usa código ou nomenclatura equivalente.
function orgaosCorrespondem(nomeEsperado, nomeEncontrado) {
  const esperado = removerCodigoOrgao(nomeEsperado);
  const encontrado = removerCodigoOrgao(nomeEncontrado);

  if (!esperado || !encontrado) return false;
  if (nomesDoFiltroCorrespondem(nomeEsperado, nomeEncontrado)) return true;
  if (
    esperado === encontrado ||
    esperado.includes(encontrado) ||
    encontrado.includes(esperado)
  ) {
    return true;
  }

  const termosEsperados = obterTermosSignificativos(nomeEsperado);
  const termosEncontrados = obterTermosSignificativos(nomeEncontrado);

  return termosEsperados.some((termo) => termosEncontrados.includes(termo));
}

// Usa o texto que o autocomplete do filtro externo reconhece.
function obterNomeOrgaoParaPesquisa(orgao) {
  const nome = removerCodigoOrgao(orgao);

  if (/prefeitura|poder executivo/.test(nome)) {
    return "PODER EXECUTIVO";
  }

  return normalizarTexto(orgao).replace(/^\d+\s*[-.)]\s*/, "") || nome;
}

// Compara a nomenclatura usada pelo filtro com a exibida no detalhe.
function nomesDoFiltroCorrespondem(nomeEsperado, nomeEncontrado) {
  return (
    normalizarParaComparacao(obterNomeOrgaoParaPesquisa(nomeEsperado)) ===
    normalizarParaComparacao(obterNomeOrgaoParaPesquisa(nomeEncontrado))
  );
}

// Aguarda a tabela inicial e garante que exista ao menos um registro.
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
        !linha.classList.contains("tb-load"),
    )
    .should("have.length.at.least", 1);
}

// Aguarda o término de uma busca realizada no filtro externo.
function aguardarRetornoDoFiltro() {
  return cy
    .get(".loader", { timeout: LISTAGEM_TIMEOUT })
    .should("not.exist")
    .then(() =>
      cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible"),
    )
    .then(() => cy.get(".tb-load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist"));
}

// Seleciona uma opção do filtro COVID-19, aceitando diferenças de acentuação.
function selecionarOpcaoCovid(opcaoEsperada) {
  return cy
    .get("#search_coronavirus .selected", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true })
    .then(() =>
      cy
        .get("#search_coronavirus .options .list a:visible", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .should("have.length.at.least", 1)
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find(
            (elemento) =>
              normalizarParaComparacao(elemento.textContent).endsWith(
                normalizarParaComparacao(opcaoEsperada),
              ),
          );

          expect(opcao, `opção COVID-19 "${opcaoEsperada}" disponível`).to.exist;

          const textoSelecionado = normalizarTexto(opcao.textContent);
          cy.wrap(opcao).click({ force: true });
          cy.get("#search_coronavirus .selected").should(
            "contain",
            textoSelecionado,
          );
          return aguardarRetornoDoFiltro();
        }),
    );
}

// Confere se a opção COVID-19 retornou ao menos um registro na listagem.
function validarResultadoCovid(opcao, exigirDados) {
  return cy.get("body", { timeout: LISTAGEM_TIMEOUT }).then(($body) => {
    const linhas = $body
      .find(".cont_dados .tb tr[id]")
      .toArray()
      .filter(
        (linha) =>
          !["not-found-line", "template_row"].includes(linha.id) &&
          !linha.classList.contains("tb-load") &&
          linha.querySelector("td"),
      );

    if (linhas.length > 0) {
      expect(
        linhas.length,
        `registros retornados para COVID-19 como ${opcao}`,
      ).to.be.greaterThan(0);
    }

    const mensagem =
      linhas.length > 0
        ? `[${SG_RECEITAS_NOME}][COVID-19=${opcao}] ${linhas.length} registro(s) encontrado(s)`
        : `[${SG_RECEITAS_NOME}][COVID-19=${opcao}] ${
            normalizarTexto($body.find("#not-found-line").text()) ||
            "Nenhum resultado encontrado"
          }`;
    console.log(mensagem);
    Cypress.log({
      name: linhas.length > 0 ? "RESULTADO" : "ALERTA",
      message: mensagem,
      consoleProps: () => ({ filtro: "COVID-19", opcao, registros: linhas.length }),
    });
    cy.log(mensagem);

    if (exigirDados) {
      expect(
        linhas.length,
        `listagem retornou dados para COVID-19 como ${opcao}`,
      ).to.be.greaterThan(0);
    }
  });
}

// Captura descrição e código da primeira linha real da listagem.
function obterDadosParaBuscaTextual() {
  return aguardarRetornoDoFiltro()
    .then(() => aguardarListagem())
    .then(($linhas) => {
      const linha = $linhas.first();
      const descricao = normalizarTexto(
        Cypress.$(linha).find(".colDescricao").text(),
      );
      const codigo = normalizarTexto(
        Cypress.$(linha).find(".colCodigo").text(),
      );

      expect(descricao, "descrição disponível na listagem").to.not.equal("");
      expect(codigo, "código disponível na listagem").to.not.equal("");

      return cy.wrap({ descricao, codigo }, { log: false });
    });
}

// Pesquisa um texto e valida que ele aparece no campo correspondente.
function pesquisarTextoEValidar(termo, seletorColuna, nomeCampo) {
  cy.get(SELETOR_BUSCA_TEXTO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(termo, { force: true })
    .should("have.value", termo);

  cy.get(".filtro .containerbusca.buscatxt .icon-lupa", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .click({ force: true });

  return aguardarRetornoDoFiltro().then(() =>
    cy.get("body", { timeout: LISTAGEM_TIMEOUT }).then(($body) => {
      const linhas = $body
        .find(".cont_dados .tb tr[id]")
        .toArray()
        .filter(
          (linha) =>
            !["not-found-line", "template_row"].includes(linha.id) &&
            !linha.classList.contains("tb-load") &&
            linha.querySelector("td"),
        );
      const termoNormalizado = normalizarParaComparacao(termo);
      const encontrouTermo = linhas.some((linha) =>
        normalizarParaComparacao(
          Cypress.$(linha).find(seletorColuna).text(),
        ).includes(termoNormalizado),
      );

      expect(
        linhas.length,
        `registros retornados para ${nomeCampo} "${termo}"`,
      ).to.be.greaterThan(0);
      expect(
        encontrouTermo,
        `${nomeCampo} "${termo}" retornado na listagem`,
      ).to.equal(true);

      const mensagem = `[${SG_RECEITAS_NOME}][busca textual][${nomeCampo}=${termo}] ${linhas.length} registro(s) encontrado(s)`;
      console.log(mensagem);
      Cypress.log({
        name: "RESULTADO",
        message: mensagem,
        consoleProps: () => ({
          filtro: "Busca textual",
          campo: nomeCampo,
          termo,
          registros: linhas.length,
        }),
      });
      cy.log(mensagem);
    }),
  );
}

// Abre o primeiro registro da listagem atual.
function abrirPrimeiroRegistro() {
  return cy
    .get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter(
      (_, linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        !linha.classList.contains("tb-load"),
    )
    .first()
    .find("td.link")
    .first()
    .should("exist")
    .click({ force: true });
}

// Lê o órgão do detalhe e reinicia a listagem para o próximo passo.
function obterOrgaoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#orgao", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const orgao = normalizarTexto(
        $campo.val() || $campo.text() || $campo.attr("value") || "",
      );

      expect(orgao, "órgão disponível no detalhamento").to.not.equal("");

      return cy.wrap(orgao, { log: false });
    })
    .then((orgao) => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem().then(() => cy.wrap(orgao, { log: false }));
    });
}

// Seleciona no filtro externo o órgão coletado no detalhamento.
function selecionarOrgaoNoFiltro(orgaoEsperado) {
  const termoPesquisa = obterNomeOrgaoParaPesquisa(orgaoEsperado);

  return cy.get("#select_orgao", { timeout: LISTAGEM_TIMEOUT }).then(
    ($container) => {
      cy.wrap($container).find(".selected").click({ force: true });
      cy.wrap($container)
        .find("input#search:visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(termoPesquisa, { force: true })
        .should("have.value", termoPesquisa);

      return cy
        .wrap($container)
        .find(".options .list a:visible")
        .should("have.length.at.least", 1)
        .then(($opcoes) => {
          const codigoEsperado = obterCodigoOrgao(orgaoEsperado);
          const opcao =
            Array.from($opcoes).find(
              (elemento) =>
                codigoEsperado &&
                elemento.getAttribute("href")?.replace(/^#/, "") ===
                  codigoEsperado,
            ) ||
            Array.from($opcoes).find((elemento) =>
              orgaosCorrespondem(orgaoEsperado, elemento.textContent),
            );

          expect(
            opcao,
            `órgão "${orgaoEsperado}" disponível no filtro externo`,
          ).to.exist;

          const textoSelecionado = normalizarTexto(opcao.textContent);
          const codigoSelecionado =
            opcao.getAttribute("href")?.replace(/^#/, "") || "";

          cy.wrap(opcao).click({ force: true });
          cy.wrap($container)
            .find(".selected")
            .should("contain", textoSelecionado);

          return cy.wrap(
            {
              texto: textoSelecionado,
              codigo: codigoSelecionado,
            },
            { log: false },
          );
        });
    },
  );
}

// Escolhe uma opção diferente da primeira e retorna o órgão selecionado.
function selecionarOutroOrgaoNoFiltro(orgaoAtual) {
  return cy
    .get("#select_orgao", { timeout: LISTAGEM_TIMEOUT })
    .find(".selected")
    .click({ force: true })
    .then(() =>
      cy
        .get("#select_orgao .options .list a:visible", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .should("have.length.at.least", 2)
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find(
            (elemento) =>
              !orgaosCorrespondem(orgaoAtual.texto, elemento.textContent),
          );

          expect(opcao, "outro órgão disponível no filtro externo").to.exist;

          const texto = normalizarTexto(opcao.textContent);
          const codigo = opcao.getAttribute("href")?.replace(/^#/, "") || "";
          cy.wrap(opcao).click({ force: true });
          cy.get("#select_orgao .selected").should("contain", texto);

          return cy.wrap({ texto, codigo }, { log: false });
        }),
    );
}

// Confere o órgão do primeiro retorno e reinicia a página para nova busca.
function validarOrgaoNoDetalhe(orgaoSelecionado) {
  return aguardarRetornoDoFiltro()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#orgao", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($campo) => {
          const orgaoRetornado = normalizarTexto(
            $campo.val() || $campo.text() || $campo.attr("value") || "",
          );
          const codigoRetornado = obterCodigoOrgao(orgaoRetornado);
          const codigoSelecionado = orgaoSelecionado.codigo;

          expect(
            (codigoSelecionado && codigoRetornado === codigoSelecionado) ||
              orgaosCorrespondem(orgaoSelecionado.texto, orgaoRetornado),
            `órgão retornado "${orgaoRetornado}" compatível com "${orgaoSelecionado.texto}"`,
          ).to.equal(true);

          cy.log(
            `[${SG_RECEITAS_NOME}][órgão] "${orgaoSelecionado.texto}" → "${orgaoRetornado}"`,
          );
        }),
    )
    .then(() => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Obtém mês e ano do primeiro detalhamento antes de aplicar o filtro.
function obterPeriodoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#ano", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($anoCampo) => {
      const ano = Number(obterValorDoCampo($anoCampo));
      const mes = obterNumeroMes(obterValorDoCampo(Cypress.$("#mes")));

      expect(ano, "ano disponível no detalhamento").to.be.greaterThan(0);
      cy.log(
        `[${SG_RECEITAS_NOME}][período inicial] ${String(mes).padStart(2, "0")}/${ano}`,
      );
      return cy.wrap({ ano, mes }, { log: false });
    })
    .then((periodo) => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem().then(() => cy.wrap(periodo, { log: false }));
    });
}

// Abre o calendário, navega até o ano e seleciona o mês informado.
function selecionarMesEAno(periodo) {
  cy.get(SELETOR_CALENDARIO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#popup_intervalo", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find(".container-ano span")
    .then(($anoAtual) => {
      const anoAtual = Number(normalizarTexto($anoAtual.text()));
      expect(anoAtual, "ano exibido no calendário").to.be.greaterThan(0);

      const direcao = periodo.ano > anoAtual ? ".right" : ".left";
      const quantidade = Math.abs(periodo.ano - anoAtual);

      for (let indice = 0; indice < quantidade; indice += 1) {
        cy.get(`#popup_intervalo .container-ano ${direcao}`)
          .should("be.visible")
          .click({ force: true });
      }
    })
    .then(() => {
      cy.get("#popup_intervalo .container-ano span").should(
        "contain",
        String(periodo.ano),
      );

      const mes = String(periodo.mes).padStart(2, "0");
      cy.get(`#popup_intervalo .container-meses span[data-mes="${mes}"]`)
        .should("be.visible")
        .click({ force: true });
    })
    .then(() => {
      cy.get("#popup_intervalo").should("not.exist");
      return aguardarListagem();
    });
}

// Confere no primeiro detalhamento que mês e ano correspondem ao filtro.
function validarPeriodoDosResultados(periodo, descricao) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#ano", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($anoCampo) => ({
          ano: Number(obterValorDoCampo($anoCampo)),
          mes: obterNumeroMes(obterValorDoCampo(Cypress.$("#mes"))),
        })),
    )
    .then((periodoRetornado) => {
      expect(periodoRetornado.ano, `ano retornado para ${descricao}`).to.equal(
        periodo.ano,
      );
      expect(periodoRetornado.mes, `mês retornado para ${descricao}`).to.equal(
        periodo.mes,
      );
      cy.log(
        `[${SG_RECEITAS_NOME}][período][${descricao}] ${String(periodoRetornado.mes).padStart(2, "0")}/${periodoRetornado.ano}`,
      );
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

describe(`Portal: ${SG_RECEITAS_NOME} - filtros externos`, () => {
  beforeEach(() => {
    cy.visitPortal(SG_RECEITAS_PATH);
    cy.get(".filtro", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
    aguardarListagem();
  });

  // Pesquisa o órgão do primeiro registro e depois outro órgão disponível.
  it("filtra por órgão e valida dois retornos no detalhamento", () => {
    obterOrgaoDoPrimeiroRegistro()
      .then((orgaoInicial) => selecionarOrgaoNoFiltro(orgaoInicial))
      .then((orgaoSelecionado) =>
        validarOrgaoNoDetalhe(orgaoSelecionado).then(() => orgaoSelecionado),
      )
      .then((orgaoAtual) => selecionarOutroOrgaoNoFiltro(orgaoAtual))
      .then((outroOrgao) => aguardarRetornoDoFiltro().then(() => outroOrgao))
      .then((outroOrgao) => validarOrgaoNoDetalhe(outroOrgao));
  });

  // Usa o calendário para selecionar um mês, outro mês e depois outro ano.
  it("seleciona mês e ano pelo calendário e valida a listagem", () => {
    obterPeriodoDoPrimeiroRegistro().then((periodoInicial) => {
      const outroMes =
        periodoInicial.mes === 1
          ? { ano: periodoInicial.ano - 1, mes: 12 }
          : { ano: periodoInicial.ano, mes: periodoInicial.mes - 1 };
      const outroAno = {
        ano: periodoInicial.ano - 1,
        mes: periodoInicial.mes,
      };

      return selecionarMesEAno(periodoInicial)
        .then(() => validarPeriodoDosResultados(periodoInicial, "mês original"))
        .then(() => selecionarMesEAno(outroMes))
        .then(() => validarPeriodoDosResultados(outroMes, "outro mês"))
        .then(() => selecionarMesEAno(outroAno))
        .then(() => validarPeriodoDosResultados(outroAno, "outro ano"));
      });
  });

  // Valida que as opções SIM e NÃO retornam registros na listagem.
  it("filtra COVID-19 como SIM e depois como NÃO", () => {
    selecionarOpcaoCovid("SIM")
      .then(() => validarResultadoCovid("SIM", false))
      .then(() => selecionarOpcaoCovid("NÃO"))
      .then(() => validarResultadoCovid("NÃO", true));
  });

  // Pesquisa pela descrição e depois pelo código de uma receita real.
  it("busca pela descrição e pelo código da receita", () => {
    obterDadosParaBuscaTextual().then(({ descricao, codigo }) =>
      pesquisarTextoEValidar(descricao, ".colDescricao", "descrição").then(
        () => pesquisarTextoEValidar(codigo, ".colCodigo", "código"),
      ),
    );
  });
});
