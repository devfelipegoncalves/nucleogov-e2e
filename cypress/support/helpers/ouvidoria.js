const { faker } = require("@faker-js/faker/locale/pt_BR");

const TIPOS_MANIFESTACAO = {
  denuncia: {
    slug: "denuncia",
    tipoId: 1,
    titulo: "Denúncia"
  },
  reclamacao: {
    slug: "reclamacao",
    tipoId: 2,
    titulo: "Reclamação"
  },
  sugestao: {
    slug: "sugestao",
    tipoId: 3,
    titulo: "Sugestão"
  },
  elogio: {
    slug: "elogio",
    tipoId: 4,
    titulo: "Elogio"
  },
  solicitacaoservico: {
    slug: "solicitacaoservico",
    tipoId: 5,
    titulo: "Solicitação"
  }
};

// Gera um CPF sintético válido para os cenários que exigem validação de documento.
function gerarCpfValido() {
  const base = Array.from({ length: 9 }, () => faker.number.int({ min: 0, max: 9 }));

  const calcularDigito = (numeros, pesoInicial) => {
    const soma = numeros.reduce((acc, numero, index) => {
      return acc + numero * (pesoInicial - index);
    }, 0);

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const digito1 = calcularDigito(base, 10);
  const digito2 = calcularDigito([...base, digito1], 11);

  return [...base, digito1, digito2].join("");
}

// Gera um CNPJ sintético válido para cobrir a troca de máscara e validação do formulário.
function gerarCnpjValido() {
  const base = Array.from({ length: 12 }, () => faker.number.int({ min: 0, max: 9 }));

  const calcularDigito = (numeros, pesos) => {
    const soma = numeros.reduce((acc, numero, index) => acc + numero * pesos[index], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const digito1 = calcularDigito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digito2 = calcularDigito(
    [...base, digito1],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  return [...base, digito1, digito2].join("");
}

function gerarDataNascimento() {
  const data = faker.date.birthdate({ min: 18, max: 70, mode: "age" });
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = String(data.getFullYear());
  return `${dia}/${mes}/${ano}`;
}

// Massa base para o fluxo de solicitação da ouvidoria, com override por cenário.
function buildManifestacaoOuvidoria(overrides = {}) {
  const unique = Date.now();
  const tipo = overrides.tipo || "solicitacaoservico";
  const tipoConfig = TIPOS_MANIFESTACAO[tipo] || TIPOS_MANIFESTACAO.solicitacaoservico;

  return {
    tipo,
    slug: tipoConfig.slug,
    tipoId: tipoConfig.tipoId,
    titulo: tipoConfig.titulo,
    assunto: overrides.assunto || null,
    mensagem:
      overrides.mensagem ||
      `${tipoConfig.titulo} automatizada Cypress ${unique}: registro de teste da Ouvidoria.`,
    tipoCadastro: overrides.tipoCadastro || "novo",
    identificacao: overrides.identificacao || "CPF",
    numeroIdentificacao: overrides.numeroIdentificacao || gerarCpfValido(),
    nome: overrides.nome || faker.person.fullName(),
    nomeRepresentante: overrides.nomeRepresentante || faker.person.fullName(),
    email:
      overrides.email ||
      `ouvidoria.${unique}.${faker.string.alphanumeric(6).toLowerCase()}@example.com`,
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
    preservarIdentidade: overrides.preservarIdentidade || false,
    assumeResponsabilidade:
      overrides.assumeResponsabilidade === undefined
        ? true
        : overrides.assumeResponsabilidade
  };
}

function buildSolicitacaoOuvidoria(overrides = {}) {
  return buildManifestacaoOuvidoria({
    tipo: "solicitacaoservico",
    ...overrides
  });
}

module.exports = {
  TIPOS_MANIFESTACAO,
  buildManifestacaoOuvidoria,
  buildSolicitacaoOuvidoria,
  gerarCpfValido,
  gerarCnpjValido,
  gerarDataNascimento
};
