const { buildManifestacaoOuvidoria } = require("../../../support/helpers/ouvidoria");

describe("Admin: ouvidoria resposta do ouvidor", () => {
  beforeEach(() => {
    cy.loginAdmin();
    cy.url().should("include", "/painel");
  });

  it("valida a resposta obrigatoria no popup da manifestação", () => {
    const manifestacao = buildManifestacaoOuvidoria({
      tipo: "solicitacaoservico",
      tipoCadastro: "novo"
    });

    cy.criarManifestacaoOuvidoria(manifestacao);
    cy.get("@protocoloOuvidoria").then((protocolo) => {
      cy.abrirManifestacaoOuvidoriaNoPainel(protocolo);

      // O tipo de resposta vem selecionado no popup; o erro esperado aqui é o campo de texto vazio.
      cy.get("#popup_manifestacao #salvar").click();

      cy.contains("body", "A resposta não pode ficar em branco.").should("be.visible");
      cy.get("#popup_manifestacao #desc").should("have.value", "");
    });
  });

  it("permite que o ouvidor responda a manifestação pelo painel", () => {
    const resposta = "Resposta automatizada do ouvidor via Cypress.";
    const manifestacao = buildManifestacaoOuvidoria({
      tipo: "solicitacaoservico",
      tipoCadastro: "novo"
    });

    cy.criarManifestacaoOuvidoria(manifestacao);
    cy.get("@protocoloOuvidoria").then((protocolo) => {
      cy.abrirManifestacaoOuvidoriaNoPainel(protocolo);

      cy.selectCustomOption("#popup_manifestacao #tipo_resposta", "Mensagem");
      cy.get("#popup_manifestacao #desc").clear().type(resposta);
      cy.get("#popup_manifestacao #salvar").click();

      cy.contains("body", "Mensagem enviada para o cidadão", { timeout: 20000 }).should(
        "be.visible"
      );
      cy.get("#popup_manifestacao .situacao").should("contain", "Respondido");
      cy.get("#popup_manifestacao .container-mensagens").should("contain", resposta);
      cy.get("#popup_manifestacao #desc").should("have.value", "");
    });
  });
});
