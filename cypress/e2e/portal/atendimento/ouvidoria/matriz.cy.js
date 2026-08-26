const {
  TIPOS_MANIFESTACAO,
  gerarCnpjValido,
  gerarCpfValido
} = require("../../../../support/helpers/ouvidoria");

describe("Portal: ouvidoria matriz de fluxos", () => {
  const tipos = Object.keys(TIPOS_MANIFESTACAO);

  tipos.forEach((tipo) => {
    it(`envia ${tipo} com dados aleatorios e campos opcionais preenchidos`, () => {
      const identificacao = tipo === "elogio" ? "CNPJ" : "CPF";
      const numeroIdentificacao =
        identificacao === "CNPJ" ? gerarCnpjValido() : gerarCpfValido();

      // Cobre massa aleatória, tipo de manifestação e preenchimento dos campos opcionais do cadastro.
      cy.criarManifestacaoOuvidoria({
        tipo,
        tipoCadastro: "novo",
        identificacao,
        numeroIdentificacao,
        preencherCamposOpcionais: true
      });

      cy.get("@protocoloOuvidoria").should("match", /Protocolo\s+n[ºo]/i);
      cy.get("@codigoAcessoOuvidoria").should("match", /C[oó]digo de Acesso/i);
    });

    it(`reutiliza cadastro existente em ${tipo}`, () => {
      const identificacao = "CPF";
      const numeroIdentificacao = gerarCpfValido();
      const nome = `Usuario Existente ${tipo}`;
      const email = `exist.${tipo.slice(0, 6)}.${Date.now()}@example.com`;
      const telefone = "62999990000";

      // Primeiro cria o cadastro para forçar o segundo fluxo a cair no card de usuário existente.
      cy.criarManifestacaoOuvidoria({
        tipo,
        tipoCadastro: "novo",
        identificacao,
        numeroIdentificacao,
        nome,
        email,
        telefone,
        preencherCamposOpcionais: true
      });

      cy.avancarAposIdentificacaoOuvidoria({
        tipo,
        tipoCadastro: "existente",
        identificacao,
        numeroIdentificacao,
        nome,
        email,
        telefone
      });

      cy.get(".step_usuario_cadastrado").should("be.visible");
      cy.get(".step_usuario_cadastrado_identificacao_nome").should(
        "contain",
        nome.toUpperCase()
      );
      cy.get(".step_usuario_cadastrado_extra").should("contain", email);

      cy.prosseguirUsuarioCadastradoOuvidoria({
        tipo,
        tipoCadastro: "existente",
        identificacao,
        numeroIdentificacao,
        nome,
        email,
        telefone
      });
      cy.preencherNotificacaoOuvidoria({
        tipo,
        tipoCadastro: "existente",
        identificacao,
        numeroIdentificacao,
        nome,
        email,
        telefone
      });

      cy.get(".step_manifestacao_enviada").should("be.visible");
    });
  });

  it
  ("envia denuncia anonima", () => {
    // Denúncia possui um caminho extra com Anônimo, que pula cadastro e card de usuário.
    cy.criarManifestacaoOuvidoria({
      tipo: "denuncia",
      identificacao: "anonimo"
    });

    cy.get(".step_cadastro_manifestante").should("not.exist");
    cy.get(".step_usuario_cadastrado").should("not.exist");
    cy.get(".step_manifestacao_enviada").should("be.visible");
    cy.get("@protocoloOuvidoria").should("match", /Protocolo\s+n[ºo]/i);
  });
});
