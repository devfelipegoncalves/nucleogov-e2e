const { gerarCpfValido } = require("../../../../support/helpers/ouvidoria");

describe("Portal: ouvidoria cadastro do manifestante", () => {
  it("abre o cadastro completo quando o documento ainda nao existe", () => {
    cy.avancarAposIdentificacaoOuvidoria({
      tipoCadastro: "novo"
    });

    cy.get(".step_cadastro_manifestante").should("be.visible");
    cy.get("#nome").should("be.visible");
    cy.get(".step_usuario_cadastrado").should("not.exist");
  });

  it("exibe o card resumido quando o documento ja esta cadastrado", () => {
    const numeroIdentificacao = gerarCpfValido();
    const nome = "Usuario Cadastro Ouvidoria";
    const email = `cadastro.ouvidoria.${Date.now()}@example.com`;

    // Primeiro registra o documento para forçar o segundo fluxo a cair no card de usuário existente.
    cy.criarSolicitacaoOuvidoria({
      tipoCadastro: "novo",
      identificacao: "CPF",
      numeroIdentificacao,
      nome,
      email,
      mensagem: `Primeira solicitacao para cadastro ${Date.now()}`
    });

    cy.avancarAposIdentificacaoOuvidoria({
      tipoCadastro: "existente",
      identificacao: "CPF",
      numeroIdentificacao,
      nome,
      email,
      mensagem: `Segunda solicitacao para card existente ${Date.now() + 1}`
    });

    cy.get(".step_usuario_cadastrado").should("be.visible");
    cy.get(".step_usuario_cadastrado_identificacao_nome").should(
      "contain",
      nome.toUpperCase()
    );
    cy.get(".step_usuario_cadastrado_identificacao_documento").should("contain", "CPF");
    cy.get(".step_usuario_cadastrado_identificacao_documento")
      .invoke("text")
      .then((text) => text.replace(/\D/g, ""))
      .should("contain", numeroIdentificacao);

    cy.prosseguirUsuarioCadastradoOuvidoria({
      tipoCadastro: "existente",
      identificacao: "CPF",
      numeroIdentificacao,
      nome,
      email,
      mensagem: `Segunda solicitacao para card existente ${Date.now() + 1}`
    });
    cy.preencherNotificacaoOuvidoria({
      tipoCadastro: "existente",
      identificacao: "CPF",
      numeroIdentificacao,
      nome,
      email,
      mensagem: `Segunda solicitacao para card existente ${Date.now() + 1}`
    });

    cy.get(".step_manifestacao_enviada").should("be.visible");
  });
});
