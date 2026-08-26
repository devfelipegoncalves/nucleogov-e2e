const DESPESAS_PATH =
  Cypress.env("DESPESAS_PATH") || "/cidadao/transparencia/mgdespesas";
const DESPESAS_NOME = Cypress.env("DESPESAS_NOME") || "mgdespesas";

// O filtro avançado usa a primeira linha real da listagem como massa de dados:
// o teste coleta um valor no detalhe, retorna à listagem e pesquisa esse valor.
function normalizarTexto(texto = "") {
  return texto.replace(/\s+/g, " ").trim();
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

// Abre um select customizado e escolhe a opção pelo texto visível.
function selecionarOpcao(containerSelector, textoOpcao) {
  cy.get(containerSelector).find(".selected").click({ force: true });
  cy.contains(`${containerSelector} .options .list a`, textoOpcao, {
    matchCase: false,
  }).click({ force: true });
}

// Espera o carregamento da tabela, mas não exige que exista uma linha: alguns
// cenários do filtro avançado também validam o retorno sem dados.
function aguardarListagem() {
  cy.get(".loader", { timeout: 30000 }).should("not.exist");
  cy.get(".cont_dados", { timeout: 30000 }).should("be.visible");
  cy.get(".tb-load", { timeout: 30000 }).should("not.exist");
}

// Retorna somente linhas de empenho, descartando placeholders e a linha de
// "nenhum resultado" para que as validações não confundam estado da tabela
// com dados reais.
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

// Centraliza a regra de resultado dos filtros: valida os dados quando existem
// e registra a mensagem apresentada pelo portal quando a consulta fica vazia.
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
    if (!$body.find(`${campoSelector}:visible`).length) {
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
      cy.wrap($campo)
        .find(".options .list a", { timeout: 30000 })
        .should("have.length.at.least", 2)
        .contains(opcao, { matchCase: false })
        .click({ force: true });
    });
}

function obterDescricaoDoEmpenho() {
  // Coleta o valor diretamente do detalhamento antes de recarregar a listagem.
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

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
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

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
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

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
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

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

function obterValorPagoDoEmpenho() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  return cy
    .contains(".campo label", /^Valor Pago$/i)
    .parent()
    .find("input, textarea", { timeout: 30000 })
    .first()
    .scrollIntoView({ duration: 0 })
    .should("exist")
    .invoke("val")
    .then((valor) => {
      const valorNormalizado = normalizarTexto(valor);

      expect(valorNormalizado, "valor pago disponível").to.not.equal("");
      cy.reload();
      aguardarListagem();

      return cy.wrap(valorNormalizado, { log: false });
    });
}

function validarValorPagoNoDetalhe(valorBuscado) {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

  fecharTermosDeUsoSeExibido();

  cy.contains(".campo label", /^Valor Pago$/i)
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
  cy.get("#select_org_avanc").find(".selected").click({ force: true });
  cy.get("#select_org_avanc .options .list a").then(($opcoes) => {
    const termosDoPortal = obterTermosSignificativos(nomeOrgao);
    const opcao = Array.from($opcoes).find((elemento) => {
      const termosDaOpcao = obterTermosSignificativos(elemento.textContent);
      return termosDoPortal.some((termo) => termosDaOpcao.includes(termo));
    });

    expect(opcao, `órgão ${nomeOrgao} disponível no filtro`).to.exist;
    cy.wrap(opcao).click({ force: true });
  });
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

function selecionarUnidadeDisponivel() {
  cy.get("#select_unidade").find(".selected").click({ force: true });
  return cy.get("#select_unidade .options .list a").then(($opcoes) => {
    const opcao = $opcoes[0];
    const unidade = normalizarTexto(opcao.textContent);

    expect(unidade, "unidade disponível no filtro").to.not.equal("");
    cy.wrap(opcao).click({ force: true });

    return cy.wrap(unidade.split(" - ").slice(1).join(" - "), { log: false });
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
      expect(normalizarTexto(unidadeRetornada).toLowerCase()).to.include(
        nomeUnidade.toLowerCase(),
      );
    });
}

function obterFuncaoDoEmpenho() {
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
  cy.get("#select_funcao").find(".selected").click({ force: true });
  cy.get("#select_funcao .options .list a").then(($opcoes) => {
    const opcao = Array.from($opcoes).find((elemento) =>
      normalizarTexto(elemento.textContent)
        .toLowerCase()
        .includes(nomeFuncao.toLowerCase()),
    );

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
    .invoke("val")
    .then((funcaoRetornada) => {
      expect(normalizarTexto(funcaoRetornada).toLowerCase()).to.equal(
        nomeFuncao.toLowerCase(),
      );
    });
}

function obterSubfuncaoDoEmpenho() {
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
  cy.contains(".campo label", /^Subfunção$/i)
    .parent()
    .then(($campo) => {
      cy.wrap($campo).find(".selected").click({ force: true });
      cy.wrap($campo)
        .find(".options .list a", { timeout: 30000 })
        .should("have.length.at.least", 1)
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find((elemento) =>
            normalizarTexto(elemento.textContent)
              .toLowerCase()
              .includes(nomeSubfuncao.toLowerCase()),
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
      .contains(".campo label", /^Grupo$/i)
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
  const nomeGrupoSemCodigo = nomeGrupo.replace(/^\d+\s*-\s*/, "").trim();

  return cy
    .contains(".campo label", /^Grupo$/i)
    .parent()
    .then(($campo) => {
      cy.wrap($campo).find(".selected").click({ force: true });

      cy.wrap($campo)
        .find(".options .list a", { timeout: 30000 })
        .should("have.length.at.least", 1)
        .then(($opcoes) => {
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
    .find("#grupo, input, textarea, .input", { timeout: 30000 })
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

function obterModalidadeAplicacaoDoEmpenho() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

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

      cy.wrap($campo)
        .find(".options .list a")
        .then(($opcoes) => {
          const opcao = Array.from($opcoes).find((elemento) =>
            normalizarTexto(elemento.textContent)
              .toLowerCase()
              .includes(nomeModalidade.toLowerCase()),
          );

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
      expect(normalizarTexto(modalidadeRetornada).toLowerCase()).to.equal(
        nomeModalidade.toLowerCase(),
      );
    });
}

function obterNumeroDaNaturezaDoEmpenho() {
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

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

function obterProgramaDoEmpenho() {
  // O programa usado na pesquisa vem do detalhamento, preservando inclusive
  // o texto exibido pelo portal antes da remoção opcional do código.
  cy.get(
    '.cont_dados .tb tr[id]:not([id="not-found-line"]):not([id="template_row"]) .colNumero',
  )
    .first()
    .click({ force: true });

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

      expect(programaNormalizado, "programa disponível").to.not.equal("");
      cy.reload();
      aguardarListagem();

      return cy.wrap(programaNormalizado, { log: false });
    });
}

function pesquisarProgramaAteEncontrarResultado(nomePrograma) {
  const nomeProgramaSemCodigo = nomePrograma.replace(/^\d+\s*-\s*/, "").trim();

  return tentarOpcoesDePrograma(nomeProgramaSemCodigo, 0);
}

// O autocomplete de Programa pode retornar várias opções para o mesmo texto.
// Cada tentativa repete a busca, seleciona a opção pelo índice e só avança
// quando a consulta anterior não trouxe nenhuma linha válida.
function tentarOpcoesDePrograma(nomePrograma, indice) {
  const programaPesquisado = normalizarTexto(nomePrograma)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

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
    .should(($opcoes) => {
      const opcoes = Array.from($opcoes).filter((opcao) =>
        normalizarTexto(opcao.textContent)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(programaPesquisado),
      );

      expect(
        opcoes.length,
        `opções filtradas para o programa ${nomePrograma}`,
      ).to.be.greaterThan(0);
    })
    .then(($opcoes) => {
      const opcoesFiltradas = Array.from($opcoes).filter((opcao) =>
        normalizarTexto(opcao.textContent)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(programaPesquisado),
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
        normalizarTexto(programaRetornado)
          .replace(/^\d+\s*-\s*/, "")
          .toLowerCase(),
      ).to.equal(nomePrograma.replace(/^\d+\s*-\s*/, "").toLowerCase());
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
    .contains(".campo label", /^Fontes$/i)
    .parent()
    .then(($campo) => {
      cy.wrap($campo).find(".selected").click({ force: true });
      cy.wrap($campo)
        .find("input:visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(codigoFonte, { force: true });

      cy.wrap($campo)
        .find(".options .list a")
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

          return cy
            .wrap($campo)
            .find(".options .list a", { timeout: 30000 })
            .filter(":visible")
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

function obterCategoriaEconomicaDoEmpenho() {
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
  const codigoCategoria = nomeCategoria.match(/^\d+/)?.[0] || nomeCategoria;

  return cy
    .contains(".campo label", /^Categoria Econômica$/i)
    .parent()
    .then(($campo) => {
      cy.wrap($campo).find(".selected").click({ force: true });
      cy.wrap($campo)
        .find("input:visible")
        .first()
        .should("be.visible")
        .clear({ force: true })
        .type(codigoCategoria, { force: true });

      cy.wrap($campo)
        .find(".options .list a")
        .then(($opcoes) => {
          const opcao =
            Array.from($opcoes).find((elemento) =>
              new RegExp(`^${codigoCategoria}\\s*[-.]`).test(
                normalizarTexto(elemento.textContent),
              ),
            ) || $opcoes[0];

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
      expect(normalizarTexto(categoriaRetornada).toLowerCase()).to.equal(
        nomeCategoria.toLowerCase(),
      );
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

  it("acessa o filtro avançado, pesquisa Valor Pago e valida o retorno", () => {
    obterValorPagoDoEmpenho().then((valorPago) => {
      abrirFiltroAvancado(".campo label");

      cy.contains(".campo label", /^Valor Pago$/i)
        .parent()
        .find("input, textarea")
        .first()
        .clear({ force: true })
        .type(valorPago, { force: true });

      cy.contains("button, a, div", "PESQUISAR").click({ force: true });

      aguardarListagem();
      validarResultadoOuNenhumResultado("Valor Pago", () =>
        validarValorPagoNoDetalhe(valorPago),
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
    abrirFiltroAvancado("#select_unidade");
    selecionarUnidadeDisponivel().then((nomeUnidade) => {
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
      obterLinhasValidas().then((linhas) => {
        expect(
          linhas.length,
          "registros retornados pelo filtro de Categoria Econômica",
        ).to.be.greaterThan(0);
        validarCategoriaEconomicaNoDetalhe(nomeCategoria);
      });
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
