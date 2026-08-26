const {
  gerarCpfValido,
  gerarCnpjValido
} = require("../../../../support/helpers/ouvidoria");

function gerarRgUnico() {
  return `RG${Date.now()}`;
}

function gerarCnhUnica() {
  return String(90000000000 + (Date.now() % 999999999)).slice(0, 11);
}

describe("Portal: sic identificacao", () => {
  const cenarios = [
    {
      identificacao: "CPF",
      numeroIdentificacao: gerarCpfValido(),
      mascaraEsperada: /^\d{3}\.\d{3}\.\d{3}\-\d{2}$/
    },
    {
      identificacao: "CNPJ",
      numeroIdentificacao: gerarCnpjValido(),
      mascaraEsperada: /^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$/
    },
    {
      identificacao: "RG",
      numeroIdentificacao: gerarRgUnico(),
      mascaraEsperada: /^RG\d+$/
    },
    {
      identificacao: "CNH",
      numeroIdentificacao: gerarCnhUnica(),
      mascaraEsperada: /^\d{11}$/
    },
    {
      identificacao: "Registro Profissional",
      tipoDocumento: "CRM",
      numeroIdentificacao: "123456",
      mascaraEsperada: /^123456$/,
      exigeTipoDocumento: true
    },
    {
      identificacao: "Outro",
      tipoDocumento: "Passaporte",
      numeroIdentificacao: "AB123456",
      mascaraEsperada: /^AB123456$/,
      exigeTipoDocumento: true
    }
  ];

  cenarios.forEach((cenario) => {
    it(`ajusta os campos dinamicos para ${cenario.identificacao}`, () => {
      // Cada cenário valida máscara, campo complementar e persistência ao avançar de etapa.
      cy.iniciarSolicitacaoSic();

      cy.get(".step_identificacao").should("be.visible");
      cy.selectCustomOption("#identificacao", cenario.identificacao);

      if (cenario.exigeTipoDocumento) {
        cy.get("#tipo_identificacao").parents(".campo").should("not.have.class", "none");
        cy.get("#tipo_identificacao").clear().type(cenario.tipoDocumento);
      } else {
        cy.get("#tipo_identificacao").parents(".campo").should("have.class", "none");
      }

      cy.get("#numero_identificacao").should("be.visible").clear().type(cenario.numeroIdentificacao);
      cy.get("#numero_identificacao")
        .invoke("val")
        .should("match", cenario.mascaraEsperada);

      cy.get("#buttons_next").click();

      cy.get("body", { timeout: 20000 }).should(($body) => {
        expect(
          $body.find(".step_cadastro_solicitante, .step_usuario_cadastrado").length,
          "cadastro novo ou card de usuário existente"
        ).to.be.greaterThan(0);
      });

      cy.get("body").then(($body) => {
        if ($body.find(".step_cadastro_solicitante").length > 0) {
          cy.get(".step_cadastro_solicitante").should("be.visible");
          cy.get("#identificacao .selected p").should("contain", cenario.identificacao);

          if (cenario.exigeTipoDocumento) {
            cy.get("#tipo_identificacao").parents(".campo").should("not.have.class", "none");
            cy.get("#tipo_identificacao").should("have.value", cenario.tipoDocumento);
          } else {
            cy.get("#tipo_identificacao").parents(".campo").should("have.class", "none");
          }

          cy.get("#numero_identificacao")
            .invoke("val")
            .should("match", cenario.mascaraEsperada);
          return;
        }

        cy.get(".step_usuario_cadastrado").should("be.visible");
        cy.get(".step_usuario_cadastrado_identificacao_documento")
          .invoke("text")
          .then((text) => text.replace(/\D/g, ""))
          .should("contain", cenario.numeroIdentificacao.replace(/\D/g, ""));
      });
    });
  });
});
