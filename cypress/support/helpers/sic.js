const { faker } = require("@faker-js/faker/locale/pt_BR");
const {
  gerarCpfValido,
  gerarCnpjValido,
  gerarDataNascimento
} = require("./ouvidoria");

// Massa base do SIC com override por cenário, no mesmo padrão usado na Ouvidoria.
function buildSolicitacaoSic(overrides = {}) {
  const unique = Date.now();

  return {
    mensagem:
      overrides.mensagem ||
      `Solicitação automatizada Cypress ${unique}: favor disponibilizar os documentos públicos correspondentes.`,
    tipoCadastro: overrides.tipoCadastro || "novo",
    identificacao: overrides.identificacao || "CPF",
    numeroIdentificacao:
      overrides.numeroIdentificacao ||
      (overrides.identificacao === "CNPJ" ? gerarCnpjValido() : gerarCpfValido()),
    tipoDocumento: overrides.tipoDocumento || "Documento funcional",
    nome: overrides.nome || faker.person.fullName(),
    nomeRepresentante: overrides.nomeRepresentante || faker.person.fullName(),
    email:
      overrides.email ||
      `sic.${unique}.${faker.string.alphanumeric(6).toLowerCase()}@example.com`,
    telefone: overrides.telefone || "62999990000",
    preencherCamposOpcionais:
      overrides.preencherCamposOpcionais === undefined
        ? false
        : overrides.preencherCamposOpcionais,
    dataNascimento: overrides.dataNascimento || gerarDataNascimento(),
    cep: overrides.cep || "74000-000",
    endereco: overrides.endereco || faker.location.streetAddress(),
    anexos: overrides.anexos || [],
    desejaNotificacaoEmail:
      overrides.desejaNotificacaoEmail === undefined
        ? true
        : overrides.desejaNotificacaoEmail,
    sigilo: overrides.sigilo || false,
    covid: overrides.covid || false
  };
}

module.exports = {
  buildSolicitacaoSic
};
