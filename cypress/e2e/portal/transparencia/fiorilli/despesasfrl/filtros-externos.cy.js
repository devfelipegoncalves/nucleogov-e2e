/**
 * Testes E2E dos filtros que ficam diretamente na listagem de despesas da
 * integração Fiorilli.
 *
 * Os filtros externos são os controles disponíveis sem abrir o popup de
 * pesquisa avançada: órgão, busca textual e período. Os cenários usam dados
 * reais da página para não depender de valores fixos que podem mudar.
 *
 * Execução interativa:
 * npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/fiorilli/filtros-externos.cy.js"
 *
 * Execução headless:
 * npm run cy:run -- --spec "cypress/e2e/portal/transparencia/fiorilli/filtros-externos.cy.js"
 */

// Rota pública e nome usados nos títulos e mensagens de diagnóstico do spec.
const DESPESAS_PATH = "/cidadao/transparencia/despesas_frl";
const DESPESAS_NOME = "fiorilli/despesas_frl";
const LISTAGEM_TIMEOUT = 60000;

// Garante que a página terminou o bootstrap antes de qualquer interação. O
// comando visitPortal já faz esta checagem globalmente, mas ela fica explícita
// neste spec porque os selects e a tabela dependem dos assets do portal.
function aguardarAssetsDoPortal() {
  cy.document({ timeout: LISTAGEM_TIMEOUT }).should((documento) => {
    const folhasDeEstilo = Array.from(
      documento.querySelectorAll("link[rel='stylesheet'][href*='/res/']"),
    );
    const scriptsDoPortal = Array.from(
      documento.querySelectorAll(
        "script[src*='/res/js/'], script[src*='require.min.js']",
      ),
    );
    const folhasAplicadas = folhasDeEstilo.filter((folha) => folha.sheet);

    expect(folhasDeEstilo.length, "CSS do portal encontrado").to.be.greaterThan(
      0,
    );
    expect(
      folhasAplicadas.length,
      "CSS do portal aplicado no documento",
    ).to.equal(folhasDeEstilo.length);
    expect(
      scriptsDoPortal.length,
      "JavaScript do portal encontrado",
    ).to.be.greaterThan(0);
    expect(documento.readyState, "documento pronto").to.equal("complete");
  });
}

// Uniformiza espaços para que as asserções não dependam da formatação visual.
function normalizarTexto(texto = "") {
  return texto.replace(/\s+/g, " ").trim();
}

// Aguarda o indicador de carregamento usado pelo portal desaparecer. O
// should("not.exist") faz o Cypress esperar enquanto #load estiver no DOM e
// permite continuar imediatamente quando essa página não renderiza o id.
function aguardarLoadFinalizar() {
  cy.get("#load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
}

// Remove acentos e transforma o texto em uma forma adequada para comparações.
function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// A listagem pode remover pontuação e cortar a descrição visualmente, embora
// o detalhe mantenha o texto completo. A comparação usa palavras normalizadas
// para validar o mesmo conteúdo sem depender dessas diferenças de apresentação.
function normalizarDescricaoParaComparacao(texto = "") {
  return normalizarParaComparacao(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Retira o código numérico exibido antes do nome do órgão no detalhamento.
function removerCodigoDoOrgao(texto = "") {
  return normalizarParaComparacao(texto).replace(/^\d+\s*[-.)]\s*/, "");
}

// Retorna palavras relevantes para comparar nomes com pequenas diferenças de
// formatação, como "Prefeitura Municipal de Eldorado" e "Prefeitura
// Municipal Eldorado".
function obterTermosDoOrgao(texto) {
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

  return removerCodigoDoOrgao(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((palavra) => palavra.length > 2 && !palavrasIgnoradas.has(palavra));
}

// Confirma que o órgão retornado possui os mesmos termos do órgão filtrado.
function orgaosCorrespondem(orgaoEsperado, orgaoRetornado) {
  const esperado = removerCodigoDoOrgao(orgaoEsperado);
  const retornado = removerCodigoDoOrgao(orgaoRetornado);

  if (esperado === retornado || esperado.includes(retornado)) {
    return true;
  }

  const termosEsperados = obterTermosDoOrgao(orgaoEsperado);
  const termosRetornados = obterTermosDoOrgao(orgaoRetornado);

  return termosEsperados.every((termo) => termosRetornados.includes(termo));
}

// Retorna somente as linhas de dados, excluindo templates e a linha de vazio.
function obterLinhasDeDados() {
  return Cypress.$(".cont_dados .tb tr[id]")
    .toArray()
    .filter((linha) => {
      return (
        !["not-found-line", "template_row"].includes(linha.id) &&
        !linha.classList.contains("tb-load") &&
        linha.querySelector(".colNumero")
      );
    });
}

// Aguarda a tabela inicial e todos os loaders da página desaparecerem.
function aguardarListagemComDados() {
  cy.get(".filtro", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  aguardarLoadFinalizar();
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .should("have.length.at.least", 1);
}

// Aguarda uma nova consulta sem exigir que todo filtro sempre possua dados.
// Alguns órgãos ou períodos podem legitimamente retornar a mensagem de vazio.
function aguardarRetornoDoFiltro() {
  aguardarLoadFinalizar();
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
}

// Abre o detalhamento de uma linha específica da tabela. O índice é usado
// apenas para escolher registros diferentes dentro da listagem atual.
function abrirDetalhamentoDaLinha(indice) {
  cy.get(".cont_dados .tb tr[id]")
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .eq(indice)
    .find(".colNumero")
    .click({ force: true });

  cy.url({ timeout: LISTAGEM_TIMEOUT }).should(
    "include",
    "/transparencia/despesa_frl/",
  );
  aguardarAssetsDoPortal();
  cy.get(".cont_right .cnt", { timeout: LISTAGEM_TIMEOUT }).should(
    "be.visible",
  );
}

// Captura o número exibido no título do detalhamento, em vez de reutilizar o
// texto da tabela, comprovando que o dado foi realmente consultado no detalhe.
function obterEmpenhoDoDetalhamento() {
  // Aguardamos um campo preenchido pela API para garantir que o controller do
  // detalhamento terminou de inicializar o botão Voltar.
  return cy
    .get("#orgao", { timeout: LISTAGEM_TIMEOUT })
    .should("exist")
    .then(() =>
      cy
        .get(".cont_right h2", { timeout: LISTAGEM_TIMEOUT })
        .invoke("text")
        .then((texto) => {
          const numero = normalizarTexto(texto).match(/(\d+)\s*$/)?.[1];

          expect(numero, "empenho disponível no detalhamento").to.exist;
          return numero;
        }),
    );
}

// Captura o histórico apresentado como "Descrição / Histórico" no detalhe.
function obterDescricaoDoDetalhamento() {
  return cy
    .get(".campo.area #desc", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .invoke("text")
    .then((texto) => {
      const descricao = normalizarTexto(texto);

      expect(descricao, "descrição disponível no detalhamento").to.not.equal(
        "",
      );
      return descricao;
    });
}

// Usa o começo da descrição como termo de busca, preservando uma parte real
// do histórico sem enviar para o campo um texto maior que a própria tabela.
function obterTrechoDaDescricao(descricao) {
  return normalizarDescricaoParaComparacao(descricao)
    .split(" ")
    .slice(0, 8)
    .join(" ");
}

// Preenche a busca textual visível e aciona a lupa responsável pela consulta.
function realizarBuscaTextual(textoBusca) {
  cy.get(".containerbusca input.busca")
    .filter(":visible")
    .first()
    .clear()
    .type(textoBusca);
  cy.get(".containerbusca .icon-lupa:visible").first().click({ force: true });
  aguardarRetornoDoFiltro();
}

// Abre o calendário de intervalo existente dentro do filtro de período.
function abrirCalendarioDePeriodo() {
  cy.get("#filtro_periodo .filtro_intervalo", { timeout: LISTAGEM_TIMEOUT })
    .should("exist")
    .click({ force: true });
  cy.get("#popup_intervalo", { timeout: LISTAGEM_TIMEOUT }).should(
    "be.visible",
  );
}

// Calcula o último dia do mês escolhido para validar o intervalo retornado.
function obterUltimoDiaDoMes(mes, ano) {
  return new Date(ano, mes, 0).getDate();
}

// Monta as datas inicial e final a partir do identificador de um mês retornado
// pelo componente de período, normalmente no formato "MM_AAAA".
function montarPeriodoMensal(idPeriodo) {
  const correspondencia = String(idPeriodo).match(/(\d{1,2})[_-](\d{4})/);

  expect(
    correspondencia,
    `identificador do período mensal "${idPeriodo}" válido`,
  ).to.exist;

  const mes = Number(correspondencia[1]);
  const ano = Number(correspondencia[2]);
  const mesFormatado = String(mes).padStart(2, "0");

  return {
    inicial: `01/${mesFormatado}/${ano}`,
    final: `${String(obterUltimoDiaDoMes(mes, ano)).padStart(2, "0")}/${mesFormatado}/${ano}`,
  };
}

// Formata uma data no padrão exibido pelo portal: dia/mês/ano.
function formatarData(dia, mes, ano) {
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(
    2,
    "0",
  )}/${ano}`;
}

// Confirma o intervalo escolhido no resumo "PERÍODO DE PESQUISA".
function validarPeriodoExibido(dataInicial, dataFinal) {
  cy.get(".periodo-pesquisa .periodo-inicial").should("contain", dataInicial);
  cy.get(".periodo-pesquisa .periodo-final").should("contain", dataFinal);
}

// Converte uma data brasileira para número, permitindo comparações de limite.
function converterDataParaNumero(data) {
  const [dia, mes, ano] = normalizarTexto(data).split("/").map(Number);

  return Number(
    `${ano}${String(mes).padStart(2, "0")}${String(dia).padStart(2, "0")}`,
  );
}

// Verifica se as datas dos registros estão dentro do período selecionado.
// Quando não houver lançamentos, o componente Fiorilli pode manter apenas a
// linha de carregamento sem renderizar uma mensagem de lista vazia; nesse caso
// o intervalo exibido pelo relatório continua sendo a validação do retorno.
function validarDatasDosRegistros(dataInicial, dataFinal) {
  const limiteInicial = converterDataParaNumero(dataInicial);
  const limiteFinal = converterDataParaNumero(dataFinal);

  aguardarRetornoDoFiltro();
  cy.get("body").then(($body) => {
    const linhas = obterLinhasDeDados();

    if (linhas.length === 0) {
      const mensagem = normalizarTexto($body.find("#not-found-line").text());

      if (mensagem) {
        expect(mensagem, "mensagem para período sem registros").to.contain(
          "Nenhum resultado encontrado",
        );
      } else {
        cy.log("Período sem registros renderizados para validar");
      }
      return;
    }

    const datas = linhas
      .map((linha) =>
        normalizarTexto(linha.querySelector(".colData")?.textContent),
      )
      .filter(Boolean)
      .map(converterDataParaNumero);

    expect(
      datas.length,
      "datas disponíveis nos registros filtrados",
    ).to.be.greaterThan(0);
    datas.forEach((data, indice) => {
      expect(
        Number.isNaN(data),
        `data do registro ${indice + 1} válida`,
      ).to.equal(false);
      expect(
        data,
        `data do registro ${indice + 1} dentro do período`,
      ).to.be.at.least(limiteInicial);
      expect(
        data,
        `data do registro ${indice + 1} dentro do período`,
      ).to.be.at.most(limiteFinal);
    });
  });
}

// Seleciona uma opção dinâmica pelo início do texto e retorna seu identificador.
// Os períodos mensais são gerados pela API e mudam conforme o ano vigente.
function selecionarPeriodoPorPrefixo(prefixo) {
  cy.get("#filtro_periodo .selected")
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#filtro_periodo .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const prefixoNormalizado = normalizarParaComparacao(prefixo);
      const opcao = Array.from($opcoes).find((elemento) =>
        normalizarParaComparacao(elemento.textContent).startsWith(
          prefixoNormalizado,
        ),
      );

      expect(opcao, `período iniciado por "${prefixo}" disponível`).to.exist;
      const periodo = {
        id: opcao.getAttribute("href")?.replace(/^#/, "") || "",
        texto: normalizarTexto(opcao.textContent),
      };

      cy.wrap(opcao).click({ force: true });
      return cy.wrap(periodo, { log: false });
    });
}

// Limpa o período atual e aguarda a listagem voltar ao estado inicial.
function limparFiltrosExternos() {
  cy.get("#x_filtros:visible")
    .first()
    .should("be.visible")
    .click({ force: true });
  aguardarListagemComDados();
}

// Inicia a captura das requisições da API que serão disparadas pelo período.
// O alias é criado antes do clique para não perder uma resposta rápida.
function interceptarConsultaDoPeriodo(alias) {
  cy.intercept("POST", "**/api").as(alias);
}

// Aguarda a resposta que efetivamente contém a lista de despesas. O controller
// solicita primeiro os totais e depois a listagem, por isso a primeira resposta
// pode não conter "dados" e precisamos aguardar a próxima.
function aguardarRegistrosDoPeriodo(alias) {
  cy.wait(`@${alias}`, { timeout: LISTAGEM_TIMEOUT }).then((interceptacao) => {
    const corpo = JSON.stringify(interceptacao.response?.body || {});

    if (!corpo.includes('"dados"')) {
      cy.wait(`@${alias}`, { timeout: LISTAGEM_TIMEOUT });
    }
    aguardarLoadFinalizar();
  });
}

// Confirma que todos os registros retornados possuem o número pesquisado.
function validarEmpenhosDaBusca(numeroEmpenho) {
  cy.get(".cont_dados .tb tr[id]")
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .should("have.length.at.least", 1)
    .each(($linha) => {
      expect(
        normalizarTexto($linha.find(".colNumero").text()),
        "empenho retornado pela busca textual",
      ).to.contain(numeroEmpenho);
    });
}

// Confirma que pelo menos uma descrição retornada contém o trecho pesquisado.
// A busca do portal pode retornar outras linhas que compartilham termos da
// frase, por isso não é correto exigir o texto completo em todas as linhas.
function validarDescricoesDaBusca(trechoDaDescricao) {
  const trechoNormalizado = normalizarDescricaoParaComparacao(
    trechoDaDescricao,
  );

  cy.get(".cont_dados .tb tr[id]")
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .should("have.length.at.least", 1)
    .then(($linhas) => {
      const descricoes = Array.from($linhas).map((linha) =>
        normalizarDescricaoParaComparacao(
          linha.querySelector(".colDescricao")?.textContent,
        ),
      );
      const encontrouDescricao = descricoes.some((descricao) =>
        descricao.includes(trechoNormalizado),
      );

      expect(
        encontrouDescricao,
        "pelo menos uma descrição correspondente à pesquisa textual",
      ).to.equal(true);
    });
}

// Escolhe uma opção de um Select customizado utilizado pelo portal.
function selecionarOpcao(containerSelector, textoOpcao) {
  cy.get(containerSelector)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });
  cy.get(`${containerSelector} .options`, { timeout: LISTAGEM_TIMEOUT }).should(
    "be.visible",
  );
  cy.contains(`${containerSelector} .options .list a`, textoOpcao, {
    matchCase: false,
  }).click({ force: true });
}

// Abre o detalhamento da primeira despesa e captura o órgão exibido pelo
// backend. O valor retornado contém o nome e, normalmente, o código do órgão.
function obterOrgaoDaPrimeiraDespesa() {
  cy.get(".cont_dados .tb tr[id]")
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .first()
    .find(".colNumero")
    .click({ force: true });

  return cy
    .url({ timeout: LISTAGEM_TIMEOUT })
    .should("include", "/transparencia/despesa_frl/")
    .then(() => {
      aguardarAssetsDoPortal();

      return cy
        .get("#orgao", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .invoke("text")
        .then((texto) => {
          const orgao = normalizarTexto(texto);

          expect(orgao, "órgão disponível no detalhamento").to.not.equal("");
          return cy.wrap(orgao, { log: false });
        });
    });
}

// Retorna à listagem pelo botão oficial do detalhamento.
function voltarParaFiltrosExternos() {
  cy.get("#voltar-list", { timeout: LISTAGEM_TIMEOUT })
    .should("exist")
    .click({ force: true });
  // O botão utiliza a rota relativa e o servidor redireciona para a URL
  // canônica, que não contém o prefixo /cidadao.
  cy.url({ timeout: LISTAGEM_TIMEOUT }).should(
    "match",
    /\/transparencia\/despesas_frl$/,
  );
  aguardarAssetsDoPortal();
  aguardarListagemComDados();
}

// Pesquisa o órgão capturado no campo interno do select e escolhe a opção que
// corresponde ao código ou ao nome encontrado no detalhamento.
function pesquisarESelecionarOrgao(orgaoDoDetalhamento) {
  const codigoOrgao = normalizarTexto(orgaoDoDetalhamento).match(/^\d+/)?.[0];
  const nomeOrgao = removerCodigoDoOrgao(orgaoDoDetalhamento);
  const termosOrgao = obterTermosDoOrgao(orgaoDoDetalhamento);
  const termoPesquisa = termosOrgao[termosOrgao.length - 1] || nomeOrgao;

  cy.get("#select_orgao .selected").click({ force: true });
  cy.get("#select_orgao input:visible", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });
  // Neste Select, a digitação não filtra a lista automaticamente. A lupa
  // interna dispara a pesquisa e só então o portal renderiza as opções.
  cy.get("#select_orgao .options .icon-lupa:visible", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });
  cy.get("#select_orgao .options .list a:visible", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcoes = Array.from($opcoes);
      const opcao =
        opcoes.find(
          (elemento) =>
            codigoOrgao && elemento.getAttribute("href") === `#${codigoOrgao}`,
        ) ||
        opcoes.find((elemento) =>
          orgaosCorrespondem(orgaoDoDetalhamento, elemento.textContent),
        );

      expect(
        opcao,
        `órgão pesquisado "${orgaoDoDetalhamento}" disponível no select`,
      ).to.exist;
      cy.wrap(opcao).click({ force: true });
    });
}

// Após o filtro, abre um resultado e confirma o órgão novamente no detalhe.
function validarOrgaoDoPrimeiroResultado(orgaoFiltrado) {
  cy.get(".cont_dados .tb tr[id]")
    .filter((_, linha) => obterLinhasDeDados().includes(linha))
    .first()
    .find(".colNumero")
    .click({ force: true });

  cy.get("#orgao", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .invoke("text")
    .then((texto) => {
      const orgaoRetornado = normalizarTexto(texto);

      expect(
        orgaosCorrespondem(orgaoFiltrado, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com "${orgaoFiltrado}"`,
      ).to.equal(true);
    });
}

describe(`Portal: ${DESPESAS_NOME} - filtros externos`, () => {
  beforeEach(() => {
    // Cada cenário começa com os filtros limpos e com a listagem inicial pronta.
    cy.visitPortal(DESPESAS_PATH);
    aguardarAssetsDoPortal();
    aguardarListagemComDados();
  });

  it("exibe os controles externos e a primeira página de despesas", () => {
    cy.get("#select_anobase").should("exist");
    cy.get("#select_orgao").should("be.visible");
    cy.get(".containerbusca input.busca")
      .filter(":visible")
      .first()
      .should("be.visible")
      .and(
        "have.attr",
        "placeholder",
        "Buscar por Empenho, Favorecido ou Descrição",
      );
    cy.get("#filtro_periodo").should("exist");
    cy.get("#busca_avancada").should("be.visible");
    cy.get("#exportar").should("exist");
  });

  it("busca por empenho e depois por descrição de registros reais", () => {
    // Primeiro registro: acessa o detalhe e captura o número do empenho.
    abrirDetalhamentoDaLinha(0);
    obterEmpenhoDoDetalhamento().then((numeroEmpenho) => {
      voltarParaFiltrosExternos();
      realizarBuscaTextual(numeroEmpenho);
      validarEmpenhosDaBusca(numeroEmpenho);

      // A limpeza remove o texto da busca e reinicia a listagem para que o
      // segundo registro seja escolhido sem carregar o filtro anterior.
      cy.get("#x_filtros:visible")
        .first()
        .should("be.visible")
        .click({ force: true });
      aguardarListagemComDados();
      cy.get(".containerbusca input.busca")
        .filter(":visible")
        .first()
        .should("have.value", "");

      // Segundo registro: captura a descrição/histórico no detalhamento.
      abrirDetalhamentoDaLinha(1);
      obterDescricaoDoDetalhamento().then((descricao) => {
        const trechoDaDescricao = obterTrechoDaDescricao(descricao);

        voltarParaFiltrosExternos();
        realizarBuscaTextual(trechoDaDescricao);
        validarDescricoesDaBusca(trechoDaDescricao);
      });
    });
  });

  it("filtra pelo órgão encontrado no detalhamento da despesa", () => {
    // Primeiro usamos um registro real da tabela para descobrir o órgão que
    // deverá ser pesquisado no filtro externo.
    obterOrgaoDaPrimeiraDespesa().then((orgaoDoDetalhamento) => {
      voltarParaFiltrosExternos();
      pesquisarESelecionarOrgao(orgaoDoDetalhamento);
      cy.get("#x_filtros:visible").first().should("be.visible");
      aguardarRetornoDoFiltro();

      // O campo selecionado deve mostrar o órgão pesquisado antes de abrir um
      // novo resultado para confirmar o mesmo valor no detalhamento.
      cy.get("#select_orgao .selected p")
        .invoke("text")
        .then((textoSelecionado) => {
          const orgaoSelecionado = normalizarTexto(textoSelecionado);

          expect(
            orgaoSelecionado,
            "órgão exibido no filtro externo",
          ).to.not.equal("");
          expect(
            orgaosCorrespondem(orgaoDoDetalhamento, orgaoSelecionado),
            `órgão selecionado "${orgaoSelecionado}" compatível com "${orgaoDoDetalhamento}"`,
          ).to.equal(true);
          validarOrgaoDoPrimeiroResultado(orgaoSelecionado);
        });
    });
  });

  it("valida os filtros de período em uma única sequência", () => {
    const hoje = new Date();
    const dataFinalSeteDias = formatarData(
      hoje.getDate(),
      hoje.getMonth() + 1,
      hoje.getFullYear(),
    );
    const seteDiasAtras = new Date(hoje);

    seteDiasAtras.setDate(hoje.getDate() - 7);

    // 1) Seleciona os últimos sete dias e valida o intervalo e as datas dos
    // registros retornados pela consulta.
    interceptarConsultaDoPeriodo("consultaUltimosSeteDias");
    selecionarOpcao("#filtro_periodo", "Últimos 7 dias");
    aguardarRegistrosDoPeriodo("consultaUltimosSeteDias");
    validarPeriodoExibido(
      formatarData(
        seteDiasAtras.getDate(),
        seteDiasAtras.getMonth() + 1,
        seteDiasAtras.getFullYear(),
      ),
      dataFinalSeteDias,
    );
    validarDatasDosRegistros(
      formatarData(
        seteDiasAtras.getDate(),
        seteDiasAtras.getMonth() + 1,
        seteDiasAtras.getFullYear(),
      ),
      dataFinalSeteDias,
    );
    limparFiltrosExternos();

    // 2) Seleciona um mês disponível no select e valida o período mensal
    // retornado pelo próprio identificador da opção.
    interceptarConsultaDoPeriodo("consultaPeriodoMensal");
    selecionarPeriodoPorPrefixo("Mês de").then(({ id }) => {
      const periodoMensal = montarPeriodoMensal(id);

      aguardarRegistrosDoPeriodo("consultaPeriodoMensal");
      validarPeriodoExibido(periodoMensal.inicial, periodoMensal.final);
      validarDatasDosRegistros(periodoMensal.inicial, periodoMensal.final);
      limparFiltrosExternos();
    });

    // 3) Seleciona o ano atual no select e confirma de 01/01 a 31/12.
    const anoAtual = hoje.getFullYear();
    const dataInicialAno = formatarData(1, 1, anoAtual);
    const dataFinalAno = formatarData(31, 12, anoAtual);

    interceptarConsultaDoPeriodo("consultaAnoAtual");
    selecionarOpcao("#filtro_periodo", `Ano de ${anoAtual}`);
    aguardarRegistrosDoPeriodo("consultaAnoAtual");
    validarPeriodoExibido(dataInicialAno, dataFinalAno);
    validarDatasDosRegistros(dataInicialAno, dataFinalAno);
    limparFiltrosExternos();

    // 4) Acessa o ícone de calendário, muda para o ano anterior e escolhe o
    // mês anterior ao atual para validar um intervalo personalizado.
    const anoAnterior = anoAtual - 1;
    const mesAtual = hoje.getMonth() + 1;
    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
    const mesFormatado = String(mesAnterior).padStart(2, "0");
    const dataInicialCalendario = formatarData(1, mesAnterior, anoAnterior);
    const dataFinalCalendario = formatarData(
      obterUltimoDiaDoMes(mesAnterior, anoAnterior),
      mesAnterior,
      anoAnterior,
    );

    interceptarConsultaDoPeriodo("consultaCalendario");
    abrirCalendarioDePeriodo();
    cy.get("#popup_intervalo .container-ano span")
      .should("contain", String(anoAtual))
      .closest(".container-ano")
      .find(".left")
      .click({ force: true });
    cy.get("#popup_intervalo .container-ano span").should(
      "contain",
      String(anoAnterior),
    );
    cy.get(`#popup_intervalo .container-meses span[data-mes='${mesFormatado}']`)
      .should("be.visible")
      .click({ force: true });

    aguardarRegistrosDoPeriodo("consultaCalendario");
    validarPeriodoExibido(dataInicialCalendario, dataFinalCalendario);
    validarDatasDosRegistros(dataInicialCalendario, dataFinalCalendario);
    cy.get("#x_filtros:visible").first().should("be.visible");
  });

  it("limpa a busca externa pelo botão de limpar filtros", () => {
    cy.get(".containerbusca input.busca")
      .filter(":visible")
      .first()
      .type("consulta de teste");
    cy.get(".containerbusca .icon-lupa:visible").first().click({ force: true });
    aguardarRetornoDoFiltro();
    cy.get("#x_filtros:visible")
      .first()
      .should("be.visible")
      .click({ force: true });
    aguardarRetornoDoFiltro();

    cy.get(".containerbusca input.busca")
      .filter(":visible")
      .first()
      .should("have.value", "");
    cy.get("#x_filtros").should("not.be.visible");
  });
});
