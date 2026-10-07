/**
 * Teste do filtro externo de órgão do módulo CNTReceitas da Centi.
 *
 * O órgão é obtido no detalhamento de uma receita da listagem. Em seguida,
 * o teste seleciona esse órgão e outro órgão disponível no filtro, validando
 * o detalhamento do primeiro resultado após cada seleção.
 */

// Caminho da página testada. O valor pode ser sobrescrito com `--env` para
// reutilizar o mesmo spec em outro município que use o adaptador Centi.
const RECEITAS_PATH =
  Cypress.env("RECEITAS_PATH") || "/cidadao/transparencia/cntreceitas";
// Nome usado nos títulos e nos logs do Cypress.
const RECEITAS_NOME = Cypress.env("RECEITAS_NOME") || "cntreceitas";
// Prazo máximo para carregamentos do portal e respostas assíncronas.
const LISTAGEM_TIMEOUT = 30000;
// A tabela é criada pelo JavaScript do portal depois que a página é aberta.
const SELETOR_LINHAS = ".cont_dados .tb tr[id]";
// O componente Centi monta o select de órgão dentro de `.conteinerorgao`.
const SELETOR_SELECT_ORGAO = ".conteinerorgao > .select > .selected";
const SELETOR_OPCOES_ORGAO = ".conteinerorgao > .select > .options";
// Campo de busca textual da listagem, separado do campo de busca dos selects.
const SELETOR_BUSCA_TEXTO = ".filtro .containerbusca.busca_texto #search";
// O CNTReceitas usa somente o calendário mensal para o filtro de período.
const SELETOR_CALENDARIO = "#filtro_periodo .filtro_intervalo";
// Nomes usados para converter o texto do detalhamento em número de mês.
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

// Remove espaços duplicados e quebras de linha antes das comparações.
function normalizarTexto(texto = "") {
  return String(texto).replace(/\s+/g, " ").trim();
}

// Normaliza acentos e caixa para comparar textos sem depender da apresentação.
function normalizarParaComparacao(texto = "") {
  return normalizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Converte "Outubro" ou "10" para o número do mês usado pelo calendário.
function obterNumeroMes(texto) {
  const valor = normalizarParaComparacao(texto);
  const indice = MESES.findIndex((mes) => valor.includes(mes));
  const numero = indice >= 0 ? indice + 1 : Number(valor.match(/\b(1[0-2]|[1-9])\b/)?.[1]);

  expect(numero, `mês válido no valor "${texto}"`).to.be.within(1, 12);
  return numero;
}

// Remove códigos como "01 -" do início do nome de um órgão.
function removerCodigo(texto = "") {
  return normalizarParaComparacao(texto).replace(/^\d+[\s.]*[-.)]\s*/, "");
}

// Separa palavras úteis, ignorando termos genéricos de órgãos públicos.
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

  return removerCodigo(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((termo) => termo.length > 2 && !termosIgnorados.has(termo));
}

// Aceita diferenças de código, prefixo e nomenclatura entre filtro e detalhe.
function orgaosCorrespondem(orgaoEsperado, orgaoEncontrado) {
  const esperado = removerCodigo(orgaoEsperado);
  const encontrado = removerCodigo(orgaoEncontrado);

  if (!esperado || !encontrado) return false;
  if (
    esperado === encontrado ||
    esperado.includes(encontrado) ||
    encontrado.includes(esperado)
  ) {
    return true;
  }

  if (
    /\bprefeitura\b|\bpoder executivo\b/.test(esperado) &&
    /\bprefeitura\b|\bpoder executivo\b/.test(encontrado)
  ) {
    return true;
  }

  const termosEsperados = obterTermosSignificativos(esperado);
  const termosEncontrados = obterTermosSignificativos(encontrado);

  return termosEsperados.some((termo) => termosEncontrados.includes(termo));
}

// Retorna somente linhas reais, descartando template, carregamento e vazio.
function obterLinhasValidas() {
  return cy
    .get(SELETOR_LINHAS, { timeout: LISTAGEM_TIMEOUT })
    .filter(
      (_, linha) =>
        !["not-found-line", "template_row"].includes(linha.id) &&
        !linha.classList.contains("tb-load") &&
        linha.querySelector(".colIcone, .colDescricao"),
    );
}

// Sincroniza o teste com o fim do carregamento inicial ou de um filtro.
function aguardarListagem() {
  cy.get(".loader", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");
  cy.get(".cont_dados", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
  cy.get(".tb-load", { timeout: LISTAGEM_TIMEOUT }).should("not.exist");

  return obterLinhasValidas().should("have.length.at.least", 1);
}

// Lê valores de input, textarea ou elementos que exibem texto no detalhe.
function obterValorDoCampo($campo) {
  const campo = $campo.first();
  return normalizarTexto(
    campo.val() || campo.attr("value") || campo.text() || "",
  );
}

// Abre o detalhamento da primeira receita disponível na tabela.
function abrirPrimeiroRegistro() {
  return obterLinhasValidas()
    .first()
    .find(".colIcone")
    .should("exist")
    .should("be.visible")
    .click({ force: true });
}

// Fecha o popup para que o próximo filtro seja aplicado na listagem.
function fecharDetalhamento() {
  cy.get("#popmov #close", { timeout: LISTAGEM_TIMEOUT }).click({
    force: true,
  });
  cy.get("#popmov").should("not.exist");
}

// Obtém o órgão exibido no popup da receita atualmente aberta.
function obterOrgaoDoDetalhamento() {
  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find("#orgao")
    .should("be.visible")
    .then(($campo) => {
      const orgao = obterValorDoCampo($campo);

      expect(orgao, "órgão disponível no detalhamento").to.not.equal("");
      return cy.wrap(orgao, { log: false });
    });
}

// Encapsula abrir, ler e fechar o primeiro registro.
function obterOrgaoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return obterOrgaoDoDetalhamento().then((orgao) => {
    fecharDetalhamento();
    return cy.wrap(orgao, { log: false });
  });
}

// Abre o select, pesquisa o órgão coletado e aplica a opção correspondente.
function selecionarOrgaoCorrespondente(orgaoEsperado) {
  cy.get(SELETOR_SELECT_ORGAO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(SELETOR_OPCOES_ORGAO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find(".list a", { timeout: LISTAGEM_TIMEOUT })
    .filter(":visible")
    .should("have.length.at.least", 1)
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find((elemento) =>
        orgaosCorrespondem(orgaoEsperado, elemento.textContent),
      );

      expect(
        opcao,
        `órgão encontrado "${orgaoEsperado}" disponível no filtro`,
      ).to.exist;

      const orgaoSelecionado = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get(SELETOR_SELECT_ORGAO, { timeout: LISTAGEM_TIMEOUT }).should(
        "contain",
        orgaoSelecionado,
      );

      return cy.wrap(orgaoSelecionado, { log: false });
    });
}

// Escolhe uma opção diferente para provar que o filtro muda de fato o retorno.
function selecionarOutroOrgao(orgaoAtual) {
  cy.get(SELETOR_SELECT_ORGAO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .click({ force: true });

  return cy
    .get(SELETOR_OPCOES_ORGAO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .find(".list a", { timeout: LISTAGEM_TIMEOUT })
    .filter(":visible")
    .then(($opcoes) => {
      const opcao = Array.from($opcoes).find(
        (elemento) => !orgaosCorrespondem(orgaoAtual, elemento.textContent),
      );

      expect(opcao, "segundo órgão disponível no filtro").to.exist;

      const outroOrgao = normalizarTexto(opcao.textContent);
      cy.wrap(opcao).click({ force: true });
      cy.get(SELETOR_SELECT_ORGAO, { timeout: LISTAGEM_TIMEOUT }).should(
        "contain",
        outroOrgao,
      );

      return cy.wrap(outroOrgao, { log: false });
    });
}

// Confere se o primeiro resultado após o filtro pertence ao órgão solicitado.
function validarOrgaoDosResultados(orgaoEsperado) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() => obterOrgaoDoDetalhamento())
    .then((orgaoRetornado) => {
      expect(
        orgaosCorrespondem(orgaoEsperado, orgaoRetornado),
        `órgão retornado "${orgaoRetornado}" compatível com "${orgaoEsperado}"`,
      ).to.equal(true);

      cy.log(
        `[${RECEITAS_NOME}][órgão] "${orgaoEsperado}" → "${orgaoRetornado}"`,
      );
      return fecharDetalhamento();
    });
}

// Captura os dois campos usados nos testes de busca textual.
function obterNaturezaEDescricaoDaPrimeiraReceita() {
  return obterLinhasValidas()
    .first()
    .then(($linha) => {
      const natureza = normalizarTexto(
        Cypress.$($linha).find(".colModalidade").text(),
      );
      const descricao = normalizarTexto(
        Cypress.$($linha).find(".colDescricao").text(),
      );

      expect(natureza, "natureza disponível na primeira receita").to.not.equal(
        "",
      );
      expect(
        descricao,
        "descrição disponível na primeira receita",
      ).to.not.equal("");

      return cy.wrap({ natureza, descricao }, { log: false });
    });
}

// Pesquisa um termo e garante que ele aparece na coluna esperada dos resultados.
function pesquisarTextoEValidar(termo, seletorColuna, nomeDoCampo) {
  cy.get(SELETOR_BUSCA_TEXTO, { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .clear()
    .type(termo, { force: true })
    .should("have.value", termo);

  return aguardarListagem().then(($linhas) => {
    const termoNormalizado = normalizarParaComparacao(termo);
    const encontrouTermo = Array.from($linhas).some((linha) =>
      normalizarParaComparacao(
        Cypress.$(linha).find(seletorColuna).text(),
      ).includes(termoNormalizado),
    );

    expect(
      encontrouTermo,
      `${nomeDoCampo} "${termo}" retornado na listagem`,
    ).to.equal(true);

    cy.log(
      `[${RECEITAS_NOME}][busca textual][${nomeDoCampo}] "${termo}" encontrado`,
    );
  });
}

// Lê mês e ano do primeiro detalhe para formar o primeiro filtro de período.
function obterPeriodoDoPrimeiroRegistro() {
  abrirPrimeiroRegistro();

  return cy
    .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
    .should("be.visible")
    .then(($popup) => {
      const ano = Number(obterValorDoCampo($popup.find("#ano")));
      const mes = obterNumeroMes(obterValorDoCampo($popup.find("#mes")));

      expect(ano, "ano disponível no detalhamento").to.be.greaterThan(0);
      fecharDetalhamento();
      return cy.wrap({ ano, mes }, { log: false });
    });
}

// Navega no calendário até o ano indicado e seleciona o mês informado.
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

// Abre o primeiro resultado e compara mês e ano com o período solicitado.
function validarPeriodoDosResultados(periodo, descricao) {
  return aguardarListagem()
    .then(() => abrirPrimeiroRegistro())
    .then(() =>
      cy
        .get("#popmov", { timeout: LISTAGEM_TIMEOUT })
        .should("be.visible")
        .then(($popup) => ({
          ano: Number(obterValorDoCampo($popup.find("#ano"))),
          mes: obterNumeroMes(obterValorDoCampo($popup.find("#mes"))),
        })),
    )
    .then((periodoRetornado) => {
      expect(
        periodoRetornado.ano,
        `ano retornado para ${descricao}`,
      ).to.equal(periodo.ano);
      expect(
        periodoRetornado.mes,
        `mês retornado para ${descricao}`,
      ).to.equal(periodo.mes);
      cy.log(
        `[${RECEITAS_NOME}][período][${descricao}] ${String(periodoRetornado.mes).padStart(2, "0")}/${periodoRetornado.ano}`,
      );
      return fecharDetalhamento();
    });
}

// Cada cenário começa em uma página limpa para não herdar filtros anteriores.
describe(`Portal: ${RECEITAS_NOME} - filtros externos`, () => {
  beforeEach(() => {
    cy.visitPortal(RECEITAS_PATH);
    cy.get(".filtro", { timeout: LISTAGEM_TIMEOUT }).should("be.visible");
    aguardarListagem();
  });

  // Confere o órgão original e depois prova que uma segunda opção também filtra.
  it("filtra pelo órgão do registro e depois por outro órgão", () => {
    obterOrgaoDoPrimeiroRegistro()
      .then((orgaoEncontrado) => selecionarOrgaoCorrespondente(orgaoEncontrado))
      .then((orgaoSelecionado) =>
        validarOrgaoDosResultados(orgaoSelecionado).then(
          () => orgaoSelecionado,
        ),
      )
      .then((orgaoSelecionado) => selecionarOutroOrgao(orgaoSelecionado))
      .then((outroOrgao) => validarOrgaoDosResultados(outroOrgao));
  });

  // Usa os valores reais da primeira linha para testar os dois campos textuais.
  it("busca pela natureza e pela descrição da primeira receita", () => {
    obterNaturezaEDescricaoDaPrimeiraReceita().then(({ natureza, descricao }) =>
      pesquisarTextoEValidar(natureza, ".colModalidade", "natureza")
        .then(() => pesquisarTextoEValidar(descricao, ".colDescricao", "descrição")),
    );
  });

  // Testa mês original, outro mês e a mesma consulta em um ano diferente.
  it("filtra pelo mês do registro, por outro mês e depois altera o ano", () => {
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
});
