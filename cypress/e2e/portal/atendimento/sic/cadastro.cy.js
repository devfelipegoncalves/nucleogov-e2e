const { gerarCpfValido } = require("../../../../support/helpers/ouvidoria");

describe("Portal: sic cadastro do solicitante", () => {
  it("abre o cadastro completo quando o documento ainda nao existe", () => {
    cy.avancarAposIdentificacaoSic({
      tipoCadastro: "novo"
    });

    cy.get(".step_cadastro_solicitante").should("be.visible");
    cy.get("#nome").should("be.visible");
    cy.get(".step_usuario_cadastrado").should("not.exist");
  });

  it("exibe o card resumido para usuarios previamente cadastrados", () => {
    const usuarios = [
      {
        numeroIdentificacao: gerarCpfValido(),
        nome: "Usuario Cadastro Sic Um",
        email: `cadastro.sic.um.${Date.now()}@example.com`
      },
      {
        numeroIdentificacao: gerarCpfValido(),
        nome: "Usuario Cadastro Sic Dois",
        email: `cadastro.sic.dois.${Date.now() + 1}@example.com`
      }
    ];

    // Primeiro cria o cadastro e depois força um segundo fluxo no mesmo documento para validar o card.
    cy.wrap(usuarios).each((usuario) => {
      cy.criarSolicitacaoSic({
        tipoCadastro: "novo",
        identificacao: "CPF",
        numeroIdentificacao: usuario.numeroIdentificacao,
        nome: usuario.nome,
        email: usuario.email,
        mensagem: `Primeira solicitacao sic para cadastro ${Date.now()}`
      });

      cy.avancarAposIdentificacaoSic({
        tipoCadastro: "existente",
        identificacao: "CPF",
        numeroIdentificacao: usuario.numeroIdentificacao,
        nome: usuario.nome,
        email: usuario.email,
        mensagem: `Segunda solicitacao sic para card ${Date.now() + 1}`
      });

      cy.get(".step_usuario_cadastrado").should("be.visible");
      cy.get(".step_usuario_cadastrado_identificacao_nome").should(
        "contain",
        usuario.nome.toUpperCase()
      );
      cy.get(".step_usuario_cadastrado_identificacao_documento").should("contain", "CPF");
      cy.get(".step_usuario_cadastrado_identificacao_documento")
        .invoke("text")
        .then((text) => text.replace(/\D/g, ""))
        .should("contain", usuario.numeroIdentificacao);

      cy.prosseguirUsuarioCadastradoSic({
        tipoCadastro: "existente",
        identificacao: "CPF",
        numeroIdentificacao: usuario.numeroIdentificacao,
        nome: usuario.nome,
        email: usuario.email,
        mensagem: `Segunda solicitacao sic para card ${Date.now() + 2}`
      });
      cy.preencherNotificacaoSic({
        tipoCadastro: "existente",
        identificacao: "CPF",
        numeroIdentificacao: usuario.numeroIdentificacao,
        nome: usuario.nome,
        email: usuario.email,
        mensagem: `Segunda solicitacao sic para card ${Date.now() + 3}`
      });

      cy.get(".step_solicitacao_enviada").should("be.visible");
    });
  });
});
