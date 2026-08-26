describe("Portal: ouvidoria manifestacoes", () => {
  const tiposComIdentificacao = [
    { tipo: "elogio", titulo: "Elogio" },
    { tipo: "sugestao", titulo: "Sugestão" },
    { tipo: "reclamacao", titulo: "Reclamação" },
    { tipo: "solicitacaoservico", titulo: "Solicitação" },
    { tipo: "denuncia", titulo: "Denúncia" }
  ];

  tiposComIdentificacao.forEach((cenario) => {
    it(`envia ${cenario.titulo.toLowerCase()} com identificacao`, () => {
      // Reaproveita o fluxo completo e garante que o mesmo command atende todos os tipos públicos.
      cy.criarManifestacaoOuvidoria({
        tipo: cenario.tipo,
        tipoCadastro: "novo"
      });
      cy.get("@protocoloOuvidoria").should("match", /Protocolo\s+n[ºo]/i);
      cy.get("@codigoAcessoOuvidoria").should("match", /C[oó]digo de Acesso/i);
    });
  });

  it("envia denuncia anonima sem abrir o cadastro do manifestante", () => {
    // Denúncia permite a opção Anônimo mesmo quando o anonimato global não está habilitado.
    cy.criarManifestacaoOuvidoria({
      tipo: "denuncia",
      identificacao: "anonimo"
    });

    cy.get(".step_cadastro_manifestante").should("not.exist");
    cy.get(".step_usuario_cadastrado").should("not.exist");
    cy.get(".step_manifestacao_enviada").should("be.visible");
    cy.get("@protocoloOuvidoria").should("match", /Protocolo\s+n[ºo]/i);
  });
});
