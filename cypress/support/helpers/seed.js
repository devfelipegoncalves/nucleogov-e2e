function logSeedStep(message) {
  cy.task("log", `[seed] ${message}`);
}

module.exports = {
  logSeedStep
};
