describe("Portal: ouvidoria solicitacao", () => {
  it("cria uma solicitacao de servico", () => {
    // Gera uma manifestação real e captura protocolo/código para reutilização em asserts futuros.
    cy.criarSolicitacaoOuvidoria();
    cy.get("@protocoloOuvidoria").should("match", /Protocolo\s+n[ºo]/i);
    cy.get("@codigoAcessoOuvidoria").should("match", /C[oó]digo de Acesso/i);
  });
});
