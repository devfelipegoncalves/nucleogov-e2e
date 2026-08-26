// O popup usa selects customizados e pode renderizar campos fora da area visivel.
// Este helper centraliza o scroll, a abertura da lista e a validacao da opcao escolhida.
const {
  buildManifestacaoOuvidoria,
} = require("../../../../support/helpers/ouvidoria");

function selecionarOpcaoConfiguracao(containerSelector, optionLabel) {
  cy.get(`${containerSelector} .selected`)
    .scrollIntoView()
    .should("be.visible")
    .click({ force: true });
  cy.get(`${containerSelector} .options`).should("be.visible");
  cy.contains(`${containerSelector} .options .list a`, optionLabel).click({
    force: true,
  });
  cy.get(`${containerSelector} .selected p`).should("contain", optionLabel);
}

function selecionarArquivo(scopeSelector, arquivo) {
  cy.get(`${scopeSelector} input[type='file']`)
    .last()
    .selectFile(
      {
        contents: Cypress.Buffer.from(arquivo.contents),
        fileName: arquivo.fileName,
        mimeType: arquivo.mimeType,
        lastModified: Date.now(),
      },
      { force: true },
    );
}

function validarArquivoRejeitado(scopeSelector, arquivo) {
  // O alerta e um toast temporario; o seletor abaixo identifica especificamente o tipo de erro.
  selecionarArquivo(scopeSelector, arquivo);
  cy.get("body .alertas-msg.fechar p", { timeout: 10000 })
    .should("be.visible")
    // O painel antigo usa "invalido" sem acento; ambas as formas representam o mesmo erro.
    .invoke("text")
    .should("match", /Formato de arquivo inv[áa]lido/i);
  cy.get(scopeSelector).should("not.contain", arquivo.fileName);
}

function validarArquivoAceito(scopeSelector, arquivo) {
  selecionarArquivo(scopeSelector, arquivo);
  // O nome so e adicionado a lista de anexos depois que o upload termina com sucesso.
  cy.contains(scopeSelector, arquivo.fileName, { timeout: 20000 }).should(
    "be.visible",
  );
}

describe("Admin: configuracoes da ouvidoria", () => {
  beforeEach(() => {
    // Cada teste inicia com uma sessao autenticada e abre o popup pela tela real do painel.
    cy.loginAdmin();
    cy.url({ timeout: 20000 }).should("include", "/painel");
    cy.visitPage("/painel/ouvidoria/manifestacoes");
    cy.get("#config", { timeout: 20000 }).should("be.visible").click();
    cy.get("#popup_configuracoes", { timeout: 20000 }).should("be.visible");
  });

  it("carrega as abas e os campos principais da configuracao", () => {
    // Garante que a configuracao foi carregada com as abas essenciais para os proximos cenarios.
    cy.get("#popup_configuracoes .configs-menu-item").should(($items) => {
      const abas = $items.toArray().map((item) => item.textContent.trim());

      expect(abas).to.include.members([
        "Informações",
        "Assuntos",
        "Departamentos",
      ]);
    });

    cy.get("#popup_configuracoes .configs-content[data-content='informacoes']")
      .should("have.class", "active")
      .within(() => {
        [
          "#responsavel_ouvidoria",
          "#ouv_endereco",
          "#ouv_local",
          "#ouv_fone",
          "#ouv_horario",
          "#nomeregouv",
          "#linkregouv",
        ].forEach((selector) => cy.get(selector).should("exist"));
      });
  });

  it("alterna entre as abas de assuntos e departamentos", () => {
    // Valida a navegacao entre abas antes de adicionar testes especificos de cada configuracao.
    cy.get("#popup_configuracoes .configs-menu-item[data-menu='assuntos']")
      .should("be.visible")
      .click();
    cy.get(
      "#popup_configuracoes .configs-content[data-content='assuntos']",
    ).should("have.class", "active");

    cy.get("#popup_configuracoes .configs-menu-item[data-menu='departamentos']")
      .should("be.visible")
      .click();
    cy.get(
      "#popup_configuracoes .configs-content[data-content='departamentos']",
    ).should("have.class", "active");
  });

  const casosConfiguracao = [
    // Configuracoes disponiveis somente para o perfil desenvolvedor.
    ["limite de upload", "#upload_manifestacoes", "25", "texto_condicional"],
    [
      "URL do iframe",
      "#ouv_url_iframe",
      "https://example.com/ouvidoria",
      "texto_condicional",
    ],
    [
      "ocultar identidade",
      "#ouv_ocultar_identidade",
      "Ocultar",
      "select_condicional",
    ],
    [
      "ocultar nome do usuário",
      "#ocultar_nome_usuario_resposta_ouvidoria",
      "Ocultar",
      "select_condicional",
    ],
    [
      "ocultar departamento",
      "#ocultar_departamento_manifestacao",
      "Ocultar",
      "select_condicional",
    ],
    [
      "informar atendente",
      "#informar_atendente_manifestacao",
      "Sim",
      "select_condicional",
    ],
    [
      "anonimato em todos os tipos",
      "#ouv_ativar_anonimato_todos_tipos",
      "Sim",
      "select_condicional",
    ],
  ];

  it("salva os dados institucionais e confirma a exibição na tela inicial do cidadão", () => {
    // Usa uma massa unica para validar que os dados salvos no painel chegam ao portal do cidadao.
    const dados = {
      responsavel: "Responsavel Ouvidoria Cypress",
      endereco: "Rua da Ouvidoria, 100",
      setor: "Setor de Atendimento",
      telefone: "6233334444",
      horario: "08:00 as 18:00",
      nomeRegulamentacao: "Regulamentacao Cypress",
      linkRegulamentacao: "https://example.com/regulamentacao",
      email: `ouvidoria.${Date.now()}@example.com`,
    };

    // Relaciona cada campo da configuracao com o valor que sera persistido.
    const campos = {
      "#responsavel_ouvidoria": dados.responsavel,
      "#ouv_endereco": dados.endereco,
      "#ouv_local": dados.setor,
      "#ouv_fone": dados.telefone,
      "#ouv_horario": dados.horario,
      "#nomeregouv": dados.nomeRegulamentacao,
      "#linkregouv": dados.linkRegulamentacao,
      "#email_ouvidoria": dados.email,
    };

    // Preenche todos os dados institucionais no popup de configuracoes da Ouvidoria.
    Object.entries(campos).forEach(([seletor, valor]) => {
      cy.get(seletor).clear().type(valor);
    });

    // Salva as configuracoes e fecha o popup antes de consultar a tela publica.
    cy.get("#configs-save").click();
    cy.contains("body", "Configurações salvas com sucesso", {
      timeout: 20000,
    }).should("be.visible");
    cy.get("#configs-cancel").click();

    // Acessa a tela inicial da Ouvidoria no portal do cidadao.
    cy.visit("http://localhost:8000/cidadao/ouvidoria/inicio");
    cy.get(".container_info_cards", { timeout: 20000 }).should("be.visible");

    // Confirma que os dados institucionais aparecem no card de atendimento presencial.
    [
      ["Setor", dados.setor],
      ["Endereço", dados.endereco],
      ["Responsável", dados.responsavel],
      ["E-mail", dados.email],
      ["Telefone", dados.telefone],
      ["Horário de Funcionamento", dados.horario],
    ].forEach(([rotulo, valor]) => {
      cy.contains(".info_card_ouv_item strong", rotulo)
        .parent()
        .find("p")
        .should("contain", valor);
    });

    // Confirma que nome e endereco da regulamentacao foram publicados no link correspondente.
    cy.get("#procedimentos_pedidos")
      .should("have.attr", "href", dados.linkRegulamentacao)
      .and("contain", dados.nomeRegulamentacao);
  });

  casosConfiguracao.forEach(([nome, seletor, valor, tipo]) => {
    it(`salva a configuração de ${nome}`, () => {
      cy.get("body").then(($body) => {
        // Algumas configuracoes ficam ocultas para usuarios que nao sao desenvolvedores.
        if (tipo.endsWith("_condicional") && !$body.find(seletor).length) {
          cy.log(`Opção ${nome} indisponível para o usuário atual`);
          return;
        }

        // Altera o campo conforme o tipo de controle renderizado no popup.
        if (tipo.startsWith("texto")) {
          cy.get(seletor).clear().type(valor);
        } else {
          selecionarOpcaoConfiguracao(seletor, valor);
        }

        // Salva, reabre o popup e confirma a persistencia no backend.
        cy.get("#configs-save").click();
        cy.contains("body", "Configurações salvas com sucesso", {
          timeout: 20000,
        }).should("be.visible");
        cy.get("#configs-cancel").click();
        cy.get("#popup_configuracoes").should("not.exist");
        cy.get("#config").click();
        cy.get("#popup_configuracoes", { timeout: 20000 }).should("be.visible");

        if (tipo.startsWith("texto")) {
          cy.get(seletor).should("have.value", valor);
        } else {
          cy.get(`${seletor} .selected p`).should("contain", valor);
        }
      });
    });
  });

  const cenariosAnexo = [
    {
      tipo: "Áudio",
      correto: {
        fileName: "manifestacao-audio.mp3",
        contents: "ID3\nAudio de teste Cypress",
        mimeType: "audio/mpeg",
      },
      incorreto: {
        fileName: "manifestacao-audio-incorreto.pdf",
        contents: "%PDF-1.4\nArquivo incorreto\n%%EOF",
        mimeType: "application/pdf",
      },
    },
    {
      tipo: "Vídeo",
      correto: {
        fileName: "manifestacao-video.mp4",
        contents: "video de teste Cypress",
        mimeType: "video/mp4",
      },
      incorreto: {
        fileName: "manifestacao-video-incorreto.pdf",
        contents: "%PDF-1.4\nArquivo incorreto\n%%EOF",
        mimeType: "application/pdf",
      },
    },
    {
      tipo: "Arquivos compactados",
      correto: {
        fileName: "manifestacao-arquivo.zip",
        contents: "PK\x03\x04 arquivo compactado de teste",
        mimeType: "application/zip",
      },
      incorreto: {
        fileName: "manifestacao-arquivo-incorreto.pdf",
        contents: "%PDF-1.4\nArquivo incorreto\n%%EOF",
        mimeType: "application/pdf",
      },
    },
    {
      tipo: "Imagem",
      correto: {
        fileName: "manifestacao-imagem.png",
        contents: Cypress.Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
        mimeType: "image/png",
      },
      incorreto: {
        fileName: "manifestacao-imagem-incorreto.pdf",
        contents: "%PDF-1.4\nArquivo incorreto\n%%EOF",
        mimeType: "application/pdf",
      },
    },
    {
      tipo: "Documentos",
      correto: {
        fileName: "manifestacao-documento.pdf",
        contents: "%PDF-1.4\nDocumento de teste Cypress\n%%EOF",
        mimeType: "application/pdf",
      },
      incorreto: {
        fileName: "manifestacao-documento-incorreto.mp3",
        contents: "ID3\nAudio incorreto",
        mimeType: "audio/mpeg",
      },
    },
  ];

  cenariosAnexo.forEach(({ tipo, correto, incorreto }) => {
    it(`valida o envio de anexos ${tipo} pelo cidadão e pelo ouvidor`, () => {
      const manifestacao = buildManifestacaoOuvidoria({
        tipo: "solicitacaoservico",
        tipoCadastro: "novo",
      });

      // Habilita somente o tipo de anexo deste caso.
      cy.get(".tipos_multimidia .css-checkbox").uncheck({ force: true });
      cy.get(`.tipos_multimidia .css-checkbox[value="${tipo}"]`).check({
        force: true,
      });
      cy.get("#configs-save").click();
      cy.contains("body", "Configurações salvas com sucesso", {
        timeout: 20000,
      }).should("be.visible");
      cy.get("#configs-cancel").click();

      // Acessa o inicio da Ouvidoria e inicia uma manifestacao pelo portal do cidadao.
      cy.visit("http://localhost:8000/cidadao/ouvidoria/inicio");
      cy.get('a[href="ouvidoria/solicitacaoservico"]', { timeout: 20000 })
        .should("be.visible")
        .click();
      cy.get(".step_manifestacao").should("be.visible");
      cy.selectCustomRandomOption("#select_assunto");
      cy.get("#mensagem").clear().type(manifestacao.mensagem);

      // O arquivo incompatível deve ser rejeitado e o arquivo do tipo habilitado deve ser aceito.
      validarArquivoRejeitado(".step_manifestacao_anexo", incorreto);
      validarArquivoAceito(".step_manifestacao_anexo", correto);
      cy.get(".step_manifestacao_anexo_items").should(
        "contain",
        correto.fileName,
      );
      cy.get("#buttons_next").click();

      // Conclui o cadastro do cidadão para finalizar a manifestação.
      cy.preencherIdentificacaoOuvidoria(manifestacao);
      cy.get("#buttons_next").click();
      cy.preencherCadastroManifestanteOuvidoria(manifestacao);
      cy.preencherNotificacaoOuvidoria(manifestacao);
      cy.get(".step_manifestacao_enviada", { timeout: 20000 }).should(
        "be.visible",
      );
      cy.get(".copy_protocolo span")
        .invoke("text")
        .then((text) => text.replace(/\s+/g, " ").trim())
        .as("protocoloOuvidoria");

      // Abre a manifestação recém-criada no painel para responder como ouvidor.
      cy.get("@protocoloOuvidoria").then((protocolo) => {
        cy.abrirManifestacaoOuvidoriaNoPainel(protocolo);
        validarArquivoRejeitado("#popup_manifestacao .responder", incorreto);
        validarArquivoAceito("#popup_manifestacao .responder", correto);
        cy.selectCustomOption("#popup_manifestacao #tipo_resposta", "Mensagem");
        cy.get("#popup_manifestacao #desc")
          .clear()
          .type(`Resposta com anexo ${tipo} enviada pelo ouvidor.`);
        cy.get("#popup_manifestacao #salvar").click();
      });

      // Confirma que a resposta do ouvidor foi enviada com o anexo permitido.
      cy.contains("body", "Mensagem enviada para o cidadão", {
        timeout: 20000,
      }).should("be.visible");
      cy.get("#popup_manifestacao .container-mensagens").should(
        "contain",
        `Resposta com anexo ${tipo} enviada pelo ouvidor.`,
      );
    });
  });

  ["RG", "Registro Profissional", "Outro", "CNH", "CNPJ"].forEach(
    (tipoIdentificacao) => {
      it(`salva o tipo de identificação ${tipoIdentificacao} oculto`, () => {
        cy.get("body").then(($body) => {
          // A lista de tipos de identificacao e exibida apenas para usuarios desenvolvedores.
          if (!$body.find(".tipos_identificacao .css-checkbox").length) {
            cy.log("Opção disponível somente para usuário desenvolvedor");
            return;
          }

          // Mantem somente o tipo deste caso marcado como oculto.
          cy.get(".tipos_identificacao .css-checkbox").uncheck({ force: true });
          cy.get(
            `.tipos_identificacao .css-checkbox[value="${tipoIdentificacao}"]`,
          ).check({
            force: true,
          });
          // Salva e consulta novamente o popup para validar o valor persistido.
          cy.get("#configs-save").click();
          cy.contains("body", "Configurações salvas com sucesso", {
            timeout: 20000,
          }).should("be.visible");
          cy.get("#configs-cancel").click();
          cy.get("#config").click();
          cy.get("#popup_configuracoes", { timeout: 20000 }).should(
            "be.visible",
          );
          cy.get(
            `.tipos_identificacao .css-checkbox[value="${tipoIdentificacao}"]`,
          ).should("be.checked");
        });
      });
    },
  );

  it("salva as configuracoes carregadas sem erro", () => {
    // Smoke test do salvamento sem alterar manualmente os valores carregados.
    cy.get("#configs-save").should("be.enabled").click();
    cy.contains("body", "Configurações salvas com sucesso", {
      timeout: 20000,
    }).should("be.visible");
  });
});
