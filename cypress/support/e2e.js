require("./commands");

Cypress.on("uncaught:exception", (err) => {
  const stack = err?.stack || "";

  if (
    err.message.includes(
      "Cannot read properties of undefined (reading 'getValue')",
    ) ||
    err.message.includes(
      "Cannot read properties of undefined (reading 'settings')",
    ) ||
    stack.includes("static.nucleogov.com.br/res/js/cidadao/boot.js")
  ) {
    return false;
  }

  return undefined;
});

beforeEach(() => {
  cy.viewport(
    Cypress.config("viewportWidth"),
    Cypress.config("viewportHeight"),
  );
});
