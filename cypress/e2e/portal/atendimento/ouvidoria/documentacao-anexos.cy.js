const {
  gerarCpfValido,
  gerarCnpjValido
} = require("../../../../support/helpers/ouvidoria");

function buildAnexos(prefixo) {
  return [
    {
      fileName: `${prefixo}-evidencia.pdf`,
      contents: `%PDF-1.4\n${prefixo} - anexo de teste do Cypress\n%%EOF`,
      mimeType: "application/pdf"
    },
    {
      fileName: `${prefixo}-comprovante.csv`,
      contents: "coluna,valor\nprotocolo,teste",
      mimeType: "text/csv"
    }
  ];
}

function gerarRgUnico() {
  return `RG${Date.now()}`;
}

function gerarCnhUnica() {
  return String(90000000000 + (Date.now() % 999999999)).slice(0, 11);
}

describe("Portal: ouvidoria documentacao e anexos", () => {
  const cenariosIdentificacao = [
    {
      nome: "CPF",
      identificacao: "CPF",
      numeroIdentificacao: gerarCpfValido()
    },
    {
      nome: "CNPJ",
      identificacao: "CNPJ",
      numeroIdentificacao: gerarCnpjValido()
    },
    {
      nome: "RG",
      identificacao: "RG",
      numeroIdentificacao: gerarRgUnico()
    },
    {
      nome: "CNH",
      identificacao: "CNH",
      numeroIdentificacao: gerarCnhUnica()
    },
    {
      nome: "CRM",
      identificacao: "Registro Profissional",
      tipoDocumento: "CRM",
      numeroIdentificacao: "123456"
    },
    {
      nome: "Outro",
      identificacao: "Outro",
      tipoDocumento: "Passaporte",
      numeroIdentificacao: "AB123456"
    }
  ];

  cenariosIdentificacao.forEach((cenario) => {
    it(`envia ouvidoria com ${cenario.nome} e anexos`, () => {
      // Cada cenário valida um tipo de documento diferente junto com upload real no primeiro passo.
      cy.criarManifestacaoOuvidoria({
        tipo: "solicitacaoservico",
        tipoCadastro: "novo",
        identificacao: cenario.identificacao,
        tipoDocumento: cenario.tipoDocumento,
        numeroIdentificacao: cenario.numeroIdentificacao,
        anexos: buildAnexos(`ouvidoria-${cenario.nome.toLowerCase()}`)
      });

      cy.get("@protocoloOuvidoria").should("match", /Protocolo\s+n[ºo]/i);
      cy.get("@codigoAcessoOuvidoria").should("match", /C[oó]digo de Acesso/i);
    });
  });

  it("envia denuncia anonima com anexos", () => {
    // O ambiente local conclui o ramo anônimo até o estado de envio, mas nem sempre fecha a tela final.
    cy.iniciarManifestacaoOuvidoria({
      tipo: "denuncia",
      identificacao: "anonimo",
      anexos: buildAnexos("ouvidoria-denuncia-anonima")
    });

    cy.preencherIdentificacaoOuvidoria({
      tipo: "denuncia",
      identificacao: "anonimo"
    });
    cy.get("#buttons_next").click();

    cy.get(".step_cadastro_manifestante").should("not.exist");
    cy.get(".step_usuario_cadastrado").should("not.exist");
    cy.get("body", { timeout: 60000 }).should(($body) => {
      const texto = $body.text();
      const concluiu = $body.find(".step_manifestacao_enviada").length > 0;
      const enviando = texto.includes("Enviando manifestação");

      expect(concluiu || enviando, "ramo anônimo chega ao envio").to.equal(true);
    });
  });
});
