describe("Smoke: login do admin", () => {
  it("faz login com credenciais validas", () => {
    cy.loginAdmin();
    cy.url().should("include", "/painel");
  });
});
