const DESPESAS_PATH =
  Cypress.env("DESPESAS_PATH") || "/cidadao/transparencia/mgdespesas";
const DESPESAS_NOME = Cypress.env("DESPESAS_NOME") || "mgdespesas";
const LISTAGEM_TIMEOUT = 60000;
const INTERVALO_VERIFICACAO_LOADER = 1000;
const MAX_TENTATIVAS_LOADER = 60;

// O filtro avançado usa a primeira linha real da listagem como massa de dados:
// o teste coleta um valor no detalhe, retorna à listagem e pesquisa esse valor.
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

function obterOpcaoCorrespondente($opcoes, valorEsperado) {
  return Array.from($opcoes).find(
    (opcao) =>
      Cypress.$(opcao).is(":visible") &&
      valoresDoFiltroCorrespondem(valorEsperado, opcao.textContent),
  );
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

// Mantém apenas termos úteis para comparar descrições que podem variar entre
// o detalhamento e as opções dos selects customizados.
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

  return (
    siglas[removerCodigo(nomeOrgao)] ||
    obterTermosParaAcronimo(nomeOrgao).join("")
  );
}

function obterTermosParaAcronimo(texto) {
  const palavrasIgnoradas = new Set([
    "a",
    "as",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
  ]);

  return removerCodigo(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((palavra) => palavra && !palavrasIgnoradas.has(palavra))
    .map((palavra) => palavra[0]);
}

function obterTermosDePesquisaDoOrgao(nomeOrgao) {
  const nomeCompleto = removerCodigo(nomeOrgao);
  const sigla = obterSiglaDoOrgao(nomeOrgao);

  return [...new Set([nomeCompleto, sigla].filter(Boolean))];
}

function encontrarOpcaoDeOrgao($opcoes, termoPesquisa) {
  const termoNormalizado = removerCodigo(termoPesquisa);
  const termosPesquisados = obterTermosSignificativos(termoNormalizado);

  return Array.from($opcoes).find((elemento) => {
    if (!Cypress.$(elemento).is(":visible")) {
      return false;
    }

    const textoOpcao = removerCodigo(elemento.textContent);
    const termosDaOpcao = obterTermosSignificativos(textoOpcao);

    return (
      textoOpcao.includes(termoNormalizado) ||
      (termosPesquisados.length > 0 &&
        termosPesquisados.every((termo) => termosDaOpcao.includes(termo)))
    );
  });
}

function tentarSelecionarOrgao(termosDePesquisa, indice = 0) {
  const termoPesquisa = termosDePesquisa[indice];

  return cy
    .get("#select_org_avanc .options", { timeout: 30000 })
    .then(($options) => {
      const $input = $options.find("input:visible");

      if (indice === 0 || !$input.length) {
        return undefined;
      }

      return cy
        .wrap($input.first())
        .clear({ force: true })
        .type(termoPesquisa, { force: true });
    })
    .then(() =>
      obterOpcoesCarregadas("#select_org_avanc").then(($opcoes) => {
        const opcao = encontrarOpcaoDeOrgao($opcoes, termoPesquisa);

        if (opcao) {
          cy.wrap(opcao).click({ force: true });
          return cy.wrap(true, { log: false });
        }

        if (indice < termosDePesquisa.length - 1) {
          return tentarSelecionarOrgao(termosDePesquisa, indice + 1);
        }

        expect(opcao, `órgão ${termoPesquisa} disponível no filtro`).to.exist;
        return cy.wrap(false, { log: false });
      }),
    );
}

// Abre um select customizado e escolhe a opção pelo texto visível.
function selecionarOpcao(containerSelector, textoOpcao) {
  cy.get(containerSelector).find(".selected").click({ force: true });
  obterOpcoesCarregadas(containerSelector);
  cy.contains(`${containerSelector} .options .list a`, textoOpcao, {
    matchCase: false,
  }).click({ force: true });
}

function obterOpcoesCarregadas(campo) {
  const comando = typeof campo === "string" ? cy.get(campo) : cy.wrap(campo);

  return comando
    .find(".options", { timeout: 30000 })
    .should("be.visible")
    .find(".list a", { timeout: 30000 })
    .filter(":visible")
    .should("have.length.at.least", 1);
}

// Alguns selects do filtro avançado são autocompletes: ao abrir, exibem
// somente o campo de busca e só criam as opções depois da pesquisa.
function pesquisarAutocomplete(campo, texto) {
  const comando = typeof campo === "string" ? cy.get(campo) : cy.wrap(campo);

  return comando
    .find(".options input:visible", { timeout: 30000 })
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

function unidadeCombinaComOpcao(nomeUnidade, nomeOpcao) {
  const unidadeEsperada = removerCodigo(nomeUnidade);
  const unidadeDaOpcao = removerCodigo(nomeOpcao);
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

function normalizarTermoParaSemelhanca(termo) {
  const termoNormalizado = normalizarParaComparacao(termo);

  return termoNormalizado.length > 4 && termoNormalizado.endsWith("s")
    ? termoNormalizado.slice(0, -1)
    : termoNormalizado;
}

function pontuarSemelhanca(valorEsperado, valorAtual) {
  const termosEsperados = obterTermosSignificativos(valorEsperado).map(
    normalizarTermoParaSemelhanca,
  );
  const termosAtuais = obterTermosSignificativos(valorAtual).map(
    normalizarTermoParaSemelhanca,
  );
  const termosEncontrados = termosEsperados.filter((termo) =>
    termosAtuais.includes(termo),
  ).length;

  return termosEsperados.length > 0
    ? termosEncontrados / termosEsperados.length
    : 0;
}

function obterOpcaoMaisParecida($opcoes, valorEsperado) {
  return Array.from($opcoes)
    .filter((opcao) => Cypress.$(opcao).is(":visible"))
    .map((opcao) => ({
      opcao,
      pontuacao: pontuarSemelhanca(valorEsperado, opcao.textContent),
    }))
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .find(({ pontuacao }) => pontuacao >= 0.75)?.opcao;
}

function aguardarLoaderDesaparecer(
  seletor,
  descricao,
  tentativa = 0,
  recarregamento = 0,
) {
  return cy.get("body").then(($body) => {
    const loaderVisivel = $body.find(seletor).filter(":visible").length > 0;

    if (!loaderVisivel) {
      return;
    }

    if (tentativa < MAX_TENTATIVAS_LOADER) {
      return cy
        .wait(INTERVALO_VERIFICACAO_LOADER, { log: false })
        .then(() =>
          aguardarLoaderDesaparecer(
            seletor,
            descricao,
            tentativa + 1,
            recarregamento,
          ),
        );
    }

    if (recarregamento === 0) {
      cy.log(`Loader persistente (${descricao}); recarregando a listagem`);

      return cy
        .reload()
        .then(() =>
          cy
            .get(".cont_dados", { timeout: LISTAGEM_TIMEOUT })
            .should("be.visible"),
        )
        .then(() => aguardarLoaderDesaparecer(seletor, descricao, 0, 1));
    }

    throw new Error(
      `${descricao} permaneceu visível após ${recarregamento} recarregamento da listagem`,
    );
  });
}

// Espera o carregamento da tabela, mas não exige que exista uma linha: alguns
// cenários do filtro avançado também validam o retorno sem dados.
function aguardarListagem() {
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.wait(250, { log: false });
  aguardarLoaderDesaparecer(".loader", "loader visível da listagem");
  aguardarLoaderDesaparecer(".tb-load", "loader visível da tabela");
}

// Retorna somente linhas de empenho, descartando placeholders e a linha de
// "nenhum resultado" para que as validações não confundam estado da tabela
// com dados reais.
function filtrarLinhasValidas($linhas) {
  return Array.from($linhas).filter(
    (row) =>
      !["not-found-line", "template_row"].includes(row.id) &&
      !row.classList.contains("tb-load"),
  );
}

function obterLinhasValidas() {
  return cy.get(".cont_dados .tb tr[id]").then(filtrarLinhasValidas);
}

function abrirPrimeiroEmpenho(tentativa = 0) {
  aguardarListagem();

  return obterLinhasValidas().then((linhas) => {
    if (linhas.length) {
      return cy
        .wrap(linhas[0])
        .find(".colNumero")
        .should("be.visible")
        .click({ force: true });
    }

    if (tentativa === 0) {
      cy.log("Nenhum empenho real carregado; recarregando a listagem");
      return cy.reload().then(() => abrirPrimeiroEmpenho(1));
    }

    const mensagem = normalizarTexto(Cypress.$("#not-found-line").text());
    throw new Error(
      mensagem || "Nenhum empenho real disponível para abrir no detalhamento",
    );
  });
}

// Centraliza a regra de resultado dos filtros: valida os dados quando existem
// e registra a mensagem apresentada pelo portal quando a consulta fica vazia.
function validarResultadoOuNenhumResultado(nomeFiltro, validarResultado) {
  return cy
    .get("body", { timeout: LISTAGEM_TIMEOUT })
    .should(($body) => {
      const linhas = filtrarLinhasValidas($body.find(".cont_dados .tb tr[id]"));
      const mensagem = normalizarTexto($body.find("#not-found-line").text());

      expect(
        linhas.length > 0 || mensagem.includes("Nenhum resultado encontrado"),
        `resultado do filtro ${nomeFiltro} carregado`,
      ).to.equal(true);
    })
    .then(() =>
      obterLinhasValidas().then((linhas) => {
        if (!linhas.length) {
          cy.get("#not-found-line > td", { timeout: LISTAGEM_TIMEOUT })
            .should("be.visible")
            .and("contain.text", "Nenhum resultado encontrado");

          const mensagem = `ALERTA: Nenhum resultado encontrado para o filtro ${nomeFiltro}.`;
          Cypress.log({
            name: "ALERTA",
            message: mensagem,
            consoleProps: () => ({
              filtro: nomeFiltro,
              resultado: "sem dados",
            }),
          });
          cy.log(mensagem);
          return;
        }

        validarResultado();
      }),
    );
}

// Alguns cenários precisam de um favorecido disponível. Se o ano atual não
// tiver dados completos, tenta também o ano anterior antes de iniciar os testes.
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

// O botão do filtro avançado é um toggle. Só clicamos nele quando o campo
// solicitado ainda não está visível, evitando fechar o painel entre tentativas.
function abrirFiltroAvancado(campoSelector = "#fornecedor") {
  cy.get("body").then(($body) => {
    const campoVisivel = $body.find(`${campoSelector}:visible`).length > 0;
    const painelAvancadoVisivel =
      $body.find(
        "#select_unidade:visible, #select_funcao:visible, #select_programa:visible, #rubricaDaDespesa:visible",
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

// Limpa filtros deixados por uma navegação anterior sem interferir quando o
// botão de limpeza não está disponível.
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
  cy.contains(".campo label", /^Filtrar COVID-19$/i)
    .parent()
    .then(($campo) => {
      cy.wrap($campo).find(".selected").click({ force: true });
      obterOpcoesCarregadas($campo)
        .should("have.length.at.least", 2)
        .contains(opcao, { matchCase: false })
        .click({ force: true });
    });
}

function obterDescricaoDoEmpenho() {
  // Coleta o valor diretamente do detalhamento antes de recarregar a listagem.
  abrirPrimeiroEmpenho();

  return cy
    .get("#desc", { timeout: 30000 })
    .should("be.visible")
    .invoke("val")
    .then((descricao) => {
      const descricaoNormalizada = normalizarTexto(descricao);

      expect(descricaoNormalizada, "descrição disponível").to.not.equal("");
      cy.reload();
      aguardarListagem();

      return cy.wrap(descricaoNormalizada, { log: false });
    });
}

function validarDescricaoNoDetalhe(descricaoBuscada) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  cy.get("#desc", { timeout: 30000 })
    .should("be.visible")
    .invoke("val")
    .then((descricaoRetornada) => {
      expect(normalizarTexto(descricaoRetornada).toLowerCase()).to.equal(
        descricaoBuscada.toLowerCase(),
      );
    });
}

function selecionarFavorecidoDaListagem() {
  return obterLinhasValidas().then((linhas) => {
    const favorecidos = Array.from(linhas)
      .slice(0, 5)
      .map((row) =>
        normalizarTexto(Cypress.$(row).find(".colFornecedor").text() || ""),
      )
      .filter(Boolean);

    expect(favorecidos.length, "favorecidos disponíveis").to.be.greaterThan(0);

    return cy.wrap(favorecidos[0], { log: false });
  });
}

function obterCpfCnpjDoEmpenho() {
  // O CPF/CNPJ é uma massa dinâmica; usar o primeiro empenho evita fixar dados
  // que podem mudar no ambiente público.
  abrirPrimeiroEmpenho();

  return cy
    .get("#cnpj", { timeout: 30000 })
    .should("be.visible")
    .invoke("val")
    .then((cpfCnpj) => {
      const documentoNormalizado = normalizarTexto(cpfCnpj);

      expect(documentoNormalizado, "CPF/CNPJ disponível").to.not.equal("");
      cy.reload();
      aguardarListagem();

      return cy.wrap(documentoNormalizado, { log: false });
    });
}

function validarCpfCnpjNoDetalhe(documentoBuscado) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  cy.get("#cnpj", { timeout: 30000 })
    .should("be.visible")
    .invoke("val")
    .then((documentoRetornado) => {
      expect(normalizarTexto(documentoRetornado)).to.equal(documentoBuscado);
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

function obterNumeroDaListagem() {
  return obterLinhasValidas().then((linhas) => {
    const numeros = Array.from(linhas)
      .map((row) =>
        normalizarTexto(Cypress.$(row).find(".colNumero").text() || ""),
      )
      .filter(Boolean);

    expect(numeros.length, "números de empenho disponíveis").to.be.greaterThan(
      0,
    );
    return cy.wrap(numeros[0], { log: false });
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
      .filter(Boolean);

    numerosRetornados.forEach((numero) => {
      expect(numero).to.equal(numeroBuscado);
    });
  });
}

function obterValorEmpenhadoDoEmpenho() {
  abrirPrimeiroEmpenho();

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Valor Empenhado$/i)
    .parent()
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((valor) => {
      const valorNormalizado = normalizarTexto(valor);

      expect(valorNormalizado, "valor empenhado disponível").to.not.equal("");
      cy.reload();
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
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((valorRetornado) => {
      expect(normalizarTexto(valorRetornado)).to.equal(valorBuscado);
    });
}

function obterValorLiquidadoDoEmpenho() {
  abrirPrimeiroEmpenho();

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Valor Liquidado$/i)
    .parent()
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((valor) => {
      const valorNormalizado = normalizarTexto(valor);

      expect(valorNormalizado, "valor liquidado disponível").to.not.equal("");
      cy.reload();
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
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((valorRetornado) => {
      expect(normalizarTexto(valorRetornado)).to.equal(valorBuscado);
    });
}

function converterData(data) {
  const [dia, mes, ano] = data.split("/").map(Number);
  return new Date(ano, mes - 1, dia);
}

function obterPeriodoDaListagem() {
  // Usa a data do primeiro registro para garantir que o período pesquisado
  // corresponda a dados realmente existentes na listagem.
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

function obterOrgaoDoEmpenho() {
  // Os selects do filtro avançado podem ter textos abreviados; por isso o
  // órgão é obtido no detalhe e comparado por termos significativos.
  abrirPrimeiroEmpenho();

  return cy
    .contains(".campo label", /^Órgão$/)
    .parent()
    .find("#orgao", { timeout: 30000 })
    .should("be.visible")
    .invoke("val")
    .then((orgao) => {
      const orgaoNormalizado = normalizarTexto(orgao);

      expect(orgaoNormalizado, "órgão disponível").to.not.equal("");
      cy.reload();
      aguardarListagem();

      return cy.wrap(orgaoNormalizado, { log: false });
    });
}

function selecionarOrgao(nomeOrgao) {
  const termosDePesquisa = obterTermosDePesquisaDoOrgao(nomeOrgao);

  cy.get("#select_org_avanc").find(".selected").click({ force: true });

  return tentarSelecionarOrgao(termosDePesquisa);
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
    .invoke("val")
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

function obterUnidadeDoEmpenho() {
  abrirPrimeiroEmpenho();

  return cy
    .contains(".campo label", /^Unidade$/)
    .parent()
    .find("#unidade", { timeout: 30000 })
    .should("be.visible")
    .invoke("val")
    .then((unidade) => {
      const unidadeNormalizada = normalizarTexto(unidade);

      expect(unidadeNormalizada, "unidade disponível").to.not.equal("");
      cy.reload();
      aguardarListagem();

      return cy.wrap(unidadeNormalizada, { log: false });
    });
}

function selecionarUnidade(nomeUnidade) {
  cy.get("#select_unidade").find(".selected").click({ force: true });
  const termosParaBusca = obterTermosSignificativos(nomeUnidade);
  const termoParaBusca = [...termosParaBusca].sort(
    (termoA, termoB) => termoB.length - termoA.length,
  )[0];

  pesquisarAutocomplete(
    "#select_unidade",
    termoParaBusca || removerCodigo(nomeUnidade),
  )
    .then(() => obterOpcoesCarregadas("#select_unidade"))
    .should(($opcoes) => {
      expect(
        Array.from($opcoes).find((opcao) =>
          unidadeCombinaComOpcao(nomeUnidade, opcao.textContent),
        ),
        `unidade ${nomeUnidade} disponível no filtro`,
      ).to.exist;
    })
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        unidadeCombinaComOpcao(nomeUnidade, elemento.textContent),
      );

      cy.wrap(opcao).click({ force: true });
    });
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
    .invoke("val")
    .then((unidadeRetornada) => {
      expect(
        valoresDoFiltroCorrespondem(nomeUnidade, unidadeRetornada),
        `unidade retornada "${unidadeRetornada}" compatível com "${nomeUnidade}"`,
      ).to.equal(true);
    });
}

function obterFuncaoDoEmpenho() {
  abrirPrimeiroEmpenho();

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Função$/, { timeout: 30000 })
    .parent()
    .find("#funcao", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .invoke("val")
    .then((funcao) => {
      const funcaoNormalizada = normalizarTexto(funcao);

      expect(funcaoNormalizada, "função disponível").to.not.equal("");
      cy.reload();
      aguardarListagem();

      return cy.wrap(funcaoNormalizada, { log: false });
    });
}

// Fecha o aviso de termos quando ele aparece sobre o detalhamento. O helper é
// chamado apenas nos campos que podem abrir esse aviso no portal.
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
  const termoParaPesquisa = removerCodigo(nomeFuncao);

  cy.get("#select_funcao").find(".selected").click({ force: true });
  cy.get("#select_funcao .options input:visible", { timeout: 30000 })
    .first()
    .should("be.visible")
    .clear({ force: true })
    .type(termoParaPesquisa, { force: true });

  obterOpcoesCarregadas("#select_funcao").then(($opcoes) => {
    const opcao = obterOpcaoCorrespondente($opcoes, nomeFuncao);

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

  cy.contains(".campo label", /^Função$/, { timeout: 30000 })
    .parent()
    .find("#funcao", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .invoke("val")
    .then((funcaoRetornada) => {
      expect(
        valoresDoFiltroCorrespondem(nomeFuncao, funcaoRetornada),
        `função retornada "${funcaoRetornada}" compatível com "${nomeFuncao}"`,
      ).to.equal(true);
    });
}

function obterSubfuncaoDoEmpenho() {
  abrirPrimeiroEmpenho();

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Subfunção$/, { timeout: 30000 })
    .parent()
    .find("#subfuncao", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .invoke("val")
    .then((subfuncao) => {
      const subfuncaoNormalizada = normalizarTexto(subfuncao);

      expect(subfuncaoNormalizada, "subfunção disponível").to.not.equal("");
      cy.reload();
      aguardarListagem();

      return cy.wrap(subfuncaoNormalizada, { log: false });
    });
}

function selecionarSubfuncao(nomeSubfuncao) {
  cy.contains(".campo:visible label", /^Subfunção$/i, { timeout: 30000 })
    .parent()
    .then(($campo) => {
      cy.wrap($campo).find(".selected").click({ force: true });
      cy.wrap($campo)
        .find(".options input:visible")
        .then(($input) => {
          if ($input.length) {
            return pesquisarAutocomplete($campo, removerCodigo(nomeSubfuncao));
          }

          return undefined;
        })
        .then(() => obterOpcoesCarregadas($campo))
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find((elemento) =>
            valoresDoFiltroCorrespondem(nomeSubfuncao, elemento.textContent),
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

  cy.contains(".campo label", /^Subfunção$/, { timeout: 30000 })
    .parent()
    .find("#subfuncao", { timeout: 30000 })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .invoke("val")
    .then((subfuncaoRetornada) => {
      expect(normalizarTexto(subfuncaoRetornada).toLowerCase()).to.equal(
        nomeSubfuncao.toLowerCase(),
      );
    });
}

function obterGrupoDoEmpenho(indice = 0) {
  return obterLinhasValidas().then((linhas) => {
    expect(indice, "registro com Grupo disponível na listagem").to.be.lessThan(
      linhas.length,
    );

    cy.wrap(linhas[indice]).find(".colNumero").click({ force: true });
    fecharTermosDeUsoSeExibido();

    return cy
      .contains(".campo label", /^Grupo$/i, { timeout: 30000 })
      .parent()
      .find("#grupo, input, textarea, .input", { timeout: 30000 })
      .first()
      .scrollIntoView({ duration: 0 })
      .should("exist")
      .should(aguardarCampoComValor)
      .then(obterValorDoCampo)
      .then((grupo) => {
        cy.visitPortal(DESPESAS_PATH);
        aguardarListagem();

        if (grupo) {
          return cy.wrap(grupo, { log: false });
        }

        return obterGrupoDoEmpenho(indice + 1);
      });
  });
}

function selecionarGrupo(nomeGrupo) {
  const termoParaPesquisa =
    nomeGrupo.match(/^[\d.]+/)?.[0] || removerCodigo(nomeGrupo);

  return cy
    .contains(".campo label", /^Grupo$/i, { timeout: 30000 })
    .parent()
    .then(($campo) => {
      cy.wrap($campo).find(".selected").click({ force: true });
      cy.wrap($campo)
        .find(".options input:visible")
        .then(($input) => {
          if ($input.length) {
            return pesquisarAutocomplete($campo, termoParaPesquisa);
          }

          return undefined;
        })
        .then(() => obterOpcoesCarregadas($campo))
        .then(($opcoes) => {
          const opcao = obterOpcaoCorrespondente($opcoes, nomeGrupo);

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

  cy.contains(".campo label", /^Grupo$/i, { timeout: 30000 })
    .parent()
    .find("#grupo, input, textarea, .input", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((grupoRetornado) => {
      expect(
        valoresDoFiltroCorrespondem(nomeGrupo, grupoRetornado),
        `grupo retornado "${grupoRetornado}" compatível com "${nomeGrupo}"`,
      ).to.equal(true);
    });
}

function obterModalidadeAplicacaoDoEmpenho() {
  abrirPrimeiroEmpenho();

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Modalidade de Aplicação$/i)
    .parent()
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((modalidade) => {
      const modalidadeNormalizada = normalizarTexto(modalidade);

      expect(
        modalidadeNormalizada,
        "modalidade de aplicação disponível",
      ).to.not.equal("");
      cy.reload();
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
      const codigoModalidade =
        nomeModalidade.match(/^[\d.]+/)?.[0] || removerCodigo(nomeModalidade);

      cy.wrap($campo)
        .find(".options input:visible")
        .then(($input) => {
          if ($input.length) {
            return pesquisarAutocomplete($campo, codigoModalidade);
          }

          return undefined;
        })
        .then(() => obterOpcoesCarregadas($campo))
        .then(($opcoes) => {
          const opcao = obterOpcaoCorrespondente($opcoes, nomeModalidade);

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
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((modalidadeRetornada) => {
      expect(
        valoresDoFiltroCorrespondem(nomeModalidade, modalidadeRetornada),
        `modalidade retornada "${modalidadeRetornada}" compatível com "${nomeModalidade}"`,
      ).to.equal(true);
    });
}

function obterNumeroDaNaturezaDoEmpenho() {
  abrirPrimeiroEmpenho();

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Natureza(?: da Despesa)?$/i)
    .parent()
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((natureza) => {
      const numeroNatureza = normalizarTexto(natureza).replace(/\D/g, "");

      expect(numeroNatureza, "número da natureza disponível").to.not.equal("");
      cy.reload();
      aguardarListagem();

      return cy.wrap(numeroNatureza, { log: false });
    });
}

function preencherElementoDaDespesa(numeroNatureza) {
  cy.get("#rubricaDaDespesa")
    .clear({ force: true })
    .type(numeroNatureza, { force: true })
    .should("have.value", numeroNatureza);
}

function validarNaturezaNoDetalhe(numeroNatureza) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Natureza(?: da Despesa)?$/i)
    .parent()
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((naturezaRetornada) => {
      expect(normalizarTexto(naturezaRetornada).replace(/\D/g, "")).to.equal(
        numeroNatureza,
      );
    });
}

function obterProgramaDoEmpenho(indice = 0) {
  return obterLinhasValidas().then((linhas) => {
    expect(
      indice,
      "registro com Programa disponível na listagem",
    ).to.be.lessThan(linhas.length);

    cy.wrap(linhas[indice]).find(".colNumero").click({ force: true });
    fecharTermosDeUsoSeExibido();

    return cy
      .contains(".campo label", /^Programa$/)
      .parent()
      .find("#programa", { timeout: 30000 })
      .scrollIntoView({ duration: 0 })
      .should("be.visible")
      .invoke("val")
      .then((programa) => {
        const programaNormalizado = normalizarTexto(programa);
        const programaValido =
          programaNormalizado && !/^[-–—]+$/.test(programaNormalizado);

        cy.reload();
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
    .filter(":visible")
    .should("have.length.at.least", 1)
    .should(($opcoes) => {
      const opcoes = Array.from($opcoes).filter(
        (opcao) =>
          Cypress.$(opcao).is(":visible") &&
          valoresDoFiltroCorrespondem(nomePrograma, opcao.textContent),
      );

      expect(
        opcoes.length,
        `opções filtradas para o programa ${nomePrograma}`,
      ).to.be.greaterThan(0);
    })
    .then(($opcoes) => {
      const opcoesFiltradas = Array.from($opcoes).filter(
        (opcao) =>
          Cypress.$(opcao).is(":visible") &&
          valoresDoFiltroCorrespondem(nomePrograma, opcao.textContent),
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
  // A validação final acontece no detalhe do primeiro resultado efetivamente
  // retornado, garantindo que a opção selecionada não foi apenas visualmente
  // escolhida no autocomplete.
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
    .invoke("val")
    .then((programaRetornado) => {
      expect(
        normalizarTexto(programaRetornado),
        "programa retornado",
      ).to.not.equal("");
      expect(
        valoresDoFiltroCorrespondem(nomePrograma, programaRetornado),
      ).to.equal(true);
    });
}

function obterFonteDoEmpenho(indice = 0) {
  return obterLinhasValidas().then((linhas) => {
    expect(indice, "registro com Fonte disponível na listagem").to.be.lessThan(
      linhas.length,
    );

    cy.wrap(linhas[indice]).find(".colNumero").click({ force: true });
    fecharTermosDeUsoSeExibido();

    return cy
      .contains(".campo label", /^Fonte$/)
      .parent()
      .scrollIntoView({ duration: 0 })
      .find("#fonte", { timeout: 30000 })
      .scrollIntoView({ duration: 0 })
      .should("exist")
      .invoke("val")
      .then((fonte) => {
        const fonteNormalizada = normalizarTexto(fonte);

        cy.visitPortal(DESPESAS_PATH);
        aguardarListagem();

        if (fonteNormalizada) {
          return cy.wrap(fonteNormalizada, { log: false });
        }

        return obterFonteDoEmpenho(indice + 1);
      });
  });
}

function selecionarFonte(nomeFonte) {
  const codigoFonte = nomeFonte.match(/^[\d.]+/)?.[0] || nomeFonte;

  return cy
    .contains(".campo label", /^Fonte$/i)
    .parent()
    .then(($campo) => {
      cy.wrap($campo).find(".selected").click({ force: true });
      pesquisarAutocomplete($campo, codigoFonte)
        .then(() => obterOpcoesCarregadas($campo))
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

          return obterOpcoesCarregadas($campo)
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
    .invoke("val")
    .then((fonteRetornada) => {
      const normalizarFonte = (fonte) =>
        normalizarParaComparacao(fonte)
          .replace(/[^a-z0-9]+/g, " ")
          .trim();

      expect(normalizarFonte(fonteRetornada)).to.equal(
        normalizarFonte(nomeFonte),
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

function obterCategoriaEconomicaDoEmpenho() {
  abrirPrimeiroEmpenho();

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Categoria Econômica$/)
    .parent()
    .scrollIntoView({ duration: 0 })
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((categoria) => {
      const categoriaNormalizada = normalizarTexto(categoria);

      expect(
        categoriaNormalizada,
        "categoria econômica disponível",
      ).to.not.equal("");
      cy.reload();
      aguardarListagem();

      return cy.wrap(categoriaNormalizada, { log: false });
    });
}

function selecionarCategoriaEconomica(nomeCategoria) {
  const nomeCategoriaParaPesquisa = nomeCategoria
    .replace(/^[\d.]+\s*[-.)]\s*/, "")
    .trim();
  const termoParaPesquisa = obterTermosSignificativos(nomeCategoriaParaPesquisa)
    .map(normalizarTermoParaSemelhanca)
    .sort((termoA, termoB) => termoB.length - termoA.length)[0];

  return cy
    .contains(".campo label", /^Categoria Econômica$/i)
    .parent()
    .then(($campo) => {
      cy.wrap($campo).find(".selected").click({ force: true });
      pesquisarAutocomplete(
        $campo,
        termoParaPesquisa || nomeCategoriaParaPesquisa,
      )
        .then(() => obterOpcoesCarregadas($campo))
        .should(($opcoes) => {
          expect(
            obterOpcaoMaisParecida($opcoes, nomeCategoriaParaPesquisa),
            `categoria econômica ${nomeCategoria} disponível no filtro`,
          ).to.exist;
        })
        .then(($opcoes) => {
          const opcao = obterOpcaoMaisParecida(
            $opcoes,
            nomeCategoriaParaPesquisa,
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
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((categoriaRetornada) => {
      expect(
        pontuarSemelhanca(nomeCategoria, categoriaRetornada),
        `categoria retornada "${categoriaRetornada}" compatível com "${nomeCategoria}"`,
      ).to.be.at.least(0.75);
    });
}

describe(`Portal: ${DESPESAS_NOME} - filtro avançado`, () => {
  // Cada teste começa com uma listagem limpa e com favorecido disponível para
  // que a origem dos dados seja determinística dentro do ambiente público.
  beforeEach(() => {
    cy.visitPortal(DESPESAS_PATH);
    aguardarListagem();
    limparFiltrosAntesDoTeste();
    prepararListagemComFavorecido();
  });

  it("acessa o filtro avançado, pesquisa favorecido e valida a listagem filtrada", () => {
    abrirFiltroAvancado();

    selecionarFavorecidoDaListagem().then((favorecido) => {
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

  it("acessa o filtro avançado, pesquisa descrição do empenho e valida o retorno", () => {
    obterDescricaoDoEmpenho().then((descricao) => {
      abrirFiltroAvancado("#descricao");

      cy.get("#descricao")
        .clear({ force: true })
        .type(descricao, { force: true });
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Descrição do Empenho", () =>
        validarDescricaoNoDetalhe(descricao),
      );
    });
  });

  it("acessa o filtro avançado, pesquisa CPF/CNPJ e valida o retorno", () => {
    obterCpfCnpjDoEmpenho().then((cpfCnpj) => {
      abrirFiltroAvancado("#cpfCnpj");

      cy.get("#cpfCnpj").clear({ force: true }).type(cpfCnpj, { force: true });
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("CPF/CNPJ", () =>
        validarCpfCnpjNoDetalhe(cpfCnpj),
      );
    });
  });

  it("acessa o filtro avançado, pesquisa Nº Empenho e valida o retorno", () => {
    obterNumeroDaListagem().then((numeroEmpenho) => {
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

  it("acessa o filtro avançado, pesquisa por período e valida as datas retornadas", () => {
    obterPeriodoDaListagem().then(({ dataInicial, dataFinal }) => {
      abrirFiltroAvancado("#data_i");

      cy.get("#data_i").type(dataInicial, { force: true });
      cy.get("#data_f").type(dataFinal, { force: true });
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Período", () =>
        validarDatasNoPeriodo(dataInicial, dataFinal),
      );
    });
  });

  it("acessa o filtro avançado, pesquisa órgão e valida o retorno", () => {
    obterOrgaoDoEmpenho().then((nomeOrgao) => {
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
    obterUnidadeDoEmpenho().then((nomeUnidade) => {
      abrirFiltroAvancado("#select_unidade");
      selecionarUnidade(nomeUnidade);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Unidade", () =>
        validarUnidadeNoDetalhe(nomeUnidade),
      );
    });
  });

  it("acessa o filtro avançado, pesquisa função e valida o retorno", () => {
    obterFuncaoDoEmpenho().then((nomeFuncao) => {
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
    obterSubfuncaoDoEmpenho().then((nomeSubfuncao) => {
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
    obterGrupoDoEmpenho().then((nomeGrupo) => {
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
    obterModalidadeAplicacaoDoEmpenho().then((nomeModalidade) => {
      abrirFiltroAvancado(".campo label");
      selecionarModalidadeAplicacao(nomeModalidade);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Modalidade de Aplicação", () =>
        validarModalidadeAplicacaoNoDetalhe(nomeModalidade),
      );
    });
  });

  it("acessa o filtro avançado, pesquisa Elemento da Despesa pelo número da Natureza e valida o retorno", () => {
    obterNumeroDaNaturezaDoEmpenho().then((numeroNatureza) => {
      abrirFiltroAvancado("#rubricaDaDespesa");
      preencherElementoDaDespesa(numeroNatureza);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Elemento da Despesa", () =>
        validarNaturezaNoDetalhe(numeroNatureza),
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
    obterCategoriaEconomicaDoEmpenho().then((nomeCategoria) => {
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
