const { buildManifestacaoOuvidoria } = require("../../../support/helpers/ouvidoria");

// O frontend do popup possui dois erros conhecidos após algumas ações de salvar/upload.
// Como o teste valida o resultado funcional pela UI pública e pelo próprio popup, ignoramos só esses casos específicos.
Cypress.on("uncaught:exception", (err) => {
  if (
    err.message.includes("Cannot read properties of undefined (reading 'getValue')") ||
    err.message.includes("Cannot read properties of undefined (reading 'settings')")
  ) {
    return false;
  }

  return undefined;
});

// Os cenários administrativos sempre começam criando uma manifestação real no portal para evitar dependência de seed fixa.
function abrirManifestacaoNoPainel(manifestacao) {
  cy.criarManifestacaoOuvidoria(manifestacao);
  cy.get("@protocoloOuvidoria").then((protocolo) => {
    cy.abrirManifestacaoOuvidoriaNoPainel(protocolo);
  });
}

// Para respostas que alteram o estado final da manifestação, confirmamos também o que o cidadão enxerga no acompanhamento.
function validarAcompanhamento(statusEsperado, respostaEsperada) {
  cy.get("@protocoloOuvidoria").then((protocolo) => {
    cy.get("@codigoAcessoOuvidoria").then((codigoAcesso) => {
      cy.acompanharManifestacaoOuvidoria(protocolo, codigoAcesso);
      cy.get("#status_manifestacao").should("contain", statusEsperado);
      cy.get(".mensagens_container").should("contain", respostaEsperada);
    });
  });
}

describe("Admin: ouvidoria tipos de resposta do ouvidor", () => {
  beforeEach(() => {
    cy.loginAdmin();
    cy.url().should("include", "/painel");
  });

  it("envia solicitacao de complementacao e atualiza o status", () => {
    const resposta = "Solicitação automatizada de complementação.";
    const manifestacao = buildManifestacaoOuvidoria({
      tipo: "solicitacaoservico",
      tipoCadastro: "novo"
    });

    abrirManifestacaoNoPainel(manifestacao);

    cy.selectCustomOption(
      "#popup_manifestacao #tipo_resposta",
      "Solicitação de Complementação de Informação"
    );
    cy.get("#popup_manifestacao #desc").clear().type(resposta);
    cy.get("#popup_manifestacao #salvar").click();

    cy.contains("body", "Mensagem enviada para o cidadão", { timeout: 20000 }).should(
      "be.visible"
    );
    cy.get("#popup_manifestacao .situacao").should("contain", "Aguardando complementação");
    cy.get("#popup_manifestacao .container-mensagens").should("contain", resposta);
    validarAcompanhamento("Aguardando complementação", resposta);
  });

  it("envia resposta final e conclui a manifestação", () => {
    const resposta = "Resposta final automatizada do ouvidor.";
    const manifestacao = buildManifestacaoOuvidoria({
      tipo: "reclamacao",
      tipoCadastro: "novo"
    });

    abrirManifestacaoNoPainel(manifestacao);

    cy.selectCustomOption(
      "#popup_manifestacao #tipo_resposta",
      "Resposta Final (Decisão Administrativa)"
    );
    cy.get("#popup_manifestacao #desc").clear().type(resposta);
    cy.get("#popup_manifestacao #salvar").click();

    cy.contains("body", "Mensagem enviada para o cidadão", { timeout: 20000 }).should(
      "be.visible"
    );
    cy.get("#popup_manifestacao .situacao").should("contain", "Concluído");
    validarAcompanhamento("Concluído", resposta);
  });

  it("arquiva a manifestação pelo painel", () => {
    const resposta = "Arquivamento automatizado pelo Cypress.";
    const manifestacao = buildManifestacaoOuvidoria({
      tipo: "elogio",
      tipoCadastro: "novo"
    });

    abrirManifestacaoNoPainel(manifestacao);

    cy.selectCustomOption("#popup_manifestacao #tipo_resposta", "Arquivamento da Manifestação");
    cy.get("#popup_manifestacao #desc").clear().type(resposta);
    cy.get("#popup_manifestacao #salvar").click();

    cy.contains("body", "Mensagem enviada para o cidadão", { timeout: 20000 }).should(
      "be.visible"
    );
    cy.get("#popup_manifestacao .situacao").should("contain", "Arquivado");
    validarAcompanhamento("Arquivado", resposta);
  });

  it("encaminha a manifestação no painel e atualiza o status publico", () => {
    const manifestacao = buildManifestacaoOuvidoria({
      tipo: "sugestao",
      tipoCadastro: "novo"
    });

    abrirManifestacaoNoPainel(manifestacao);

    // No sistema atual, o encaminhamento confiável acontece pela troca do departamento com confirmação,
    // e não pelo envio comum do tipo de resposta "Encaminhamento".
    cy.selectCustomRandomOption("#popup_manifestacao #departamento");
    cy.contains("button", "CONFIRMAR", { timeout: 20000 }).click({ force: true });

    cy.contains("body", "Manifestação encaminhada ao Departamento selecionado.", {
      timeout: 20000
    }).should("be.visible");
    cy.get("#popup_manifestacao .situacao").should("contain", "Encaminhado");
    cy.get("#popup_manifestacao .container-mensagens").should("contain", "Manifestação encaminhada");

    cy.get("@protocoloOuvidoria").then((protocolo) => {
      cy.get("@codigoAcessoOuvidoria").then((codigoAcesso) => {
        cy.acompanharManifestacaoOuvidoria(protocolo, codigoAcesso);
        cy.get("#status_manifestacao").should("contain", "Encaminhado");
        cy.get(".mensagens_container").should("contain", manifestacao.mensagem);
      });
    });
  });

  it("exibe no painel o anexo do cidadão e no acompanhamento o anexo enviado pelo ouvidor", () => {
    const anexoCidadao = {
      fileName: "cidadao-anexo.csv",
      contents: "tipo,origem\ncidadao,portal\n",
      mimeType: "text/csv"
    };
    const anexoPainel = {
      fileName: "painel-anexo.csv",
      contents: "tipo,origem\nouvidor,painel\n",
      mimeType: "text/csv"
    };
    const resposta = "Resposta com anexo enviada pelo painel.";
    const manifestacao = buildManifestacaoOuvidoria({
      tipo: "solicitacaoservico",
      tipoCadastro: "novo",
      anexos: [anexoCidadao]
    });

    cy.criarManifestacaoOuvidoria(manifestacao);
    cy.get("@protocoloOuvidoria").then((protocolo) => {
      cy.get("@codigoAcessoOuvidoria").then((codigoAcesso) => {
        cy.abrirManifestacaoOuvidoriaNoPainel(protocolo);

        cy.get("#popup_manifestacao .container-mensagens .icone-anexo")
          .first()
          .click({ force: true });
        cy.contains("#popup_anexos", anexoCidadao.fileName, { timeout: 20000 }).should("be.visible");
        // O popup de anexos do histórico cobre a área de resposta; ele precisa ser fechado antes do upload do painel.
        cy.get("body").then(($body) => {
          const closeButton = $body.find(
            "#popup_anexos .icon-close-a, #popup_anexos .icone-close-a, #popup_anexos .close"
          );

          if (closeButton.length > 0) {
            cy.wrap(closeButton.first()).click({ force: true });
            return;
          }

          cy.get("#popup_anexos").click("topLeft", { force: true });
        });

        cy.anexarArquivosUpload(
          "#popup_manifestacao .responder",
          [anexoPainel],
          "#popup_manifestacao .anexos_uploaded .anexo_titulo"
        );
        cy.selectCustomOption("#popup_manifestacao #tipo_resposta", "Mensagem");
        cy.get("#popup_manifestacao #desc").clear().type(resposta);
        cy.get("#popup_manifestacao #salvar").click();

        cy.contains("body", "Mensagem enviada para o cidadão", { timeout: 20000 }).should(
          "be.visible"
        );
        cy.get("#popup_manifestacao .container-mensagens").should("contain", resposta);

        cy.acompanharManifestacaoOuvidoria(protocolo, codigoAcesso);
        cy.get(".mensagens_container").should("contain", resposta);
        cy.get(".mensagens_container .mensagem_item.responsavel .icone-anexo")
          .last()
          .click({ force: true });
        cy.contains("#popup_anexos", anexoPainel.fileName, { timeout: 20000 }).should("be.visible");
      });
    });
  });
});
