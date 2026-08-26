require("./commands");

Cypress.on("uncaught:exception", (err) => {
  if (
    err.message.includes("Cannot read properties of undefined (reading 'getValue')") ||
    err.message.includes("Cannot read properties of undefined (reading 'settings')")
  ) {
    return false;
  }

  return undefined;
});

beforeEach(() => {
  cy.viewport(Cypress.config("viewportWidth"), Cypress.config("viewportHeight"));
});
