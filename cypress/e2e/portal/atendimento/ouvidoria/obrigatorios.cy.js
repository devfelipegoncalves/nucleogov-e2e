const { gerarCpfValido } = require("../../../../support/helpers/ouvidoria");

describe("Portal: ouvidoria campos obrigatorios", () => {
  it("valida assunto e mensagem obrigatorios no primeiro passo", () => {
    cy.visitPortal("/ouvidoria/solicitacaoservico");
    cy.get(".step_manifestacao").should("be.visible");

    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "Campo Obrigatório!").should("have.length.at.least", 1);
    cy.get(".step_identificacao").should("not.exist");
  });

  it("valida mensagem muito curta no primeiro passo", () => {
    cy.visitPortal("/ouvidoria/solicitacaoservico");
    cy.get(".step_manifestacao").should("be.visible");

    cy.selectCustomRandomOption("#select_assunto");
    cy.get("#mensagem").clear().type("curta");
    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "Texto muito curto! Descreva melhor sua manifestação.").should(
      "be.visible"
    );
    cy.get(".step_identificacao").should("not.exist");
  });

  it("valida identificacao obrigatoria no segundo passo", () => {
    cy.iniciarSolicitacaoOuvidoria();
    cy.get(".step_identificacao").should("be.visible");

    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "Campo Obrigatório!").should("be.visible");
    cy.get(".step_cadastro_manifestante").should("not.exist");
  });

  it("valida CPF invalido no segundo passo", () => {
    cy.iniciarSolicitacaoOuvidoria();
    cy.get(".step_identificacao").should("be.visible");

    cy.selectCustomOption("#identificacao", "CPF");
    cy.get("#numero_identificacao").clear().type("11111111111");
    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "CPF Inválido!").should("be.visible");
    cy.get(".step_cadastro_manifestante").should("not.exist");
  });

  it("valida CNPJ invalido no segundo passo", () => {
    cy.iniciarSolicitacaoOuvidoria();
    cy.get(".step_identificacao").should("be.visible");

    cy.selectCustomOption("#identificacao", "CNPJ");
    cy.get("#numero_identificacao").clear().type("11111111111111");
    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "CNPJ Inválido!").should("be.visible");
    cy.get(".step_cadastro_manifestante").should("not.exist");
  });

  it("valida tipo de documento obrigatorio para Registro Profissional", () => {
    cy.iniciarSolicitacaoOuvidoria();
    cy.get(".step_identificacao").should("be.visible");

    cy.selectCustomOption("#identificacao", "Registro Profissional");
    cy.get("#numero_identificacao").clear().type("123456");
    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "Campo Obrigatório!").should("be.visible");
    cy.get(".step_cadastro_manifestante").should("not.exist");
  });

  it("valida nome completo obrigatorio no cadastro do manifestante", () => {
    const numeroIdentificacao = gerarCpfValido();

    cy.avancarAposIdentificacaoOuvidoria({
      tipoCadastro: "novo",
      identificacao: "CPF",
      numeroIdentificacao
    });

    cy.get(".step_cadastro_manifestante").should("be.visible");
    cy.get("#nome").clear().type("Maria");
    cy.get("#buttons_next").click();

    cy.contains(".campo .msg", "Informe seu nome completo!").should("be.visible");
    cy.get(".step_notificar").should("not.exist");
  });
});
