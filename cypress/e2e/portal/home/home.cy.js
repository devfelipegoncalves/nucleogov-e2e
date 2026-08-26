describe("Portal: home", () => {
  it("renderiza a pagina inicial", () => {
    cy.visitPortal("/");
    cy.get("body").should("be.visible");
  });
});
