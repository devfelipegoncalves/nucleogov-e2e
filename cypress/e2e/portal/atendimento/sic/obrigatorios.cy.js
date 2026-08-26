const { gerarCpfValido } = require("../../../../support/helpers/ouvidoria");

describe("Portal: sic campos obrigatorios", () => {
  it("valida mensagem obrigatoria no primeiro passo", () => {
    cy.abrirHomeSic();
    cy.get("a[href*='sic_solicitar']").first().click({ force: true });
    cy.get(".step_solicitacao").should("be.visible");

    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "Campo Obrigatório!").should("be.visible");
    cy.get(".step_identificacao").should("not.exist");
  });

  it("valida mensagem muito curta no primeiro passo", () => {
    cy.abrirHomeSic();
    cy.get("a[href*='sic_solicitar']").first().click({ force: true });
    cy.get(".step_solicitacao").should("be.visible");

    cy.get("#mensagem").clear().type("curta");
    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "Texto muito curto! Descreva melhor sua solicitação.").should(
      "be.visible"
    );
    cy.get(".step_identificacao").should("not.exist");
  });

  it("valida identificacao obrigatoria no segundo passo", () => {
    cy.iniciarSolicitacaoSic();
    cy.get(".step_identificacao").should("be.visible");

    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "Campo Obrigatório!").should("be.visible");
    cy.get(".step_cadastro_solicitante").should("not.exist");
  });

  it("valida CPF invalido no segundo passo", () => {
    cy.iniciarSolicitacaoSic();
    cy.get(".step_identificacao").should("be.visible");

    cy.selectCustomOption("#identificacao", "CPF");
    cy.get("#numero_identificacao").clear().type("11111111111");
    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "CPF Inválido!").should("be.visible");
    cy.get(".step_cadastro_solicitante").should("not.exist");
  });

  it("valida CNPJ invalido no segundo passo", () => {
    cy.iniciarSolicitacaoSic();
    cy.get(".step_identificacao").should("be.visible");

    cy.selectCustomOption("#identificacao", "CNPJ");
    cy.get("#numero_identificacao").clear().type("11111111111111");
    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "CNPJ Inválido!").should("be.visible");
    cy.get(".step_cadastro_solicitante").should("not.exist");
  });

  it("valida tipo de documento obrigatorio para Registro Profissional", () => {
    cy.iniciarSolicitacaoSic();
    cy.get(".step_identificacao").should("be.visible");

    cy.selectCustomOption("#identificacao", "Registro Profissional");
    cy.get("#numero_identificacao").clear().type("123456");
    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "Campo Obrigatório!").should("be.visible");
    cy.get(".step_cadastro_solicitante").should("not.exist");
  });

  it("valida nome completo obrigatorio no cadastro do solicitante", () => {
    const numeroIdentificacao = gerarCpfValido();

    cy.avancarAposIdentificacaoSic({
      tipoCadastro: "novo",
      identificacao: "CPF",
      numeroIdentificacao
    });

    cy.get(".step_cadastro_solicitante").should("be.visible");
    cy.get("#nome").clear().type("Maria");
    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "Informe seu nome completo!").should("be.visible");
    cy.get(".step_notificar").should("not.exist");
  });
});
