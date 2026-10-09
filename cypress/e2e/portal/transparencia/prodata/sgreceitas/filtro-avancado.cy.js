/**
 * Teste do filtro avançado de Mês do módulo SGReceitas da Prodata.
 *
 * O cenário utiliza valores reais do portal: coleta o mês de um detalhamento,
 * pesquisa esse mês no filtro avançado, valida o retorno e repete o fluxo com
 * outro mês disponível.
 */

const SG_RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/sgreceitas";
const SG_RECEITAS_NOME = Cypress.env("RECEITAS_NOME") || "sgreceitas";
const LISTAGEM_TIMEOUT = 30000;
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

// Remove espaços duplicados e quebras de linha do HTML.
function normalizarTexto(texto = "") {
  return String(texto).replace(/\s+/g, " ").trim();
}

// Normaliza acentos e caixa para comparar mês do filtro e do detalhamento.
function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Converte o período da coluna da listagem, por exemplo Outubro/2026.
function converterPeriodoDaListagem(texto) {
  const valor = normalizarParaComparacao(texto);
  const indiceMes = MESES.findIndex((mes) => valor.includes(mes));
  const ano = Number(valor.match(/\b(20\d{2})\b/)?.[1]);

  expect(indiceMes, `mês válido no período "${texto}"`).to.be.at.least(0);
  expect(ano, `ano válido no período "${texto}"`).to.be.greaterThan(0);
  return new Date(ano, indiceMes, 1);
}

// Formata uma data para o padrão aceito pelos campos do filtro avançado.
function formatarDataBrasileira(data) {
  return `${String(data.getDate()).padStart(2, "0")}/${String(
    data.getMonth() + 1,
  ).padStart(2, "0")}/${data.getFullYear()}`;
}

// Retorna o último dia do mês utilizado como data final do intervalo.
function ultimoDiaDoMes(data) {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0);
}

// Converte o mês exibido no detalhamento ou no filtro para seu número.
function obterNumeroMes(texto) {
  const valor = normalizarParaComparacao(texto);
  const indice = MESES.findIndex((mes) => valor.includes(mes));
  const numero =
    indice >= 0 ? indice + 1 : Number(valor.match(/\b(1[0-2]|[1-9])\b/)?.[1]);

  expect(numero, `mês válido no valor "${texto}"`).to.be.within(1, 12);
  return numero;
}

// Lê o valor de inputs, campos ou elementos que exibem texto.
function obterValorDoCampo($campo) {
  const campo = $campo.first();
  return normalizarTexto(
    campo.val() || campo.attr("value") || campo.text() || "",
  );
}

// Extrai o código numérico usado por algumas opções de órgão.
function obterCodigoOrgao(texto) {
  return normalizarTexto(texto).match(/^\d+/)?.[0] || "";
}

// Remove códigos e separadores que aparecem antes do nome do órgão.
function removerCodigoOrgao(texto) {
  return normalizarParaComparacao(texto).replace(/^[\d.]+\s*[-.)]\s*/, "");
}

// Converte a nomenclatura do detalhamento para a nomenclatura do filtro.
function obterNomeOrgaoParaPesquisa(orgao) {
  const nome = removerCodigoOrgao(orgao);

  if (/prefeitura|poder executivo/.test(nome)) {
    return "PODER EXECUTIVO";
  }

  return normalizarTexto(orgao).replace(/^\d+\s*[-.)]\s*/, "") || nome;
}

// Compara o órgão do detalhe e a opção do filtro, inclusive equivalências.
function orgaosCorrespondem(nomeEsperado, nomeEncontrado) {
  const esperado = normalizarParaComparacao(nomeEsperado);
  const encontrado = normalizarParaComparacao(nomeEncontrado);
  const pesquisaEsperada = normalizarParaComparacao(
    obterNomeOrgaoParaPesquisa(nomeEsperado),
  );
  const pesquisaEncontrada = normalizarParaComparacao(
    obterNomeOrgaoParaPesquisa(nomeEncontrado),
  );

  return (
    pesquisaEsperada === pesquisaEncontrada ||
    esperado === encontrado ||
    esperado.includes(encontrado) ||
    encontrado.includes(esperado)
  );
}

// Aguarda o fim de uma requisição e garante que existam registros reais.
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

// Aguarda apenas a conclusão da busca para que possamos validar o retorno.
function aguardarRetornoDoFiltro() {
  return cy
    .get(".loader", { timeout: LISTAGEM_TIMEOUT })
    .should("not.exist")
    .then(() =>
      cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible"),
    )
    .then(() =>
      cy.get(".tb-load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist"),
    );
}

// Abre a primeira receita da listagem atual.
function abrirPrimeiroRegistro() {
  return cy
    .get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter(
      (_, linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        !linha.classList.contains("tb-load") &&
        linha.querySelector("td"),
    )
    .first()
    .find("td.link")
    .first()
    .should("exist")
    .click({ force: true });
}

// Coleta o mês do primeiro registro e retorna à listagem para iniciar a busca.
function obterMesDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#mes", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const texto = obterValorDoCampo($campo);
      const mes = obterNumeroMes(texto);

      cy.log(
        `[${SG_RECEITAS_NOME}][mês inicial] ${MESES[mes - 1]}`,
      );
      return cy.wrap(mes, { log: false });
    })
    .then((mes) => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem().then(() => cy.wrap(mes, { log: false }));
    });
}

// Coleta o ano do primeiro registro e retorna à listagem para a pesquisa.
function obterAnoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#ano", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const ano = Number(obterValorDoCampo($campo));

      expect(ano, "ano disponível no detalhamento").to.be.greaterThan(0);
      cy.log(`[${SG_RECEITAS_NOME}][ano inicial] ${ano}`);
      return cy.wrap(ano, { log: false });
    })
    .then((ano) => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem().then(() => cy.wrap(ano, { log: false }));
    });
}

// Coleta o órgão do primeiro registro e retorna à listagem.
function obterOrgaoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#orgao", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const orgao = obterValorDoCampo($campo);

      expect(orgao, "órgão disponível no detalhamento").to.not.equal("");
      return cy.wrap(orgao, { log: false });
    })
    .then((orgao) => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem().then(() => cy.wrap(orgao, { log: false }));
    });
}

// Coleta a descrição exibida na primeira linha da listagem.
function obterDescricaoDoPrimeiroRegistro() {
  return aguardarListagem().then(($linhas) => {
    const descricao = normalizarTexto(
      Cypress.$($linhas.first()).find(".colDescricao").text(),
    );

    expect(descricao, "descrição disponível na listagem").to.not.equal("");
    cy.log(`[${SG_RECEITAS_NOME}][descrição inicial] ${descricao}`);
    return cy.wrap(descricao, { log: false });
  });
}

// Coleta a Categoria Econômica do primeiro detalhamento.
function obterCategoriaEconomicaDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#nat_categoria_economica", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const categoria = obterValorDoCampo($campo);

      expect(categoria, "categoria econômica disponível no detalhamento").to.not.equal(
        "",
      );
      cy.log(`[${SG_RECEITAS_NOME}][categoria econômica inicial] ${categoria}`);
      return cy.wrap(categoria, { log: false });
    })
    .then((categoria) => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem().then(() => cy.wrap(categoria, { log: false }));
    });
}

// Coleta a Origem do primeiro detalhamento.
function obterOrigemDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#nat_origem", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const origem = obterValorDoCampo($campo);

      expect(origem, "origem disponível no detalhamento").to.not.equal("");
      cy.log(`[${SG_RECEITAS_NOME}][origem inicial] ${origem}`);
      return cy.wrap(origem, { log: false });
    })
    .then((origem) => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem().then(() => cy.wrap(origem, { log: false }));
    });
}

// Coleta a Espécie do primeiro detalhamento.
function obterEspecieDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#nat_especie", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const especie = obterValorDoCampo($campo);

      expect(especie, "espécie disponível no detalhamento").to.not.equal("");
      cy.log(`[${SG_RECEITAS_NOME}][espécie inicial] ${especie}`);
      return cy.wrap(especie, { log: false });
    })
    .then((especie) => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem().then(() => cy.wrap(especie, { log: false }));
    });
}

// Coleta o Tipo exibido no detalhamento do primeiro registro.
function obterTipoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#nat_tipo", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const tipo = obterValorDoCampo($campo);

      expect(tipo, "Tipo disponível no detalhamento").to.not.equal("");
      cy.log(`[${SG_RECEITAS_NOME}][tipo inicial] ${tipo}`);
      return cy.wrap(tipo, { log: false });
    })
    .then((tipo) => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem().then(() => cy.wrap(tipo, { log: false }));
    });
}

// Converte valores monetários brasileiros para comparação numérica.
function normalizarValorMonetario(valor) {
  const texto = normalizarTexto(valor).replace(/[^\d,.-]/g, "");

  if (!texto) {
    return NaN;
  }

  return texto.includes(",")
    ? Number(texto.replace(/\./g, "").replace(",", "."))
    : Number(texto);
}

// Formata o valor coletado para preenchimento do campo monetário do filtro.
function formatarValorParaEntrada(valor) {
  return Number(valor).toFixed(2).replace(".", ",");
}

// Coleta o menor e o maior Valor Previsto exibidos na listagem.
function obterIntervaloValorPrevistoDaListagem() {
  return aguardarListagem().then(($linhas) => {
    const valores = Array.from($linhas)
      .map((linha) => {
        const celulas = Cypress.$(linha).find(".colPrevisao").toArray();
        const texto = normalizarTexto(celulas[celulas.length - 1]?.textContent);

        return {
          texto,
          numero: normalizarValorMonetario(texto),
        };
      })
      .filter(({ numero }) => Number.isFinite(numero));

    expect(valores.length, "Valores Previstos disponíveis na listagem").to.be
      .greaterThan(0);

    const valoresOrdenados = [...valores].sort(
      (valorA, valorB) => valorA.numero - valorB.numero,
    );
    const minimo = valoresOrdenados[0];
    const maximo = valoresOrdenados[valoresOrdenados.length - 1];

    expect(minimo.numero, "menor Valor Previsto").to.be.at.most(maximo.numero);
    cy.log(
      `[${SG_RECEITAS_NOME}][Valor Previsto] intervalo ${minimo.texto} a ${maximo.texto}`,
    );

    return cy.wrap(
      {
        minimo: {
          ...minimo,
          entrada: formatarValorParaEntrada(minimo.numero),
        },
        maximo: {
          ...maximo,
          entrada: formatarValorParaEntrada(maximo.numero),
        },
      },
      { log: false },
    );
  });
}

// Coleta um Desdobramento disponível no filtro a partir de um registro real.
// Os primeiros registros da listagem são níveis consolidados e não aparecem
// no select; por isso selecionamos dinamicamente o primeiro código compatível.
function obterDesdobramentoDoPrimeiroRegistro() {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_desdobramento .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() =>
      cy
        .get("#select_desdobramento .options .list a", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .should("have.length.at.least", 1)
        .then(($opcoes) =>
          Array.from($opcoes).map((elemento) => ({
            codigo: elemento.getAttribute("href")?.replace(/^#/, "") || "",
            texto: normalizarTexto(elemento.textContent),
          })),
        ),
    )
    .then((opcoes) => {
      cy.visitPortal(SG_RECEITAS_PATH);

      return aguardarListagem().then(($linhas) => {
        const registro = Array.from($linhas).find((linha) => {
          const codigo = normalizarTexto(
            Cypress.$(linha).find(".colCodigo").text(),
          ).replace(/\D/g, "");
          const desdobramento = codigo.slice(0, 7);

          return opcoes.some((opcao) => opcao.codigo === desdobramento);
        });

        expect(
          registro,
          "registro com Desdobramento disponível no filtro",
        ).to.exist;

        return cy
          .wrap(registro)
          .find("td.link")
          .first()
          .should("exist")
          .click({ force: true });
      });
    })
    .then(() =>
      cy.get("#nat_desdobramento", { timeout: LISTAGEM_TIMEOUT }),
    )
    .should("be.visible")
    .then(($campo) => {
      const desdobramento = obterValorDoCampo($campo);

      expect(
        desdobramento,
        "desdobramento disponível no detalhamento",
      ).to.not.equal("");
      cy.log(`[${SG_RECEITAS_NOME}][desdobramento inicial] ${desdobramento}`);
      return cy.wrap(desdobramento, { log: false });
    })
    .then((desdobramento) => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem().then(() => cy.wrap(desdobramento, { log: false }));
    });
}

// Coleta vários períodos da listagem e monta o menor/maior intervalo real.
function obterDatasInicialEFinalDaListagem() {
  return aguardarListagem().then(($linhas) => {
    const datas = Array.from($linhas)
      .map((linha) =>
        normalizarTexto(Cypress.$(linha).find(".col8").text() || ""),
      )
      .filter(Boolean)
      .map(converterPeriodoDaListagem)
      .sort((dataA, dataB) => dataA - dataB);

    expect(datas.length, "períodos disponíveis na listagem").to.be.greaterThan(
      0,
    );

    const dataInicial = datas[0];
    const dataFinal = ultimoDiaDoMes(datas[datas.length - 1]);
    return cy.wrap(
      {
        dataInicial: formatarDataBrasileira(dataInicial),
        dataFinal: formatarDataBrasileira(dataFinal),
        inicio: dataInicial,
        fim: dataFinal,
      },
      { log: false },
    );
  });
}

// Abre o painel avançado quando ele ainda não está visível.
function abrirFiltroAvancado() {
  return cy.get("body").then(($body) => {
    if (!$body.find("#select_mes:visible").length) {
      cy.get("#busca_avancada", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .click({ force: true });
    }

    return cy
      .get("#select_mes", { timeout: LISTAGEM_TIMEOUT })
      .should("be.visible");
  });
}

// Seleciona um mês específico no select customizado do filtro avançado.
function selecionarMesNoFiltroAvancado(mesEsperado) {
  const mes = Number(mesEsperado);
  const nomeMes = MESES[mes - 1];
  const codigoMes = String(mes).padStart(2, "0");

  expect(mes, "mês esperado no filtro avançado").to.be.within(1, 12);

  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_mes .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() =>
      cy
        .get("#select_mes .options .list a", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .should("have.length.at.least", 1)
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find(
            (elemento) =>
              elemento.getAttribute("href")?.replace(/^#/, "") === codigoMes ||
              normalizarParaComparacao(elemento.textContent) ===
                normalizarParaComparacao(nomeMes),
          );

          expect(opcao, `mês ${nomeMes} disponível no filtro avançado`).to.exist;
          cy.wrap(opcao).click({ force: true });
          cy.get("#select_mes .selected").should("have.attr", "id", codigoMes);

          return cy.wrap(
            { numero: mes, nome: nomeMes },
            { log: false },
          );
        }),
    );
}

// Escolhe o primeiro mês diferente do mês atualmente validado.
function selecionarOutroMesNoFiltroAvancado(mesAtual) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_mes .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() =>
      cy
        .get("#select_mes .options .list a", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find(
            (elemento) =>
              Number(elemento.getAttribute("href")?.replace(/^#/, "")) !==
              Number(mesAtual),
          );

          expect(opcao, "outro mês disponível no filtro avançado").to.exist;
          const numero = Number(opcao.getAttribute("href").replace(/^#/, ""));
          const nome = normalizarTexto(opcao.textContent);

          cy.wrap(opcao).click({ force: true });
          cy.get("#select_mes .selected").should(
            "have.attr",
            "id",
            String(numero).padStart(2, "0"),
          );
          return cy.wrap({ numero, nome }, { log: false });
        }),
    );
}

// Seleciona um ano específico no select customizado do filtro avançado.
function selecionarAnoNoFiltroAvancado(anoEsperado) {
  const ano = String(anoEsperado);

  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_ano .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() =>
      cy
        .get("#select_ano .options .list a", { timeout: LISTAGEM_TIMEOUT })
        .should("have.length.at.least", 1)
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find(
            (elemento) => elemento.getAttribute("href")?.replace(/^#/, "") === ano,
          );

          expect(opcao, `ano ${ano} disponível no filtro avançado`).to.exist;
          cy.wrap(opcao).click({ force: true });
          cy.get("#select_ano .selected").should("have.attr", "id", ano);

          return cy.wrap(Number(ano), { log: false });
        }),
    );
}

// Pesquisa e seleciona o órgão coletado no detalhamento.
function selecionarOrgaoNoFiltroAvancado(orgaoEsperado) {
  const termoPesquisa = obterNomeOrgaoParaPesquisa(orgaoEsperado);

  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_orgao_advanced .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() => {
      const campoBusca = cy
        .get("#select_orgao_advanced .options input#search", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .filter(":visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(termoPesquisa, { force: true });

      return campoBusca.then(() =>
        cy
          .get("#select_orgao_advanced .options .list a", {
            timeout: LISTAGEM_TIMEOUT,
          })
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
              `órgão "${orgaoEsperado}" disponível no filtro avançado`,
            ).to.exist;

            const texto = normalizarTexto(opcao.textContent);
            const codigo = opcao.getAttribute("href")?.replace(/^#/, "") || "";
            cy.wrap(opcao).click({ force: true });
            cy.get("#select_orgao_advanced .selected").should("have.attr", "id", codigo);

            return cy.wrap({ texto, codigo }, { log: false });
          }),
      );
    });
}

// Seleciona um órgão diferente do órgão atualmente utilizado.
function selecionarOutroOrgaoNoFiltroAvancado(orgaoAtual) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_orgao_advanced .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() =>
      cy
        .get("#select_orgao_advanced .options .list a", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find(
            (elemento) =>
              !orgaosCorrespondem(orgaoAtual.texto, elemento.textContent),
          );

          expect(opcao, "outro órgão disponível no filtro avançado").to.exist;

          const texto = normalizarTexto(opcao.textContent);
          const codigo = opcao.getAttribute("href")?.replace(/^#/, "") || "";
          cy.wrap(opcao).click({ force: true });
          cy.get("#select_orgao_advanced .selected").should("have.attr", "id", codigo);

          return cy.wrap({ texto, codigo }, { log: false });
        }),
    );
}

// Preenche a descrição coletada no campo textual do filtro avançado.
function selecionarDescricaoNoFiltroAvancado(descricao) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#descricao", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(descricao, { force: true })
        .should("have.value", descricao),
    )
    .then(() => cy.wrap(descricao, { log: false }));
}

// Compara a categoria mesmo quando o filtro remove ou altera o código inicial.
function categoriasCorrespondem(categoriaEsperada, categoriaEncontrada) {
  const esperado = normalizarParaComparacao(categoriaEsperada);
  const encontrado = normalizarParaComparacao(categoriaEncontrada);
  const esperadoSemCodigo = esperado.replace(/^[\d.]+\s*[-.)]\s*/, "");
  const encontradoSemCodigo = encontrado.replace(/^[\d.]+\s*[-.)]\s*/, "");

  return (
    esperado === encontrado ||
    esperadoSemCodigo === encontradoSemCodigo ||
    esperado.includes(encontradoSemCodigo) ||
    encontrado.includes(esperadoSemCodigo)
  );
}

// Compara a origem aceitando diferenças de código e formatação.
function origensCorrespondem(origemEsperada, origemEncontrada) {
  const esperado = normalizarParaComparacao(origemEsperada);
  const encontrado = normalizarParaComparacao(origemEncontrada);
  const esperadoSemCodigo = esperado.replace(/^[\d.]+\s*[-.)]\s*/, "");
  const encontradoSemCodigo = encontrado.replace(/^[\d.]+\s*[-.)]\s*/, "");

  return (
    esperado === encontrado ||
    esperadoSemCodigo === encontradoSemCodigo ||
    esperado.includes(encontradoSemCodigo) ||
    encontrado.includes(esperadoSemCodigo)
  );
}

// Compara a espécie aceitando diferenças de código e formatação.
function especiesCorrespondem(especieEsperada, especieEncontrada) {
  const esperado = normalizarParaComparacao(especieEsperada);
  const encontrado = normalizarParaComparacao(especieEncontrada);
  const esperadoSemCodigo = esperado.replace(/^[\d.]+\s*[-.)]\s*/, "");
  const encontradoSemCodigo = encontrado.replace(/^[\d.]+\s*[-.)]\s*/, "");

  return (
    esperado === encontrado ||
    esperadoSemCodigo === encontradoSemCodigo ||
    esperado.includes(encontradoSemCodigo) ||
    encontrado.includes(esperadoSemCodigo)
  );
}

// Compara o Tipo aceitando diferenças de código e formatação.
function tiposCorrespondem(tipoEsperado, tipoEncontrado) {
  const esperado = normalizarParaComparacao(tipoEsperado);
  const encontrado = normalizarParaComparacao(tipoEncontrado);
  const esperadoSemCodigo = esperado.replace(/^\d+\s*[-.)]\s*/, "");
  const encontradoSemCodigo = encontrado.replace(/^\d+\s*[-.)]\s*/, "");

  return (
    esperado === encontrado ||
    esperadoSemCodigo === encontradoSemCodigo ||
    esperado.includes(encontradoSemCodigo) ||
    encontrado.includes(esperadoSemCodigo)
  );
}

// Compara o desdobramento aceitando diferenças de código e formatação.
function desdobramentosCorrespondem(desdobramentoEsperado, desdobramentoEncontrado) {
  const esperado = normalizarParaComparacao(desdobramentoEsperado);
  const encontrado = normalizarParaComparacao(desdobramentoEncontrado);
  const esperadoSemCodigo = esperado.replace(/^[\d.]+\s*[-.)]\s*/, "");
  const encontradoSemCodigo = encontrado.replace(/^[\d.]+\s*[-.)]\s*/, "");

  return (
    esperado === encontrado ||
    esperadoSemCodigo === encontradoSemCodigo ||
    esperado.includes(encontradoSemCodigo) ||
    encontrado.includes(esperadoSemCodigo)
  );
}

// Pesquisa a categoria no select customizado do filtro avançado.
function selecionarCategoriaNoFiltroAvancado(categoriaEsperada) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_categoria_economica .selected", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .click({ force: true }),
    )
    .then(() => {
      const campoBusca = cy
        .get("#select_categoria_economica .options input#search", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .filter(":visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(categoriaEsperada, { force: true });

      return campoBusca.then(() =>
        cy
          .get("#select_categoria_economica .options .list a", {
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
            cy.wrap(opcao).click({ force: true });
            return cy.wrap(categoriaSelecionada, { log: false });
          }),
      );
    });
}

// Seleciona uma categoria diferente da categoria usada na primeira pesquisa.
function selecionarOutraCategoriaNoFiltroAvancado(categoriaAtual) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_categoria_economica .selected", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .click({ force: true }),
    )
    .then(() =>
      cy
        .get("#select_categoria_economica .options input#search", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .filter(":visible")
        .first()
        .clear({ force: true })
        .type("Receitas", { force: true }),
    )
    .then(() =>
      cy
        .get("#select_categoria_economica .options .list a", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .should("have.length.at.least", 1)
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find(
            (elemento) =>
              !categoriasCorrespondem(categoriaAtual, elemento.textContent),
          );

          expect(opcao, "outra categoria econômica disponível").to.exist;
          const categoriaSelecionada = normalizarTexto(opcao.textContent);
          cy.wrap(opcao).click({ force: true });
          return cy.wrap(categoriaSelecionada, { log: false });
        }),
    );
}

// Pesquisa a origem no select customizado do filtro avançado.
function selecionarOrigemNoFiltroAvancado(origemEsperada) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_origem .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() => {
      const campoBusca = cy
        .get("#select_origem .options input#search", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .filter(":visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(origemEsperada, { force: true });

      return campoBusca.then(() =>
        cy
          .get("#select_origem .options .list a", {
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
            cy.wrap(opcao).click({ force: true });
            return cy.wrap(origemSelecionada, { log: false });
          }),
      );
    });
}

// Pesquisa a espécie no select customizado do filtro avançado.
function selecionarEspecieNoFiltroAvancado(especieEsperada) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_especie .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() => {
      const campoBusca = cy
        .get("#select_especie .options input#search", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .filter(":visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(especieEsperada, { force: true });

      return campoBusca.then(() =>
        cy
          .get("#select_especie .options .list a", {
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
            cy.wrap(opcao).click({ force: true });
            return cy.wrap(especieSelecionada, { log: false });
          }),
      );
    });
}

// Pesquisa o Tipo no select customizado do filtro avançado.
function selecionarTipoNoFiltroAvancado(tipoEsperado) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_tipo .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() => {
      const campoBusca = cy
        .get("#select_tipo .options input#search", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .filter(":visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(tipoEsperado, { force: true });

      return campoBusca.then(() =>
        cy
          .get("#select_tipo .options .list a", {
            timeout: LISTAGEM_TIMEOUT,
          })
          .should("have.length.at.least", 1)
          .then(($opcoes) => {
            const opcao = Array.from($opcoes).find((elemento) =>
              tiposCorrespondem(tipoEsperado, elemento.textContent),
            );

            expect(
              opcao,
              `Tipo "${tipoEsperado}" disponível no filtro avançado`,
            ).to.exist;

            const tipoSelecionado = normalizarTexto(opcao.textContent);
            cy.wrap(opcao).click({ force: true });
            return cy.wrap(tipoSelecionado, { log: false });
          }),
      );
    });
}

// Preenche os valores inicial e final no filtro avançado.
function selecionarIntervaloValorPrevistoNoFiltroAvancado({ minimo, maximo }) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#prevmin", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(minimo.entrada, { force: true })
        .should(($campo) => {
          expect(
            normalizarValorMonetario($campo.val()),
            "Valor Previsto inicial preenchido no filtro avançado",
          ).to.be.greaterThan(0);
        }),
    )
    .then(() =>
      cy
        .get("#prevmax", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(maximo.entrada, { force: true })
        .should(($campo) => {
          expect(
            normalizarValorMonetario($campo.val()),
            "Valor Previsto final preenchido no filtro avançado",
          ).to.be.greaterThan(0);
        }),
    )
    .then(() => cy.wrap({ minimo, maximo }, { log: false }));
}

// Preenche o intervalo invertido para validar o bloqueio do portal.
function selecionarIntervaloValorPrevistoInvalidoNoFiltroAvancado({
  minimo,
  maximo,
}) {
  const valorInicialInvalido = {
    numero: maximo.numero + 1,
    entrada: formatarValorParaEntrada(maximo.numero + 1),
  };

  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#prevmin", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(valorInicialInvalido.entrada, { force: true }),
    )
    .then(() =>
      cy
        .get("#prevmax", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(minimo.entrada, { force: true }),
    )
    .then(() =>
      cy.wrap(
        {
          valorInicial: valorInicialInvalido,
          valorFinal: minimo,
        },
        { log: false },
      ),
    );
}

// Pesquisa o desdobramento no select customizado do filtro avançado.
function selecionarDesdobramentoNoFiltroAvancado(desdobramentoEsperado) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_desdobramento .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() => {
      const campoBusca = cy
        .get("#select_desdobramento .options input#search", {
          timeout: LISTAGEM_TIMEOUT,
        })
        .filter(":visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(desdobramentoEsperado, { force: true });

      return campoBusca.then(() =>
        cy
          .get("#select_desdobramento .options .list a", {
            timeout: LISTAGEM_TIMEOUT,
          })
          .should("have.length.at.least", 1)
          .then(($opcoes) => {
            const opcao = Array.from($opcoes).find((elemento) =>
              desdobramentosCorrespondem(
                desdobramentoEsperado,
                elemento.textContent,
              ),
            );

            expect(
              opcao,
              `desdobramento "${desdobramentoEsperado}" disponível no filtro avançado`,
            ).to.exist;

            const desdobramentoSelecionado = normalizarTexto(opcao.textContent);
            cy.wrap(opcao).click({ force: true });
            return cy.wrap(desdobramentoSelecionado, { log: false });
          }),
      );
    });
}

// Preenche o intervalo formado pelas menores e maiores datas encontradas.
function selecionarDatasNoFiltroAvancado({ dataInicial, dataFinal }) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#periodo_inicial", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(dataInicial, { force: true })
        .should("have.value", dataInicial),
    )
    .then(() =>
      cy
        .get("#periodo_final", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(dataFinal, { force: true })
        .should("have.value", dataFinal),
    );
}

// Escolhe o primeiro ano diferente do ano já utilizado na pesquisa.
function selecionarOutroAnoNoFiltroAvancado(anoAtual) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#select_ano .selected", { timeout: LISTAGEM_TIMEOUT })
        .click({ force: true }),
    )
    .then(() =>
      cy
        .get("#select_ano .options .list a", { timeout: LISTAGEM_TIMEOUT })
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find(
            (elemento) =>
              Number(elemento.getAttribute("href")?.replace(/^#/, "")) !==
              Number(anoAtual),
          );

          expect(opcao, "outro ano disponível no filtro avançado").to.exist;
          const ano = Number(opcao.getAttribute("href").replace(/^#/, ""));

          cy.wrap(opcao).click({ force: true });
          cy.get("#select_ano .selected").should("have.attr", "id", String(ano));
          return cy.wrap(ano, { log: false });
        }),
    );
}

// Executa a consulta do filtro avançado e aguarda a nova listagem.
function pesquisarFiltroAvancado() {
  cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  return aguardarRetornoDoFiltro().then(() => aguardarListagem());
}

// Abre o primeiro resultado e confere o mês retornado no detalhamento.
function validarMesDoResultado(mesEsperado, descricao) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#mes", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($campo) => obterNumeroMes(obterValorDoCampo($campo))),
    )
    .then((mesRetornado) => {
      expect(mesRetornado, `mês retornado para ${descricao}`).to.equal(
        Number(mesEsperado),
      );
      cy.log(
        `[${SG_RECEITAS_NOME}][filtro avançado][${descricao}] ${MESES[mesRetornado - 1]}`,
      );
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Abre o primeiro retorno e confere o ano aplicado no filtro avançado.
function validarAnoDoResultado(anoEsperado, descricao) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#ano", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($campo) => Number(obterValorDoCampo($campo))),
    )
    .then((anoRetornado) => {
      expect(anoRetornado, `ano retornado para ${descricao}`).to.equal(
        Number(anoEsperado),
      );
      cy.log(
        `[${SG_RECEITAS_NOME}][filtro avançado][${descricao}] ${anoRetornado}`,
      );
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Abre o primeiro retorno e confere o órgão aplicado no filtro avançado.
function validarOrgaoDoResultado(orgaoSelecionado, descricao) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#orgao", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($campo) => obterValorDoCampo($campo)),
    )
    .then((orgaoRetornado) => {
      const codigoRetornado = obterCodigoOrgao(orgaoRetornado);
      const codigoSelecionado = orgaoSelecionado.codigo;
      const correspondePorCodigo =
        codigoSelecionado &&
        codigoRetornado &&
        codigoSelecionado === codigoRetornado;

      expect(
        correspondePorCodigo ||
          orgaosCorrespondem(orgaoSelecionado.texto, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com "${orgaoSelecionado.texto}"`,
      ).to.equal(true);
      cy.log(
        `[${SG_RECEITAS_NOME}][filtro avançado][${descricao}] ${orgaoRetornado}`,
      );
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Confere a descrição na listagem e em um campo de Natureza do detalhamento.
function validarDescricaoDoResultado(descricao) {
  const descricaoNormalizada = normalizarParaComparacao(descricao);

  return aguardarListagem()
    .then(($linhas) => {
      const encontrouNaListagem = Array.from($linhas).some((linha) =>
        normalizarParaComparacao(
          Cypress.$(linha).find(".colDescricao").text(),
        ).includes(descricaoNormalizada),
      );

      expect(
        encontrouNaListagem,
        `descrição "${descricao}" retornada na listagem`,
      ).to.equal(true);
    })
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#container_content", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($detalhe) => {
          const camposNatureza = [
            "#nat_categoria_economica",
            "#nat_origem",
            "#nat_especie",
            "#nat_desdobramento",
          ];
          const encontrouNoDetalhe = camposNatureza.some((seletor) =>
            normalizarParaComparacao(
              obterValorDoCampo($detalhe.find(seletor)),
            ).includes(descricaoNormalizada),
          );

          expect(
            encontrouNoDetalhe,
            `descrição "${descricao}" compatível com o detalhamento`,
          ).to.equal(true);
        }),
    )
    .then(() => {
      cy.log(
        `[${SG_RECEITAS_NOME}][filtro avançado][descrição] ${descricao}`,
      );
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Valida a Categoria Econômica no detalhamento do primeiro retorno.
function validarCategoriaEconomicaDoResultado(categoriaEsperada) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#nat_categoria_economica", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($campo) => obterValorDoCampo($campo)),
    )
    .then((categoriaRetornada) => {
      expect(
        categoriasCorrespondem(categoriaEsperada, categoriaRetornada),
        `categoria retornada "${categoriaRetornada}" compatível com "${categoriaEsperada}"`,
      ).to.equal(true);
      cy.log(
        `[${SG_RECEITAS_NOME}][filtro avançado][categoria econômica] ${categoriaRetornada}`,
      );
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Valida a Origem no detalhamento do primeiro retorno.
function validarOrigemDoResultado(origemEsperada) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#nat_origem", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($campo) => obterValorDoCampo($campo)),
    )
    .then((origemRetornada) => {
      expect(
        origensCorrespondem(origemEsperada, origemRetornada),
        `origem retornada "${origemRetornada}" compatível com "${origemEsperada}"`,
      ).to.equal(true);
      cy.log(`[${SG_RECEITAS_NOME}][filtro avançado][origem] ${origemRetornada}`);
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Valida a Espécie no detalhamento do primeiro retorno.
function validarEspecieDoResultado(especieEsperada) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#nat_especie", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($campo) => obterValorDoCampo($campo)),
    )
    .then((especieRetornada) => {
      expect(
        especiesCorrespondem(especieEsperada, especieRetornada),
        `espécie retornada "${especieRetornada}" compatível com "${especieEsperada}"`,
      ).to.equal(true);
      cy.log(`[${SG_RECEITAS_NOME}][filtro avançado][espécie] ${especieRetornada}`);
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Valida o Tipo no detalhamento do primeiro retorno.
function validarTipoDoResultado(tipoEsperado) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#nat_tipo", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($campo) => obterValorDoCampo($campo)),
    )
    .then((tipoRetornado) => {
      expect(
        tiposCorrespondem(tipoEsperado, tipoRetornado),
        `Tipo retornado "${tipoRetornado}" compatível com "${tipoEsperado}"`,
      ).to.equal(true);
      cy.log(`[${SG_RECEITAS_NOME}][filtro avançado][Tipo] ${tipoRetornado}`);
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Confere se os registros retornados estão dentro do intervalo pesquisado.
function validarIntervaloValorPrevistoDoResultado({ minimo, maximo }) {
  return aguardarListagem()
    .then(($linhas) => {
      expect(
        $linhas.length,
        `registros retornados para Valor Previsto entre ${minimo.texto} e ${maximo.texto}`,
      ).to.be.greaterThan(0);

      Array.from($linhas).forEach((linha) => {
        const celulas = Cypress.$(linha).find(".colPrevisao").toArray();
        const texto = normalizarTexto(celulas[celulas.length - 1]?.textContent);
        const numero = normalizarValorMonetario(texto);

        if (Number.isFinite(numero)) {
          expect(
            numero,
            `Valor Previsto retornado "${texto}" dentro do intervalo pesquisado`,
          ).to.be.within(minimo.numero, maximo.numero);
        }
      });

      cy.log(
        `[${SG_RECEITAS_NOME}][filtro avançado][Valor Previsto] ${$linhas.length} registro(s) entre ${minimo.texto} e ${maximo.texto}`,
      );
    })
    .then(() => {
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Coleta vários valores arrecadados e identifica os limites do intervalo.
function obterIntervaloValorArrecadadoDaListagem() {
  return aguardarListagem().then(($linhas) => {
    const valores = Array.from($linhas)
      .map((linha) => {
        const texto = normalizarTexto(
          Cypress.$(linha).find(".colArrecadacao").text(),
        );

        return {
          texto,
          numero: normalizarValorMonetario(texto),
        };
      })
      .filter(({ numero }) => Number.isFinite(numero));

    expect(valores.length, "Valores Arrecadados disponíveis na listagem").to.be
      .greaterThan(1);

    const valoresOrdenados = [...valores].sort(
      (valorA, valorB) => valorA.numero - valorB.numero,
    );
    const minimo = valoresOrdenados[0];
    const maximo = valoresOrdenados[valoresOrdenados.length - 1];

    expect(minimo.numero, "menor Valor Arrecadado").to.be.at.most(maximo.numero);
    cy.log(
      `[${SG_RECEITAS_NOME}][Valor Arrecadado] intervalo ${minimo.texto} a ${maximo.texto}`,
    );

    return cy.wrap(
      {
        minimo: {
          ...minimo,
          entrada: formatarValorParaEntrada(minimo.numero),
        },
        maximo: {
          ...maximo,
          entrada: formatarValorParaEntrada(maximo.numero),
        },
      },
      { log: false },
    );
  });
}

// Preenche os valores inicial e final de Arrecadação no filtro avançado.
function selecionarIntervaloValorArrecadadoNoFiltroAvancado({ minimo, maximo }) {
  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#arrmin", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(minimo.entrada, { force: true })
        .should(($campo) => {
          expect(
            normalizarValorMonetario($campo.val()),
            "Valor Arrecadado inicial preenchido no filtro avançado",
          ).to.be.greaterThan(0);
        }),
    )
    .then(() =>
      cy
        .get("#arrmax", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(maximo.entrada, { force: true })
        .should(($campo) => {
          expect(
            normalizarValorMonetario($campo.val()),
            "Valor Arrecadado final preenchido no filtro avançado",
          ).to.be.greaterThan(0);
        }),
    )
    .then(() => cy.wrap({ minimo, maximo }, { log: false }));
}

// Preenche o intervalo invertido para validar o bloqueio da Arrecadação.
function selecionarIntervaloValorArrecadadoInvalidoNoFiltroAvancado({
  minimo,
  maximo,
}) {
  const valorInicialInvalido = {
    numero: maximo.numero + 1,
    entrada: formatarValorParaEntrada(maximo.numero + 1),
  };

  return abrirFiltroAvancado()
    .then(() =>
      cy
        .get("#arrmin", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(valorInicialInvalido.entrada, { force: true }),
    )
    .then(() =>
      cy
        .get("#arrmax", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .clear({ force: true })
        .type(minimo.entrada, { force: true }),
    )
    .then(() =>
      cy.wrap(
        {
          valorInicial: valorInicialInvalido,
          valorFinal: minimo,
        },
        { log: false },
      ),
    );
}

// Confere se os valores arrecadados retornados estão no intervalo pesquisado.
function validarIntervaloValorArrecadadoDoResultado({ minimo, maximo }) {
  return aguardarListagem().then(($linhas) => {
    expect(
      $linhas.length,
      `registros retornados para Valor Arrecadado entre ${minimo.texto} e ${maximo.texto}`,
    ).to.be.greaterThan(0);

    Array.from($linhas).forEach((linha) => {
      const texto = normalizarTexto(
        Cypress.$(linha).find(".colArrecadacao").text(),
      );
      const numero = normalizarValorMonetario(texto);

      if (Number.isFinite(numero)) {
        expect(
          numero,
          `Valor Arrecadado retornado "${texto}" dentro do intervalo pesquisado`,
        ).to.be.within(minimo.numero, maximo.numero);
      }
    });

    cy.log(
      `[${SG_RECEITAS_NOME}][filtro avançado][Valor Arrecadado] ${$linhas.length} registro(s) entre ${minimo.texto} e ${maximo.texto}`,
    );
  });
}

// Valida o Desdobramento no detalhamento do primeiro retorno.
function validarDesdobramentoDoResultado(desdobramentoEsperado) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#nat_desdobramento", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($campo) => obterValorDoCampo($campo)),
    )
    .then((desdobramentoRetornado) => {
      expect(
        desdobramentosCorrespondem(
          desdobramentoEsperado,
          desdobramentoRetornado,
        ),
        `desdobramento retornado "${desdobramentoRetornado}" compatível com "${desdobramentoEsperado}"`,
      ).to.equal(true);
      cy.log(
        `[${SG_RECEITAS_NOME}][filtro avançado][desdobramento] ${desdobramentoRetornado}`,
      );
      cy.visitPortal(SG_RECEITAS_PATH);
      return aguardarListagem();
    });
}

// Valida que os períodos exibidos permanecem dentro do intervalo pesquisado.
function validarDatasDoResultado({ inicio, fim }) {
  return aguardarListagem().then(($linhas) => {
    expect($linhas.length, "registros retornados pelo filtro de período").to.be.greaterThan(
      0,
    );

    Array.from($linhas).forEach((linha) => {
      const periodo = normalizarTexto(Cypress.$(linha).find(".col8").text());
      const dataDoRegistro = converterPeriodoDaListagem(periodo);

      expect(dataDoRegistro, `${periodo} dentro do intervalo filtrado`).to.be.at.least(
        inicio,
      );
      expect(dataDoRegistro, `${periodo} dentro do intervalo filtrado`).to.be.at.most(
        fim,
      );
    });

    cy.log(
      `[${SG_RECEITAS_NOME}][filtro avançado][período] ${formatarDataBrasileira(inicio)} a ${formatarDataBrasileira(fim)}`,
    );
  });
}

describe(`Portal: ${SG_RECEITAS_NOME} - filtro avançado`, () => {
  beforeEach(() => {
    cy.visitPortal(SG_RECEITAS_PATH);
    cy.get(".filtro", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
    aguardarListagem();
  });

  // Pesquisa o mês original e depois outro mês no filtro avançado.
  it("filtra por mês no filtro avançado e valida dois retornos", () => {
    obterMesDoPrimeiroRegistro().then((mesInicial) => {
      return selecionarMesNoFiltroAvancado(mesInicial)
        .then(() => pesquisarFiltroAvancado())
        .then(() => validarMesDoResultado(mesInicial, "mês original"))
        .then(() => selecionarOutroMesNoFiltroAvancado(mesInicial))
        .then((mesSelecionado) => pesquisarFiltroAvancado().then(() => mesSelecionado))
        .then((mesSelecionado) =>
          validarMesDoResultado(mesSelecionado.numero, "outro mês"),
        );
    });
  });

  // Pesquisa o ano original e depois outro ano no filtro avançado.
  it("filtra por ano no filtro avançado e valida dois retornos", () => {
    obterAnoDoPrimeiroRegistro().then((anoInicial) =>
      selecionarAnoNoFiltroAvancado(anoInicial)
        .then(() => pesquisarFiltroAvancado())
        .then(() => validarAnoDoResultado(anoInicial, "ano original"))
        .then(() => selecionarOutroAnoNoFiltroAvancado(anoInicial))
        .then((anoSelecionado) =>
          pesquisarFiltroAvancado().then(() => anoSelecionado),
        )
        .then((anoSelecionado) =>
          validarAnoDoResultado(anoSelecionado, "outro ano"),
        ),
    );
  });

  // Pesquisa o órgão original e depois outro órgão no filtro avançado.
  it("filtra por órgão no filtro avançado e valida dois retornos", () => {
    obterOrgaoDoPrimeiroRegistro()
      .then((orgaoInicial) => selecionarOrgaoNoFiltroAvancado(orgaoInicial))
      .then((orgaoSelecionado) =>
        pesquisarFiltroAvancado().then(() => orgaoSelecionado),
      )
      .then((orgaoSelecionado) =>
        validarOrgaoDoResultado(orgaoSelecionado, "órgão original").then(
          () => orgaoSelecionado,
        ),
      )
      .then((orgaoAtual) => selecionarOutroOrgaoNoFiltroAvancado(orgaoAtual))
      .then((outroOrgao) =>
        pesquisarFiltroAvancado().then(() => outroOrgao),
      )
      .then((outroOrgao) => validarOrgaoDoResultado(outroOrgao, "outro órgão"));
  });

  // Pesquisa a descrição real no campo textual do filtro avançado.
  it("filtra por descrição no filtro avançado e valida o detalhamento", () => {
    obterDescricaoDoPrimeiroRegistro()
      .then((descricao) => selecionarDescricaoNoFiltroAvancado(descricao))
      .then((descricao) =>
        pesquisarFiltroAvancado().then(() => descricao),
      )
      .then((descricao) => validarDescricaoDoResultado(descricao));
  });

  // Usa a menor e a maior data dos registros para validar o intervalo.
  it("filtra por data inicial e data final e valida a listagem", () => {
    obterDatasInicialEFinalDaListagem()
      .then((periodo) => selecionarDatasNoFiltroAvancado(periodo).then(() => periodo))
      .then((periodo) => pesquisarFiltroAvancado().then(() => periodo))
      .then((periodo) => validarDatasDoResultado(periodo));
  });

  // Confirma que o portal bloqueia o intervalo quando a data inicial é maior.
  it("bloqueia pesquisa com data inicial maior que data final", () => {
    abrirFiltroAvancado()
      .then(() =>
        cy
          .get("#periodo_inicial", { timeout: LISTAGEM_TIMEOUT })
          .clear({ force: true })
          .type("31/12/2026", { force: true })
          .should("have.value", "31/12/2026"),
      )
      .then(() =>
        cy
          .get("#periodo_final", { timeout: LISTAGEM_TIMEOUT })
          .clear({ force: true })
          .type("01/01/2026", { force: true })
          .should("have.value", "01/01/2026"),
      )
      .then(() => {
        cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT })
          .should("be.visible")
          .click({ force: true });

        cy.get(".alertas-msg > p", { timeout: LISTAGEM_TIMEOUT })
          .first()
          .should("be.visible")
          .invoke("text")
          .then((textoAlerta) => {
            const mensagem = normalizarTexto(textoAlerta);
            expect(
              mensagem,
              "mensagem de erro para intervalo inválido",
            ).to.match(/data|período|inicial|final|inválid|invalíd/i);

            Cypress.log({
              name: "ALERTA",
              message: mensagem,
              consoleProps: () => ({
                dataInicial: "31/12/2026",
                dataFinal: "01/01/2026",
                mensagem,
              }),
            });
            cy.log(`ALERTA: ${mensagem}`);
          });
      });
  });

  // Pesquisa duas Categorias Econômicas e valida cada detalhamento retornado.
  it("filtra por duas Categorias Econômicas e valida os detalhamentos", () => {
    obterCategoriaEconomicaDoPrimeiroRegistro()
      .then((categoria) => selecionarCategoriaNoFiltroAvancado(categoria))
      .then((categoriaSelecionada) =>
        pesquisarFiltroAvancado().then(() => categoriaSelecionada),
      )
      .then((categoriaSelecionada) =>
        validarCategoriaEconomicaDoResultado(categoriaSelecionada).then(
          () => categoriaSelecionada,
        ),
      )
      .then((categoriaAtual) =>
        selecionarOutraCategoriaNoFiltroAvancado(categoriaAtual),
      )
      .then((outraCategoria) =>
        pesquisarFiltroAvancado().then(() => outraCategoria),
      )
      .then((outraCategoria) =>
        validarCategoriaEconomicaDoResultado(outraCategoria),
      );
  });

  // Pesquisa a Origem real e valida o detalhamento retornado.
  it("filtra por Origem e valida o detalhamento", () => {
    obterOrigemDoPrimeiroRegistro()
      .then((origem) => selecionarOrigemNoFiltroAvancado(origem))
      .then((origemSelecionada) =>
        pesquisarFiltroAvancado().then(() => origemSelecionada),
      )
      .then((origemSelecionada) => validarOrigemDoResultado(origemSelecionada));
  });

  // Pesquisa a Espécie real e valida o detalhamento retornado.
  it("filtra por Espécie e valida o detalhamento", () => {
    obterEspecieDoPrimeiroRegistro()
      .then((especie) => selecionarEspecieNoFiltroAvancado(especie))
      .then((especieSelecionada) =>
        pesquisarFiltroAvancado().then(() => especieSelecionada),
      )
      .then((especieSelecionada) =>
        validarEspecieDoResultado(especieSelecionada),
      );
  });

  // Pesquisa o Tipo real e valida o detalhamento retornado.
  it("filtra por Tipo e valida o detalhamento", () => {
    obterTipoDoPrimeiroRegistro()
      .then((tipo) => selecionarTipoNoFiltroAvancado(tipo))
      .then((tipoSelecionado) =>
        pesquisarFiltroAvancado().then(() => tipoSelecionado),
      )
      .then((tipoSelecionado) => validarTipoDoResultado(tipoSelecionado));
  });

  // Pesquisa o intervalo de Valor Previsto e valida os registros retornados.
  it("filtra por Valor Previsto e valida a listagem", () => {
    obterIntervaloValorPrevistoDaListagem()
      .then((intervalo) =>
        selecionarIntervaloValorPrevistoNoFiltroAvancado(intervalo),
      )
      .then((intervalo) => pesquisarFiltroAvancado().then(() => intervalo))
      .then((intervalo) => validarIntervaloValorPrevistoDoResultado(intervalo));
  });

  // Pesquisa o intervalo de Valor Arrecadado e valida os registros retornados.
  it("filtra por Valor Arrecadado e valida a listagem", () => {
    obterIntervaloValorArrecadadoDaListagem()
      .then((intervalo) =>
        selecionarIntervaloValorArrecadadoNoFiltroAvancado(intervalo),
      )
      .then((intervalo) => pesquisarFiltroAvancado().then(() => intervalo))
      .then((intervalo) => validarIntervaloValorArrecadadoDoResultado(intervalo));
  });

  // Impede a pesquisa quando o Valor Arrecadado inicial é maior que o final.
  it("bloqueia Valor Arrecadado inicial maior que o final", () => {
    obterIntervaloValorArrecadadoDaListagem()
      .then((intervalo) =>
        aguardarListagem().then(($linhas) => ({
          intervalo,
          codigoPrimeiroRegistro: normalizarTexto(
            Cypress.$($linhas.first()).find(".colCodigo").text(),
          ),
        })),
      )
      .then(({ intervalo, codigoPrimeiroRegistro }) =>
        selecionarIntervaloValorArrecadadoInvalidoNoFiltroAvancado(
          intervalo,
        ).then((valores) => ({ valores, codigoPrimeiroRegistro })),
      )
      .then(({ valores, codigoPrimeiroRegistro }) => {
        cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT })
          .should("be.visible")
          .click({ force: true });

        cy.get(".alertas-msg > p", { timeout: LISTAGEM_TIMEOUT })
          .first()
          .should("be.visible")
          .invoke("text")
          .then((textoAlerta) => {
            const mensagem = normalizarTexto(textoAlerta);

            expect(
              mensagem,
              "mensagem de erro para intervalo inválido de Valor Arrecadado",
            ).to.match(/valor|arrec|mín|máx|invalíd|inválid/i);

            Cypress.log({
              name: "ALERTA",
              message: mensagem,
              consoleProps: () => ({
                valorInicial: valores.valorInicial.entrada,
                valorFinal: valores.valorFinal.entrada,
                mensagem,
              }),
            });
            cy.log(`ALERTA: ${mensagem}`);
          });

        cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
          .filter(
            (_, linha) =>
              !["not-found-line", "template_row"].includes(linha.id) &&
              !linha.classList.contains("tb-load") &&
              linha.querySelector("td"),
          )
          .first()
          .find(".colCodigo")
          .should("contain", codigoPrimeiroRegistro);
      });
  });

  // Impede a pesquisa quando o Valor Previsto inicial é maior que o final.
  it("bloqueia Valor Previsto inicial maior que o final", () => {
    obterIntervaloValorPrevistoDaListagem()
      .then((intervalo) =>
        aguardarListagem().then(($linhas) => ({
          intervalo,
          codigoPrimeiroRegistro: normalizarTexto(
            Cypress.$($linhas.first()).find(".colCodigo").text(),
          ),
        })),
      )
      .then(({ intervalo, codigoPrimeiroRegistro }) =>
        selecionarIntervaloValorPrevistoInvalidoNoFiltroAvancado(intervalo).then(
          (valores) => ({ valores, codigoPrimeiroRegistro }),
        ),
      )
      .then(({ valores, codigoPrimeiroRegistro }) => {
        cy.get("#btnBuscar", { timeout: LISTAGEM_TIMEOUT })
          .should("be.visible")
          .click({ force: true });

        cy.get(".alertas-msg > p", { timeout: LISTAGEM_TIMEOUT })
          .first()
          .should("be.visible")
          .invoke("text")
          .then((textoAlerta) => {
            const mensagem = normalizarTexto(textoAlerta);

            expect(
              mensagem,
              "mensagem de erro para intervalo inválido de Valor Previsto",
            ).to.match(/valor|previs|mín|máx|invalíd|inválid/i);

            Cypress.log({
              name: "ALERTA",
              message: mensagem,
              consoleProps: () => ({
                valorInicial: valores.valorInicial.entrada,
                valorFinal: valores.valorFinal.entrada,
                mensagem,
              }),
            });
            cy.log(`ALERTA: ${mensagem}`);
          });

        cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
          .filter(
            (_, linha) =>
              !["not-found-line", "template_row"].includes(linha.id) &&
              !linha.classList.contains("tb-load") &&
              linha.querySelector("td"),
          )
          .first()
          .find(".colCodigo")
          .should("contain", codigoPrimeiroRegistro);
      });
  });

  // Pesquisa o Desdobramento real e valida o detalhamento retornado.
  it("filtra por Desdobramento e valida o detalhamento", () => {
    obterDesdobramentoDoPrimeiroRegistro()
      .then((desdobramento) =>
        selecionarDesdobramentoNoFiltroAvancado(desdobramento),
      )
      .then((desdobramentoSelecionado) =>
        pesquisarFiltroAvancado().then(() => desdobramentoSelecionado),
      )
      .then((desdobramentoSelecionado) =>
        validarDesdobramentoDoResultado(desdobramentoSelecionado),
      );
  });
});
