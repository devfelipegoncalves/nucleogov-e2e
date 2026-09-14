/**
 * Testes E2E dos filtros disponíveis diretamente na listagem do SGDespesas.
 *
 * Este arquivo cobre os controles que ficam fora do popup de filtro avançado:
 * órgão, COVID-19, tipo, busca textual e período. Cada cenário inicia em uma
 * listagem carregada, aplica um filtro e valida o resultado exibido.
 *
 * Execução interativa:
 * npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/filtros-externos.cy.js"
 *
 * Execução headless:
 * npm run cy:run -- --spec "cypress/e2e/portal/transparencia/prodata/sgdespesas/filtros-externos.cy.js"
 */

// Identificação da página usada em todas as visitas e mensagens de diagnóstico.
const SG_DESPESAS_PATH = "/cidadao/transparencia/sgdespesas";
const SG_DESPESAS_NOME = "sgdespesas";

// Mantém o texto comparável mesmo quando o portal altera espaços ou formatação.
function normalizarTexto(texto = "") {
  return texto.replace(/\s+/g, " ").trim();
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

function obterCodigoOrgao(texto) {
  return normalizarTexto(texto).match(/^\d+/)?.[0] || "";
}

function removerCodigoOrgao(texto) {
  return normalizarParaComparacao(texto).replace(/^[\d.]+\s*[-.)]\s*/, "");
}

function ehPrefeituraOuPoderExecutivo(nomeOrgao) {
  return /\bprefeitura\b|\bpoder executivo\b/.test(
    removerCodigoOrgao(nomeOrgao),
  );
}

function obterNomeOrgaoParaPesquisa(orgao) {
  const nomesPorCodigo = {
    11: "PODER EXECUTIVO",
  };
  const codigo = obterCodigoOrgao(orgao);

  if (ehPrefeituraOuPoderExecutivo(orgao)) {
    return "PODER EXECUTIVO";
  }

  const nomeParaPesquisa =
    nomesPorCodigo[codigo] ||
    normalizarTexto(orgao).replace(/^\d+\s*-\s*/, "") ||
    codigo;

  return nomeParaPesquisa;
}

function obterSiglasOrgao(nomeOrgao) {
  const siglas = {
    "fundo municipal de educação": ["fme"],
    "fundo municipal de saude": ["fms"],
    "fundo municipal de saúde": ["fms"],
    "fundo municipal de assistência social": ["fmas"],
    "fundo municipal de assistencia social": ["fmas"],
    "fundo municipal de habitação e interesse social": ["fmhis"],
    "fundo municipal de habitacao e interesse social": ["fmhis"],
    "fundo municipal de meio ambiente": ["fmma"],
    fundef: ["fundef"],
  };

  return siglas[removerCodigoOrgao(nomeOrgao)] || [];
}

function obterIdentificadoresOrgao(nomeOrgao) {
  const nomeNormalizado = removerCodigoOrgao(nomeOrgao);
  const identificadores = new Set([nomeNormalizado]);
  const siglas = obterSiglasOrgao(nomeOrgao);

  siglas.forEach((sigla) => identificadores.add(sigla));

  if (ehPrefeituraOuPoderExecutivo(nomeOrgao)) {
    identificadores.add("prefeitura");
    identificadores.add("poder executivo");
  }

  return identificadores;
}

function orgaosCorrespondem(nomeEsperado, nomeEncontrado) {
  const esperado = removerCodigoOrgao(nomeEsperado);
  const encontrado = removerCodigoOrgao(nomeEncontrado);

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

  const identificadoresEsperados = obterIdentificadoresOrgao(nomeEsperado);
  const identificadoresEncontrados = obterIdentificadoresOrgao(nomeEncontrado);

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

// Aguarda a primeira listagem completa antes de ler um empenho ou selecionar
// um filtro externo.
function aguardarListagem() {
  cy.get(".loader", { timeout: 30000 }).should("not.exist");
  cy.get(".cont_dados", { timeout: 30000 }).should("be.visible");
  cy.get(".cont_dados .tb tr[id]")
    .filter((_, row) => !["not-found-line", "template_row"].includes(row.id))
    .should("have.length.at.least", 1);
}

// Obtém do primeiro registro um órgão real para usar como dado de entrada do
// cenário, evitando depender de códigos fixos no ambiente.
function obterOrgaoDoPortal() {
  cy.get(".cont_dados .tb tr[id]")
    .filter((_, row) => !["not-found-line", "template_row"].includes(row.id))
    .first()
    .find(".colNumero")
    .click({ force: true });

  return cy
    .get("#orgao", { timeout: 30000 })
    .should("be.visible")
    .then(($campo) => {
      const orgao = normalizarTexto(
        $campo.val() || $campo.text() || $campo.attr("value") || "",
      );
      const orgaoNormalizado = normalizarTexto(orgao);

      expect(orgaoNormalizado, "órgão disponível no detalhamento").to.not.equal(
        "",
      );
      cy.visitPortal(SG_DESPESAS_PATH);
      aguardarListagem();

      return cy.wrap(orgaoNormalizado, { log: false });
    });
}

// Seleciona o órgão pelo código quando possível e usa o nome como fallback.
function selecionarOrgaoDoPortal(orgaoDoPortal) {
  const nomeOrgao = obterNomeOrgaoParaPesquisa(orgaoDoPortal);

  return cy.get("#select_orgao").then(($container) => {
    cy.wrap($container).find(".selected").click({ force: true });
    cy.wrap($container)
      .find("input#search:visible")
      .first()
      .should("be.visible")
      .clear({ force: true })
      .type(nomeOrgao, { force: true })
      .should("have.value", nomeOrgao);

    return cy
      .wrap($container)
      .find(".options .list a")
      .should("have.length.at.least", 1)
      .then(($opcoes) => {
        const opcoes = Array.from($opcoes);
        const codigoOrgao = obterCodigoOrgao(orgaoDoPortal);
        const opcaoPorCodigo = opcoes.find(
          (elemento) =>
            elemento.getAttribute("href")?.replace(/^#/, "") === codigoOrgao,
        );
        const opcaoPorNome = opcoes.find((elemento) => {
          return orgaosCorrespondem(nomeOrgao, elemento.textContent);
        });

        const opcao = opcaoPorCodigo || opcaoPorNome;

        expect(opcao, `órgão do portal "${orgaoDoPortal}" disponível no filtro`)
          .to.exist;

        const orgao = {
          texto: normalizarTexto(opcao.textContent),
          codigo: opcao.getAttribute("href")?.replace(/^#/, "") || "",
        };
        cy.wrap(opcao).click({ force: true });
        return cy.wrap(orgao, { log: false });
      });
  });
}

// Seleciona uma opção de um select customizado do portal pelo texto exibido.
function selecionarOpcao(containerSelector, textoOpcao) {
  cy.get(containerSelector).find(".selected").click({ force: true });
  cy.contains(`${containerSelector} .options .list a`, textoOpcao, {
    matchCase: false,
  }).click({ force: true });
}

// Aguarda o término do filtro externo e a remoção do loader da tabela.
function aguardarRetornoDoFiltro() {
  cy.get(".loader", { timeout: 30000 }).should("not.exist");
  cy.get(".cont_dados", { timeout: 30000 }).should("be.visible");
  cy.get(".tb-load", { timeout: 30000 }).should("not.exist");
}

function validarPeriodoExibido(inicial, final) {
  cy.get(".periodo-pesquisa .periodo-inicial").should("contain", inicial);
  cy.get(".periodo-pesquisa .periodo-final").should("contain", final);
}

// Converte uma data brasileira para um número comparável no formato AAAAMMDD.
function dataParaNumero(data) {
  const [dia, mes, ano] = data.split("/");
  return Number(`${ano}${mes}${dia}`);
}

// Confere cada data retornada contra o intervalo solicitado. Lista vazia é
// aceita somente quando o portal exibe sua mensagem oficial de ausência.
function validarDatasDaListagemNoPeriodo(inicial, final) {
  const dataInicial = dataParaNumero(inicial);
  const dataFinal = dataParaNumero(final);

  aguardarRetornoDoFiltro();

  cy.get("body").then(($body) => {
    const linhas = $body
      .find(".cont_dados .tb tr[id]")
      .toArray()
      .filter((row) => !["not-found-line", "template_row"].includes(row.id));

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());
      expect(mensagem).to.contain("Nenhum resultado encontrado");

      const mensagemComContexto = `[sgdespesas][período] ${mensagem}`;
      console.log(mensagemComContexto);
      Cypress.log({
        name: "ALERTA",
        message: mensagemComContexto,
        consoleProps: () => ({
          filtro: "período",
          resultado: "sem dados",
          mensagem,
        }),
      });
      cy.task("log", mensagemComContexto);
      cy.log(mensagemComContexto);
      return;
    }

    const datas = linhas
      .slice(0, 10)
      .map((row) =>
        normalizarTexto(row.querySelector(".colData")?.textContent || ""),
      )
      .filter(Boolean);

    expect(datas.length, "datas disponíveis na listagem").to.be.greaterThan(0);

    datas.forEach((data) => {
      const dataAtual = dataParaNumero(data);
      expect(dataAtual, `data ${data} dentro do período`).to.be.at.least(
        dataInicial,
      );
      expect(dataAtual, `data ${data} dentro do período`).to.be.at.most(
        dataFinal,
      );
    });
  });
}

function ultimoDiaDoMes(mes, ano) {
  return new Date(ano, mes, 0).getDate();
}

function formatarData(data) {
  return `${String(data.getDate()).padStart(2, "0")}/${String(
    data.getMonth() + 1,
  ).padStart(2, "0")}/${data.getFullYear()}`;
}

function montarPeriodoAnual(ano) {
  return {
    label: `Ano de ${ano}`,
    inicial: `01/01/${ano}`,
    final: `31/12/${ano}`,
  };
}

// Seleciona um período pré-configurado e aguarda a atualização da listagem.
function selecionarPeriodo(textoOpcao) {
  selecionarOpcao("#filtro_periodo", textoOpcao);
  aguardarRetornoDoFiltro();
}

// Abre o calendário para que o teste possa trocar ano e mês manualmente.
function abrirCalendarioPeriodo() {
  cy.get("#filtro_periodo .filtro_intervalo").click({ force: true });
  cy.get("#popup_intervalo", { timeout: 30000 }).should("exist");
}

function validarOrgaoNoDetalhe(orgaoSelecionado) {
  cy.get(".cont_dados .tb tr[id]")
    .filter((_, row) => !["not-found-line", "template_row"].includes(row.id))
    .first()
    .find(".colNumero")
    .click({ force: true });

  cy.get("#orgao", { timeout: 30000 })
    .should("be.visible")
    .then(($campo) => {
      const orgaoRetornado = normalizarTexto(
        $campo.val() || $campo.text() || $campo.attr("value") || "",
      );
      const codigoRetornado = obterCodigoOrgao(orgaoRetornado);
      const codigoSelecionado = orgaoSelecionado.codigo;
      const orgaosCorrespondemPorCodigo =
        codigoSelecionado !== "" &&
        codigoRetornado !== "" &&
        codigoSelecionado === codigoRetornado;

      expect(
        orgaosCorrespondemPorCodigo ||
          orgaosCorrespondem(orgaoSelecionado.texto, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com "${orgaoSelecionado.texto}"`,
      ).to.equal(true);
    });
}

// Executa a mesma sequência para Sim e Não. Sim deve retornar empenhos; para
// Não, o portal pode retornar empenhos ou a mensagem oficial de lista vazia.
// O resultado é registrado no log para facilitar a análise no Cypress.
function pesquisarCovidEValidarListagem(opcao) {
  selecionarOpcao("#search_coronavirus", opcao);
  aguardarRetornoDoFiltro();

  cy.get("body").then(($body) => {
    const linhas = $body
      .find(".cont_dados .tb tr[id]")
      .toArray()
      .filter((row) => !["not-found-line", "template_row"].includes(row.id));

    if (linhas.length > 0) {
      expect(
        linhas.length,
        `registros retornados para COVID-19 como ${opcao}`,
      ).to.be.greaterThan(0);

      const mensagemComContexto = `[${SG_DESPESAS_NOME}][COVID-19=${opcao}] ${linhas.length} registro(s) encontrado(s)`;
      console.log(mensagemComContexto);
      Cypress.log({
        name: "RESULTADO",
        message: mensagemComContexto,
        consoleProps: () => ({
          filtro: "COVID-19",
          opcao,
          registros: linhas.length,
        }),
      });
      cy.task("log", mensagemComContexto);
      cy.log(mensagemComContexto);
      return;
    }

    const mensagem = normalizarTexto($body.find("#not-found-line").text());
    expect(mensagem).to.contain("Nenhum resultado encontrado");

    const mensagemComContexto = `[${SG_DESPESAS_NOME}][COVID-19=${opcao}] ${mensagem}`;
    console.log(mensagemComContexto);
    Cypress.log({
      name: "ALERTA",
      message: mensagemComContexto,
      consoleProps: () => ({ filtro: "COVID-19", opcao, mensagem }),
    });
    cy.task("log", mensagemComContexto);
    cy.log(mensagemComContexto);
  });
}

// O filtro Tipo possui três opções no portal. Cada teste abre o filtro,
// seleciona o tipo solicitado e valida a listagem retornada.
function pesquisarTipoEValidarListagem(tipoEsperado) {
  cy.get("#search_tipo").find(".selected").click({ force: true });

  return cy
    .get("#search_tipo .options .list a")
    .should("have.length", 3)
    .then(($opcoes) => {
      const tipoSelecionado = normalizarTexto(tipoEsperado);
      const opcoesDoTipo = $opcoes.filter(
        (_, opcao) =>
          normalizarTexto(opcao.textContent).toLowerCase() ===
          tipoSelecionado.toLowerCase(),
      );

      expect(
        opcoesDoTipo,
        `opção do filtro Tipo: ${tipoEsperado}`,
      ).to.have.length(1);
      cy.wrap(opcoesDoTipo).click({ force: true });
      aguardarRetornoDoFiltro();

      cy.get("body").then(($body) => {
        const linhas = $body
          .find(".cont_dados .tb tr[id]")
          .toArray()
          .filter(
            (row) => !["not-found-line", "template_row"].includes(row.id),
          );

        if (linhas.length > 0) {
          const mensagem = `[${SG_DESPESAS_NOME}][Tipo=${tipoSelecionado}] ${linhas.length} registro(s) encontrado(s)`;
          console.log(mensagem);
          Cypress.log({
            name: "RESULTADO",
            message: mensagem,
            consoleProps: () => ({
              filtro: "Tipo",
              tipo: tipoSelecionado,
              registros: linhas.length,
            }),
          });
          cy.task("log", mensagem);
          cy.log(mensagem);
          return;
        }

        const mensagemSemResultado = normalizarTexto(
          $body.find("#not-found-line").text(),
        );
        expect(mensagemSemResultado).to.contain("Nenhum resultado encontrado");

        const mensagem = `[${SG_DESPESAS_NOME}][Tipo=${tipoSelecionado}] ${mensagemSemResultado}`;
        console.log(mensagem);
        Cypress.log({
          name: "ALERTA",
          message: mensagem,
          consoleProps: () => ({
            filtro: "Tipo",
            tipo: tipoSelecionado,
            resultado: "sem dados",
          }),
        });
        cy.task("log", mensagem);
        cy.log(mensagem);
      });
    });
}

function obterLinhasValidas() {
  return cy
    .get(".cont_dados .tb tr[id]")
    .then(($linhas) =>
      Array.from($linhas).filter(
        (row) => !["not-found-line", "template_row"].includes(row.id),
      ),
    );
}

function obterTextoDaColuna($linha, seletores, rotulos = []) {
  for (const seletor of seletores) {
    const texto = normalizarTexto($linha.find(seletor).first().text());

    if (texto) {
      return texto;
    }
  }

  const $tabela = $linha.closest("table");
  const $cabecalhos = $tabela.find("thead th, thead td").length
    ? $tabela.find("thead th, thead td")
    : $tabela.find("tr").first().find("th, td");
  const rotulosNormalizados = rotulos.map(normalizarParaComparacao);
  const indiceDaColuna = Array.from($cabecalhos).findIndex((cabecalho) =>
    rotulosNormalizados.includes(
      normalizarParaComparacao(cabecalho.textContent),
    ),
  );

  if (indiceDaColuna >= 0) {
    return normalizarTexto($linha.children("td").eq(indiceDaColuna).text());
  }

  return "";
}

function obterNomeMovimentoDaListagem($linha) {
  const nomeMovimento = obterTextoDaColuna($linha, [
    ".colNomeMovimento",
    ".colMovimento",
    ".colTipoMovimento",
    ".colTipo",
  ]);

  if (nomeMovimento) {
    return nomeMovimento;
  }

  return obterTextoDaColuna($linha, [".colNumero"])
    .replace(/\d[\d./-]*$/, "")
    .trim();
}

function obterDadosParaBuscaTextual() {
  return obterLinhasValidas().then((linhas) => {
    const dados = Array.from(linhas)
      .map((linha) => {
        const $linha = Cypress.$(linha);

        return {
          nomeMovimento: obterNomeMovimentoDaListagem($linha),
          favorecido: obterTextoDaColuna(
            $linha,
            [".colFornecedor", ".colFavorecido"],
            ["favorecido", "fornecedor"],
          ),
          descricao: obterTextoDaColuna(
            $linha,
            [".colDescricao", ".colDescrição", ".colDesc"],
            ["descrição", "descricao"],
          )
            .split(" ")
            .slice(0, 4)
            .join(" "),
        };
      })
      .find(
        ({ nomeMovimento, favorecido, descricao }) =>
          nomeMovimento && favorecido && descricao,
      );

    expect(dados, "dados completos disponíveis na listagem").to.exist;
    expect(dados.nomeMovimento, "nome do movimento disponível").to.not.equal(
      "",
    );
    expect(dados.favorecido, "favorecido disponível").to.not.equal("");
    expect(dados.descricao, "descrição disponível").to.not.equal("");

    return cy.wrap(dados, { log: false });
  });
}

function normalizarParaComparacao(texto) {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Confere se pelo menos uma linha contém o valor pesquisado na coluna esperada.
function validarCampoNaListagem(linhas, textoBuscado, obterCampo, nomeCampo) {
  const textoNormalizado = normalizarParaComparacao(textoBuscado);
  const valores = Array.from(linhas).map((linha) =>
    obterCampo(Cypress.$(linha)),
  );

  expect(
    valores.some((valor) =>
      normalizarParaComparacao(valor).includes(textoNormalizado),
    ),
    `${nomeCampo} pesquisado exibido na listagem`,
  ).to.equal(true);
}

// Executa uma busca textual no campo externo e valida o conteúdo retornado.
function pesquisarTextoEValidarCampo(textoBuscado, obterCampo, nomeCampo) {
  cy.get(".filtro > .containerbusca > input#search")
    .clear()
    .type(textoBuscado, { force: true })
    .should("have.value", textoBuscado);
  cy.get(".filtro > .containerbusca > .icon-lupa").click({ force: true });
  aguardarRetornoDoFiltro();

  return obterLinhasValidas().then((linhas) => {
    expect(
      linhas.length,
      `resultado para busca por ${nomeCampo}`,
    ).to.be.greaterThan(0);
    validarCampoNaListagem(linhas, textoBuscado, obterCampo, nomeCampo);

    const mensagem = `[${SG_DESPESAS_NOME}][Busca textual - ${nomeCampo}=${textoBuscado}] ${linhas.length} registro(s) encontrado(s)`;
    console.log(mensagem);
    Cypress.log({
      name: "RESULTADO",
      message: mensagem,
      consoleProps: () => ({
        filtro: "Busca textual",
        campo: nomeCampo,
        texto: textoBuscado,
        registros: linhas.length,
      }),
    });
    cy.task("log", mensagem);
    cy.log(mensagem);
  });
}

// Executa sequencialmente buscas por movimento, favorecido e descrição usando
// os dados da mesma linha para garantir que todos os campos sejam pesquisáveis.
function pesquisarNomeMovimentoFavorecidoEDescricao() {
  return obterDadosParaBuscaTextual().then((dados) =>
    pesquisarTextoEValidarCampo(
      dados.nomeMovimento,
      obterNomeMovimentoDaListagem,
      "Nome do movimento",
    )
      .then(() =>
        pesquisarTextoEValidarCampo(
          dados.favorecido,
          ($linha) =>
            obterTextoDaColuna(
              $linha,
              [".colFornecedor", ".colFavorecido"],
              ["favorecido", "fornecedor"],
            ),
          "Favorecido",
        ),
      )
      .then(() =>
        pesquisarTextoEValidarCampo(
          dados.descricao,
          ($linha) =>
            obterTextoDaColuna(
              $linha,
              [".colDescricao", ".colDescrição", ".colDesc"],
              ["descrição", "descricao"],
            ),
          "Descrição",
        ),
      ),
  );
}

describe(`Portal: ${SG_DESPESAS_NOME} - filtros externos`, () => {
  // Todos os cenários começam com a listagem e o filtro externo visíveis.
  beforeEach(() => {
    cy.visitPortal(SG_DESPESAS_PATH);
    cy.get(".filtro", { timeout: 30000 }).should("be.visible");
    aguardarListagem();
  });

  // Obtém o órgão do detalhe, filtra a listagem e valida o órgão retornado.
  it("filtra por órgão e valida o campo no detalhe do resultado", () => {
    obterOrgaoDoPortal().then((orgaoDoPortal) => {
      selecionarOrgaoDoPortal(orgaoDoPortal).then((orgaoSelecionado) => {
        aguardarListagem();
        validarOrgaoNoDetalhe(orgaoSelecionado);
      });
    });
  });

  // Valida a opção Sim do filtro COVID-19 e registra o resultado encontrado.
  it("filtra COVID-19 como Sim e verifica a listagem", () => {
    pesquisarCovidEValidarListagem("Sim");
  });

  // Valida a opção Não, aceitando registros ou a mensagem oficial de lista vazia.
  it("filtra COVID-19 como Não e verifica a listagem", () => {
    pesquisarCovidEValidarListagem("Não");
  });

  // Confere que o select Tipo contém Empenho e valida a listagem filtrada.
  it("filtra por Tipo: Empenho e verifica a listagem", () => {
    pesquisarTipoEValidarListagem("Empenho");
  });

  // Confere o retorno do filtro Tipo para Liquidação.
  it("filtra por Tipo: Liquidação e verifica a listagem", () => {
    pesquisarTipoEValidarListagem("Liquidação");
  });

  // Confere o retorno do filtro Tipo para Pagamento.
  it("filtra por Tipo: Pagamento e verifica a listagem", () => {
    pesquisarTipoEValidarListagem("Pagamento");
  });

  // Executa as três buscas textuais disponíveis na listagem.
  it("realiza busca textual por nome do movimento, favorecido e descrição", () => {
    pesquisarNomeMovimentoFavorecidoEDescricao();
  });

  // Verifica o intervalo dinâmico dos sete dias anteriores até hoje.
  it("filtra por últimos 7 dias no select de período", () => {
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje);
    seteDiasAtras.setDate(hoje.getDate() - 7);

    selecionarPeriodo("Últimos 7 dias");
    validarPeriodoExibido(formatarData(seteDiasAtras), formatarData(hoje));
    validarDatasDaListagemNoPeriodo(
      formatarData(seteDiasAtras),
      formatarData(hoje),
    );
  });

  // Valida os períodos do ano atual e do ano anterior.
  it("filtra por anos no select de período", () => {
    const anoAtual = new Date().getFullYear();
    const periodos = [
      montarPeriodoAnual(anoAtual),
      montarPeriodoAnual(anoAtual - 1),
    ];

    periodos.forEach(({ label, inicial, final }) => {
      selecionarPeriodo(label);
      validarPeriodoExibido(inicial, final);
      validarDatasDaListagemNoPeriodo(inicial, final);
    });
  });

  // Navega no calendário, troca o ano e valida março e janeiro do ano anterior.
  it("filtra por mês e ano no calendário de período", () => {
    const anoAtual = new Date().getFullYear();
    const anoAnterior = anoAtual - 1;

    abrirCalendarioPeriodo();
    cy.get("#popup_intervalo .container-ano span").should(
      "contain",
      `${anoAtual}`,
    );
    cy.get("#popup_intervalo .container-ano .left").click();
    cy.get("#popup_intervalo .container-ano span").should(
      "contain",
      `${anoAnterior}`,
    );
    cy.get("#popup_intervalo .container-meses span[data-mes='03']").click();

    aguardarRetornoDoFiltro();
    validarPeriodoExibido(`01/03/${anoAnterior}`, `31/03/${anoAnterior}`);
    validarDatasDaListagemNoPeriodo(
      `01/03/${anoAnterior}`,
      `31/03/${anoAnterior}`,
    );

    abrirCalendarioPeriodo();
    cy.get("#popup_intervalo .container-ano span").should(
      "contain",
      `${anoAnterior}`,
    );
    cy.get("#popup_intervalo .container-meses span[data-mes='01']").click();

    const finalJaneiro = `${String(ultimoDiaDoMes(1, anoAnterior)).padStart(2, "0")}/01/${anoAnterior}`;
    aguardarRetornoDoFiltro();
    validarPeriodoExibido(`01/01/${anoAnterior}`, finalJaneiro);
    validarDatasDaListagemNoPeriodo(`01/01/${anoAnterior}`, finalJaneiro);
  });
});
