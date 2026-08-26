describe("Smoke: home do portal", () => {
  it("abre a pagina inicial", () => {
    cy.visitPortal("/");
    cy.contains("body", /nucleogov|portal|prefeitura/i);
  });
});
