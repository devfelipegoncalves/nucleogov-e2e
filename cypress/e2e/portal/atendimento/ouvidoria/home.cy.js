describe("Portal: ouvidoria", () => {
  it("abre o formulario da ouvidoria", () => {
    cy.visitPortal("/ouvidoria/inicio");
    cy.contains("body", /ouvidoria/i);
  });
});
