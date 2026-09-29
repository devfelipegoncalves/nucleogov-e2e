/**
 * Testes E2E do filtro avançado da integração Fiorilli.
 *
 * O filtro avançado é aberto pelo botão "FILTRAR" e renderizado em um popup.
 * Este arquivo valida a existência dos campos, aplica uma busca por empenho
 * usando registros reais da tabela. O processo é obtido de um HTML exportado
 * antes de ser pesquisado no filtro avançado. Também verifica as regras de
 * dependência entre Categoria Econômica e Grupo, além das buscas por
 * Favorecido, CPF/CNPJ, Órgão e período.
 *
 * Execução interativa:
 * npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/fiorilli/despesasfrl/filtro-avancado.cy.js"
 *
 * Execução headless:
 * npm run cy:run -- --spec "cypress/e2e/portal/transparencia/fiorilli/despesasfrl/filtro-avancado.cy.js"
 */

// Rota do módulo e tempo maior para chamadas públicas que carregam muitos dados.
const DESPESAS_PATH = "/cidadao/transparencia/despesas_frl";
const DESPESAS_NOME = "fiorilli/despesas_frl";
const LISTAGEM_TIMEOUT = 60000;

// Aguarda o indicador de carregamento terminar antes de acessar dados ou
// executar uma asserção. Se a página não renderizar #load, a verificação passa
// sem bloquear o teste; quando o elemento existir, ele precisa desaparecer.
function aguardarLoadFinalizar() {
  cy.get("#load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
}

// Normaliza espaços para comparar textos gerados dinamicamente pelo portal.
function normalizarTexto(texto = "") {
  return texto.replace(/\s+/g, " ").trim();
}

function normalizarProcesso(texto = "") {
  return normalizarTexto(texto).replace(/\s*([/-])\s*/g, "$1");
}

function extrairIdentificadorDoProcesso(texto = "") {
  return normalizarProcesso(texto).match(
    /\b(?:\d{1,8}[/-](?:19|20)\d{2}|\d{1,8}[/-]\d{2}|(?:19|20)\d{2}[/-]\d{1,8})\b/,
  )?.[0];
}

function processosCorrespondem(processoEsperado, processoRetornado) {
  const identificadorEsperado = extrairIdentificadorDoProcesso(
    processoEsperado,
  );
  const identificadorRetornado = extrairIdentificadorDoProcesso(
    processoRetornado,
  );

  if (identificadorEsperado && identificadorRetornado) {
    return identificadorEsperado === identificadorRetornado;
  }

  return (
    normalizarProcesso(processoEsperado).toLowerCase() ===
    normalizarProcesso(processoRetornado).toLowerCase()
  );
}

function normalizarRotuloDoHtml(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function textoIndicaProcesso(texto = "") {
  // "Licitação" é outro campo do relatório e pode conter números no mesmo
  // formato (por exemplo, "DISPENSA 13404/2026"). O filtro avançado usa o
  // valor do rótulo exato "Processo", como "000309/26".
  return normalizarRotuloDoHtml(texto) === "processo";
}

function limparValorDoProcesso(texto = "") {
  const identificador = extrairIdentificadorDoProcesso(texto);

  if (identificador) {
    return identificador;
  }

  return normalizarTexto(texto)
    .replace(/^(?:processo|procedimento\s+licitat[oó]rio|licita[cç][aã]o)\s*[:#-]?\s*/i, "")
    .trim();
}

function localizarCampoDeProcesso($raiz) {
  const $container = Cypress.$($raiz);
  let $campo = $container
    .find(
      '#processo, #processo_licitatorio, #processoLicitatorio, #numero_processo_licitacao, #licitacao, #procedimento_licitatorio, [id*="processo"], [name*="processo"], [id*="licitacao"], [name*="licitacao"], [id*="procedimento"], [name*="procedimento"]',
    )
    .filter("input, textarea, select, .input")
    .first();

  if (!$campo.length) {
    const rotulo = Array.from($container.find("label")).find((elemento) =>
      textoIndicaProcesso(elemento.textContent),
    );

    if (rotulo) {
      const $grupo = Cypress.$(rotulo).closest(".campo");
      $campo = $grupo
        .find("input, textarea, select, .input")
        .first();

      if (!$campo.length && rotulo.htmlFor) {
        $campo = $container.find(`#${rotulo.htmlFor}`).first();
      }
    }
  }

  return $campo;
}

function obterValorDeCampo($campo) {
  return normalizarTexto(
    $campo?.val?.() ||
      $campo?.attr?.("value") ||
      $campo?.text?.() ||
      $campo?.textContent ||
      "",
  );
}

function extrairProcessoDoHtml(html) {
  const $raiz = Cypress.$("<div>");
  const partesHtml = Cypress.$.parseHTML(html, document, true) || [];

  $raiz.append(partesHtml);
  $raiz.find("script, style, noscript").remove();

  const candidatos = [];
  const adicionarCandidato = (texto) => {
    const valor = limparValorDoProcesso(texto);

    if (valor && !/^(?:-|n[aã]o informado|nulo)$/i.test(valor)) {
      candidatos.push(valor);
    }
  };

  $raiz.find("tr").each((_, linha) => {
    const textos = Cypress.$(linha)
      .find("th, td")
      .map((__, celula) => normalizarTexto(celula.textContent))
      .get();

    textos.forEach((texto, indice) => {
      if (!textoIndicaProcesso(texto)) {
        return;
      }

      // No HTML exportado pelo Fiorilli, o processo fica na célula seguinte
      // ao cabeçalho: <th>Processo</th><td>000126/25</td>. Ler somente essa
      // célula evita capturar datas ou outros números posteriores da linha.
      adicionarCandidato(textos[indice + 1]);
    });
  });

  $raiz.find("label").each((_, rotulo) => {
    if (!textoIndicaProcesso(rotulo.textContent)) {
      return;
    }

    const $grupo = Cypress.$(rotulo).closest(".campo");
    const $campo = $grupo.find("input, textarea, select").first();

    if ($campo.length) {
      adicionarCandidato(obterValorDeCampo($campo));
    } else {
      adicionarCandidato($grupo.text() || rotulo.textContent);
    }
  });

  const processo = candidatos.find((candidato) =>
    extrairIdentificadorDoProcesso(candidato),
  );

  if (processo) {
    return processo;
  }

  return "";
}

function extrairRegistroComProcessoEDescricaoDoHtml(html) {
  const $raiz = Cypress.$("<div>");
  const partesHtml = Cypress.$.parseHTML(html, document, true) || [];

  $raiz.append(partesHtml);
  $raiz.find("script, style, noscript").remove();

  const registros = [];
  let registroAtual = {};

  $raiz.find("tr").each((_, linha) => {
    const textos = Cypress.$(linha)
      .find("th, td")
      .map((__, celula) => normalizarTexto(celula.textContent))
      .get();
    const rotulo = normalizarRotuloDoHtml(textos[0]);
    const valor = textos[1] || "";

    if (!rotulo) {
      return;
    }

    if (rotulo === "numero empenho") {
      if (registroAtual.processo || registroAtual.descricao) {
        registros.push(registroAtual);
      }

      registroAtual = {};
    }

    if (rotulo === "processo") {
      registroAtual.processo = limparValorDoProcesso(valor);
    }

    if (rotulo === "descricao") {
      registroAtual.descricao = normalizarTexto(valor);
    }
  });

  if (registroAtual.processo || registroAtual.descricao) {
    registros.push(registroAtual);
  }

  return (
    registros.find(
      ({ processo, descricao }) => Boolean(processo && descricao),
    ) || null
  );
}

// Normaliza o nome do órgão para permitir comparações mesmo quando o portal
// apresenta diferenças de acentuação, código ou palavras de ligação.
function normalizarOrgao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Normaliza a Fonte, incluindo a variação "No"/"Não" que o portal apresenta
// em alguns registros com caracteres acentuados corrompidos.
function normalizarFonte(texto = "") {
  return normalizarOrgao(texto)
    .replace(/^[\d.]+\s*[-.)]\s*/, "")
    .replace(/[�?]/g, "a")
    .replace(/\bno\b/g, "nao");
}

function fontesCorrespondem(fonteEsperada, fonteRetornada) {
  const esperado = normalizarFonte(fonteEsperada);
  const retornado = normalizarFonte(fonteRetornada);

  return esperado === retornado || esperado.includes(retornado);
}

function normalizarCategoriaEconomica(texto = "") {
  return normalizarOrgao(texto).replace(/^[\d.]+\s*[-.)]\s*/, "");
}

function categoriasEconomicasCorrespondem(
  categoriaEsperada,
  categoriaRetornada,
) {
  const esperado = normalizarCategoriaEconomica(categoriaEsperada);
  const retornado = normalizarCategoriaEconomica(categoriaRetornada);

  return esperado === retornado || esperado.includes(retornado);
}

function normalizarGrupo(texto = "") {
  return normalizarOrgao(texto).replace(/^[\d.]+\s*[-.)]\s*/, "");
}

function gruposCorrespondem(grupoEsperado, grupoRetornado) {
  const esperado = normalizarGrupo(grupoEsperado);
  const retornado = normalizarGrupo(grupoRetornado);

  return esperado === retornado || esperado.includes(retornado);
}

function normalizarModalidade(texto = "") {
  return normalizarOrgao(texto).replace(/^[\d.]+\s*[-.)]\s*/, "");
}

function modalidadesCorrespondem(modalidadeEsperada, modalidadeRetornada) {
  const esperado = normalizarModalidade(modalidadeEsperada);
  const retornado = normalizarModalidade(modalidadeRetornada);

  return esperado === retornado || esperado.includes(retornado);
}

function normalizarElemento(texto = "") {
  return normalizarOrgao(texto).replace(/^[\d.]+\s*[-.)]\s*/, "");
}

function elementosCorrespondem(elementoEsperado, elementoRetornado) {
  const esperado = normalizarElemento(elementoEsperado);
  const retornado = normalizarElemento(elementoRetornado);

  return (
    esperado === retornado ||
    esperado.includes(retornado) ||
    retornado.includes(esperado)
  );
}

// O Elemento corresponde à quarta parte do código da natureza da despesa
// (por exemplo, 3.1.90.11.05 -> 11).
function obterNumeroDoElemento(elemento) {
  const codigo = normalizarTexto(elemento).match(/^\d+(?:\.\d+)+/)?.[0];
  return codigo?.split(".")[3] || "";
}

function obterNumeroDoElementoParaComparacao(elemento) {
  const codigo = normalizarTexto(elemento).match(/^\d+(?:\.\d+)*/)?.[0];
  const partes = codigo?.split(".") || [];
  return partes.length >= 4 ? partes[3] : partes[0] || "";
}

function elementosCorrespondemPorNumero(elementoEsperado, elementoRetornado) {
  const numeroEsperado = obterNumeroDoElementoParaComparacao(elementoEsperado);
  const numeroRetornado =
    obterNumeroDoElementoParaComparacao(elementoRetornado);

  return (
    (numeroEsperado && numeroEsperado === numeroRetornado) ||
    elementosCorrespondem(elementoEsperado, elementoRetornado)
  );
}

// Retira o código numérico exibido antes do nome do órgão, quando existir.
function removerCodigoDoOrgao(texto = "") {
  return normalizarOrgao(texto).replace(/^\d+\s*[-.)]\s*/, "");
}

// Compara os termos importantes do órgão sem depender da formatação exata do
// texto exibido no detalhamento ou na opção do select avançado.
function orgaosCorrespondem(orgaoEsperado, orgaoRetornado) {
  const esperado = removerCodigoDoOrgao(orgaoEsperado);
  const retornado = removerCodigoDoOrgao(orgaoRetornado);

  if (esperado === retornado || esperado.includes(retornado)) {
    return true;
  }

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
  const termosEsperados = esperado
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((termo) => termo.length > 2 && !palavrasIgnoradas.has(termo));
  const termosRetornados = retornado
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);

  return termosEsperados.every((termo) => termosRetornados.includes(termo));
}

// Identifica somente linhas que representam despesas renderizadas, excluindo
// o cabeçalho de carregamento que o componente Table mantém durante a consulta.
function ehLinhaDeDados(linha) {
  return (
    !["not-found-line", "template_row"].includes(linha.id) &&
    !linha.classList.contains("tb-load") &&
    linha.querySelector(".colNumero")
  );
}

function obterLinhasDeDadosAtuais() {
  return cy
    .get(".cont_dados .tb", { timeout: LISTAGEM_TIMEOUT })
    .then(($tabela) =>
      cy.wrap(Array.from($tabela.find("tr[id]")).filter(ehLinhaDeDados), {
        log: false,
      }),
    );
}

// Converte um valor no padrão monetário brasileiro para comparação numérica.
function converterValorMonetario(valor) {
  const valorNormalizado = normalizarTexto(valor).replace(/[^\d,.-]/g, "");

  if (!valorNormalizado) {
    return NaN;
  }

  return valorNormalizado.includes(",")
    ? Number(valorNormalizado.replace(/\./g, "").replace(",", "."))
    : Number(valorNormalizado);
}

function formatarValorMonetario(valor) {
  return valor
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Obtém o Valor Empenhado diretamente da primeira linha real da listagem.
function obterValorEmpenhadoDaListagem() {
  return obterLinhasDeDadosAtuais().then((linhas) => {
    const valorTexto = normalizarTexto(
      Cypress.$(linhas[0]).find(".colValor").text(),
    );
    const valorNumerico = converterValorMonetario(valorTexto);

    expect(valorTexto, "Valor Empenhado disponível na listagem").to.not.equal(
      "",
    );
    expect(valorNumerico, "Valor Empenhado numérico disponível na listagem").to
      .be.finite;

    return cy.wrap(
      { texto: valorTexto, numerico: valorNumerico },
      { log: false },
    );
  });
}

// Preenche o intervalo com o mesmo valor real lido da listagem, permitindo
// conferir se a pesquisa retorna somente registros com esse empenhado.
function preencherValorEmpenhadoNoFiltro(valor) {
  ["#valor_empenhado_min", "#valor_empenhado_max"].forEach((seletor) => {
    cy.get(`.form_busca ${seletor}`)
      .clear({ force: true })
      .type(valor, { force: true })
      .should(($campo) => {
        expect($campo.val(), `valor preenchido em ${seletor}`).to.not.equal("");
      });
  });
}

// Confirma que todos os registros retornados respeitam o valor pesquisado.
function validarValoresEmpenhadosRetornados(valorEsperado) {
  obterLinhasDeDadosAtuais().then((linhas) => {
    expect(
      linhas.length,
      "registros retornados pelo filtro de Valor Empenhado",
    ).to.be.greaterThan(0);

    Array.from(linhas).forEach((linha, indice) => {
      const texto = normalizarTexto(Cypress.$(linha).find(".colValor").text());
      const valor = converterValorMonetario(texto);

      expect(texto, `Valor Empenhado do registro ${indice + 1}`).to.not.equal(
        "",
      );
      expect(
        valor,
        `Valor Empenhado do registro ${indice + 1} atende ao filtro`,
      ).to.equal(valorEsperado);
    });
  });
}

// Obtém o Valor Liquidado diretamente da primeira linha real da listagem.
function obterValorLiquidadoDaListagem() {
  return obterLinhasDeDadosAtuais().then((linhas) => {
    const valorTexto = normalizarTexto(
      Cypress.$(linhas[0]).find(".colLiquidado").text(),
    );
    const valorNumerico = converterValorMonetario(valorTexto);

    expect(valorTexto, "Valor Liquidado disponível na listagem").to.not.equal(
      "",
    );
    expect(valorNumerico, "Valor Liquidado numérico disponível na listagem").to
      .be.finite;

    return cy.wrap(
      { texto: valorTexto, numerico: valorNumerico },
      { log: false },
    );
  });
}

// Preenche o intervalo com o mesmo valor real lido da listagem, permitindo
// conferir se a pesquisa retorna somente registros com esse liquidado.
function preencherValorLiquidadoNoFiltro(valor) {
  ["#valor_liquidado_min", "#valor_liquidado_max"].forEach((seletor) => {
    cy.get(`.form_busca ${seletor}`)
      .clear({ force: true })
      .type(valor, { force: true })
      .should(($campo) => {
        expect($campo.val(), `valor preenchido em ${seletor}`).to.not.equal("");
      });
  });
}

// Confirma que todos os registros retornados respeitam o valor pesquisado.
function validarValoresLiquidadosRetornados(valorEsperado) {
  obterLinhasDeDadosAtuais().then((linhas) => {
    expect(
      linhas.length,
      "registros retornados pelo filtro de Valor Liquidado",
    ).to.be.greaterThan(0);

    Array.from(linhas).forEach((linha, indice) => {
      const texto = normalizarTexto(
        Cypress.$(linha).find(".colLiquidado").text(),
      );
      const valor = converterValorMonetario(texto);

      expect(texto, `Valor Liquidado do registro ${indice + 1}`).to.not.equal(
        "",
      );
      expect(
        valor,
        `Valor Liquidado do registro ${indice + 1} atende ao filtro`,
      ).to.equal(valorEsperado);
    });
  });
}

// Obtém o Valor Pago diretamente da primeira linha real da listagem.
function obterValorPagoDaListagem() {
  return obterLinhasDeDadosAtuais().then((linhas) => {
    const valorTexto = normalizarTexto(
      Cypress.$(linhas[0]).find(".colPagamento").text(),
    );
    const valorNumerico = converterValorMonetario(valorTexto);

    expect(valorTexto, "Valor Pago disponível na listagem").to.not.equal("");
    expect(valorNumerico, "Valor Pago numérico disponível na listagem").to.be
      .finite;

    return cy.wrap(
      { texto: valorTexto, numerico: valorNumerico },
      { log: false },
    );
  });
}

// Preenche o intervalo com o mesmo valor real lido da listagem, permitindo
// conferir se a pesquisa retorna somente registros com esse pago.
function preencherValorPagoNoFiltro(valor) {
  ["#valor_pago_min", "#valor_pago_max"].forEach((seletor) => {
    cy.get(`.form_busca ${seletor}`)
      .clear({ force: true })
      .type(valor, { force: true })
      .should(($campo) => {
        expect($campo.val(), `valor preenchido em ${seletor}`).to.not.equal("");
      });
  });
}

// Confirma que todos os registros retornados respeitam o valor pesquisado.
function validarValoresPagosRetornados(valorEsperado) {
  obterLinhasDeDadosAtuais().then((linhas) => {
    expect(
      linhas.length,
      "registros retornados pelo filtro de Valor Pago",
    ).to.be.greaterThan(0);

    Array.from(linhas).forEach((linha, indice) => {
      const texto = normalizarTexto(
        Cypress.$(linha).find(".colPagamento").text(),
      );
      const valor = converterValorMonetario(texto);

      expect(texto, `Valor Pago do registro ${indice + 1}`).to.not.equal("");
      expect(
        valor,
        `Valor Pago do registro ${indice + 1} atende ao filtro`,
      ).to.equal(valorEsperado);
    });
  });
}

// Converte uma data brasileira para um número ordenável, facilitando a
// comparação dos registros retornados com os limites do filtro.
function converterDataParaNumero(data) {
  const [dia, mes, ano] = normalizarTexto(data).split("/").map(Number);

  return Number(
    `${ano}${String(mes).padStart(2, "0")}${String(dia).padStart(2, "0")}`,
  );
}

// Captura a data do primeiro registro real da listagem para usar como massa
// dinâmica do teste, sem deixar uma data fixa no código.
function obterDataDoPrimeiroRegistro() {
  return cy
    .get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => ehLinhaDeDados(linha))
    .first()
    .find(".colData")
    .invoke("text")
    .then((texto) => {
      const data = normalizarTexto(texto);

      expect(data, "Data disponível no registro").to.match(
        /^\d{2}\/\d{2}\/\d{4}$/,
      );
      return data;
    });
}

// Captura a data no detalhamento do registro filtrado, em vez de confiar
// somente na data exibida na linha da tabela.
function obterDataDoDetalhamento() {
  return cy
    .get(".cont_right #data", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const data = normalizarTexto(
        $campo.val() || $campo.attr("value") || $campo.text(),
      );

      expect(data, "Data disponível no detalhamento").to.match(
        /^\d{2}\/\d{2}\/\d{4}$/,
      );
      return data;
    });
}

// Aguarda a tabela inicial antes de abrir o popup avançado.
function aguardarListagem() {
  aguardarLoadFinalizar();
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => ehLinhaDeDados(linha))
    .should("have.length.at.least", 1);
}

// Aguarda a consulta após o botão de pesquisa terminar de renderizar a tabela.
function aguardarRetornoDoFiltro() {
  aguardarLoadFinalizar();
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
}

// Abre o popup e garante que o formulário avançado está pronto para interação.
function abrirFiltroAvancado() {
  cy.get("#busca_avancada").should("be.visible").click({ force: true });
  cy.get(".form_busca", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
}

function baixarHtmlDoRelatorio() {
  const nomesDeArquivo = [
    "relatorio-despesas.html",
    "relatório-despesas.html",
  ];

  cy.task("removeDownloadedFiles", { fileNames: nomesDeArquivo });
  cy.get("#exportar button.export, #exportar .export", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .filter(":visible")
    .first()
    .should("be.visible")
    .click({ force: true });

  return cy
    .get("#exportar .btt_options a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .then(($opcoes) => {
      const opcaoHtml = Array.from($opcoes).find((opcao) =>
        /html/i.test(normalizarTexto(opcao.textContent)),
      );

      expect(opcaoHtml, "opção HTML disponível para download").to.exist;
      cy.wrap(opcaoHtml).click({ force: true });
    })
    .then(() =>
      cy.task("readDownloadedFile", { fileNames: nomesDeArquivo }, {
        timeout: LISTAGEM_TIMEOUT,
      }),
    );
}

function baixarHtmlDasDespesas() {
  return baixarHtmlDoRelatorio().then(({ content, fileName }) => {
      const processo = extrairProcessoDoHtml(content);

      expect(
        processo,
        `processo preenchido encontrado em ${fileName}`,
      ).to.not.equal("");
      cy.log(`Processo encontrado no HTML: ${processo}`);

      return cy.wrap(processo, { log: false });
    });
}

function preencherProcessoAvancado(processoEsperado) {
  return cy
    .get(".form_busca", { timeout: LISTAGEM_TIMEOUT })
    .then(($formulario) => {
      const $campo = localizarCampoDeProcesso($formulario);

      expect(
        $campo.length,
        "campo Processo disponível no filtro avançado",
      ).to.be.greaterThan(0);

      return cy
        .wrap($campo)
        .clear({ force: true })
        .type(processoEsperado, { force: true })
        .then(() => {
          const $opcoes = Cypress.$(
            "ul.ui-autocomplete:visible li.ui-menu-item .ui-menu-item-wrapper",
          );

          if (!$opcoes.length) {
            return;
          }

          const opcao =
            Array.from($opcoes).find((elemento) =>
              processosCorrespondem(processoEsperado, elemento.textContent),
            ) || $opcoes[0];

          return cy.wrap(opcao).click({ force: true });
        })
        .then(() =>
          cy.wrap($campo).should(($valor) => {
            expect(
              processosCorrespondem(processoEsperado, obterValorDeCampo($valor)),
              `processo preenchido no filtro: ${processoEsperado}`,
            ).to.equal(true);
          }),
        );
    });
}

function preencherHistoricoAvancado(historicoEsperado) {
  cy.get(".form_busca #historico")
    .clear({ force: true })
    .type(historicoEsperado, {
      force: true,
      parseSpecialCharSequences: false,
    })
    .should("have.value", historicoEsperado);
}

// Abre o detalhamento da linha indicada para buscar o empenho em uma fonte
// oficial do registro, sem fixar números no código do teste.
function abrirDetalhamentoDaLinha(indice = 0) {
  cy.get(".cont_dados .tb tr[id]")
    .filter((_, linha) => ehLinhaDeDados(linha))
    .eq(indice)
    .find(".colNumero")
    .click({ force: true });

  cy.url({ timeout: LISTAGEM_TIMEOUT }).should(
    "include",
    "/transparencia/despesa_frl/",
  );
  aguardarLoadFinalizar();
  cy.get(".cont_right .cnt", { timeout: LISTAGEM_TIMEOUT }).should(
    "be.visible",
  );
}

// Captura o número exibido no título do detalhamento, depois que a API termina
// de preencher os campos do empenho.
function obterNumeroDoDetalhamento() {
  return cy
    .get("#orgao", { timeout: LISTAGEM_TIMEOUT })
    .should("exist")
    .then(() =>
      cy
        .get(".cont_right h2", { timeout: LISTAGEM_TIMEOUT })
        .invoke("text")
        .then((texto) => {
          const numero = normalizarTexto(texto).match(/(\d+)\s*$/)?.[1];

          expect(numero, "Nº Empenho disponível no detalhamento").to.exist;
          return numero;
        }),
    );
}

function obterProcessoDoDetalhamento() {
  return cy
    .get(".cont_right .cnt", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .should(($detalhamento) => {
      expect(
        localizarCampoDeProcesso($detalhamento).length,
        "campo Processo carregado no detalhamento",
      ).to.be.greaterThan(0);
    })
    .then(($detalhamento) => {
      const $campo = localizarCampoDeProcesso($detalhamento);

      expect(
        $campo.length,
        "campo Processo disponível no detalhamento",
      ).to.be.greaterThan(0);

      const processo = obterValorDeCampo($campo);

      expect(processo, "processo disponível no detalhamento").to.not.equal("");
      return cy.wrap(processo, { log: false });
    });
}

function obterDescricaoDoDetalhamento() {
  return cy
    .get(".cont_right .campo.area #desc", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .invoke("text")
    .then((texto) => {
      const descricao = normalizarTexto(texto);

      expect(descricao, "Descrição / Histórico disponível no detalhamento").to
        .not.equal("");
      return descricao;
    });
}

// Captura o órgão exibido no detalhamento do empenho consultado.
function obterOrgaoDoDetalhamento() {
  return cy
    .get("#orgao", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .invoke("text")
    .then((texto) => {
      const orgao = normalizarTexto(texto);

      expect(orgao, "Órgão disponível no detalhamento").to.not.equal("");
      return orgao;
    });
}

// Captura a Unidade exibida no detalhamento do empenho para usar um valor real
// na pesquisa do filtro avançado.
function obterUnidadeDoDetalhamento() {
  return cy
    .get("#unidade", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const unidade = normalizarTexto(
        $campo.val() || $campo.attr("value") || $campo.text(),
      );

      expect(unidade, "Unidade disponível no detalhamento").to.not.equal("");
      return unidade;
    });
}

// Captura a Função exibida no detalhamento para usar um valor real na pesquisa.
function obterFuncaoDoDetalhamento() {
  return cy
    .get("#funcao", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($campo) => {
      const funcao = normalizarTexto(
        $campo.val() || $campo.attr("value") || $campo.text(),
      );

      expect(funcao, "Função disponível no detalhamento").to.not.equal("");
      return funcao;
    });
}

// Captura o Programa exibido no detalhamento para usar um valor real na
// pesquisa do filtro avançado.
function obterProgramaDoDetalhamento() {
  return cy
    .get("#programa", { timeout: LISTAGEM_TIMEOUT })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .then(($campo) => {
      const programa = normalizarTexto(
        $campo.val() || $campo.attr("value") || $campo.text(),
      );

      expect(programa, "Programa disponível no detalhamento").to.not.equal("");
      return programa;
    });
}

// Captura a Ação exibida no detalhamento para usar um valor real na pesquisa
// do filtro avançado.
function obterAcaoDoDetalhamento() {
  return cy
    .get("#acao", { timeout: LISTAGEM_TIMEOUT })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .then(($campo) => {
      const acao = normalizarTexto(
        $campo.val() || $campo.attr("value") || $campo.text(),
      );

      expect(acao, "Ação disponível no detalhamento").to.not.equal("");
      return acao;
    });
}

// Captura a Fonte exibida no detalhamento para usar um valor real na pesquisa
// do filtro avançado.
function obterFonteDoDetalhamento() {
  return cy
    .get("#fonte", { timeout: LISTAGEM_TIMEOUT })
    .scrollIntoView({ duration: 0 })
    .should("be.visible")
    .then(($campo) => {
      const fonte = normalizarTexto(
        $campo.val() || $campo.attr("value") || $campo.text(),
      );

      expect(fonte, "Fonte disponível no detalhamento").to.not.equal("");
      return fonte;
    });
}

function localizarCampoCategoriaEconomicaNoDetalhamento($detalhamento) {
  const $raiz = Cypress.$($detalhamento);
  let $campo = $raiz
    .find(
      '#categoria_economica, #categoria, [id*="categoria"], [name*="categoria"]',
    )
    .first();

  if (!$campo.length) {
    const rotulo = Array.from($raiz.find("label")).find(
      (elemento) =>
        normalizarOrgao(elemento.textContent).replace(/[\s-]/g, "") ===
        "categoriaeconomica",
    );

    if (rotulo) {
      $campo = Cypress.$(rotulo)
        .closest(".campo")
        .find("input, textarea, select, .input, [id], [name]")
        .not("label")
        .first();
    }
  }

  return $campo;
}

// Captura a Categoria Econômica exibida no detalhamento para usar um valor
// real na pesquisa do filtro avançado.
function obterCategoriaEconomicaDoDetalhamento() {
  cy.get("#orgao", { timeout: LISTAGEM_TIMEOUT }).should("exist");

  return cy
    .get(".cont_right", { timeout: LISTAGEM_TIMEOUT })
    .should(($detalhamento) => {
      expect(
        localizarCampoCategoriaEconomicaNoDetalhamento($detalhamento).length,
        "campo Categoria Econômica disponível no detalhamento",
      ).to.be.greaterThan(0);
    })
    .then(($detalhamento) => {
      const $campo =
        localizarCampoCategoriaEconomicaNoDetalhamento($detalhamento);

      return cy
        .wrap($campo)
        .scrollIntoView({ duration: 0 })
        .should("be.visible")
        .then(($valor) => {
          const categoria = normalizarTexto(
            $valor.val() || $valor.attr("value") || $valor.text(),
          );

          expect(
            categoria,
            "Categoria Econômica disponível no detalhamento",
          ).to.not.equal("");
          return categoria;
        });
    });
}

function localizarCampoGrupoNoDetalhamento($detalhamento) {
  const $raiz = Cypress.$($detalhamento);
  let $campo = $raiz.find('#grupo, [id*="grupo"], [name*="grupo"]').first();

  if (!$campo.length) {
    const rotulo = Array.from($raiz.find("label")).find(
      (elemento) =>
        normalizarOrgao(elemento.textContent).replace(/[\s-]/g, "") === "grupo",
    );

    if (rotulo) {
      $campo = Cypress.$(rotulo)
        .closest(".campo")
        .find("input, textarea, select, .input, [id], [name]")
        .not("label")
        .first();
    }
  }

  return $campo;
}

// Captura o Grupo exibido no detalhamento para usar um valor real na pesquisa
// do filtro avançado.
function obterGrupoDoDetalhamento() {
  cy.get("#orgao", { timeout: LISTAGEM_TIMEOUT }).should("exist");

  return cy
    .get(".cont_right", { timeout: LISTAGEM_TIMEOUT })
    .should(($detalhamento) => {
      expect(
        localizarCampoGrupoNoDetalhamento($detalhamento).length,
        "campo Grupo disponível no detalhamento",
      ).to.be.greaterThan(0);
    })
    .then(($detalhamento) => {
      const $campo = localizarCampoGrupoNoDetalhamento($detalhamento);

      return cy
        .wrap($campo)
        .scrollIntoView({ duration: 0 })
        .should("be.visible")
        .then(($valor) => {
          const grupo = normalizarTexto(
            $valor.val() || $valor.attr("value") || $valor.text(),
          );

          expect(grupo, "Grupo disponível no detalhamento").to.not.equal("");
          return grupo;
        });
    });
}

function localizarCampoElementoNoDetalhamento($detalhamento) {
  const $raiz = Cypress.$($detalhamento);
  let $campo = $raiz
    .find('#elemento, [id*="elemento"], [name*="elemento"]')
    .first();

  if (!$campo.length) {
    const rotulo = Array.from($raiz.find("label")).find((elemento) => {
      const rotuloNormalizado = normalizarOrgao(elemento.textContent).replace(
        /[\s-]/g,
        "",
      );

      return rotuloNormalizado === "elemento";
    });

    if (rotulo) {
      $campo = Cypress.$(rotulo)
        .closest(".campo")
        .find("input, textarea, select, .input, [id], [name]")
        .not("label")
        .first();
    }
  }

  return $campo;
}

// Obtém a terceira parte do código do Elemento, que corresponde à Modalidade
// de Aplicação (por exemplo, 3.1.90.11.05 -> 90).
function obterNumeroDaModalidadeAplicacao(elemento) {
  const codigo = normalizarTexto(elemento).match(/^\d+(?:\.\d+)+/)?.[0];
  return codigo?.split(".")[2] || "";
}

function obterNumeroDoCodigoDaModalidade(texto) {
  const codigo = normalizarTexto(texto).match(/^\d+(?:\.\d+)*/)?.[0];
  return codigo?.split(".").pop() || "";
}

function modalidadesCorrespondemPorNumero(
  modalidadeEsperada,
  modalidadeRetornada,
) {
  const numeroEsperado = obterNumeroDoCodigoDaModalidade(modalidadeEsperada);
  const numeroRetornado = obterNumeroDoCodigoDaModalidade(modalidadeRetornada);

  return (
    (numeroEsperado && numeroEsperado === numeroRetornado) ||
    modalidadesCorrespondem(modalidadeEsperada, modalidadeRetornada)
  );
}

// Captura o Elemento exibido no detalhamento para usar o mesmo valor real na
// pesquisa do filtro avançado.
function obterElementoDoDetalhamento() {
  cy.get("#orgao", { timeout: LISTAGEM_TIMEOUT }).should("exist");

  return cy
    .get(".cont_right", { timeout: LISTAGEM_TIMEOUT })
    .then(($detalhamento) => {
      const $campo = localizarCampoElementoNoDetalhamento($detalhamento);

      if (!$campo.length) {
        const mensagem =
          "ALERTA: Elemento não é exibido no detalhamento Fiorilli deste ambiente.";
        Cypress.log({
          name: "ALERTA",
          message: mensagem,
          consoleProps: () => ({
            campo: "Elemento",
            resultado: "não disponível no detalhamento",
          }),
        });
        cy.log(mensagem);
        return null;
      }

      return cy
        .wrap($campo)
        .scrollIntoView({ duration: 0 })
        .should("be.visible")
        .then(($valor) => {
          const elemento = normalizarTexto(
            $valor.val() || $valor.attr("value") || $valor.text(),
          );

          expect(elemento, "Elemento disponível no detalhamento").to.not.equal(
            "",
          );
          return elemento;
        });
    });
}

// Deriva a Modalidade de Aplicação da terceira parte do Elemento.
function obterModalidadeDoDetalhamento() {
  return obterElementoDoDetalhamento().then((elemento) => {
    if (!elemento) {
      return null;
    }

    const modalidade = obterNumeroDaModalidadeAplicacao(elemento);
    expect(
      modalidade,
      `Modalidade de Aplicação disponível no Elemento "${elemento}"`,
    ).to.not.equal("");
    return modalidade;
  });
}

// Captura a Subfunção exibida no detalhamento para usar um valor real na
// pesquisa do filtro avançado.
function localizarCampoSubfuncaoNoDetalhamento($detalhamento) {
  const $raiz = Cypress.$($detalhamento);
  let $campo = $raiz
    .find('#subfuncao, #sub_funcao, [id*="subfunc"], [name*="subfunc"]')
    .first();

  if (!$campo.length) {
    const rotulo = Array.from($raiz.find("label")).find(
      (elemento) =>
        normalizarOrgao(elemento.textContent).replace(/[\s-]/g, "") ===
        "subfuncao",
    );

    if (rotulo) {
      $campo = Cypress.$(rotulo)
        .closest(".campo")
        .find("input, textarea, select, .input, [id], [name]")
        .not("label")
        .first();
    }
  }

  return $campo;
}

function obterSubfuncaoDoDetalhamento() {
  cy.get("#orgao", { timeout: LISTAGEM_TIMEOUT }).should("exist");

  return cy
    .get(".cont_right", { timeout: LISTAGEM_TIMEOUT })
    .should(($detalhamento) => {
      expect(
        localizarCampoSubfuncaoNoDetalhamento($detalhamento).length,
        "campo Subfunção disponível no detalhamento",
      ).to.be.greaterThan(0);
    })
    .then(($detalhamento) => {
      const $campo = localizarCampoSubfuncaoNoDetalhamento($detalhamento);

      return cy
        .wrap($campo)
        .scrollIntoView({ duration: 0 })
        .should("be.visible")
        .then(($valor) => {
          const subfuncao = normalizarTexto(
            $valor.val() || $valor.attr("value") || $valor.text(),
          );

          expect(
            subfuncao,
            "Subfunção disponível no detalhamento",
          ).to.not.equal("");
          return subfuncao;
        });
    });
}

// Captura o Favorecido exibido no detalhamento do empenho consultado.
function obterFavorecidoDoDetalhamento() {
  return cy
    .get("#fornecedor", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .invoke("text")
    .then((texto) => {
      const favorecido = normalizarTexto(texto);

      expect(favorecido, "Favorecido disponível no detalhamento").to.not.equal(
        "",
      );
      return favorecido;
    });
}

// Remove pontos, barras, hífens e qualquer outro caractere do documento
// exibido no detalhamento, deixando somente os dígitos usados na comparação.
function normalizarCpfCnpj(documento = "") {
  return String(documento).replace(/\D/g, "");
}

// Captura o CPF/CNPJ mascarado exibido no detalhamento do empenho.
function obterCpfCnpjDoDetalhamento() {
  return cy
    .get("#cnpj", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .invoke("text")
    .then((texto) => {
      const documento = normalizarCpfCnpj(texto);

      expect(documento, "CPF/CNPJ disponível no detalhamento").to.match(
        /^(\d{11}|\d{14})$/,
      );
      return documento;
    });
}

// Volta pela ação oficial do detalhamento e aguarda novamente a tabela pronta.
function retornarParaListagem() {
  cy.get("#voltar-list", { timeout: LISTAGEM_TIMEOUT })
    .should("exist")
    .click({ force: true });
  cy.url({ timeout: LISTAGEM_TIMEOUT }).should(
    "match",
    /\/transparencia\/despesas_frl$/,
  );
  aguardarLoadFinalizar();
  aguardarListagem();
}

// Escolhe uma opção visível em um Select customizado dentro do popup.
function selecionarOpcaoAvancada(containerSelector, textoOpcao) {
  cy.get(`.form_busca ${containerSelector}`)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });
  cy.get(`.form_busca ${containerSelector} .options`, {
    timeout: LISTAGEM_TIMEOUT,
  }).should("be.visible");
  cy.contains(`.form_busca ${containerSelector} .options .list a`, textoOpcao, {
    matchCase: false,
  }).click({ force: true });
}

// Seleciona no filtro avançado a opção de órgão correspondente ao registro.
// A busca prioriza o código do órgão e usa o nome como fallback para tratar
// pequenas diferenças de escrita entre detalhamento e lista de opções.
function selecionarOrgaoAvancado(orgaoEsperado) {
  const codigoOrgao = normalizarTexto(orgaoEsperado).match(/^\d+/)?.[0];
  const containerSelector = "#select_org_avanc";

  cy.get(`.form_busca ${containerSelector}`)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });
  cy.get(`.form_busca ${containerSelector} .options`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .find(".list a")
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcoes = Array.from($opcoes);
      const opcao =
        opcoes.find(
          (elemento) =>
            codigoOrgao &&
            elemento.getAttribute("href")?.replace(/^#/, "") === codigoOrgao,
        ) ||
        opcoes.find((elemento) =>
          orgaosCorrespondem(orgaoEsperado, elemento.textContent),
        );

      expect(opcao, `Órgão "${orgaoEsperado}" disponível no filtro`).to.exist;
      cy.wrap(opcao).click({ force: true });
    });
}

// Seleciona no filtro avançado a opção de Unidade correspondente ao registro
// aberto. O portal pode mostrar código e descrição em formatos diferentes,
// por isso a comparação usa a mesma normalização aplicada ao órgão.
function selecionarUnidadeAvancado(unidadeEsperada) {
  const termoPesquisa = unidadeEsperada.replace(/^\d+\s*[-.)]\s*/, "");

  cy.get(".form_busca #select_unidade")
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  // Unidade é um autocomplete: as opções só aparecem depois da pesquisa no
  // campo interno "Buscar".
  cy.get(".form_busca #select_unidade .options", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .find("input:visible")
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });

  cy.get(".form_busca #select_unidade .options .icon-lupa:visible", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });

  return cy
    .get(".form_busca #select_unidade .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        orgaosCorrespondem(unidadeEsperada, elemento.textContent),
      );

      expect(opcao, `Unidade "${unidadeEsperada}" disponível no filtro`).to
        .exist;

      const textoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy
        .get(".form_busca #select_unidade .selected")
        .should("contain", textoSelecionado)
        .then(() => cy.wrap(textoSelecionado, { log: false }));
    });
}

// Seleciona no filtro avançado a opção de Função correspondente ao registro
// aberto e confirma o texto mostrado no select.
function selecionarFuncaoAvancado(funcaoEsperada) {
  const descricaoFuncao = funcaoEsperada.replace(/^\d+\s*[-.)]\s*/, "");
  const termoPesquisa = descricaoFuncao.split(" ")[0];

  cy.get(".form_busca #select_funcao")
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  // Função é um autocomplete: a lista inicial pode conter somente algumas
  // opções e a pesquisa interna carrega a descrição obtida no detalhamento.
  cy.get(".form_busca #select_funcao .options", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .find("input:visible")
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });

  cy.get(".form_busca #select_funcao .options .icon-lupa:visible", {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });

  return cy
    .get(".form_busca #select_funcao .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        orgaosCorrespondem(funcaoEsperada, elemento.textContent),
      );

      expect(opcao, `Função "${funcaoEsperada}" disponível no filtro`).to.exist;

      const textoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy
        .get(".form_busca #select_funcao .selected")
        .should("contain", textoSelecionado)
        .then(() => cy.wrap(textoSelecionado, { log: false }));
    });
}

// Seleciona no filtro avançado o Programa correspondente ao registro aberto e
// confirma o texto mostrado no select.
function selecionarProgramaAvancado(programaEsperado) {
  const descricaoPrograma = programaEsperado.replace(/^\d+\s*[-.)]\s*/, "");
  const termoPesquisa = descricaoPrograma.split(" ")[0];
  const containerSelector = "#select_programa";

  cy.get(`.form_busca ${containerSelector}`)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  cy.get(`.form_busca ${containerSelector} .options`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .find("input:visible")
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });

  cy.get(`.form_busca ${containerSelector} .options .icon-lupa:visible`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });

  return cy
    .get(`.form_busca ${containerSelector} .options .list a:visible`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        orgaosCorrespondem(programaEsperado, elemento.textContent),
      );

      expect(opcao, `Programa "${programaEsperado}" disponível no filtro`).to
        .exist;

      const textoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy
        .get(`.form_busca ${containerSelector} .selected`)
        .should("contain", textoSelecionado)
        .then(() => cy.wrap(textoSelecionado, { log: false }));
    });
}

// Seleciona no filtro avançado a Ação correspondente ao registro aberto e
// confirma o texto mostrado no select.
function selecionarAcaoAvancado(acaoEsperada) {
  const codigoAcao = normalizarTexto(acaoEsperada).match(/^\d+/)?.[0];
  const descricaoAcao = acaoEsperada.replace(/^\d+\s*[-.)]\s*/, "");
  const termosIgnorados = new Set([
    "a",
    "ao",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
  ]);
  const termoPesquisa =
    descricaoAcao
      .split(/\s+/)
      .filter((termo) => {
        const termoLimpo = termo.replace(/[^a-zA-ZÀ-ÿ]/g, "").toLowerCase();
        return termoLimpo.length > 3 && !termosIgnorados.has(termoLimpo);
      })
      .sort((primeiro, segundo) => segundo.length - primeiro.length)[0] ||
    descricaoAcao;
  const containerSelector = "#select_atividade";

  cy.get(`.form_busca ${containerSelector}`)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  cy.get(`.form_busca ${containerSelector} .options`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .find("input:visible")
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });

  cy.get(`.form_busca ${containerSelector} .options .icon-lupa:visible`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });

  return cy
    .get(`.form_busca ${containerSelector} .options .list a:visible`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcoes = Array.from($opcoes);
      const opcao =
        opcoes.find(
          (elemento) =>
            codigoAcao &&
            (elemento.getAttribute("href")?.replace(/^#/, "") === codigoAcao ||
              normalizarOrgao(elemento.textContent).startsWith(
                `${codigoAcao} -`,
              )),
        ) ||
        opcoes.find((elemento) =>
          orgaosCorrespondem(acaoEsperada, elemento.textContent),
        );

      if (!opcao) {
        cy.log(`Ação indisponível no filtro: ${acaoEsperada}`);
        return cy.wrap(null, { log: false });
      }

      const textoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy
        .get(`.form_busca ${containerSelector} .selected`)
        .should("contain", textoSelecionado)
        .then(() => cy.wrap(textoSelecionado, { log: false }));
    });
}

// Seleciona no filtro avançado a Fonte correspondente ao registro aberto e
// confirma o texto mostrado no select.
function selecionarFonteAvancado(fonteEsperada) {
  const codigoFonte = normalizarTexto(fonteEsperada).match(/^[\d.]+/)?.[0];
  const descricaoFonte = fonteEsperada.replace(/^[\d.]+\s*[-.)]\s*/, "");
  const termosIgnorados = new Set([
    "a",
    "ao",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
  ]);
  const termoPesquisa =
    descricaoFonte
      .split(/\s+/)
      .filter((termo) => {
        const termoLimpo = termo.replace(/[^a-zA-ZÀ-ÿ]/g, "").toLowerCase();
        return termoLimpo.length > 3 && !termosIgnorados.has(termoLimpo);
      })
      .sort((primeiro, segundo) => segundo.length - primeiro.length)[0] ||
    codigoFonte ||
    descricaoFonte;
  const containerSelector = "#select_fonte";

  cy.get(`.form_busca ${containerSelector}`)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  cy.get(`.form_busca ${containerSelector} .options`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .find("input:visible")
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });

  cy.get(`.form_busca ${containerSelector} .options .icon-lupa:visible`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });

  return cy
    .get(`.form_busca ${containerSelector} .options .list a:visible`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const descricaoEsperada = normalizarFonte(fonteEsperada);
      const codigoEsperado = codigoFonte
        ?.split(".")
        .map((parte) => String(Number(parte)))
        .join(".");
      const opcao = Array.from($opcoes).find((elemento) => {
        const textoOpcao = normalizarTexto(elemento.textContent);
        const descricaoOpcao = normalizarFonte(textoOpcao);
        const codigoOpcao = textoOpcao.match(/^[\d.]+/)?.[0]
          ? textoOpcao
              .match(/^[\d.]+/)[0]
              .split(".")
              .map((parte) => String(Number(parte)))
              .join(".")
          : "";

        return (
          descricaoOpcao === descricaoEsperada ||
          (codigoEsperado && codigoOpcao === codigoEsperado)
        );
      });

      expect(opcao, `Fonte "${fonteEsperada}" disponível no filtro`).to.exist;

      const textoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy
        .get(`.form_busca ${containerSelector} .selected`)
        .should("contain", textoSelecionado)
        .then(() => cy.wrap(textoSelecionado, { log: false }));
    });
}

// Seleciona no filtro avançado a Categoria Econômica correspondente ao
// registro aberto e confirma o texto mostrado no select.
function selecionarCategoriaEconomicaAvancado(categoriaEsperada) {
  const codigoCategoria =
    normalizarTexto(categoriaEsperada).match(/^[\d.]+/)?.[0];
  const descricaoCategoria = categoriaEsperada.replace(
    /^[\d.]+\s*[-.)]\s*/,
    "",
  );
  const termosIgnorados = new Set([
    "a",
    "ao",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
  ]);
  const termoPesquisa =
    descricaoCategoria
      .split(/\s+/)
      .filter((termo) => {
        const termoLimpo = termo.replace(/[^a-zA-ZÀ-ÿ]/g, "").toLowerCase();
        return termoLimpo.length > 3 && !termosIgnorados.has(termoLimpo);
      })
      .sort((primeiro, segundo) => segundo.length - primeiro.length)[0] ||
    codigoCategoria ||
    descricaoCategoria;
  const containerSelector = "#select_categoria_economica";

  cy.get(`.form_busca ${containerSelector}`)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  cy.get(`.form_busca ${containerSelector} .options`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .find("input:visible")
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });

  cy.get(`.form_busca ${containerSelector} .options .icon-lupa:visible`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });

  return cy
    .get(`.form_busca ${containerSelector} .options .list a:visible`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const descricaoEsperada = normalizarCategoriaEconomica(categoriaEsperada);
      const codigoEsperado = codigoCategoria
        ?.split(".")
        .map((parte) => String(Number(parte)))
        .join(".");
      const opcao = Array.from($opcoes).find((elemento) => {
        const textoOpcao = normalizarTexto(elemento.textContent);
        const descricaoOpcao = normalizarCategoriaEconomica(textoOpcao);
        const codigoOpcao = textoOpcao.match(/^[\d.]+/)?.[0]
          ? textoOpcao
              .match(/^[\d.]+/)[0]
              .split(".")
              .map((parte) => String(Number(parte)))
              .join(".")
          : "";

        return (
          descricaoOpcao === descricaoEsperada ||
          (codigoEsperado && codigoOpcao === codigoEsperado)
        );
      });

      expect(
        opcao,
        `Categoria Econômica "${categoriaEsperada}" disponível no filtro`,
      ).to.exist;

      const textoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy
        .get(`.form_busca ${containerSelector} .selected`)
        .should("contain", textoSelecionado)
        .then(() => cy.wrap(textoSelecionado, { log: false }));
    });
}

// Seleciona no filtro avançado o Grupo correspondente ao registro aberto e
// confirma o texto mostrado no select.
function selecionarGrupoAvancado(grupoEsperado) {
  const codigoGrupo = normalizarTexto(grupoEsperado).match(/^[\d.]+/)?.[0];
  const descricaoGrupo = grupoEsperado.replace(/^[\d.]+\s*[-.)]\s*/, "");
  const termosIgnorados = new Set([
    "a",
    "ao",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
  ]);
  const termoPesquisa =
    descricaoGrupo
      .split(/\s+/)
      .filter((termo) => {
        const termoLimpo = termo.replace(/[^a-zA-ZÀ-ÿ]/g, "").toLowerCase();
        return termoLimpo.length > 3 && !termosIgnorados.has(termoLimpo);
      })
      .sort((primeiro, segundo) => segundo.length - primeiro.length)[0] ||
    codigoGrupo ||
    descricaoGrupo;
  const containerSelector = "#select_grupo";

  cy.get(`.form_busca ${containerSelector}`)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  cy.get(`.form_busca ${containerSelector} .options`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .find("input:visible")
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });

  cy.get(`.form_busca ${containerSelector} .options .icon-lupa:visible`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });

  return cy
    .get(`.form_busca ${containerSelector} .options .list a:visible`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const descricaoEsperada = normalizarGrupo(grupoEsperado);
      const codigoEsperado = codigoGrupo
        ?.split(".")
        .map((parte) => String(Number(parte)))
        .join(".");
      const opcao = Array.from($opcoes).find((elemento) => {
        const textoOpcao = normalizarTexto(elemento.textContent);
        const descricaoOpcao = normalizarGrupo(textoOpcao);
        const codigoOpcao = textoOpcao.match(/^[\d.]+/)?.[0]
          ? textoOpcao
              .match(/^[\d.]+/)[0]
              .split(".")
              .map((parte) => String(Number(parte)))
              .join(".")
          : "";

        return (
          descricaoOpcao === descricaoEsperada ||
          (codigoEsperado && codigoOpcao === codigoEsperado)
        );
      });

      expect(opcao, `Grupo "${grupoEsperado}" disponível no filtro`).to.exist;

      const textoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy
        .get(`.form_busca ${containerSelector} .selected`)
        .should("contain", textoSelecionado)
        .then(() => cy.wrap(textoSelecionado, { log: false }));
    });
}

function obterContainerElementoNoFiltro() {
  return cy
    .get(".form_busca", { timeout: LISTAGEM_TIMEOUT })
    .then(($formulario) => {
      let $campo = $formulario
        .find('#select_elemento, [id*="elemento"], [name*="elemento"]')
        .first();

      if (!$campo.length) {
        const rotulo = Array.from($formulario.find("label")).find(
          (elemento) =>
            normalizarOrgao(elemento.textContent).replace(/[\s-]/g, "") ===
            "elemento",
        );

        if (rotulo) {
          $campo = Cypress.$(rotulo)
            .closest(".campo")
            .find('[class*="select"], .selected, .options, [id], [name]')
            .first()
            .closest(".campo");
        }
      }

      expect(
        $campo.length,
        "campo Elemento disponível no filtro avançado",
      ).to.be.greaterThan(0);
      return cy.wrap($campo);
    });
}

function selecionarElementoAvancado(elementoEsperado) {
  const codigoElemento =
    normalizarTexto(elementoEsperado).match(/^[\d.]+/)?.[0];
  const descricaoElemento = elementoEsperado.replace(/^[\d.]+\s*[-.)]\s*/, "");
  const termoPesquisa =
    descricaoElemento
      .split(/\s+/)
      .find((termo) => termo.replace(/[^a-zA-ZÀ-ÿ]/g, "").length > 3) ||
    codigoElemento ||
    descricaoElemento;

  return obterContainerElementoNoFiltro().then(($campo) => {
    cy.wrap($campo)
      .find(".selected")
      .should("be.visible")
      .click({ force: true });

    return cy
      .wrap($campo)
      .find(".options", { timeout: LISTAGEM_TIMEOUT })
      .should("be.visible")
      .find("input:visible")
      .should("be.visible")
      .clear({ force: true })
      .type(termoPesquisa, { force: true })
      .then(() =>
        cy
          .wrap($campo)
          .find(".options .icon-lupa:visible")
          .then(($icones) => {
            if ($icones.length) {
              return cy.wrap($icones.first()).click({ force: true });
            }

            return undefined;
          }),
      )
      .then(() =>
        cy
          .wrap($campo)
          .find(".options .list a:visible", { timeout: LISTAGEM_TIMEOUT })
          .should("have.length.at.least", 1)
          .then(($opcoes) => {
            const opcao = Array.from($opcoes).find((elemento) =>
              elementosCorrespondemPorNumero(
                elementoEsperado,
                elemento.textContent,
              ),
            );

            expect(opcao, `Elemento "${elementoEsperado}" disponível no filtro`)
              .to.exist;

            const textoSelecionado = normalizarTexto(opcao.textContent);
            cy.wrap(opcao).click({ force: true });

            return cy
              .wrap($campo)
              .find(".selected")
              .should("contain", textoSelecionado)
              .then(() => cy.wrap(textoSelecionado, { log: false }));
          }),
      );
  });
}

// Seleciona no filtro avançado a Modalidade de Aplicação correspondente ao
// registro aberto e confirma o texto mostrado no select.
function selecionarModalidadeAvancado(modalidadeEsperada) {
  const codigoModalidade =
    normalizarTexto(modalidadeEsperada).match(/^[\d.]+/)?.[0];
  const descricaoModalidade = modalidadeEsperada.replace(
    /^[\d.]+\s*[-.)]\s*/,
    "",
  );
  const termosIgnorados = new Set([
    "a",
    "ao",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
  ]);
  const termoPesquisa =
    descricaoModalidade
      .split(/\s+/)
      .filter((termo) => {
        const termoLimpo = termo.replace(/[^a-zA-ZÀ-ÿ]/g, "").toLowerCase();
        return termoLimpo.length > 3 && !termosIgnorados.has(termoLimpo);
      })
      .sort((primeiro, segundo) => segundo.length - primeiro.length)[0] ||
    codigoModalidade ||
    descricaoModalidade;
  const containerSelector = "#select_modalidade";

  cy.get(`.form_busca ${containerSelector}`)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  cy.get(`.form_busca ${containerSelector} .options`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .find("input:visible")
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });

  cy.get(`.form_busca ${containerSelector} .options .icon-lupa:visible`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });

  return cy
    .get(`.form_busca ${containerSelector} .options .list a:visible`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const descricaoEsperada = normalizarModalidade(modalidadeEsperada);
      const codigoEsperado = codigoModalidade
        ?.split(".")
        .map((parte) => String(Number(parte)))
        .join(".");
      const opcao = Array.from($opcoes).find((elemento) => {
        const textoOpcao = normalizarTexto(elemento.textContent);
        const descricaoOpcao = normalizarModalidade(textoOpcao);
        const codigoOpcao = textoOpcao.match(/^[\d.]+/)?.[0]
          ? textoOpcao
              .match(/^[\d.]+/)[0]
              .split(".")
              .map((parte) => String(Number(parte)))
              .join(".")
          : "";

        return (
          descricaoOpcao === descricaoEsperada ||
          (codigoEsperado && codigoOpcao === codigoEsperado)
        );
      });

      expect(
        opcao,
        `Modalidade de Aplicação "${modalidadeEsperada}" disponível no filtro`,
      ).to.exist;

      const textoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy
        .get(`.form_busca ${containerSelector} .selected`)
        .should("contain", textoSelecionado)
        .then(() => cy.wrap(textoSelecionado, { log: false }));
    });
}

// Quando o detalhamento Fiorilli não expõe o Elemento, seleciona a primeira
// opção disponível para validar a execução do filtro e registrar o retorno real
// da consulta.
function selecionarPrimeiraModalidadeAvancado() {
  const containerSelector = "#select_modalidade";

  cy.get(`.form_busca ${containerSelector}`)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(`.form_busca ${containerSelector} .options .list a:visible`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .first()
    .invoke("text")
    .then((texto) => {
      const modalidadePesquisa = normalizarTexto(texto);

      // Fecha a lista inicial antes de reabrir o controle para pesquisar o
      // texto da primeira opção pelo mesmo fluxo usado quando há dado no
      // detalhamento.
      cy.get(`.form_busca ${containerSelector} .selected`).click({
        force: true,
      });
      return selecionarModalidadeAvancado(modalidadePesquisa);
    });
}

// Abre o primeiro resultado filtrado e confirma que a Função retornada no
// detalhamento corresponde à Função usada na pesquisa.
function validarFuncaoNoDetalhamento(funcaoEsperada) {
  abrirDetalhamentoDaLinha();
  obterFuncaoDoDetalhamento().then((funcaoRetornada) => {
    expect(
      orgaosCorrespondem(funcaoEsperada, funcaoRetornada),
      `Função retornada "${funcaoRetornada}" compatível com "${funcaoEsperada}"`,
    ).to.equal(true);
  });
}

// Abre o primeiro resultado filtrado e confirma o Programa no detalhamento.
function validarProgramaNoDetalhamento(programaEsperado) {
  abrirDetalhamentoDaLinha();
  obterProgramaDoDetalhamento().then((programaRetornado) => {
    expect(
      orgaosCorrespondem(programaEsperado, programaRetornado),
      `Programa retornado "${programaRetornado}" compatível com "${programaEsperado}"`,
    ).to.equal(true);
  });
}

// Abre o primeiro resultado filtrado e confirma a Ação no detalhamento.
function validarAcaoNoDetalhamento(acaoEsperada) {
  abrirDetalhamentoDaLinha();
  obterAcaoDoDetalhamento().then((acaoRetornada) => {
    expect(
      orgaosCorrespondem(acaoEsperada, acaoRetornada),
      `Ação retornada "${acaoRetornada}" compatível com "${acaoEsperada}"`,
    ).to.equal(true);
  });
}

// Abre o primeiro resultado filtrado e confirma a Fonte no detalhamento.
function validarFonteNoDetalhamento(fonteEsperada) {
  abrirDetalhamentoDaLinha();
  obterFonteDoDetalhamento().then((fonteRetornada) => {
    expect(
      fontesCorrespondem(fonteEsperada, fonteRetornada),
      `Fonte retornada "${fonteRetornada}" compatível com "${fonteEsperada}"`,
    ).to.equal(true);
  });
}

// Abre o primeiro resultado filtrado e confirma a Categoria Econômica no
// detalhamento.
function validarCategoriaEconomicaNoDetalhamento(categoriaEsperada) {
  abrirDetalhamentoDaLinha();
  obterCategoriaEconomicaDoDetalhamento().then((categoriaRetornada) => {
    expect(
      categoriasEconomicasCorrespondem(categoriaEsperada, categoriaRetornada),
      `Categoria Econômica retornada "${categoriaRetornada}" compatível com "${categoriaEsperada}"`,
    ).to.equal(true);
  });
}

// Abre o primeiro resultado filtrado e confirma o Grupo no detalhamento.
function validarGrupoNoDetalhamento(grupoEsperado) {
  abrirDetalhamentoDaLinha();
  obterGrupoDoDetalhamento().then((grupoRetornado) => {
    expect(
      gruposCorrespondem(grupoEsperado, grupoRetornado),
      `Grupo retornado "${grupoRetornado}" compatível com "${grupoEsperado}"`,
    ).to.equal(true);
  });
}

// Abre o primeiro resultado filtrado e confirma a Modalidade de Aplicação no
// detalhamento.
function validarModalidadeNoDetalhamento(modalidadeEsperada) {
  abrirDetalhamentoDaLinha();
  obterModalidadeDoDetalhamento().then((modalidadeRetornada) => {
    expect(
      modalidadesCorrespondemPorNumero(modalidadeEsperada, modalidadeRetornada),
      `Modalidade retornada "${modalidadeRetornada}" compatível com "${modalidadeEsperada}"`,
    ).to.equal(true);
  });
}

// Abre o primeiro resultado filtrado e confirma o Elemento usado na pesquisa.
function validarElementoNoDetalhamento(elementoEsperado) {
  abrirDetalhamentoDaLinha();
  obterElementoDoDetalhamento().then((elementoRetornado) => {
    expect(
      elementoRetornado,
      "Elemento exibido no detalhamento filtrado",
    ).to.not.equal(null);
    expect(
      elementosCorrespondemPorNumero(elementoEsperado, elementoRetornado),
      `Elemento retornado "${elementoRetornado}" compatível com "${elementoEsperado}"`,
    ).to.equal(true);
  });
}

// Confirma a Ação no primeiro resultado. Quando o portal não encontra linhas,
// valida a mensagem oficial para registrar o resultado real da pesquisa.
function validarResultadoDaAcao(acaoEsperada) {
  return obterLinhasDeDadosAtuais().then(($linhas) => {
    if (!$linhas.length) {
      cy.contains("#not-found-line", "Nenhum resultado encontrado", {
        timeout: LISTAGEM_TIMEOUT,
      }).should("be.visible");

      const mensagem = `ALERTA: Nenhum resultado encontrado para a Ação ${acaoEsperada}.`;
      Cypress.log({
        name: "ALERTA",
        message: mensagem,
        consoleProps: () => ({ acao: acaoEsperada, resultado: "sem dados" }),
      });
      cy.log(mensagem);
      return;
    }

    validarAcaoNoDetalhamento(acaoEsperada);
  });
}

// Confirma a Fonte no primeiro resultado. Quando o portal não encontra linhas,
// valida a mensagem oficial para registrar o resultado real da pesquisa.
function validarResultadoDaFonte(fonteEsperada) {
  return obterLinhasDeDadosAtuais().then(($linhas) => {
    if (!$linhas.length) {
      cy.contains("#not-found-line", "Nenhum resultado encontrado", {
        timeout: LISTAGEM_TIMEOUT,
      }).should("be.visible");

      const mensagem = `ALERTA: Nenhum resultado encontrado para a Fonte ${fonteEsperada}.`;
      Cypress.log({
        name: "ALERTA",
        message: mensagem,
        consoleProps: () => ({ fonte: fonteEsperada, resultado: "sem dados" }),
      });
      cy.log(mensagem);
      return;
    }

    validarFonteNoDetalhamento(fonteEsperada);
  });
}

// Confirma a Categoria Econômica no primeiro resultado. Quando o portal não
// encontra linhas, valida a mensagem oficial para registrar o resultado real.
function validarResultadoDaCategoriaEconomica(categoriaEsperada) {
  return obterLinhasDeDadosAtuais().then(($linhas) => {
    if (!$linhas.length) {
      cy.contains("#not-found-line", "Nenhum resultado encontrado", {
        timeout: LISTAGEM_TIMEOUT,
      }).should("be.visible");

      const mensagem = `ALERTA: Nenhum resultado encontrado para a Categoria Econômica ${categoriaEsperada}.`;
      Cypress.log({
        name: "ALERTA",
        message: mensagem,
        consoleProps: () => ({
          categoriaEconomica: categoriaEsperada,
          resultado: "sem dados",
        }),
      });
      cy.log(mensagem);
      return;
    }

    validarCategoriaEconomicaNoDetalhamento(categoriaEsperada);
  });
}

// Confirma o Grupo no primeiro resultado. Quando o portal não encontra linhas,
// valida a mensagem oficial para registrar o resultado real da pesquisa.
function validarResultadoDoGrupo(grupoEsperado) {
  return obterLinhasDeDadosAtuais().then(($linhas) => {
    if (!$linhas.length) {
      cy.contains("#not-found-line", "Nenhum resultado encontrado", {
        timeout: LISTAGEM_TIMEOUT,
      }).should("be.visible");

      const mensagem = `ALERTA: Nenhum resultado encontrado para o Grupo ${grupoEsperado}.`;
      Cypress.log({
        name: "ALERTA",
        message: mensagem,
        consoleProps: () => ({ grupo: grupoEsperado, resultado: "sem dados" }),
      });
      cy.log(mensagem);
      return;
    }

    validarGrupoNoDetalhamento(grupoEsperado);
  });
}

// Confirma a Modalidade de Aplicação no primeiro resultado. Quando o portal
// não encontra linhas, valida a mensagem oficial para registrar o resultado.
function validarResultadoDaModalidade(modalidadeEsperada) {
  return obterLinhasDeDadosAtuais().then(($linhas) => {
    if (!$linhas.length) {
      cy.contains("#not-found-line", "Nenhum resultado encontrado", {
        timeout: LISTAGEM_TIMEOUT,
      }).should("be.visible");

      const mensagem = `ALERTA: Nenhum resultado encontrado para a Modalidade de Aplicação ${modalidadeEsperada}.`;
      Cypress.log({
        name: "ALERTA",
        message: mensagem,
        consoleProps: () => ({
          modalidade: modalidadeEsperada,
          resultado: "sem dados",
        }),
      });
      cy.log(mensagem);
      return;
    }

    validarModalidadeNoDetalhamento(modalidadeEsperada);
  });
}

// Valida somente o retorno da consulta quando o detalhamento não oferece o
// campo Modalidade de Aplicação para uma conferência cruzada.
function validarResultadoDaModalidadeSemDetalhamento(modalidadeSelecionada) {
  return obterLinhasDeDadosAtuais().then(($linhas) => {
    if (!$linhas.length) {
      cy.contains("#not-found-line", "Nenhum resultado encontrado", {
        timeout: LISTAGEM_TIMEOUT,
      }).should("be.visible");
      return;
    }

    expect(
      $linhas.length,
      `registros retornados para a Modalidade de Aplicação ${modalidadeSelecionada}`,
    ).to.be.greaterThan(0);
    cy.wrap($linhas[0]).find(".colNumero").should("be.visible");
  });
}

// Seleciona no filtro avançado a Subfunção correspondente ao registro aberto
// e confirma o texto mostrado no select.
function selecionarSubfuncaoAvancado(subfuncaoEsperada) {
  const descricaoSubfuncao = subfuncaoEsperada.replace(/^\d+\s*[-.)]\s*/, "");
  const termoPesquisa = descricaoSubfuncao.split(" ")[0];
  const containerSelector = "#select_subfuncao";

  cy.get(`.form_busca ${containerSelector}`)
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  cy.get(`.form_busca ${containerSelector} .options`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .should("be.visible")
    .find("input:visible")
    .should("be.visible")
    .clear({ force: true })
    .type(termoPesquisa, { force: true });

  cy.get(`.form_busca ${containerSelector} .options .icon-lupa:visible`, {
    timeout: LISTAGEM_TIMEOUT,
  })
    .first()
    .click({ force: true });

  return cy
    .get(`.form_busca ${containerSelector} .options .list a:visible`, {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        orgaosCorrespondem(subfuncaoEsperada, elemento.textContent),
      );

      expect(opcao, `Subfunção "${subfuncaoEsperada}" disponível no filtro`).to
        .exist;

      const textoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy
        .get(`.form_busca ${containerSelector} .selected`)
        .should("contain", textoSelecionado)
        .then(() => cy.wrap(textoSelecionado, { log: false }));
    });
}

// Abre o primeiro resultado filtrado e confirma a Subfunção no detalhamento.
function validarSubfuncaoNoDetalhamento(subfuncaoEsperada) {
  abrirDetalhamentoDaLinha();
  obterSubfuncaoDoDetalhamento().then((subfuncaoRetornada) => {
    expect(
      orgaosCorrespondem(subfuncaoEsperada, subfuncaoRetornada),
      `Subfunção retornada "${subfuncaoRetornada}" compatível com "${subfuncaoEsperada}"`,
    ).to.equal(true);
  });
}

// Seleciona uma opção do campo COVID-19 no filtro avançado e confirma que ela
// ficou marcada no select customizado.
function selecionarCovidAvancado(opcaoEsperada) {
  const opcaoNormalizada = normalizarOrgao(opcaoEsperada);

  cy.get(".form_busca #select_corona_avanc")
    .find(".selected")
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(".form_busca #select_corona_avanc .options .list a:visible", {
      timeout: LISTAGEM_TIMEOUT,
    })
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find(
        (elemento) =>
          normalizarOrgao(elemento.textContent) === opcaoNormalizada,
      );

      expect(opcao, `opção COVID-19 "${opcaoEsperada}" disponível no filtro`).to
        .exist;

      const textoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });

      return cy
        .get(".form_busca #select_corona_avanc .selected")
        .should("contain", textoSelecionado)
        .then(() => cy.wrap(textoSelecionado, { log: false }));
    });
}

// Verifica se a consulta retornou uma linha correspondente ao empenho filtrado.
function validarEmpenhoRetornado(numeroEmpenho) {
  return cy
    .get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => ehLinhaDeDados(linha))
    .should("have.length.at.least", 1)
    .each(($linha) => {
      expect(normalizarTexto($linha.find(".colNumero").text())).to.contain(
        numeroEmpenho,
      );
    });
}

// Abre o primeiro resultado filtrado e confirma o número no detalhamento,
// garantindo que o valor validado veio do registro consultado e não somente
// do texto apresentado na tabela.
function validarEmpenhoNoDetalhamento(numeroEmpenhoEsperado) {
  abrirDetalhamentoDaLinha();
  obterNumeroDoDetalhamento().then((numeroEmpenhoRetornado) => {
    expect(
      numeroEmpenhoRetornado,
      "Nº Empenho exibido no detalhamento filtrado",
    ).to.equal(numeroEmpenhoEsperado);
  });
}

function validarProcessoNoDetalhamento(processoEsperado) {
  abrirDetalhamentoDaLinha();
  obterProcessoDoDetalhamento().then((processoRetornado) => {
    expect(
      processosCorrespondem(processoEsperado, processoRetornado),
      `Processo retornado "${processoRetornado}" compatível com "${processoEsperado}"`,
    ).to.equal(true);
  });
}

// Abre o primeiro resultado filtrado e confirma o Histórico/Descrição no
// detalhamento, garantindo que a pesquisa usou o campo correto.
function validarHistoricoNoDetalhamento(historicoEsperado) {
  abrirDetalhamentoDaLinha();
  obterDescricaoDoDetalhamento().then((historicoRetornado) => {
    expect(
      normalizarTexto(historicoRetornado).toLowerCase(),
      "Histórico / Descrição exibido no detalhamento filtrado",
    ).to.equal(normalizarTexto(historicoEsperado).toLowerCase());
  });
}

// Confirma que cada registro retornado contém o Favorecido pesquisado.
function validarFavorecidoRetornado(favorecido) {
  const favorecidoEsperado = normalizarTexto(favorecido).toLowerCase();

  return cy
    .get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => ehLinhaDeDados(linha))
    .should("have.length.at.least", 1)
    .each(($linha) => {
      const favorecidoRetornado = normalizarTexto(
        $linha.find(".colFornecedor").text(),
      ).toLowerCase();

      expect(
        favorecidoRetornado,
        "Favorecido retornado pela pesquisa avançada",
      ).to.contain(favorecidoEsperado);
    });
}

// Abre o primeiro resultado filtrado e confirma o Favorecido no detalhamento,
// garantindo que a pesquisa retornou o registro com o valor esperado.
function validarFavorecidoNoDetalhamento(favorecidoEsperado) {
  abrirDetalhamentoDaLinha();
  obterFavorecidoDoDetalhamento().then((favorecidoRetornado) => {
    expect(
      normalizarTexto(favorecidoRetornado).toLowerCase(),
      "Favorecido exibido no detalhamento filtrado",
    ).to.contain(normalizarTexto(favorecidoEsperado).toLowerCase());
  });
}

// Abre o primeiro resultado do filtro e confirma o CPF/CNPJ no detalhamento.
function validarCpfCnpjDoPrimeiroResultado(documentoEsperado) {
  // Reutiliza o fluxo padronizado para aguardar a navegação e o carregamento.
  abrirDetalhamentoDaLinha();

  cy.get("#cnpj", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .invoke("text")
    .then((texto) => {
      const documentoRetornado = normalizarCpfCnpj(texto);

      expect(
        documentoRetornado,
        "CPF/CNPJ retornado no detalhamento filtrado",
      ).to.equal(documentoEsperado);
    });
}

// Abre o primeiro resultado filtrado e confirma que o detalhamento mantém o
// mesmo órgão usado na pesquisa avançada.
function validarOrgaoDoPrimeiroResultado(orgaoEsperado) {
  abrirDetalhamentoDaLinha();
  obterOrgaoDoDetalhamento().then((orgaoRetornado) => {
    expect(
      orgaosCorrespondem(orgaoEsperado, orgaoRetornado),
      `Órgão retornado "${orgaoRetornado}" compatível com "${orgaoEsperado}"`,
    ).to.equal(true);
  });
}

// Confirma que todas as datas retornadas estão dentro do intervalo informado
// nos campos Data Inicial e Data Final do filtro avançado.
function validarDatasRetornadas(dataInicial, dataFinal) {
  const limiteInicial = converterDataParaNumero(dataInicial);
  const limiteFinal = converterDataParaNumero(dataFinal);

  cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => ehLinhaDeDados(linha))
    .should("have.length.at.least", 1)
    .each(($linha, indice) => {
      const dataRetornada = normalizarTexto($linha.find(".colData").text());
      const dataNumerica = converterDataParaNumero(dataRetornada);

      expect(
        dataRetornada,
        `Data do registro ${indice + 1} no formato esperado`,
      ).to.match(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(
        dataNumerica,
        `Data do registro ${indice + 1} dentro do intervalo filtrado`,
      ).to.be.within(limiteInicial, limiteFinal);
    });
}

// Abre o primeiro resultado filtrado e confirma que a data do detalhamento
// continua dentro do intervalo usado na pesquisa.
function validarDataNoDetalhamento(dataInicial, dataFinal) {
  const limiteInicial = converterDataParaNumero(dataInicial);
  const limiteFinal = converterDataParaNumero(dataFinal);

  abrirDetalhamentoDaLinha();
  obterDataDoDetalhamento().then((dataRetornada) => {
    expect(
      converterDataParaNumero(dataRetornada),
      `Data do detalhamento dentro do intervalo ${dataInicial} a ${dataFinal}`,
    ).to.be.within(limiteInicial, limiteFinal);
  });
}

// Confirma que a pesquisa de COVID-19 terminou e que a listagem apresenta
// registros ou a mensagem oficial de ausência de resultados.
function validarListagemCovid(opcaoEsperada) {
  cy.get("body", { timeout: LISTAGEM_TIMEOUT }).then(($body) => {
    const linhas = $body
      .find(".cont_dados .tb tr[id]")
      .toArray()
      .filter(ehLinhaDeDados);

    if (linhas.length > 0) {
      expect(
        linhas.length,
        `registros retornados para COVID-19 ${opcaoEsperada}`,
      ).to.be.greaterThan(0);
      return;
    }

    const mensagem = normalizarTexto($body.find("#not-found-line").text());
    expect(
      mensagem,
      `mensagem da listagem para COVID-19 ${opcaoEsperada}`,
    ).to.contain("Nenhum resultado encontrado");
  });
}

// Confirma o alerta exibido quando o valor inicial é maior que o valor final.
function validarAlertaParaIntervaloMonetario(descricao) {
  cy.get(".alertas-msg > p", { timeout: LISTAGEM_TIMEOUT })
    .first()
    .should("be.visible")
    .invoke("text")
    .then((textoAlerta) => {
      const mensagem = normalizarTexto(textoAlerta);

      expect(mensagem, `alerta exibido para ${descricao}`).to.match(
        /valor|mínimo|máximo|menor|maior|intervalo|inválid|invalíd/i,
      );
    });
}

describe(`Portal: ${DESPESAS_NOME} - filtro avançado`, () => {
  beforeEach(() => {
    // O popup é criado pelo JavaScript da página, então sempre iniciamos pela
    // listagem e aguardamos as opções dos filtros serem carregadas.
    cy.visitPortal(DESPESAS_PATH);
    cy.get(".filtro", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
    aguardarListagem();
  });

  it("busca pelo Nº Empenho identificado no detalhamento", () => {
    // Acessa um registro real e lê o Nº Empenho diretamente do detalhamento.
    abrirDetalhamentoDaLinha();
    obterNumeroDoDetalhamento().then((numeroEmpenho) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      cy.get(".form_busca #numero")
        .clear()
        .type(numeroEmpenho)
        .should("have.value", numeroEmpenho);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      // Cada linha retornada deve apresentar o mesmo número pesquisado.
      validarEmpenhoRetornado(numeroEmpenho).then(() => {
        // A confirmação final acessa o registro e compara o valor exibido no
        // detalhamento com o número usado na pesquisa.
        validarEmpenhoNoDetalhamento(numeroEmpenho);
      });
    });
  });

  it("busca pelo Processo identificado no HTML das despesas", () => {
    baixarHtmlDasDespesas().then((processo) => {
      abrirFiltroAvancado();
      preencherProcessoAvancado(processo);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
        .filter((_, linha) => ehLinhaDeDados(linha))
        .should("have.length.at.least", 1)
        .then(() => {
          validarProcessoNoDetalhamento(processo);
        });
    });
  });

  it("busca pelo Histórico identificado no HTML das despesas", () => {
    baixarHtmlDoRelatorio()
      .then(({ content, fileName }) => {
        const registro = extrairRegistroComProcessoEDescricaoDoHtml(content);

        expect(
          registro,
          `registro com Processo e Descrição preenchidos em ${fileName}`,
        ).to.not.equal(null);
        expect(registro.processo, "Processo do registro selecionado").to.not
          .equal("");
        expect(registro.descricao, "Descrição do registro selecionado").to.not
          .equal("");

        cy.log(
          `Registro selecionado — Processo: ${registro.processo}; Descrição: ${registro.descricao}`,
        );

        return cy.wrap(registro, { log: false });
      })
      .then(({ descricao }) => {
        abrirFiltroAvancado();
        preencherHistoricoAvancado(descricao);
        cy.get(".form_busca #btnBuscar").click({ force: true });
        aguardarRetornoDoFiltro();

        cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
          .filter((_, linha) => ehLinhaDeDados(linha))
          .should("have.length.at.least", 1)
          .then(() => {
            validarHistoricoNoDetalhamento(descricao);
          });
      });
  });

  it("busca pelo Favorecido identificado no detalhamento", () => {
    // Acessa um registro real para obter o Favorecido diretamente do detalhe.
    abrirDetalhamentoDaLinha();
    obterFavorecidoDoDetalhamento().then((favorecido) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      cy.get(".form_busca #fornecedor")
        .clear()
        .type(favorecido)
        .should("have.value", favorecido);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      // Os resultados devem conter o mesmo Favorecido usado na pesquisa.
      validarFavorecidoRetornado(favorecido).then(() => {
        // A confirmação final acessa o registro e compara o Favorecido
        // retornado no detalhamento com o valor usado no filtro.
        validarFavorecidoNoDetalhamento(favorecido);
      });
    });
  });

  it("busca pelo CPF/CNPJ identificado no detalhamento", () => {
    // Acessa um registro real e captura o documento exibido no detalhamento.
    abrirDetalhamentoDaLinha();
    obterCpfCnpjDoDetalhamento().then((documento) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      cy.get(".form_busca #cpfCnpj")
        .clear()
        .type(documento)
        .invoke("val")
        .then((valorPreenchido) => {
          expect(
            normalizarCpfCnpj(valorPreenchido),
            "CPF/CNPJ preenchido no filtro avançado",
          ).to.equal(documento);
        });
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      // Como o CPF/CNPJ não é uma coluna da listagem, a confirmação final é
      // feita no detalhamento do primeiro resultado filtrado.
      validarCpfCnpjDoPrimeiroResultado(documento);
    });
  });

  it("busca pelo Órgão identificado no detalhamento", () => {
    // Acessa um registro real e captura o órgão diretamente do detalhamento.
    abrirDetalhamentoDaLinha();
    obterOrgaoDoDetalhamento().then((orgao) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      selecionarOrgaoAvancado(orgao);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      // A confirmação final ocorre no detalhamento do primeiro resultado.
      validarOrgaoDoPrimeiroResultado(orgao);
    });
  });

  it("busca pela Unidade identificada no detalhamento e valida a listagem", () => {
    // A Unidade é obtida de um registro real antes de abrir o filtro.
    abrirDetalhamentoDaLinha();
    obterUnidadeDoDetalhamento().then((unidade) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      selecionarUnidadeAvancado(unidade);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      // A unidade veio de um registro existente; a pesquisa deve retornar
      // pelo menos um registro na listagem.
      cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
        .filter((_, linha) => ehLinhaDeDados(linha))
        .should("have.length.at.least", 1);
    });
  });

  it("busca pela Função identificada no detalhamento e valida a listagem", () => {
    // A Função é obtida de um registro real antes de abrir o filtro.
    abrirDetalhamentoDaLinha();
    obterFuncaoDoDetalhamento().then((funcao) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      selecionarFuncaoAvancado(funcao);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      // A Função veio de um registro existente; a pesquisa deve retornar
      // pelo menos um registro na listagem.
      cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
        .filter((_, linha) => ehLinhaDeDados(linha))
        .should("have.length.at.least", 1)
        .then(() => {
          // Abre o resultado filtrado e confirma a Função no detalhamento.
          validarFuncaoNoDetalhamento(funcao);
        });
    });
  });

  it("busca pela Subfunção identificada no detalhamento e valida a listagem", () => {
    // A Subfunção é obtida de um registro real antes de abrir o filtro.
    abrirDetalhamentoDaLinha();
    obterSubfuncaoDoDetalhamento().then((subfuncao) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      selecionarSubfuncaoAvancado(subfuncao);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      // A Subfunção veio de um registro existente; a pesquisa deve retornar
      // pelo menos um registro e manter a Subfunção no detalhamento.
      cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
        .filter((_, linha) => ehLinhaDeDados(linha))
        .should("have.length.at.least", 1)
        .then(() => {
          validarSubfuncaoNoDetalhamento(subfuncao);
        });
    });
  });

  it("busca pelo Programa identificado no detalhamento e valida a listagem", () => {
    // O Programa é obtido de um registro real antes de abrir o filtro.
    abrirDetalhamentoDaLinha();
    obterProgramaDoDetalhamento().then((programa) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      selecionarProgramaAvancado(programa);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      // O Programa veio de um registro existente; a pesquisa deve retornar
      // pelo menos um registro e manter o Programa no detalhamento.
      cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
        .filter((_, linha) => ehLinhaDeDados(linha))
        .should("have.length.at.least", 1)
        .then(() => {
          validarProgramaNoDetalhamento(programa);
        });
    });
  });

  it("busca pela Ação identificada no detalhamento e valida a listagem", () => {
    // A Ação é obtida de um registro real antes de abrir o filtro.
    abrirDetalhamentoDaLinha();
    obterAcaoDoDetalhamento().then((acao) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      selecionarAcaoAvancado(acao).then((acaoSelecionada) => {
        expect(acaoSelecionada, `Ação "${acao}" disponível no filtro`).to.exist;
        cy.get(".form_busca #btnBuscar").click({ force: true });
        aguardarRetornoDoFiltro();
        validarResultadoDaAcao(acao);
      });
    });
  });

  it("busca pela Fonte identificada no detalhamento e valida a listagem", () => {
    // A Fonte é obtida de um registro real antes de abrir o filtro.
    abrirDetalhamentoDaLinha();
    obterFonteDoDetalhamento().then((fonte) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      selecionarFonteAvancado(fonte);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();
      validarResultadoDaFonte(fonte);
    });
  });

  it("busca pela Categoria Econômica identificada no detalhamento e valida a listagem", () => {
    // A Categoria Econômica é obtida de um registro real antes de abrir o
    // filtro.
    abrirDetalhamentoDaLinha();
    obterCategoriaEconomicaDoDetalhamento().then((categoriaEconomica) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      selecionarCategoriaEconomicaAvancado(categoriaEconomica);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();
      validarResultadoDaCategoriaEconomica(categoriaEconomica);
    });
  });

  it("busca pelo Grupo identificado no detalhamento e valida a listagem", () => {
    // O Grupo é obtido de um registro real antes de abrir o filtro.
    abrirDetalhamentoDaLinha();
    obterGrupoDoDetalhamento().then((grupo) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      selecionarGrupoAvancado(grupo);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();
      validarResultadoDoGrupo(grupo);
    });
  });

  it("busca pela Modalidade de Aplicação identificada no detalhamento e valida a listagem", () => {
    // A Modalidade de Aplicação é obtida de um registro real antes de abrir
    // o filtro.
    abrirDetalhamentoDaLinha();
    obterModalidadeDoDetalhamento().then((modalidade) => {
      retornarParaListagem();
      abrirFiltroAvancado();
      const modalidadeSelecionada = modalidade
        ? selecionarModalidadeAvancado(modalidade)
        : selecionarPrimeiraModalidadeAvancado();

      modalidadeSelecionada.then((modalidadePesquisa) => {
        cy.get(".form_busca #btnBuscar").click({ force: true });
        aguardarRetornoDoFiltro();

        if (modalidade) {
          validarResultadoDaModalidade(modalidadePesquisa);
        } else {
          validarResultadoDaModalidadeSemDetalhamento(modalidadePesquisa);
        }
      });
    });
  });

  it("busca pelo Elemento identificado no detalhamento e valida a listagem", () => {
    // O Elemento é obtido de um registro real antes de abrir o filtro.
    abrirDetalhamentoDaLinha();
    obterElementoDoDetalhamento().then((elemento) => {
      expect(
        elemento,
        "Elemento disponível para realizar o filtro",
      ).to.not.equal(null);
      const numeroElemento = obterNumeroDoElemento(elemento);
      expect(
        numeroElemento,
        `número do Elemento disponível em "${elemento}"`,
      ).to.not.equal("");

      retornarParaListagem();
      abrirFiltroAvancado();
      selecionarElementoAvancado(numeroElemento);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
        .filter((_, linha) => ehLinhaDeDados(linha))
        .should("have.length.at.least", 1)
        .then(() => {
          validarElementoNoDetalhamento(numeroElemento);
        });
    });
  });

  it("busca pelo intervalo de Data Inicial e Data Final", () => {
    // Usa a data de um registro real para garantir que o intervalo pesquisado
    // possua pelo menos um resultado válido no portal.
    obterDataDoPrimeiroRegistro().then((dataDoRegistro) => {
      abrirFiltroAvancado();
      cy.get(".form_busca #data_i")
        .clear()
        .type(dataDoRegistro)
        .should("have.value", dataDoRegistro);
      cy.get(".form_busca #data_f")
        .clear()
        .type(dataDoRegistro)
        .should("have.value", dataDoRegistro);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();

      // Cada registro retornado deve respeitar os dois limites informados.
      validarDatasRetornadas(dataDoRegistro, dataDoRegistro);
      validarDataNoDetalhamento(dataDoRegistro, dataDoRegistro);
    });
  });

  it("busca pelo Valor Empenhado identificado na listagem e valida o resultado", () => {
    obterValorEmpenhadoDaListagem().then(({ texto, numerico }) => {
      abrirFiltroAvancado();
      preencherValorEmpenhadoNoFiltro(texto);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();
      validarValoresEmpenhadosRetornados(numerico);
    });
  });

  it("busca pelo Valor Liquidado identificado na listagem e valida o resultado", () => {
    obterValorLiquidadoDaListagem().then(({ texto, numerico }) => {
      abrirFiltroAvancado();
      preencherValorLiquidadoNoFiltro(texto);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();
      validarValoresLiquidadosRetornados(numerico);
    });
  });

  it("busca pelo Valor Pago identificado na listagem e valida o resultado", () => {
    obterValorPagoDaListagem().then(({ texto, numerico }) => {
      abrirFiltroAvancado();
      preencherValorPagoNoFiltro(texto);
      cy.get(".form_busca #btnBuscar").click({ force: true });
      aguardarRetornoDoFiltro();
      validarValoresPagosRetornados(numerico);
    });
  });

  it.skip("exibe alerta quando o Valor Inicial Empenhado é maior que o Valor Final Empenhado", () => {
    obterValorEmpenhadoDaListagem().then(({ texto, numerico }) => {
      const valorInicialInvalido = formatarValorMonetario(numerico + 1);

      abrirFiltroAvancado();
      cy.get(".form_busca #valor_empenhado_min")
        .clear({ force: true })
        .type(valorInicialInvalido, { force: true });
      cy.get(".form_busca #valor_empenhado_max")
        .clear({ force: true })
        .type(texto, { force: true });
      cy.get(".form_busca #btnBuscar").click({ force: true });

      validarAlertaParaIntervaloMonetario("Valor Empenhado invertido");
    });
  });

  it.skip("exibe alerta quando o Valor Inicial Liquidado é maior que o Valor Final Liquidado", () => {
    obterValorLiquidadoDaListagem().then(({ texto, numerico }) => {
      const valorInicialInvalido = formatarValorMonetario(numerico + 1);

      abrirFiltroAvancado();
      cy.get(".form_busca #valor_liquidado_min")
        .clear({ force: true })
        .type(valorInicialInvalido, { force: true });
      cy.get(".form_busca #valor_liquidado_max")
        .clear({ force: true })
        .type(texto, { force: true });
      cy.get(".form_busca #btnBuscar").click({ force: true });

      validarAlertaParaIntervaloMonetario("Valor Liquidado invertido");
    });
  });

  it.skip("exibe alerta quando o Valor Inicial Pago é maior que o Valor Final Pago", () => {
    obterValorPagoDaListagem().then(({ texto, numerico }) => {
      const valorInicialInvalido = formatarValorMonetario(numerico + 1);

      abrirFiltroAvancado();
      cy.get(".form_busca #valor_pago_min")
        .clear({ force: true })
        .type(valorInicialInvalido, { force: true });
      cy.get(".form_busca #valor_pago_max")
        .clear({ force: true })
        .type(texto, { force: true });
      cy.get(".form_busca #btnBuscar").click({ force: true });

      validarAlertaParaIntervaloMonetario("Valor Pago invertido");
    });
  });

  it("filtra COVID-19 como Sim e verifica a listagem", () => {
    abrirFiltroAvancado();
    selecionarCovidAvancado("Sim");
    cy.get(".form_busca #btnBuscar").click({ force: true });
    aguardarRetornoDoFiltro();
    validarListagemCovid("Sim");
  });

  it("filtra COVID-19 como Não e verifica a listagem", () => {
    abrirFiltroAvancado();
    selecionarCovidAvancado("Não");
    cy.get(".form_busca #btnBuscar").click({ force: true });
    aguardarRetornoDoFiltro();
    validarListagemCovid("Não");
  });

  it.skip("exibe alerta quando a Data Inicial é maior que a Data Final", () => {
    abrirFiltroAvancado();
    cy.get(".form_busca #data_i")
      .clear()
      .type("31/12/2026")
      .should("have.value", "31/12/2026");
    cy.get(".form_busca #data_f")
      .clear()
      .type("01/01/2026")
      .should("have.value", "01/01/2026");
    cy.get(".form_busca #btnBuscar").click({ force: true });

    // A consulta inválida deve ser bloqueada e informar o erro na tela.
    cy.get(".alertas-msg > p", { timeout: LISTAGEM_TIMEOUT })
      .first()
      .should("be.visible")
      .invoke("text")
      .then((textoAlerta) => {
        const mensagem = normalizarTexto(textoAlerta);

        expect(
          mensagem,
          "mensagem de alerta para intervalo de datas inválido",
        ).to.match(/data|período|inicial|final|inválid|invalíd/i);
      });
  });

  it("exige Grupo quando somente a Categoria Econômica é selecionada", () => {
    abrirFiltroAvancado();
    selecionarOpcaoAvancada(
      "#select_categoria_economica",
      "3 - Despesas Correntes",
    );
    cy.get(".form_busca #btnBuscar").click({ force: true });

    // A validação ocorre antes da consulta e informa qual campo dependente
    // precisa ser preenchido para montar corretamente a natureza da despesa.
    cy.contains("body", "Selecione um Grupo!", {
      timeout: LISTAGEM_TIMEOUT,
    }).should("be.visible");
  });

  it("limpa os campos preenchidos no popup sem fechar o formulário", () => {
    abrirFiltroAvancado();
    cy.get(".form_busca #fornecedor").type("fornecedor de teste");
    cy.get(".form_busca #historico").type("histórico de teste");
    cy.get(".form_busca #btnLimpar").click({ force: true });

    cy.get(".form_busca #fornecedor").should("have.value", "");
    cy.get(".form_busca #historico").should("have.value", "");
    cy.get(".form_busca").should("be.visible");
  });
});
