/**
 * Testes E2E do filtro avançado da integração Fiorilli.
 *
 * O filtro avançado é aberto pelo botão "FILTRAR" e renderizado em um popup.
 * Este arquivo valida a existência dos campos, aplica uma busca por empenho
 * usando registros reais da tabela. Também verifica as regras de dependência
 * entre Categoria Econômica e Grupo, além das buscas por Favorecido, CPF/CNPJ,
 * Órgão e período.
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

// Normaliza o nome do órgão para permitir comparações mesmo quando o portal
// apresenta diferenças de acentuação, código ou palavras de ligação.
function normalizarOrgao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

// Verifica se a consulta retornou uma linha correspondente ao empenho filtrado.
function validarEmpenhoRetornado(numeroEmpenho) {
  cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
    .filter((_, linha) => ehLinhaDeDados(linha))
    .should("have.length.at.least", 1)
    .each(($linha) => {
      expect(normalizarTexto($linha.find(".colNumero").text())).to.contain(
        numeroEmpenho,
      );
    });
}

// Confirma que cada registro retornado contém o Favorecido pesquisado.
function validarFavorecidoRetornado(favorecido) {
  const favorecidoEsperado = normalizarTexto(favorecido).toLowerCase();

  cy.get(".cont_dados .tb tr[id]", { timeout: LISTAGEM_TIMEOUT })
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

describe(`Portal: ${DESPESAS_NOME} - filtro avançado`, () => {
  beforeEach(() => {
    // O popup é criado pelo JavaScript da página, então sempre iniciamos pela
    // listagem e aguardamos as opções dos filtros serem carregadas.
    cy.visitPortal(DESPESAS_PATH);
    cy.get(".filtro", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
    aguardarListagem();
  });

  it("abre o popup com todos os campos do filtro avançado", () => {
    abrirFiltroAvancado();

    // Campos textuais e numéricos da pesquisa.
    [
      "#numero",
      "#fornecedor",
      "#cpfCnpj",
      "#data_i",
      "#data_f",
      "#valor_empenhado_min",
      "#valor_empenhado_max",
      "#valor_liquidado_min",
      "#valor_liquidado_max",
      "#valor_pago_min",
      "#valor_pago_max",
      "#numero_processo_licitacao",
      "#historico",
    ].forEach((seletor) => {
      cy.get(`.form_busca ${seletor}`).should("exist");
    });

    // Selects carregados pela API de filtros do módulo despesas_frl.
    [
      "#select_org_avanc",
      "#select_corona_avanc",
      "#select_unidade",
      "#select_funcao",
      "#select_subfuncao",
      "#select_programa",
      "#select_atividade",
      "#select_fonte",
      "#select_categoria_economica",
      "#select_grupo",
      "#select_modalidade",
      "#select_elemento",
    ].forEach((seletor) => {
      cy.get(`.form_busca ${seletor}`).should("exist");
    });

    cy.get(".form_busca #btnBuscar").should("be.visible");
    cy.get(".form_busca #btnLimpar").should("be.visible");
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
      validarEmpenhoRetornado(numeroEmpenho);
      cy.get("#x_filtros:visible").first().should("be.visible");
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
      validarFavorecidoRetornado(favorecido);
      cy.get("#x_filtros:visible").first().should("be.visible");
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
    });
  });

  it("exibe erro quando a Data Inicial é maior que a Data Final", () => {
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
          "mensagem de erro para intervalo de datas inválido",
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
