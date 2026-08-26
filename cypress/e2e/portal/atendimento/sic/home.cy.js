describe("Portal: sic", () => {
  it("abre a home do sic", () => {
    cy.abrirHomeSic();
    // A home precisa expor os dois pontos de entrada públicos do módulo.
    cy.get("a[href*='sic_solicitar']").should("exist");
    cy.get("a[href*='sic_acompanhar']").should("exist");
  });
});
