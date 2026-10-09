/**
 * Identificação automática da implementação carregada pelo Portal do Cidadão.
 *
 * A rota é a evidência mais estável para módulos com nomes exclusivos, como
 * mgreceitas, cntreceitas e receitas_frl. Alguns módulos, porém, compartilham
 * a mesma rota entre fornecedores diferentes. Nesses casos o detector informa
 * a família do módulo, mas não inventa um adaptador sem evidência suficiente.
 */

const LISTAGEM_TIMEOUT = 60000;

// Regras de rotas que identificam um fornecedor sem depender do conteúdo da
// listagem. Os seletores servem como confirmação adicional do HTML carregado.
const REGRAS_DE_ROTA = [
  {
    adaptador: "megasoft",
    tipo: "integrado",
    rotas: [/\/mgreceitas(?:\/|$)/, /\/mgdespesas(?:\/|$)/],
    marcadores: ["#filtro_periodo", "#busca_avancada"],
  },
  {
    adaptador: "centi",
    tipo: "integrado",
    rotas: [/\/cntreceitas(?:\/|$)/, /\/cntdespesas(?:\/|$)/],
    marcadores: ["#busca_avancada", ".cont_dados"],
  },
  {
    adaptador: "fiorilli",
    tipo: "integrado",
    rotas: [/\/receitas_frl(?:\/|$)/, /\/despesas_frl(?:\/|$)/],
    marcadores: ["#select_orgao", ".cont_dados"],
  },
];

// sgdespesas aparece em mais de uma integração do repositório. Mantemos a
// identificação do módulo, mas deixamos o fornecedor indeterminado quando a
// página não fornece um marcador específico que diferencie os dois sistemas.
const ROTAS_COMPARTILHADAS = [
  {
    familia: "sgreceitas",
    modulo: "receitas",
    rota: /\/sgreceitas(?:\/|$)/,
  },
  {
    familia: "sgdespesas",
    modulo: "despesas",
    rota: /\/sgdespesas(?:\/|$)/,
  },
];

// Rotas usadas pelos módulos sem sufixo de integração conhecido.
const ROTAS_PADRAO = [
  { modulo: "receitas", rota: /\/receitas(?:\/|$)/ },
  { modulo: "despesas", rota: /\/despesas(?:\/|$)/ },
];

function obterPathNormalizado(pathname = "") {
  const path = String(pathname).split("?")[0].split("#")[0];

  return path.replace(/\/+$/, "") || "/";
}

function obterModuloPeloPath(pathname = "") {
  const trechoFinal = obterPathNormalizado(pathname).split("/").pop();

  if (/receita/i.test(trechoFinal)) {
    return "receitas";
  }

  if (/despesa/i.test(trechoFinal)) {
    return "despesas";
  }

  return null;
}

function obterMarcadoresEncontrados(documento, marcadores = []) {
  return marcadores.filter((seletor) => documento.querySelector(seletor));
}

function criarResultado({
  adaptador = null,
  tipo = "desconhecido",
  modulo = null,
  familia = null,
  confianca = "baixa",
  pathname,
  marcadores = [],
  motivo,
}) {
  return {
    adaptador,
    tipo,
    modulo,
    familia,
    confianca,
    pathname: obterPathNormalizado(pathname),
    marcadores,
    motivo,
  };
}

/**
 * Executa a classificação síncrona depois que o documento já foi carregado.
 * Esta função fica separada do comando Cypress para facilitar manutenção e
 * permitir que novas integrações sejam incluídas apenas no catálogo acima.
 */
function classificarPortal({ pathname, documento }) {
  const pathNormalizado = obterPathNormalizado(pathname);

  const regraDeRota = REGRAS_DE_ROTA.find((regra) =>
    regra.rotas.some((rota) => rota.test(pathNormalizado)),
  );

  if (regraDeRota) {
    const marcadores = obterMarcadoresEncontrados(
      documento,
      regraDeRota.marcadores,
    );
    const modulo = obterModuloPeloPath(pathNormalizado);
    const confianca = marcadores.length > 0 ? "alta" : "media";

    return criarResultado({
      adaptador: regraDeRota.adaptador,
      tipo: regraDeRota.tipo,
      modulo,
      confianca,
      pathname: pathNormalizado,
      marcadores,
      motivo:
        marcadores.length > 0
          ? "rota conhecida confirmada pelo HTML"
          : "rota conhecida sem marcador HTML confirmado",
    });
  }

  const rotaCompartilhada = ROTAS_COMPARTILHADAS.find((regra) =>
    regra.rota.test(pathNormalizado),
  );

  if (rotaCompartilhada) {
    return criarResultado({
      tipo: "integrado",
      modulo: rotaCompartilhada.modulo,
      familia: rotaCompartilhada.familia,
      confianca: "baixa",
      pathname: pathNormalizado,
      motivo:
        "rota compartilhada por mais de uma integração; fornecedor não identificado",
    });
  }

  const rotaPadrao = ROTAS_PADRAO.find((regra) =>
    regra.rota.test(pathNormalizado),
  );

  if (rotaPadrao) {
    return criarResultado({
      tipo: "padrao",
      modulo: rotaPadrao.modulo,
      confianca: "media",
      pathname: pathNormalizado,
      motivo: "rota padrão do módulo sem sufixo de integração",
    });
  }

  return criarResultado({
    tipo: "desconhecido",
    modulo: obterModuloPeloPath(pathNormalizado),
    pathname: pathNormalizado,
    motivo: "nenhuma regra de rota ou marcador conhecido foi encontrado",
  });
}

/**
 * Comando usado depois de cy.visitPortal(). O resultado fica disponível para
 * as asserções e também é exibido no log do Cypress para facilitar diagnóstico.
 */
function identificarImplementacaoPortal() {
  return cy
    .location("pathname", { timeout: LISTAGEM_TIMEOUT })
    .then((pathname) =>
      cy.document({ timeout: LISTAGEM_TIMEOUT }).then((documento) => {
        const resultado = classificarPortal({ pathname, documento });
        const identificacao =
          resultado.adaptador || resultado.familia || "nenhuma";

        return cy
          .log(
            `[portal] tipo=${resultado.tipo} adaptador=${identificacao} módulo=${resultado.modulo || "desconhecido"} confiança=${resultado.confianca}`,
          )
          .then(() => resultado);
      }),
    );
}

module.exports = {
  classificarPortal,
  identificarImplementacaoPortal,
};
