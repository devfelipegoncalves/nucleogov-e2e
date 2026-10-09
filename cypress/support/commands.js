const { buildManifestacaoOuvidoria } = require("./helpers/ouvidoria");
const { buildSolicitacaoSic } = require("./helpers/sic");
const { identificarImplementacaoPortal } = require("./helpers/portal");

function assertAssetsLoaded() {
  const timeout = 60000;

  // Os assets podem ser inseridos pelo bootstrap depois do evento load.
  // O should faz a verificação ser repetida até CSS e JS estarem disponíveis.
  cy.document({ timeout }).should((doc) => {
    const cssLinks = Array.from(
      doc.querySelectorAll("link[rel='stylesheet'][href*='/res/']"),
    );
    const jsScripts = Array.from(
      doc.querySelectorAll(
        "script[src*='/res/js/'], script[src*='require.min.js']",
      ),
    );
    const cssAplicados = cssLinks.filter((link) => link.sheet).length;

    expect(doc.readyState, "documento pronto").to.equal("complete");
    expect(cssLinks.length, "folhas de estilo do Nucleogov").to.be.greaterThan(
      0,
    );
    expect(cssAplicados, "folhas de estilo do Nucleogov aplicadas").to.equal(
      cssLinks.length,
    );
    expect(jsScripts.length, "scripts do Nucleogov").to.be.greaterThan(0);
    expect(
      doc.styleSheets.length,
      "stylesheets aplicadas no documento",
    ).to.be.greaterThan(0);
  });

  cy.window({ timeout }).should((win) => {
    const recursos = win.performance.getEntriesByType("resource");
    const cssCarregado = recursos.some(
      (entry) =>
        entry.responseEnd > 0 &&
        (entry.name.includes("/res/css/") ||
          /\.css(?:[?#]|$)/i.test(entry.name)),
    );
    const jsCarregado = recursos.some(
      (entry) =>
        entry.responseEnd > 0 &&
        (entry.name.includes("/res/js/") ||
          entry.name.includes("require.min.js") ||
          /\.js(?:[?#]|$)/i.test(entry.name)),
    );

    expect(cssCarregado, "CSS carregado pelo browser").to.equal(true);
    expect(jsCarregado, "JS carregado pelo browser").to.equal(true);
  });
}

// O projeto usa selects customizados; este helper abstrai a abertura da lista e a escolha por texto.
Cypress.Commands.add("selectCustomOption", (containerSelector, optionLabel) => {
  cy.get(`${containerSelector} .selected`)
    .should("be.visible")
    .click({ force: true });
  cy.get(`${containerSelector} .options`).should("be.visible");
  cy.contains(`${containerSelector} .options .list a`, optionLabel).click({
    force: true,
  });
  cy.get(`${containerSelector} .selected p`).should("contain", optionLabel);
});

// Quando o cenário não depende de uma opção específica, seleciona aleatoriamente uma opção disponível.
Cypress.Commands.add("selectCustomRandomOption", (containerSelector) => {
  cy.get(`${containerSelector} .selected`)
    .should("be.visible")
    .click({ force: true });
  cy.get(`${containerSelector} .options .list a`).then(($options) => {
    const randomIndex = Cypress._.random(0, $options.length - 1);
    const $option = $options.eq(randomIndex);
    const label = $option.text().trim();

    cy.wrap($option).click({ force: true });
    cy.get(`${containerSelector} .selected p`).should("contain", label);
  });
});

// Alguns campos opcionais dependem de selects encadeados; este helper seleciona opções aleatórias.
Cypress.Commands.add(
  "preencherCamposOpcionaisCadastroOuvidoria",
  (overrides = {}) => {
    const solicitacao = buildManifestacaoOuvidoria(overrides);

    if (!solicitacao.preencherCamposOpcionais) {
      return;
    }

    cy.get("#data_nasc").clear().type(solicitacao.dataNascimento);
    // O datepicker do campo de data fica aberto e pode cobrir os demais inputs se não perder o foco.
    cy.get("body").click(0, 0, { force: true });
    cy.get("#cep").clear().type(solicitacao.cep);
    cy.get("#endereco").clear().type(solicitacao.endereco);

    cy.selectCustomRandomOption("#profissao");
    cy.selectCustomRandomOption("#sexo");
    cy.selectCustomRandomOption("#raca");
    cy.selectCustomRandomOption("#escolaridade");
    cy.selectCustomRandomOption("#estado_id");

    cy.get("#cidade_id .selected").click({ force: true });
    cy.get("#cidade_id .options .list a").should("have.length.greaterThan", 0);
    cy.get("#cidade_id .options .list a").then(($options) => {
      const randomIndex = Cypress._.random(0, $options.length - 1);
      const $option = $options.eq(randomIndex);
      const label = $option.text().trim();

      cy.wrap($option).click({ force: true });
      cy.get("#cidade_id .selected p").should("contain", label);
    });
  },
);

Cypress.Commands.add("visitPage", (path, options = {}) => {
  cy.visit(path, options);
  assertAssetsLoaded();
});

Cypress.Commands.add("loginAdmin", (overrides = {}) => {
  const user = overrides.user || Cypress.env("adminUser");
  const password = overrides.password || Cypress.env("adminPassword");

  cy.visitPage("/painel");
  cy.get("body").then(($body) => {
    if ($body.find("[name='login']").length > 0) {
      cy.get("[name='login']").should("be.visible").type(user);
      cy.get("[name='senha']")
        .should("be.visible")
        .type(password, { log: false });
      cy.get(
        "input[type='button'], button[type='submit'], input[type='submit']",
      )
        .first()
        .click();
    }
  });
  // Aguarda a troca da tela de login antes que o próximo cy.visit interrompa a autenticação.
  cy.get("[name='login']", { timeout: 20000 }).should("not.exist");
  cy.url({ timeout: 20000 }).should("include", "/painel");
});

Cypress.Commands.add("visitPortal", (path = "/") => {
  cy.visitPage(path);
  return identificarImplementacaoPortal();
});

// Permite identificar novamente a implementação sem recarregar a página, por
// exemplo depois de uma navegação interna ou ao validar uma rota redirecionada.
Cypress.Commands.add("identificarImplementacaoPortal", () => {
  return identificarImplementacaoPortal();
});

// A listagem administrativa aceita o protocolo na querystring e abre o popup da manifestação.
Cypress.Commands.add("abrirManifestacaoOuvidoriaNoPainel", (protocolo) => {
  const protocoloNormalizado = String(protocolo).replace(/\D/g, "");

  cy.visitPage(
    `/painel/ouvidoria/manifestacoes?protocolo=${protocoloNormalizado}`,
  );
  cy.get("#popup_manifestacao", { timeout: 20000 }).should("be.visible");
  cy.get("#popup_manifestacao .copy_protocolo span").should(
    "contain",
    protocoloNormalizado,
  );
});

// O Nucleogov usa Uploadifive; o input de arquivo é recriado a cada upload e precisa ser reconsultado.
Cypress.Commands.add(
  "anexarArquivosUpload",
  (scopeSelector, arquivos = [], _titleSelector) => {
    cy.wrap(arquivos).each((arquivo) => {
      cy.get(`${scopeSelector} input[type='file']`)
        .last()
        .selectFile(
          {
            contents: Cypress.Buffer.from(arquivo.contents),
            fileName: arquivo.fileName,
            mimeType: arquivo.mimeType || "text/csv",
            lastModified: Date.now(),
          },
          { force: true },
        );

      // O item anexado pode ser remontado por JS logo após o upload, então a verificação olha o container inteiro.
      cy.contains(scopeSelector, arquivo.fileName, { timeout: 20000 }).should(
        "be.visible",
      );
    });
  },
);

// O acompanhamento público exige protocolo e código de acesso para abrir a manifestação.
Cypress.Commands.add(
  "acompanharManifestacaoOuvidoria",
  (protocolo, codigoAcesso) => {
    cy.visitPortal("/ouvidoria/ouvidoria_acompanhar");
    cy.get("#numero_protocolo")
      .clear()
      .type(String(protocolo).replace(/\D/g, ""));
    cy.get("#codigo_acesso")
      .clear()
      .type(String(codigoAcesso).replace(/\D/g, ""));
    cy.get("#buttons_next").click();
    cy.url({ timeout: 20000 }).should("include", "/ouvidoria/manifestacao/id=");
    cy.get(".manifestacao_header", { timeout: 20000 }).should("be.visible");
  },
);

// Abre qualquer manifestação pública da Ouvidoria e conclui apenas o primeiro passo.
Cypress.Commands.add("iniciarManifestacaoOuvidoria", (overrides = {}) => {
  const manifestacao = buildManifestacaoOuvidoria(overrides);
  cy.wrap(manifestacao, { log: false }).as("manifestacaoOuvidoria");

  cy.visitPortal(`/ouvidoria/${manifestacao.slug}`);
  cy.get("#container_forms").should("be.visible");

  cy.get(".step_manifestacao").should("be.visible");
  if (manifestacao.assunto) {
    cy.selectCustomOption("#select_assunto", manifestacao.assunto);
  } else {
    cy.selectCustomRandomOption("#select_assunto");
  }
  cy.get("#mensagem").clear().type(manifestacao.mensagem);

  if (manifestacao.anexos.length > 0) {
    cy.anexarArquivosUpload(
      ".step_manifestacao_anexo",
      manifestacao.anexos,
      ".step_manifestacao_anexo_titulo",
    );
  }

  // O rodapé de aceite de termos pode cobrir o botão em viewport padrão, então o avanço precisa ser forçado.
  cy.get("#buttons_next").click({ force: true });
});

// Mantém compatibilidade com a API antiga focada em solicitação.
Cypress.Commands.add("iniciarSolicitacaoOuvidoria", (overrides = {}) => {
  cy.iniciarManifestacaoOuvidoria({
    tipo: "solicitacaoservico",
    ...overrides,
  });
});

// Preenche o passo de identificação respeitando os campos dinâmicos de cada tipo de documento.
Cypress.Commands.add("preencherIdentificacaoOuvidoria", (overrides = {}) => {
  const solicitacao = buildManifestacaoOuvidoria(overrides);
  cy.wrap(solicitacao, { log: false }).as("manifestacaoOuvidoria");
  cy.get(".step_identificacao").should("be.visible");
  const identificacaoLabel =
    solicitacao.identificacao === "anonimo"
      ? "Anônimo"
      : solicitacao.identificacao;
  cy.selectCustomOption("#identificacao", identificacaoLabel);
  if (solicitacao.identificacao === "anonimo") {
    cy.get("#numero_identificacao")
      .parents(".campo")
      .should("have.class", "none");
    return;
  }
  if (
    solicitacao.identificacao === "Registro Profissional" ||
    solicitacao.identificacao === "Outro"
  ) {
    cy.get("#tipo_identificacao")
      .should("be.visible")
      .clear()
      .type(solicitacao.tipoDocumento || "Documento funcional");
  } else {
    cy.get("#tipo_identificacao")
      .parents(".campo")
      .should("have.class", "none");
  }
  cy.get("#numero_identificacao").clear().type(solicitacao.numeroIdentificacao);
});

// Avança até o cadastro do manifestante, ponto ideal para validar persistência de campos.
Cypress.Commands.add(
  "avancarParaCadastroManifestanteOuvidoria",
  (overrides = {}) => {
    cy.iniciarSolicitacaoOuvidoria(overrides);
    cy.preencherIdentificacaoOuvidoria(overrides);
    cy.get("#buttons_next").click();

    cy.get(".step_cadastro_manifestante").should("be.visible");
  },
);

// Após a identificação, a Ouvidoria pode abrir cadastro novo ou o card de usuário já cadastrado.
Cypress.Commands.add("avancarAposIdentificacaoOuvidoria", (overrides = {}) => {
  const solicitacao = buildManifestacaoOuvidoria(overrides);

  cy.iniciarManifestacaoOuvidoria(solicitacao);
  cy.preencherIdentificacaoOuvidoria(solicitacao);
  cy.get("#buttons_next").click();

  if (solicitacao.identificacao === "anonimo") {
    cy.get(".step_manifestacao_enviada", { timeout: 60000 }).should(
      "be.visible",
    );
    return;
  }

  if (solicitacao.tipoCadastro === "existente") {
    cy.get(".step_usuario_cadastrado").should("be.visible");
    cy.get(".step_usuario_cadastrado_identificacao_nome").should(
      "contain",
      solicitacao.nome.toUpperCase(),
    );
    cy.get(".step_usuario_cadastrado_identificacao_documento")
      .invoke("text")
      .then((text) => text.replace(/\D/g, ""))
      .should("contain", solicitacao.numeroIdentificacao.replace(/\D/g, ""));
    return;
  }

  cy.get("body", { timeout: 20000 }).should(($body) => {
    expect(
      $body.find(".step_cadastro_manifestante, .step_usuario_cadastrado")
        .length,
      "cadastro novo ou card de usuário existente",
    ).to.be.greaterThan(0);
  });
});

// Preenche o formulário completo quando o documento ainda não possui cadastro prévio.
Cypress.Commands.add(
  "preencherCadastroManifestanteOuvidoria",
  (overrides = {}) => {
    const solicitacao = buildManifestacaoOuvidoria(overrides);

    cy.get(".step_cadastro_manifestante").should("be.visible");
    cy.get("#numero_identificacao")
      .clear()
      .type(solicitacao.numeroIdentificacao);
    cy.get("#nome").clear().type(solicitacao.nome);
    if (solicitacao.identificacao === "CNPJ") {
      cy.get("#nome_representante").clear().type(solicitacao.nomeRepresentante);
    }
    cy.get("#email").clear().type(solicitacao.email);
    cy.get("#telefone").clear().type(solicitacao.telefone);
    cy.preencherCamposOpcionaisCadastroOuvidoria(solicitacao);

    if (solicitacao.desejaNotificacaoEmail) {
      cy.get("#assinatura_email").check({ force: true });
    } else {
      cy.get("#assinatura_email").uncheck({ force: true });
    }

    if (solicitacao.preservarIdentidade) {
      cy.get("#reserva_identidade").check({ force: true });
    } else {
      cy.get("#reserva_identidade").uncheck({ force: true });
    }

    if (solicitacao.assumeResponsabilidade) {
      cy.get("#assume_responsabilidade").check({ force: true });
    } else {
      cy.get("#assume_responsabilidade").uncheck({ force: true });
    }

    cy.get("#buttons_next").click();
  },
);

// Quando o documento já existe, o fluxo mostra um card resumo e segue direto para notificação.
Cypress.Commands.add(
  "prosseguirUsuarioCadastradoOuvidoria",
  (overrides = {}) => {
    const solicitacao = buildManifestacaoOuvidoria(overrides);

    cy.get(".step_usuario_cadastrado").should("be.visible");
    cy.get(".step_usuario_cadastrado_identificacao_nome").should(
      "contain",
      solicitacao.nome.toUpperCase(),
    );
    cy.get(".step_usuario_cadastrado_identificacao_documento")
      .invoke("text")
      .then((text) => text.replace(/\D/g, ""))
      .should("contain", solicitacao.numeroIdentificacao.replace(/\D/g, ""));
    cy.get("#buttons_next").click();
  },
);

// A última etapa editável confirma e-mail e telefone antes do envio definitivo.
Cypress.Commands.add("preencherNotificacaoOuvidoria", (overrides = {}) => {
  const solicitacao = buildManifestacaoOuvidoria(overrides);

  cy.get(".step_notificar").should("be.visible");
  cy.get("#email").clear().type(solicitacao.email);
  cy.get("#telefone").clear().type(solicitacao.telefone);
  cy.get("#buttons_next").click();
});

// Fluxo ponta a ponta para qualquer manifestação pública da Ouvidoria.
Cypress.Commands.add("criarManifestacaoOuvidoria", (overrides = {}) => {
  const solicitacao = buildManifestacaoOuvidoria(overrides);

  cy.avancarAposIdentificacaoOuvidoria(solicitacao);

  if (solicitacao.identificacao === "anonimo") {
    cy.get(".step_manifestacao_enviada", { timeout: 60000 }).should(
      "be.visible",
    );
    cy.contains(
      ".step_manifestacao_enviada",
      "Sua manifestação foi enviada com sucesso.",
    );
    cy.get(".copy_protocolo span")
      .invoke("text")
      .then((text) => text.replace(/\s+/g, " ").trim())
      .as("protocoloOuvidoria");
    cy.get(".copy_codigo_acesso span")
      .invoke("text")
      .then((text) => text.replace(/\s+/g, " ").trim())
      .as("codigoAcessoOuvidoria");
    return;
  }

  cy.get("body").then(($body) => {
    if ($body.find(".step_usuario_cadastrado:visible").length > 0) {
      if (solicitacao.tipoCadastro === "existente") {
        cy.prosseguirUsuarioCadastradoOuvidoria(solicitacao);
        return;
      }

      cy.get(".step_usuario_cadastrado").should("be.visible");
      cy.get("#buttons_next").click();
      return;
    }

    cy.preencherCadastroManifestanteOuvidoria(solicitacao);
  });

  cy.preencherNotificacaoOuvidoria(solicitacao);

  cy.get(".step_manifestacao_enviada", { timeout: 20000 }).should("be.visible");
  cy.contains(
    ".step_manifestacao_enviada",
    "Sua manifestação foi enviada com sucesso.",
  );
  cy.get(".copy_protocolo span")
    .invoke("text")
    .then((text) => text.replace(/\s+/g, " ").trim())
    .as("protocoloOuvidoria");
  cy.get(".copy_codigo_acesso span")
    .invoke("text")
    .then((text) => text.replace(/\s+/g, " ").trim())
    .as("codigoAcessoOuvidoria");
});

// Mantém compatibilidade com a API antiga focada em solicitação.
Cypress.Commands.add("criarSolicitacaoOuvidoria", (overrides = {}) => {
  cy.criarManifestacaoOuvidoria({
    tipo: "solicitacaoservico",
    ...overrides,
  });
});

Cypress.Commands.add(
  "preencherCamposOpcionaisCadastroSic",
  (overrides = {}) => {
    const solicitacao = buildSolicitacaoSic(overrides);

    if (!solicitacao.preencherCamposOpcionais) {
      return;
    }

    cy.get("#data_nasc").clear().type(solicitacao.dataNascimento);
    cy.get("body").click(0, 0, { force: true });
    cy.get("#cep").clear().type(solicitacao.cep);
    cy.get("#endereco").clear().type(solicitacao.endereco);

    cy.selectCustomRandomOption("#profissao");
    cy.selectCustomRandomOption("#sexo");
    cy.selectCustomRandomOption("#raca");
    cy.selectCustomRandomOption("#escolaridade");
    cy.selectCustomRandomOption("#estado_id");

    cy.get("#cidade_id .selected").click({ force: true });
    cy.get("#cidade_id .options .list a").should("have.length.greaterThan", 0);
    cy.get("#cidade_id .options .list a").then(($options) => {
      const randomIndex = Cypress._.random(0, $options.length - 1);
      const $option = $options.eq(randomIndex);
      const label = $option.text().trim();

      cy.wrap($option).click({ force: true });
      cy.get("#cidade_id .selected p").should("contain", label);
    });
  },
);

// A home pública correta do ambiente atual do SIC fica sob /cidadao/informacao/sic.
Cypress.Commands.add("abrirHomeSic", () => {
  cy.visitPortal("/cidadao/informacao/sic");
  cy.get("body").should("contain.text", "SIC");
});

// Entra pela home do SIC e conclui apenas o primeiro passo do formulário.
Cypress.Commands.add("iniciarSolicitacaoSic", (overrides = {}) => {
  const solicitacao = buildSolicitacaoSic(overrides);
  cy.wrap(solicitacao, { log: false }).as("solicitacaoSic");

  cy.abrirHomeSic();
  cy.get("a[href*='sic_solicitar']")
    .first()
    .should("be.visible")
    .click({ force: true });

  cy.get("#container_forms").should("be.visible");
  cy.get(".step_solicitacao").should("be.visible");
  cy.get("#mensagem").clear().type(solicitacao.mensagem);

  if (solicitacao.anexos.length > 0) {
    cy.anexarArquivosUpload(
      ".step_solicitacao_anexo",
      solicitacao.anexos,
      ".step_solicitacao_anexo_titulo",
    );
  }

  cy.get("#buttons_next").click({ force: true });
});

// O passo de identificação compartilha a lógica dinâmica de máscara e campo extra do portal.
Cypress.Commands.add("preencherIdentificacaoSic", (overrides = {}) => {
  const solicitacao = buildSolicitacaoSic(overrides);
  cy.wrap(solicitacao, { log: false }).as("solicitacaoSic");

  cy.get(".step_identificacao").should("be.visible");
  cy.selectCustomOption("#identificacao", solicitacao.identificacao);

  if (
    solicitacao.identificacao === "Registro Profissional" ||
    solicitacao.identificacao === "Outro"
  ) {
    cy.get("#tipo_identificacao")
      .parents(".campo")
      .should("not.have.class", "none");
    cy.get("#tipo_identificacao").clear().type(solicitacao.tipoDocumento);
  } else {
    cy.get("#tipo_identificacao")
      .parents(".campo")
      .should("have.class", "none");
  }

  cy.get("#numero_identificacao").clear().type(solicitacao.numeroIdentificacao);
});

// Após a identificação, o SIC pode abrir cadastro novo ou o card de usuário existente.
Cypress.Commands.add("avancarAposIdentificacaoSic", (overrides = {}) => {
  const solicitacao = buildSolicitacaoSic(overrides);

  cy.iniciarSolicitacaoSic(solicitacao);
  cy.preencherIdentificacaoSic(solicitacao);
  cy.get("#buttons_next").click();

  if (solicitacao.tipoCadastro === "existente") {
    cy.get(".step_usuario_cadastrado").should("be.visible");
    cy.get(".step_usuario_cadastrado_identificacao_nome").should(
      "contain",
      solicitacao.nome.toUpperCase(),
    );
    cy.get(".step_usuario_cadastrado_identificacao_documento")
      .invoke("text")
      .then((text) => text.replace(/\D/g, ""))
      .should("contain", solicitacao.numeroIdentificacao.replace(/\D/g, ""));
    return;
  }

  cy.get("body", { timeout: 20000 }).should(($body) => {
    expect(
      $body.find(".step_cadastro_solicitante, .step_usuario_cadastrado").length,
      "cadastro novo ou card de usuário existente",
    ).to.be.greaterThan(0);
  });
});

// O cadastro do SIC tem obrigatórios mínimos e um bloco opcional dependente de selects encadeados.
Cypress.Commands.add("preencherCadastroSolicitanteSic", (overrides = {}) => {
  const solicitacao = buildSolicitacaoSic(overrides);

  cy.get(".step_cadastro_solicitante").should("be.visible");
  cy.get("#numero_identificacao").clear().type(solicitacao.numeroIdentificacao);
  cy.get("#nome").clear().type(solicitacao.nome);
  if (solicitacao.identificacao === "CNPJ") {
    cy.get("#nome_representante").clear().type(solicitacao.nomeRepresentante);
  }
  cy.preencherCamposOpcionaisCadastroSic(solicitacao);

  if (solicitacao.desejaNotificacaoEmail) {
    cy.get("#assinatura_email").check({ force: true });
  } else {
    cy.get("#assinatura_email").uncheck({ force: true });
  }

  if (solicitacao.covid) {
    cy.get("#covid").check({ force: true });
  } else {
    cy.get("#covid").uncheck({ force: true });
  }

  if (solicitacao.sigilo) {
    cy.get("#sigilo").check({ force: true });
  } else {
    cy.get("#sigilo").uncheck({ force: true });
  }

  cy.get("#buttons_next").click();
});

// Quando o documento já existe, o fluxo reduz para um card-resumo antes da notificação.
Cypress.Commands.add("prosseguirUsuarioCadastradoSic", (overrides = {}) => {
  const solicitacao = buildSolicitacaoSic(overrides);

  cy.get(".step_usuario_cadastrado").should("be.visible");
  cy.get(".step_usuario_cadastrado_identificacao_nome").should(
    "contain",
    solicitacao.nome.toUpperCase(),
  );
  cy.get(".step_usuario_cadastrado_identificacao_documento")
    .invoke("text")
    .then((text) => text.replace(/\D/g, ""))
    .should("contain", solicitacao.numeroIdentificacao.replace(/\D/g, ""));
  cy.get("#buttons_next").click();
});

// A última etapa editável do SIC confirma os canais de contato do solicitante.
Cypress.Commands.add("preencherNotificacaoSic", (overrides = {}) => {
  const solicitacao = buildSolicitacaoSic(overrides);

  cy.get(".step_notificar").should("be.visible");
  cy.get("#email").clear().type(solicitacao.email);
  cy.get("#telefone").clear().type(solicitacao.telefone);
  cy.get("#buttons_next").click();
});

// Fluxo ponta a ponta do SIC, reaproveitando cadastro novo ou existente conforme o cenário.
Cypress.Commands.add("criarSolicitacaoSic", (overrides = {}) => {
  const solicitacao = buildSolicitacaoSic(overrides);

  cy.avancarAposIdentificacaoSic(solicitacao);

  cy.get("body").then(($body) => {
    if ($body.find(".step_usuario_cadastrado:visible").length > 0) {
      if (solicitacao.tipoCadastro === "existente") {
        cy.prosseguirUsuarioCadastradoSic(solicitacao);
        return;
      }

      cy.get(".step_usuario_cadastrado").should("be.visible");
      cy.get("#buttons_next").click();
      return;
    }

    cy.preencherCadastroSolicitanteSic(solicitacao);
  });

  cy.preencherNotificacaoSic(solicitacao);

  cy.get(".step_solicitacao_enviada", { timeout: 20000 }).should("be.visible");
  cy.contains(
    ".step_solicitacao_enviada",
    "Sua solicitação foi enviada com sucesso.",
  );
  cy.get(".step_solicitacao_enviada_protocolo span")
    .invoke("text")
    .then((text) => text.replace(/\s+/g, " ").trim())
    .as("protocoloSic");
});
