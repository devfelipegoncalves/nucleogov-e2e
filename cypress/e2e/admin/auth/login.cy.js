describe("Admin: autenticacao", () => {
  it("permite acessar o painel", () => {
    cy.loginAdmin();
    cy.url().should("include", "/painel");
  });
});
