describe("Portal: sic solicitacao", () => {
  it("cria uma solicitacao de informacao", () => {
    // O fluxo real expõe o texto do protocolo na tela final e o command publica isso em @protocoloSic.
    cy.criarSolicitacaoSic();
    cy.get("@protocoloSic").should("match", /Protocolo/i);
  });
});
