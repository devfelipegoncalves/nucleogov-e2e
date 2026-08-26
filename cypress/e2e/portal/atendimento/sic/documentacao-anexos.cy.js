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

describe("Portal: sic documentacao e anexos", () => {
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
    it(`envia sic com ${cenario.nome} e anexos`, () => {
      // O SIC precisa validar o upload junto com cada documento suportado no fluxo público.
      cy.criarSolicitacaoSic({
        tipoCadastro: "novo",
        identificacao: cenario.identificacao,
        tipoDocumento: cenario.tipoDocumento,
        numeroIdentificacao: cenario.numeroIdentificacao,
        anexos: buildAnexos(`sic-${cenario.nome.toLowerCase()}`)
      });

      cy.get("@protocoloSic").should("match", /Protocolo/i);
    });
  });
});
