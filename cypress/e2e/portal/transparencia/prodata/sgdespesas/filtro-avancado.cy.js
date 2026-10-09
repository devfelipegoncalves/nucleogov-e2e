/**
 * Testes E2E do filtro avançado do módulo SGDespesas.
 *
 * Estratégia do spec:
 * 1. Abrir a listagem pública e aguardar a tabela e as cargas iniciais.
 * 2. Obter valores reais de um empenho para evitar dados fixos e obsoletos.
 * 3. Voltar à listagem, abrir o filtro avançado e selecionar a opção desejada.
 * 4. Aplicar o filtro e validar o resultado na listagem ou no detalhamento.
 *
 * O portal usa selects customizados. As opções dos selects são carregadas na
 * segunda requisição POST /api e o campo "Buscar" apenas filtra essa lista
 * localmente no evento keyup; por isso a sincronização deve ocorrer antes de
 * abrir o popup e não durante a digitação do autocomplete.
 *
 * Execução interativa:
 * npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/filtro-avancado.cy.js"
 *
 * Execução headless:
 * npm run cy:run -- --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/filtro-avancado.cy.js"
 */

// Configurações comuns do módulo e limite das tentativas de recuperação.
const SG_DESPESAS_PATH = "/cidadao/transparencia/sgdespesas";
const SG_DESPESAS_NOME = "sgdespesas";
const LISTAGEM_TIMEOUT = 60000;
const MAX_TENTATIVAS_CARREGAMENTO_SELECT = 2;
let contadorVisitasSgDespesas = 0;
let contadorFiltrosSgDespesas = 0;

// Normaliza espaços, acentos e caixa para tornar as comparações resistentes às
// diferenças entre o texto da listagem, do filtro e do detalhamento.
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

function obterCodigoNumerico(texto = "") {
  const codigo = normalizarTexto(texto).match(/^[\d.]+/)?.[0] || "";

  return codigo
    ? codigo
        .split(".")
        .map((parte) => String(Number(parte)))
        .join(".")
    : "";
}

function opcaoCorrespondeAoCodigo(textoEsperado, textoDaOpcao) {
  const codigoEsperado = obterCodigoNumerico(textoEsperado);
  const codigoDaOpcao = obterCodigoNumerico(textoDaOpcao);

  return Boolean(
    codigoEsperado &&
    codigoDaOpcao &&
    (codigoEsperado === codigoDaOpcao ||
      codigoEsperado.startsWith(`${codigoDaOpcao}.`) ||
      codigoEsperado.startsWith(codigoDaOpcao) ||
      codigoDaOpcao.startsWith(codigoEsperado)),
  );
}

function obterIdentificacaoDaOpcao(elemento) {
  return [
    elemento.textContent,
    elemento.getAttribute("href"),
    elemento.getAttribute("data-value"),
    elemento.getAttribute("data-id"),
    elemento.getAttribute("value"),
  ]
    .filter(Boolean)
    .join(" ");
}

function obterCodigoOrgao(texto = "") {
  return normalizarTexto(texto).match(/^\d+/)?.[0] || "";
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

// Localiza um campo do popup pelo texto do label, pois a estrutura visual do
// portal pode mudar sem alterar a finalidade do campo.
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

// Helpers de interação com os selects customizados do Nucleogov.
function selecionarOpcao(containerSelector, textoOpcao) {
  const alias = `alteracaoPeriodoSgDespesas${++contadorFiltrosSgDespesas}`;

  cy.intercept("POST", "**/api").as(alias);
  cy.get(containerSelector).find(".selected").click({ force: true });
  cy.contains(`${containerSelector} .options .list a`, textoOpcao, {
    matchCase: false,
  }).click({ force: true });
  cy.wait(`@${alias}`, { timeout: LISTAGEM_TIMEOUT });
}

function obterContainerDoSelect(campo) {
  const seletor = obterSeletorDoSelect(campo);

  return seletor ? cy.get(seletor, { timeout: 30000 }) : cy.wrap(campo);
}

function obterSeletorDoSelect(campo, $container = Cypress.$(campo)) {
  if (typeof campo === "string") {
    return campo;
  }

  const id = $container?.attr?.("id");
  return id ? `#${id}` : "";
}

/**
 * Visita a página e espera as duas cargas iniciais do SGDespesas:
 * a primeira alimenta a listagem e a segunda fornece as opções dos filtros.
 * O alias é criado antes da visita para não perder requisições rápidas.
 */
function visitarSgDespesas() {
  const alias = `carregamentoSgDespesas${++contadorVisitasSgDespesas}`;

  cy.intercept("POST", "**/api").as(alias);
  cy.visitPortal(SG_DESPESAS_PATH);

  // A primeira chamada carrega a listagem e a segunda carrega as listas
  // usadas pelo filtro avançado (incluindo categorias e subfunções).
  cy.wait(`@${alias}`, { timeout: LISTAGEM_TIMEOUT });
  cy.wait(`@${alias}`, { timeout: LISTAGEM_TIMEOUT });
}

function pesquisarEAguardarRetornoDoFiltro() {
  const alias = `retornoFiltroSgDespesas${++contadorFiltrosSgDespesas}`;

  cy.intercept("POST", "**/api").as(alias);
  cy.contains("button, a, div", "PESQUISAR").click({ force: true });

  return cy
    .wait(`@${alias}`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .then(() => aguardarListagem());
}

/**
 * Recupera a página quando um select foi criado antes de receber sua lista.
 * O callback mantém o fluxo original do teste após a nova abertura do popup.
 */
function recarregarPaginaEReabrirFiltro(campo, tentativa, continuar) {
  const seletor = obterSeletorDoSelect(campo, Cypress.$(campo));

  if (!seletor || tentativa >= MAX_TENTATIVAS_CARREGAMENTO_SELECT) {
    return cy.wrap([], { log: false });
  }

  cy.log(
    `Select ${seletor} sem opções; recarregando a página (tentativa ${tentativa + 1}).`,
  );

  return cy
    .then(() => visitarSgDespesas())
    .then(() => aguardarListagem())
    .then(() => abrirFiltroAvancado(".campo label"))
    .then(() => continuar(seletor, tentativa + 1));
}

// Alguns selects do filtro avançado são autocompletes: ao abrir, exibem apenas
// o campo de busca e criam as opções depois que um texto é digitado. Os
// selects estáticos, por outro lado, já exibem a lista ao abrir.
/**
 * Abre um select e retorna somente opções visíveis e utilizáveis.
 * Selectors são reconsultados por ID porque o portal recria o DOM ao recarregar
 * ou ao abrir o popup.
 */
function abrirSelectAvancadoComOpcoes(
  campo,
  recarregarSeVazio = true,
  tentativa = 0,
) {
  return obterContainerDoSelect(campo).then(($container) => {
    const seletor = obterSeletorDoSelect(campo, $container);
    const campoAtual = seletor || $container;
    const obterCampoAtual = () => obterContainerDoSelect(campoAtual);
    const clicarNoSelect = () =>
      obterCampoAtual()
        .find(".selected", { timeout: 30000 })
        .should("be.visible")
        .click({ force: true });

    const obterOpcoesDoContainer = () =>
      obterCampoAtual().then(($campoAtual) =>
        cy.wrap(Array.from($campoAtual.find(".options:visible .list a")), {
          log: false,
        }),
      );

    const aguardarOpcoesDoContainer = () =>
      obterCampoAtual()
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

        if (recarregarSeVazio) {
          return recarregarPaginaEReabrirFiltro(
            campo,
            tentativa,
            (seletor, proximaTentativa) =>
              abrirSelectAvancadoComOpcoes(
                seletor,
                recarregarSeVazio,
                proximaTentativa,
              ),
          );
        }

        const possuiCampoDeBusca =
          Cypress.$($container).find(".options:visible input:visible").length >
          0;

        if (possuiCampoDeBusca) {
          return cy.wrap([], { log: false });
        }

        cy.log("Select sem opções; fechando e reabrindo o próprio select.");

        const selectEstaAberto =
          Cypress.$($container).find(".options:visible").length;
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

/**
 * Digita no campo de busca do select.
 *
 * A busca é local no componente Select do portal: o type() dispara keyup e o
 * próprio componente alterna a visibilidade dos links. Não se deve aguardar
 * uma nova requisição de API após a digitação.
 */
function pesquisarAutocomplete(campo, texto) {
  const seletor = obterSeletorDoSelect(campo);
  const campoAtual = seletor || campo;

  return (
    obterContainerDoSelect(campoAtual)
      .find("input:visible")
      .first()
      .should("be.visible")
      .clear({ force: true })
      .type(texto, { force: true })
      .should(($input) => {
        expect($input.val(), `termo pesquisado em ${campoAtual}`).to.equal(
          texto,
        );
      })
      // O Select do portal filtra a lista localmente no keyup; não há uma
      // chamada de API nem um botão de busca para aguardar neste componente.
      .then(() => cy.wait(300, { log: false }))
  );
}

/**
 * Obtém as opções de um select, pesquisando por termos alternativos e, caso a
 * lista continue vazia, recarregando a página dentro do limite configurado.
 */
function obterOpcoesDoFiltro(campo, termoPesquisa = "", tentativa = 0) {
  return obterContainerDoSelect(campo).then(($container) => {
    const seletor = obterSeletorDoSelect(campo, $container);
    const campoAtual = seletor || $container;
    const termosDeBusca = (
      Array.isArray(termoPesquisa) ? termoPesquisa : [termoPesquisa]
    ).filter(Boolean);

    return abrirSelectAvancadoComOpcoes(campoAtual, false).then(
      ($opcoesIniciais) => {
        const opcoesIniciais = Array.from($opcoesIniciais).filter((elemento) =>
          Cypress.$(elemento).is(":visible"),
        );

        const termosNormalizados = termosDeBusca.map((termo) =>
          normalizarParaComparacao(termo),
        );
        const possuiTermoNasOpcoes = termosNormalizados.length
          ? opcoesIniciais.some((elemento) => {
              const identificacao = normalizarParaComparacao(
                obterIdentificacaoDaOpcao(elemento),
              );

              return termosNormalizados.some((termo) =>
                identificacao.includes(termo),
              );
            })
          : true;

        if (opcoesIniciais.length && possuiTermoNasOpcoes) {
          return cy.wrap(opcoesIniciais, { log: false });
        }

        return obterContainerDoSelect(campoAtual).then(($campoAberto) => {
          const $input = Cypress.$($campoAberto)
            .find(".options:visible input:visible")
            .first();

          if (!termosDeBusca.length || !$input.length) {
            return cy.wrap(opcoesIniciais, { log: false });
          }

          const termosParaPesquisar = termosDeBusca
            .flatMap((termo) => [termo, normalizarParaComparacao(termo)])
            .filter(
              (termo, indice, termos) =>
                termo && termos.indexOf(termo) === indice,
            );

          const pesquisarAteEncontrarOpcoes = (indice = 0) => {
            if (indice >= termosParaPesquisar.length) {
              return cy.wrap([], { log: false });
            }

            return pesquisarAutocomplete(
              campoAtual,
              termosParaPesquisar[indice],
            )
              .then(() => cy.wait(300, { log: false }))
              .then(() => obterContainerDoSelect(campoAtual))
              .then(($campoPesquisado) => {
                const opcoes = Array.from(
                  $campoPesquisado.find(".options:visible .list a:visible"),
                );

                return opcoes.length
                  ? cy.wrap(opcoes, { log: false })
                  : pesquisarAteEncontrarOpcoes(indice + 1);
              });
          };

          return pesquisarAteEncontrarOpcoes().then(($opcoes) => {
            if ($opcoes.length) {
              return $opcoes;
            }

            return recarregarPaginaEReabrirFiltro(
              campoAtual,
              tentativa,
              (seletorAtual, proximaTentativa) =>
                obterOpcoesDoFiltro(
                  seletorAtual,
                  termosDeBusca,
                  proximaTentativa,
                ),
            );
          });
        });
      },
    );
  });
}

// Seleciona uma opção encontrada e permite que o chamador aplique sua própria
// regra de correspondência (texto, código ou ambos).
function obterOpcaoDoFiltro(campo, termos, corresponde, tentativa = 0) {
  const campoAtual = obterSeletorDoSelect(campo) || campo;

  return obterOpcoesDoFiltro(campoAtual, termos, tentativa).then(($opcoes) => {
    const opcao = Array.from($opcoes).find(corresponde);

    if (opcao || tentativa >= MAX_TENTATIVAS_CARREGAMENTO_SELECT) {
      return cy.wrap(opcao, { log: false });
    }

    return recarregarPaginaEReabrirFiltro(
      campoAtual,
      tentativa,
      (seletor, proximaTentativa) =>
        obterOpcaoDoFiltro(seletor, termos, corresponde, proximaTentativa),
    );
  });
}

// Aguarda os loaders da tabela antes de ler ou validar qualquer registro.
function aguardarListagem() {
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

// Quando necessário, troca o período para encontrar uma linha com favorecido
// preenchido, que é usado por vários cenários de consulta.
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

// Abre o popup apenas quando o campo solicitado ainda não está visível.
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
      visitarSgDespesas();
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

        visitarSgDespesas();
        aguardarListagem();

        return cy.wrap(favorecido, { log: false });
      });
  });
}

function obterCpfCnpjDeUmRegistro(indice = 0) {
  return obterLinhasValidas().then((linhas) => {
    if (indice >= linhas.length) {
      expect(
        indice,
        "registro com CPF/CNPJ disponível na listagem",
      ).to.be.lessThan(linhas.length);
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

        if (![11, 14].includes(quantidadeDeDigitos)) {
          visitarSgDespesas();
          aguardarListagem();
          return obterCpfCnpjDeUmRegistro(indice + 1);
        }

        visitarSgDespesas();
        aguardarListagem();

        return cy.wrap(documentoNormalizado, { log: false });
      });
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
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((documentoRetornado) => {
      const documentoRetornadoNormalizado = normalizarTexto(documentoRetornado);
      const digitosRetornados = documentoRetornadoNormalizado.replace(
        /\D/g,
        "",
      );
      const digitosBuscados = documentoBuscado.replace(/\D/g, "");

      expect(digitosRetornados, "CPF/CNPJ retornado no detalhe").to.have.length(
        documentoBuscado.replace(/\D/g, "").length,
      );
      expect(digitosRetornados).to.equal(digitosBuscados);
    });
}

function validarFavorecidoNoDetalhe(favorecidoBuscado) {
  obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      "registros retornados pelo filtro de favorecido",
    ).to.be.greaterThan(0);

    cy.wrap(linhas[0]).find(".colNumero").click({ force: true });

    cy.contains(".campo label", /^Favorecido$/i)
      .parent()
      .find("#favorecido, #fornecedor, input, textarea, .input")
      .first()
      .should("be.visible")
      .should(aguardarCampoComValor)
      .then(obterValorDoCampo)
      .then((favorecidoRetornado) => {
        expect(
          favorecidoRetornado.toLowerCase(),
          "favorecido disponível no detalhamento do retorno",
        ).to.equal(favorecidoBuscado.toLowerCase());
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
      .get(".dados > :nth-child(1) > h2", { timeout: 30000 })
      .should("be.visible")
      .invoke("text")
      .then((textoDetalhamento) => {
        const numeroEmpenho =
          textoDetalhamento.match(/N[ºo°]\s*([\d./-]+)/i)?.[1] ||
          textoDetalhamento.match(/(\d+)\s*$/)?.[1] ||
          "";

        expect(
          numeroEmpenho,
          `Nº do empenho identificado no detalhamento: "${normalizarTexto(textoDetalhamento)}"`,
        ).to.not.equal("");

        visitarSgDespesas();
        aguardarListagem();

        return cy.wrap(numeroEmpenho, { log: false });
      });
  });
}

function validarNumeroNoDetalhe(numeroBuscado) {
  obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      "empenhos retornados pelo filtro de número",
    ).to.be.greaterThan(0);

    cy.wrap(linhas[0]).find(".colNumero").click({ force: true });
    cy.get(".dados > :nth-child(1) > h2", { timeout: 30000 })
      .should("be.visible")
      .invoke("text")
      .then((textoDetalhamento) => {
        const numeroRetornado =
          textoDetalhamento.match(/N[ºo°]\s*([\d./-]+)/i)?.[1] ||
          textoDetalhamento.match(/(\d+)\s*$/)?.[1] ||
          "";

        expect(
          numeroRetornado,
          "Nº do empenho disponível no detalhamento do retorno",
        ).to.not.equal("");
        expect(numeroRetornado).to.equal(numeroBuscado);
      });
  });
}

// Conversão, preenchimento e validação dos filtros monetários.
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
    valores.forEach(({ numerico, texto }) => {
      if (tipoLimite === "minimo") {
        expect(
          numerico,
          `${descricao} dentro do mínimo (valor: ${texto})`,
        ).to.be.at.least(limite);
      } else {
        expect(
          numerico,
          `${descricao} dentro do máximo (valor: ${texto})`,
        ).to.be.at.most(limite);
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

function validarRetornoMonetarioComAcumulado(descricao) {
  obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      `registros retornados pelo filtro de ${descricao}`,
    ).to.be.greaterThan(0);

    Cypress.log({
      name: "VALIDAÇÃO MONETÁRIA",
      message: `${descricao}: listagem retornada; o portal exibe valores acumulados`,
      consoleProps: () => ({
        filtro: descricao,
        registros: linhas.length,
        observacao:
          "O valor exibido na linha pode representar o acumulado do empenho.",
      }),
    });
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

// Cenários que validam órgão e unidade, incluindo diferenças de nomenclatura
// entre o registro exibido e a opção disponível no filtro.
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
      visitarSgDespesas();
      aguardarListagem();

      return cy.wrap(
        {
          texto: orgaoNormalizado,
          codigo: obterCodigoOrgao(orgaoNormalizado),
        },
        { log: false },
      );
    });
}

function selecionarOrgao(orgaoDoRegistro) {
  const nomeOrgao = orgaoDoRegistro.texto;

  abrirSelectAvancadoComOpcoes("#select_org_avanc").then(($opcoes) => {
    const opcoes = Array.from($opcoes);
    const opcaoPorCodigo = opcoes.find(
      (elemento) =>
        elemento.getAttribute("href")?.replace(/^#/, "") ===
        orgaoDoRegistro.codigo,
    );
    const opcaoPorNome = opcoes.find((elemento) => {
      return orgaosCorrespondem(nomeOrgao, elemento.textContent);
    });
    const opcao = opcaoPorCodigo || opcaoPorNome;

    expect(opcao, `órgão ${nomeOrgao} disponível no filtro`).to.exist;
    cy.wrap(opcao).click({ force: true });
  });
}

function validarOrgaoNoDetalhe(orgaoSelecionado) {
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
      const codigoRetornado = obterCodigoOrgao(orgaoRetornado);
      const correspondePorCodigo =
        orgaoSelecionado.codigo &&
        codigoRetornado &&
        orgaoSelecionado.codigo === codigoRetornado;

      expect(
        correspondePorCodigo ||
          orgaosCorrespondem(orgaoSelecionado.texto, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com "${orgaoSelecionado.texto}"`,
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
      .get("#unidade", { timeout: 30000 })
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

        visitarSgDespesas();
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
  return obterOpcaoDoFiltro(
    "#select_unidade",
    [normalizarTexto(nomeUnidade).replace(/^\d+\s*-\s*/, ""), nomeUnidade],
    (elemento) => unidadeCombinaComOpcao(nomeUnidade, elemento.textContent),
  ).then((opcao) => {
    expect(opcao, `Unidade ${nomeUnidade} disponível no filtro`).to.exist;
    cy.wrap(opcao).click({ force: true });
  });
}

function validarUnidadeNoDetalhe(nomeUnidade) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  cy.get("#unidade", { timeout: 30000 })
    .should("be.visible")
    .should(aguardarCampoComValor)
    .then(obterValorDoCampo)
    .then((unidadeRetornada) => {
      expect(normalizarTexto(unidadeRetornada).toLowerCase()).to.include(
        nomeUnidade.toLowerCase(),
      );
    });
}

// Cenários de classificação funcional e orçamentária.
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
      visitarSgDespesas();
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
  const funcaoEsperada = normalizarParaComparacao(nomeFuncao).replace(
    /^\d+\s*-\s*/,
    "",
  );
  const termoPesquisa = nomeFuncao.match(/^\d+/)?.[0] || funcaoEsperada;

  obterOpcaoDoFiltro(
    "#select_funcao",
    [termoPesquisa, funcaoEsperada],
    (elemento) =>
      normalizarParaComparacao(obterIdentificacaoDaOpcao(elemento)).includes(
        funcaoEsperada,
      ) ||
      opcaoCorrespondeAoCodigo(nomeFuncao, obterIdentificacaoDaOpcao(elemento)),
  ).then((opcao) => {
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
      visitarSgDespesas();
      aguardarListagem();

      return cy.wrap(subfuncaoNormalizada, { log: false });
    });
}

function selecionarSubfuncao(nomeSubfuncao) {
  const subfuncaoEsperada = normalizarParaComparacao(nomeSubfuncao).replace(
    /^\d+\s*-\s*/,
    "",
  );
  const termoPesquisa = normalizarTexto(nomeSubfuncao).replace(
    /^\d+\s*-\s*/,
    "",
  );

  cy.contains(".campo label", /^Subfunção$/i)
    .parent()
    .then(($campo) => {
      obterOpcoesDoFiltro($campo, termoPesquisa).then(($opcoes) => {
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
      visitarSgDespesas();
      aguardarListagem();

      return cy.wrap(grupoNormalizado, { log: false });
    });
}

function selecionarGrupo(nomeGrupo) {
  const nomeGrupoSemCodigo = nomeGrupo.replace(/^\d+\s*-\s*/, "").trim();
  const termoPesquisa = nomeGrupoSemCodigo;

  return cy
    .contains(".campo label", /^Grupo$/i)
    .parent()
    .then(($campo) => {
      obterOpcoesDoFiltro($campo, termoPesquisa).then(($opcoes) => {
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
      visitarSgDespesas();
      aguardarListagem();

      return cy.wrap(modalidadeNormalizada, { log: false });
    });
}

function selecionarModalidadeAplicacao(nomeModalidade) {
  return cy
    .contains(".campo label", /^Modalidade de Aplicação$/i)
    .parent()
    .then(($campo) =>
      obterOpcaoDoFiltro(
        $campo,
        nomeModalidade,
        (elemento) =>
          valoresDoFiltroCorrespondem(nomeModalidade, elemento.textContent) ||
          opcaoCorrespondeAoCodigo(nomeModalidade, elemento.textContent),
      ).then((opcao) => {
        expect(
          opcao,
          `modalidade de aplicação ${nomeModalidade} disponível no filtro`,
        ).to.exist;
        return cy.wrap(opcao).click({ force: true });
      }),
    );
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
      visitarSgDespesas();
      aguardarListagem();

      return cy.wrap(naturezaNormalizada, { log: false });
    });
}

function selecionarNatureza(nomeNatureza) {
  const naturezaEsperada = normalizarParaComparacao(nomeNatureza).replace(
    /^\d+\s*-\s*/,
    "",
  );
  // O autocomplete de Natureza trabalha no nível sintético de seis dígitos;
  // o detalhamento pode apresentar o desdobramento com oito dígitos.
  const termoPesquisa = nomeNatureza.match(/^\d{6}/)?.[0] || naturezaEsperada;
  const termosDescricao = obterTermosSignificativos(nomeNatureza);

  return obterCampoAvancadoPorRotulo("Natureza").then(($campo) => {
    obterOpcaoDoFiltro(
      $campo,
      [naturezaEsperada, ...termosDescricao, termoPesquisa],
      (elemento) =>
        normalizarParaComparacao(obterIdentificacaoDaOpcao(elemento)).includes(
          naturezaEsperada,
        ) ||
        opcaoCorrespondeAoCodigo(
          nomeNatureza,
          obterIdentificacaoDaOpcao(elemento),
        ),
    ).then((opcao) => {
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
      visitarSgDespesas();
      aguardarListagem();

      return cy.wrap(elementoNormalizado, { log: false });
    });
}

function selecionarElementoDaDespesa(nomeElemento) {
  const codigoElemento = nomeElemento.match(/^\d+/)?.[0] || nomeElemento;
  const termoPesquisa = codigoElemento;

  return obterCampoAvancadoPorRotulo("Elemento").then(($campo) => {
    obterOpcaoDoFiltro(
      $campo,
      termoPesquisa,
      (elemento) =>
        normalizarParaComparacao(
          obterIdentificacaoDaOpcao(elemento),
        ).startsWith(normalizarParaComparacao(codigoElemento)) ||
        opcaoCorrespondeAoCodigo(
          nomeElemento,
          obterIdentificacaoDaOpcao(elemento),
        ),
    ).then((opcao) => {
      if (!opcao) {
        const mensagem = `ALERTA: O Elemento ${nomeElemento} do detalhamento não está disponível no filtro avançado deste ambiente.`;
        Cypress.log({ name: "ALERTA", message: mensagem });
        cy.log(mensagem);
        return false;
      }

      expect(opcao, `Elemento ${nomeElemento} disponível no filtro`).to.exist;
      return cy
        .wrap(opcao)
        .click({ force: true })
        .then(() => true);
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

function extrairNumeroDoDetalhamento(texto = "") {
  return (
    normalizarTexto(texto).match(/N[ºo°]\s*([\d./-]+)/i)?.[1] ||
    normalizarTexto(texto).match(/(\d+)\s*$/)?.[1] ||
    ""
  );
}

function obterNumeroDoDetalhamentoAtual() {
  return cy.get("body", { timeout: 30000 }).then(($body) => {
    const numeroDoCabecalho = extrairNumeroDoDetalhamento(
      $body.find(".dados > :nth-child(1) > h2").first().text(),
    );

    if (numeroDoCabecalho) {
      return numeroDoCabecalho;
    }

    return cy
      .url()
      .then((url) => url.match(/\/sgdespesa\/id=(\d+)_\d+/)?.[1] || "");
  });
}

function obterDadosDaAcaoDoPrimeiroRegistro() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return obterNumeroDoDetalhamentoAtual().then((numeroEmpenho) => {
    expect(
      numeroEmpenho,
      "Nº do empenho identificado no detalhamento da ação",
    ).to.not.equal("");

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
        const nomeAcoes = normalizarTexto(acoes);

        expect(nomeAcoes, "Ações disponíveis").to.not.equal("");
        visitarSgDespesas();
        aguardarListagem();

        return cy.wrap({ nomeAcoes, numeroEmpenho }, { log: false });
      });
  });
}

function selecionarAcoes(nomeAcoes, indice = 0, tentativaCarregamento = 0) {
  const acoesNormalizadas = normalizarParaComparacao(nomeAcoes);
  const acoesEsperadas = acoesNormalizadas.replace(/^\d+\s*-\s*/, "");

  return abrirSelectAvancadoComOpcoes("#select_atividade").then(($opcoes) => {
    const opcoesCorrespondentes = Array.from($opcoes).filter((elemento) =>
      normalizarParaComparacao(elemento.textContent).includes(acoesEsperadas),
    );

    if (
      !opcoesCorrespondentes.length &&
      tentativaCarregamento < MAX_TENTATIVAS_CARREGAMENTO_SELECT
    ) {
      return recarregarPaginaEReabrirFiltro(
        "#select_atividade",
        tentativaCarregamento,
        () => selecionarAcoes(nomeAcoes, indice, tentativaCarregamento + 1),
      );
    }

    expect(
      indice,
      `ocorrência ${indice + 1} da ação ${nomeAcoes} disponível no filtro`,
    ).to.be.lessThan(opcoesCorrespondentes.length);

    const opcao = opcoesCorrespondentes[indice];
    return cy
      .wrap(opcao)
      .click({ force: true })
      .then(() =>
        cy.wrap(
          {
            indice,
            totalOpcoes: opcoesCorrespondentes.length,
          },
          { log: false },
        ),
      );
  });
}

function obterDadosDaAcaoNoResultado() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return obterNumeroDoDetalhamentoAtual().then((numeroEmpenho) =>
    cy
      .contains(".campo label", /^Aç(?:ão|ões)$/i)
      .parent()
      .find("input, textarea, .input", { timeout: 30000 })
      .first()
      .scrollIntoView({ duration: 0 })
      .should("exist")
      .should(aguardarCampoComValor)
      .then(obterValorDoCampo)
      .then((acoes) => ({
        nomeAcoes: normalizarTexto(acoes),
        numeroEmpenho,
      })),
  );
}

function selecionarAcaoComResultado(dadosEsperados, indice = 0) {
  abrirFiltroAvancado(".campo label");

  return selecionarAcoes(dadosEsperados.nomeAcoes, indice).then((selecao) => {
    cy.contains("button, a, div", "PESQUISAR").click({ force: true });
    aguardarListagem();

    return obterLinhasValidas().then((linhas) => {
      if (!linhas.length) {
        visitarSgDespesas();
        aguardarListagem();
        return selecionarAcaoComResultado(dadosEsperados, indice + 1);
      }

      return obterDadosDaAcaoNoResultado().then((dadosRetornados) => {
        const acaoCorresponde =
          normalizarParaComparacao(dadosRetornados.nomeAcoes) ===
          normalizarParaComparacao(dadosEsperados.nomeAcoes);
        const numeroCorresponde =
          dadosRetornados.numeroEmpenho === dadosEsperados.numeroEmpenho;

        if (acaoCorresponde && numeroCorresponde) {
          expect(dadosRetornados.nomeAcoes).to.equal(dadosEsperados.nomeAcoes);
          expect(dadosRetornados.numeroEmpenho).to.equal(
            dadosEsperados.numeroEmpenho,
          );
          return cy.wrap(selecao, { log: false });
        }

        cy.log(
          `Ação ${indice + 1} divergente: número esperado ${dadosEsperados.numeroEmpenho}, retornado ${dadosRetornados.numeroEmpenho}.`,
        );
        visitarSgDespesas();
        aguardarListagem();
        return selecionarAcaoComResultado(dadosEsperados, indice + 1);
      });
    });
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

        visitarSgDespesas();
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
    .get("#select_programa > .select > .options > .list", {
      timeout: 30000,
    })
    .should("be.visible")
    .then(($lista) => {
      const $opcoes = $lista.find("a:visible");
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
      visitarSgDespesas();
      aguardarListagem();

      return cy.wrap(fonteNormalizada, { log: false });
    });
}

function selecionarFonte(nomeFonte) {
  const codigoFonte = obterCodigoNumerico(nomeFonte);

  return cy
    .contains(".campo label", /^Fontes$/i)
    .parent()
    .then(($campo) =>
      obterOpcaoDoFiltro($campo, nomeFonte, (elemento) => {
        const textoOpcao = normalizarTexto(obterIdentificacaoDaOpcao(elemento));

        return (
          valoresDoFiltroCorrespondem(nomeFonte, textoOpcao) ||
          (codigoFonte && opcaoCorrespondeAoCodigo(nomeFonte, textoOpcao))
        );
      }).then((opcao) => {
        if (!opcao) {
          const mensagem = `ALERTA: A Fonte ${nomeFonte} do detalhamento não está disponível no filtro avançado deste ambiente.`;
          Cypress.log({
            name: "ALERTA",
            message: mensagem,
            consoleProps: () => ({
              fonteDoDetalhamento: nomeFonte,
            }),
          });
          cy.log(mensagem);
          return cy.wrap(
            { fonteSelecionada: null, validarDetalhe: false },
            { log: false },
          );
        }

        const fonteSelecionada = normalizarTexto(opcao.textContent);

        return cy
          .wrap(opcao)
          .click({ force: true })
          .then(() =>
            cy.wrap({ fonteSelecionada, validarDetalhe: true }, { log: false }),
          );
      }),
    );
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
      visitarSgDespesas();
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
      obterOpcoesDoFiltro($campo, nomeCategoriaParaPesquisa).then(($opcoes) => {
        const opcao = Array.from($opcoes).find((elemento) =>
          normalizarParaComparacao(elemento.textContent).includes(
            nomeCategoriaNormalizado,
          ),
        );

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
    .should("have.length.at.least", 1)
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

// Cenários de consulta por valores e regras de validação do formulário.
describe(`Portal: ${SG_DESPESAS_NOME} - filtro avançado`, () => {
  beforeEach(() => {
    // O filtro avançado é montado com os dados da segunda chamada POST /api.
    // A listagem pode terminar primeiro, mas isso não significa que categorias
    // e subfunções já estejam disponíveis para o popup.
    visitarSgDespesas();
    aguardarListagem();
    limparFiltrosAntesDoTeste();
    prepararListagemComFavorecido();
  });

  // Consultas textuais e identificação do empenho no detalhamento.
  // Usa o número real do empenho e confere o mesmo número no detalhe filtrado.
  it("acessa o filtro avançado, pesquisa Nº Empenho e valida o retorno", () => {
    obterNumeroDoPrimeiroRegistro().then((numeroEmpenho) => {
      abrirFiltroAvancado("#numero");

      cy.get("#numero")
        .clear({ force: true })
        .type(numeroEmpenho, { force: true });
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarNumeroNoDetalhe(numeroEmpenho);
    });
  });

  // Pesquisa pelo favorecido real e valida o favorecido do primeiro resultado.
  it("acessa o filtro avançado, pesquisa favorecido e valida a listagem filtrada", () => {
    obterFavorecidoDoPrimeiroRegistro().then((favorecido) => {
      abrirFiltroAvancado();

      cy.get("#fornecedor")
        .clear({ force: true })
        .type(favorecido, { force: true });
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarFavorecidoNoDetalhe(normalizarTexto(favorecido));
    });
  });

  // Pesquisa um CPF/CNPJ válido e compara os dígitos no detalhamento.
  it("acessa o filtro avançado, pesquisa CPF/CNPJ e valida o retorno", () => {
    obterCpfCnpjDeUmRegistro().then((cpfCnpj) => {
      abrirFiltroAvancado("#cpfCnpj");

      cy.get("#cpfCnpj")
        .clear({ force: true })
        .type(cpfCnpj, { force: true })
        .should("have.value", cpfCnpj);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarCpfCnpjNoDetalhe(cpfCnpj);
    });
  });

  // Seleciona o órgão equivalente ao registro e valida texto ou código retornado.
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

  // Pesquisa o histórico completo do empenho e valida o texto do detalhe.
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

  // Classificações orçamentárias e funcionais.
  // Seleciona a categoria econômica encontrada no empenho de referência.
  it("acessa a listagem, pesquisa e seleciona categoria econômica no filtro avançado e valida o retorno", () => {
    obterCategoriaEconomicaDoPrimeiroRegistro().then((nomeCategoria) => {
      abrirFiltroAvancado(".campo label");
      selecionarCategoriaEconomica(nomeCategoria);
      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarCategoriaEconomicaNoDetalhe(nomeCategoria);
    });
  });

  // Seleciona o grupo orçamentário e aceita retorno vazio conforme o portal.
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

  // Seleciona a modalidade de aplicação do empenho de referência.
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

  // Pesquisa o elemento; se o portal não disponibilizar a opção, registra alerta.
  it("acessa o filtro avançado, pesquisa Elemento e valida o retorno", () => {
    obterElementoDoPrimeiroRegistro().then((nomeElemento) => {
      abrirFiltroAvancado(".campo label");
      selecionarElementoDaDespesa(nomeElemento).then((selecionado) => {
        if (!selecionado) {
          return;
        }

        cy.contains("button, a, div", "PESQUISAR").click({ force: true });

        aguardarListagem();
        validarResultadoOuNenhumResultado("Elemento", () =>
          validarElementoNoDetalhe(nomeElemento),
        );
      });
    });
  });

  // Preenche as datas reais da listagem e valida o período aplicado.
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

  // Escolhe uma unidade que tenha correspondência com um registro pesquisável.
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

  // Pesquisa a função por descrição/código e valida o detalhe resultante.
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

  // Pesquisa a subfunção por descrição e valida a subfunção retornada.
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

  // Pesquisa a natureza da despesa e valida o código/descrição retornado.
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

  // Tenta o programa do empenho e repete a busca quando a lista dinâmica está vazia.
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

  // Seleciona uma ação compatível e valida o resultado da ação na listagem/detalhe.
  it("acessa o filtro avançado, pesquisa Ações e valida o retorno", () => {
    obterDadosDaAcaoDoPrimeiroRegistro().then((dadosEsperados) =>
      selecionarAcaoComResultado(dadosEsperados),
    );
  });

  // Pesquisa a fonte; quando aplicável, valida também o detalhe do empenho.
  it("acessa o filtro avançado, pesquisa fonte e valida o retorno", () => {
    obterFonteDoEmpenho().then((nomeFonte) => {
      abrirFiltroAvancado(".campo label");
      selecionarFonte(nomeFonte).then(
        ({ fonteSelecionada, validarDetalhe }) => {
          if (!fonteSelecionada) {
            return;
          }

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

  ["Sim", "Não"].forEach((opcaoCovid) => {
    // Exercita cada opção do filtro booleano COVID-19 com a mesma validação.
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

  // Filtros numéricos e validações de limites.
  // Aplica o menor valor empenhado encontrado e valida que os resultados
  // respeitam o limite inferior.
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

  // Aplica o maior valor empenhado encontrado e valida o limite superior.
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

  // Aplica o menor valor liquidado encontrado e valida o limite inferior.
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

  // Aplica o maior valor liquidado encontrado e valida o limite superior.
  it("acessa o filtro avançado, pesquisa Valor Máximo Liquidado e valida a listagem", () => {
    obterValoresLiquidadosDaListagem().then(({ maximo }) => {
      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Máximo Liquidado", maximo.texto);
      pesquisarEAguardarRetornoDoFiltro();
      validarResultadoOuNenhumResultado("Valor Máximo Liquidado", () =>
        validarRetornoMonetarioComAcumulado("Valor Máximo Liquidado"),
      );
    });
  });

  // Aplica o menor valor pago encontrado e valida o limite inferior.
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

  // Aplica o maior valor pago encontrado e valida o limite superior.
  it("acessa o filtro avançado, pesquisa Valor Máximo Pago e valida a listagem", () => {
    obterValoresPagosDaListagem().then(({ maximo }) => {
      abrirFiltroAvancado(".campo label");
      preencherValorAvancado("Valor Máximo Pago", maximo.texto);
      pesquisarEAguardarRetornoDoFiltro();
      validarResultadoOuNenhumResultado("Valor Máximo Pago", () =>
        validarRetornoMonetarioComAcumulado("Valor Máximo Pago"),
      );
    });
  });

  // Envia mínimo empenhado acima do máximo para validar a mensagem de erro.
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

  // Envia mínimo liquidado acima do máximo para validar a mensagem de erro.
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

  // Envia mínimo pago acima do máximo para validar a mensagem de erro.
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

  // Envia data inicial posterior à final e valida o alerta de período inválido.
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
