/**
 * Exportações do módulo MegaSoft SGDespesas.
 *
 * O fluxo de captura do detalhamento, validação dos formatos, download e
 * comparação dos campos é compartilhado com MGDespesas. Este spec configura
 * a rota de SG antes de carregar o spec comum, mantendo um arquivo próprio
 * para execução e identificação no Cypress.
 *
 * Execução:
 * npm run cy:run -- --spec "cypress/e2e/portal/transparencia/rotinas/sgdespesas/exportacoes-megasoft.cy.js"
 */

// O spec comum lê estas variáveis quando é carregado e passa a operar no SG.
Cypress.env("DESPESAS_PATH", "/cidadao/transparencia/sgdespesas");
Cypress.env("DESPESAS_NOME", "sgdespesas");

// Reutiliza o fluxo já validado sem duplicar os helpers de exportação.
require("../../megasoft/mgdespesas/exportacoes.cy.js");
