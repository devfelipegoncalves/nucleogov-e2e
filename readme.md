# Nucleogov E2E

Suite de testes E2E do Nucleogov usando Cypress.

Este repositório concentra os fluxos públicos e administrativos que hoje estão automatizados, com foco principal em:

- Ouvidoria
- SIC
- fluxos administrativos que dependem de protocolo gerado no portal

## Instalação

```bash
npm install
```

## Scripts

```bash
npm run cy:open
npm run cy:run
npm run cy:run:smoke
npm run cy:run:admin
npm run cy:run:portal
npm run lint
```

Execuções úteis:

```bash
npm run cy:run -- --spec 'cypress/e2e/portal/atendimento/ouvidoria/identificacao.cy.js'
npx cypress run --spec 'cypress/e2e/portal/atendimento/ouvidoria/**/*.cy.js'
npx cypress run --spec 'cypress/e2e/portal/atendimento/sic/**/*.cy.js'
```

## Estrutura

```text
cypress/
  e2e/
    admin/
    portal/
      atendimento/
        ouvidoria/
        sic/
      transparencia/
        megasoft/
          mgdespesas/
          sgdespesas/
    smoke/
  support/
    commands.js
    e2e.js
    helpers/
      ouvidoria.js
      sic.js
docs/
  ouvidoria-cypress.md
  sic-cypress.md
  cobertura-documentacao-anexos.md
```

## Organização da Base

O projeto foi separado em três níveis:

- `helpers`: geram massa e padronizam dados
- `commands`: encapsulam interação com o portal
- `specs`: validam comportamento funcional

Essa divisão existe porque Ouvidoria e SIC:

- têm fluxo multi-step
- mudam os campos conforme o tipo de identificação
- podem cair em `cadastro novo` ou `usuário já cadastrado`
- usam selects customizados, não `select` nativo
- montam parte do DOM via JS

## Configuração do Cypress

Arquivo:

- [cypress.config.js](/home/felipenucleo/nucleogov-e2e/cypress.config.js)

Pontos principais:

- `baseUrl`: `http://localhost:8000` por padrão
- `supportFile`: `cypress/support/e2e.js`
- `screenshotsFolder`: `cypress/artifacts/screenshots`
- `videosFolder`: `cypress/artifacts/videos`
- `viewportWidth`: `1440`
- `viewportHeight`: `900`

Variáveis lidas do ambiente:

- `CYPRESS_BASE_URL`
- `CYPRESS_ADMIN_USER`
- `CYPRESS_ADMIN_PASSWORD`
- `CYPRESS_PORTAL_HOST`

## Executar em Domínio Real

Documentação dos testes MegaSoft:

- [MegaSoft — MG Despesas](docs/megasoft-mgdespesas.md)

Hoje a troca principal de ambiente fica centralizada em:

- `CYPRESS_BASE_URL`

Essa variável já é usada em [cypress.config.js](/home/felipenucleo/nucleogov-e2e/cypress.config.js), então a maior parte da suíte troca de ambiente sem precisar alterar as specs.

### Exemplo via terminal

```bash
CYPRESS_BASE_URL='https://seu-dominio.gov.br' npm run cy:run
```

### Exemplo no `.env`

```bash
CYPRESS_BASE_URL=https://seu-dominio.gov.br
```

Se também precisar rodar fluxos administrativos no domínio real:

```bash
CYPRESS_ADMIN_USER=seu_usuario
CYPRESS_ADMIN_PASSWORD=sua_senha
```

### O que já funciona só com a troca da URL

- specs que usam `cy.visitPortal()`
- specs que usam rotas relativas
- commands que entram por caminhos como `/ouvidoria/...`, `/painel` e `/cidadao/informacao/sic`

### Quando a troca de URL sozinha pode não ser suficiente

- quando o domínio real usa rotas diferentes do ambiente local
- quando algum módulo está desabilitado no ambiente real
- quando o conteúdo dos selects muda a ponto de invalidar uma asserção por texto
- quando o ambiente real possui bloqueios anti-spam, captcha ou regras extras de autenticação

Resumo:

- se o domínio real mantiver a mesma estrutura de rotas e o mesmo frontend, a troca pode ser feita em um único lugar
- se o comportamento funcional do ambiente mudar, aí será necessário ajustar as specs afetadas

## Support Global

Arquivo:

- [cypress/support/e2e.js](/home/felipenucleo/nucleogov-e2e/cypress/support/e2e.js)

O que esse arquivo faz:

- carrega `commands.js`
- ajusta o viewport antes de cada teste
- ignora dois erros conhecidos do frontend que não invalidam o resultado funcional

Erros ignorados hoje:

- `Cannot read properties of undefined (reading 'getValue')`
- `Cannot read properties of undefined (reading 'settings')`

O segundo aparece especialmente no `uploadifive`.

## Helper da Ouvidoria

Arquivo:

- [cypress/support/helpers/ouvidoria.js](/home/felipenucleo/nucleogov-e2e/cypress/support/helpers/ouvidoria.js)

### `TIPOS_MANIFESTACAO`

Mapa interno usado para traduzir um tipo lógico do teste em rota e metadados:

- `denuncia` -> `slug: denuncia`, `tipoId: 1`, `titulo: Denúncia`
- `reclamacao` -> `slug: reclamacao`, `tipoId: 2`, `titulo: Reclamação`
- `sugestao` -> `slug: sugestao`, `tipoId: 3`, `titulo: Sugestão`
- `elogio` -> `slug: elogio`, `tipoId: 4`, `titulo: Elogio`
- `solicitacaoservico` -> `slug: solicitacaoservico`, `tipoId: 5`, `titulo: Solicitação`

### `gerarCpfValido()`

Gera um CPF sintético válido.

Uso:

- testes de máscara
- testes de validação de documento
- cenários em que o fluxo exige um documento novo

### `gerarCnpjValido()`

Gera um CNPJ sintético válido.

Uso:

- troca de máscara no formulário
- cenários com CNPJ
- cadastros que exigem representante

### `gerarDataNascimento()`

Gera uma data no formato `dd/mm/aaaa`.

Uso:

- preenchimento dos campos opcionais

### `buildManifestacaoOuvidoria(overrides = {})`

É a massa base da Ouvidoria. Sempre retorna um objeto completo, com padrão seguro para o fluxo inteiro.

Campos retornados:

- `tipo`: tipo lógico da manifestação
- `slug`: rota pública derivada do tipo
- `tipoId`: id interno do tipo
- `titulo`: nome humano do tipo
- `assunto`: assunto específico, ou `null` para seleção aleatória
- `mensagem`: texto principal da manifestação
- `tipoCadastro`: `novo` ou `existente`
- `identificacao`: `CPF`, `CNPJ`, `RG`, `CNH`, `Registro Profissional`, `Outro` ou `anonimo`
- `numeroIdentificacao`: documento usado no passo 2
- `nome`: nome do manifestante
- `nomeRepresentante`: representante quando houver `CNPJ`
- `email`: email do manifestante
- `telefone`: telefone do manifestante
- `preencherCamposOpcionais`: liga o bloco opcional do cadastro
- `dataNascimento`
- `cep`
- `endereco`
- `anexos`: lista de arquivos do primeiro passo
- `desejaNotificacaoEmail`: controla `#assinatura_email`
- `preservarIdentidade`: controla `#reserva_identidade`
- `assumeResponsabilidade`: controla `#assume_responsabilidade`

### O que são `overrides`

`overrides` é um objeto parcial usado para sobrescrever só o que o cenário precisa mudar.

Exemplo:

```js
cy.criarManifestacaoOuvidoria({
  tipo: "denuncia",
  identificacao: "anonimo",
  anexos: [
    {
      fileName: "evidencia.pdf",
      contents: "%PDF-1.4 teste",
      mimeType: "application/pdf",
    },
  ],
});
```

Nesse exemplo:

- todo o resto continua vindo da massa padrão
- só `tipo`, `identificacao` e `anexos` foram alterados

### `buildSolicitacaoOuvidoria(overrides = {})`

Atalho para:

```js
buildManifestacaoOuvidoria({
  tipo: "solicitacaoservico",
  ...overrides,
});
```

Serve para manter compatibilidade com specs antigas que tratavam Ouvidoria sempre como solicitação.

## Helper do SIC

Arquivo:

- [cypress/support/helpers/sic.js](/home/felipenucleo/nucleogov-e2e/cypress/support/helpers/sic.js)

### `buildSolicitacaoSic(overrides = {})`

É a massa base do SIC.

Campos retornados:

- `mensagem`: descrição inicial da solicitação
- `tipoCadastro`: `novo` ou `existente`
- `identificacao`: `CPF`, `CNPJ`, `RG`, `CNH`, `Registro Profissional` ou `Outro`
- `numeroIdentificacao`: CPF/CNPJ válido ou documento informado
- `tipoDocumento`: nome do documento complementar para `Registro Profissional` e `Outro`
- `nome`
- `nomeRepresentante`: obrigatório em cenários `CNPJ`
- `email`
- `telefone`
- `preencherCamposOpcionais`
- `dataNascimento`
- `cep`
- `endereco`
- `anexos`
- `desejaNotificacaoEmail`
- `sigilo`: controla `#sigilo`
- `covid`: controla `#covid`

Regra importante:

- se `identificacao === "CNPJ"` e `numeroIdentificacao` não for informado, o helper gera um CNPJ válido
- nos demais casos, gera CPF válido por padrão

Exemplo:

```js
cy.criarSolicitacaoSic({
  identificacao: "Registro Profissional",
  tipoDocumento: "CRM",
  numeroIdentificacao: "123456",
  anexos: [
    {
      fileName: "crm.pdf",
      contents: "%PDF-1.4 crm",
      mimeType: "application/pdf",
    },
  ],
});
```

## Estrutura de Anexo

Ouvidoria e SIC usam o mesmo formato de item em `anexos`:

```js
{
  fileName: "arquivo.pdf",
  contents: "%PDF-1.4 exemplo",
  mimeType: "application/pdf"
}
```

Campos:

- `fileName`: nome que o portal deve exibir
- `contents`: conteúdo enviado pelo Cypress
- `mimeType`: tipo MIME do arquivo

## Commands Compartilhados

Arquivo:

- [cypress/support/commands.js](/home/felipenucleo/nucleogov-e2e/cypress/support/commands.js)

### `cy.visitPage(path, options)`

Abre a página e ainda valida se os assets básicos do Nucleogov realmente carregaram.

Internamente:

- chama `cy.visit`
- confirma presença de CSS
- confirma presença de JS
- confirma `requirejs` carregado

Isso evita falso positivo em página quebrada visualmente.

### `cy.visitPortal(path = "/")`

Atalho para rotas públicas.

### `cy.loginAdmin(overrides = {})`

Faz login no painel usando:

- `CYPRESS_ADMIN_USER`
- `CYPRESS_ADMIN_PASSWORD`

Ou usando override:

```js
cy.loginAdmin({
  user: "admin",
  password: "senha",
});
```

### `cy.selectCustomOption(containerSelector, optionLabel)`

Resolve os selects customizados do projeto.

Uso:

```js
cy.selectCustomOption("#identificacao", "CPF");
```

Passos internos:

- abre o dropdown
- encontra a opção pelo texto
- clica forçado
- valida o texto selecionado

### `cy.selectCustomRandomOption(containerSelector)`

Seleciona uma opção aleatória dentro do dropdown.

É útil quando:

- o cenário não depende de um valor específico
- basta garantir que o portal avançou com uma opção válida

### `cy.anexarArquivosUpload(scopeSelector, arquivos)`

Encapsula o `uploadifive`.

Problema que esse command resolve:

- o input de arquivo é recriado a cada upload
- portanto o Cypress precisa reconsultar `input[type='file']` a cada item

Passos internos:

- pega o último input do container
- faz `selectFile`
- valida se o nome do arquivo apareceu no container do upload

Exemplo:

```js
cy.anexarArquivosUpload(".step_solicitacao_anexo", [
  {
    fileName: "teste.pdf",
    contents: "%PDF-1.4 teste",
    mimeType: "application/pdf",
  },
]);
```

## Commands da Ouvidoria

### `cy.iniciarManifestacaoOuvidoria(overrides = {})`

Executa o passo 1 da Ouvidoria.

O que faz:

- monta a massa com `buildManifestacaoOuvidoria`
- abre `/ouvidoria/${slug}`
- seleciona assunto
- preenche mensagem
- faz upload de anexos, se existir
- avança para identificação

Observação:

- se `assunto` não for informado, escolhe um assunto aleatório válido

### `cy.iniciarSolicitacaoOuvidoria(overrides = {})`

Atalho para iniciar a Ouvidoria já como `solicitacaoservico`.

### `cy.preencherIdentificacaoOuvidoria(overrides = {})`

Executa só o passo de identificação.

Regras internas:

- traduz `anonimo` para o label `Anônimo`
- preenche `#tipo_identificacao` apenas para `Registro Profissional` e `Outro`
- esconde o número do documento quando o cenário é anônimo

### `cy.avancarParaCadastroManifestanteOuvidoria(overrides = {})`

Executa:

1. primeiro passo
2. identificação
3. avanço para o cadastro

Uso ideal:

- specs de persistência do passo 2

### `cy.avancarAposIdentificacaoOuvidoria(overrides = {})`

Esse command é importante porque o fluxo pode tomar três caminhos:

- denúncia anônima: vai direto para o estado final
- documento existente: abre `.step_usuario_cadastrado`
- documento novo: abre `.step_cadastro_manifestante`

Esse desvio foi centralizado aqui para as specs não duplicarem regras do portal.

### `cy.preencherCamposOpcionaisCadastroOuvidoria(overrides = {})`

Só preenche se:

```js
preencherCamposOpcionais: true;
```

Campos cobertos:

- `#data_nasc`
- `#cep`
- `#endereco`
- `#profissao`
- `#sexo`
- `#raca`
- `#escolaridade`
- `#estado_id`
- `#cidade_id`

### `cy.preencherCadastroManifestanteOuvidoria(overrides = {})`

Preenche o cadastro novo.

Campos principais:

- `#numero_identificacao`
- `#nome`
- `#nome_representante` quando `CNPJ`
- `#email`
- `#telefone`

Switches controlados por override:

- `desejaNotificacaoEmail`
- `preservarIdentidade`
- `assumeResponsabilidade`

### `cy.prosseguirUsuarioCadastradoOuvidoria(overrides = {})`

Valida:

- nome no card
- documento no card

Depois avança para a etapa seguinte.

### `cy.preencherNotificacaoOuvidoria(overrides = {})`

Preenche:

- `#email`
- `#telefone`

E avança para o envio.

### `cy.criarManifestacaoOuvidoria(overrides = {})`

É o fluxo ponta a ponta da Ouvidoria.

O command:

- decide o ramo correto após a identificação
- resolve novo cadastro ou usuário existente
- passa pela notificação quando aplicável
- valida a tela final
- expõe aliases para reuso posterior

Aliases expostos:

- `@protocoloOuvidoria`
- `@codigoAcessoOuvidoria`

### `cy.criarSolicitacaoOuvidoria(overrides = {})`

Mesmo fluxo acima, mas sempre com:

```js
tipo: "solicitacaoservico";
```

### `cy.abrirManifestacaoOuvidoriaNoPainel(protocolo)`

Abre o popup administrativo do protocolo.

Útil para specs do painel que dependem de manifestação real criada no portal.

### `cy.acompanharManifestacaoOuvidoria(protocolo, codigoAcesso)`

Abre a manifestação pública pelo acompanhamento.

Uso:

- validar o que o cidadão enxerga após ações do painel

## Commands do SIC

### `cy.abrirHomeSic()`

Abre a home pública correta do ambiente atual:

```text
/cidadao/informacao/sic
```

### `cy.iniciarSolicitacaoSic(overrides = {})`

Executa o passo 1 do SIC.

O que faz:

- abre a home do SIC
- clica no link `sic_solicitar`
- preenche mensagem
- faz upload de anexos, se houver
- avança para identificação

### `cy.preencherIdentificacaoSic(overrides = {})`

Executa só o passo de identificação do SIC.

Regras:

- preenche `#tipo_identificacao` em `Registro Profissional` e `Outro`
- mantém o comportamento de máscara por documento

### `cy.avancarAposIdentificacaoSic(overrides = {})`

Resolve o desvio do SIC:

- cadastro novo
- card de usuário já cadastrado

### `cy.preencherCamposOpcionaisCadastroSic(overrides = {})`

Só roda quando:

```js
preencherCamposOpcionais: true;
```

Campos cobertos:

- `#data_nasc`
- `#cep`
- `#endereco`
- `#profissao`
- `#sexo`
- `#raca`
- `#escolaridade`
- `#estado_id`
- `#cidade_id`

### `cy.preencherCadastroSolicitanteSic(overrides = {})`

Preenche o cadastro novo do SIC.

Campos:

- `#numero_identificacao`
- `#nome`
- `#nome_representante` quando `CNPJ`

Switches:

- `desejaNotificacaoEmail`
- `sigilo`
- `covid`

### `cy.prosseguirUsuarioCadastradoSic(overrides = {})`

Valida o card de usuário existente e avança.

### `cy.preencherNotificacaoSic(overrides = {})`

Preenche:

- `#email`
- `#telefone`

### `cy.criarSolicitacaoSic(overrides = {})`

Fluxo ponta a ponta do SIC.

Alias exposto:

- `@protocoloSic`

## Exemplos de Uso

### Ouvidoria: solicitação simples

```js
cy.criarSolicitacaoOuvidoria({
  identificacao: "CPF",
});
```

### Ouvidoria: denúncia anônima com anexos

```js
cy.criarManifestacaoOuvidoria({
  tipo: "denuncia",
  identificacao: "anonimo",
  anexos: [
    {
      fileName: "denuncia.pdf",
      contents: "%PDF-1.4 evidencia",
      mimeType: "application/pdf",
    },
  ],
});
```

Importante:

- denúncia anônima só existe na Ouvidoria
- ela fica na aba `Denúncias`
- não existe cenário anônimo no SIC

### Ouvidoria: usuário existente

```js
const numeroIdentificacao = gerarCpfValido();

cy.criarSolicitacaoOuvidoria({
  tipoCadastro: "novo",
  identificacao: "CPF",
  numeroIdentificacao,
  nome: "Usuario Base",
  email: "base@example.com",
});

cy.criarSolicitacaoOuvidoria({
  tipoCadastro: "existente",
  identificacao: "CPF",
  numeroIdentificacao,
  nome: "Usuario Base",
  email: "base@example.com",
});
```

### SIC: CNPJ com representante

```js
cy.criarSolicitacaoSic({
  identificacao: "CNPJ",
  numeroIdentificacao: "12345678000195",
  nome: "Empresa Teste LTDA",
  nomeRepresentante: "Responsavel Teste",
  email: "empresa@example.com",
});
```

### SIC: documento complementar

```js
cy.criarSolicitacaoSic({
  identificacao: "Outro",
  tipoDocumento: "Passaporte",
  numeroIdentificacao: "AB123456",
});
```

## Specs Relevantes

Ouvidoria:

- [cypress/e2e/portal/atendimento/ouvidoria/identificacao.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/identificacao.cy.js)
- [cypress/e2e/portal/atendimento/ouvidoria/cadastro.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/cadastro.cy.js)
- [cypress/e2e/portal/atendimento/ouvidoria/documentacao-anexos.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/documentacao-anexos.cy.js)

SIC:

- [cypress/e2e/portal/atendimento/sic/identificacao.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/sic/identificacao.cy.js)
- [cypress/e2e/portal/atendimento/sic/cadastro.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/sic/cadastro.cy.js)
- [cypress/e2e/portal/atendimento/sic/documentacao-anexos.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/sic/documentacao-anexos.cy.js)

## Documentação Complementar

- [docs/ouvidoria-cypress.md](/home/felipenucleo/nucleogov-e2e/docs/ouvidoria-cypress.md)
- [docs/sic-cypress.md](/home/felipenucleo/nucleogov-e2e/docs/sic-cypress.md)
- [docs/cobertura-documentacao-anexos.md](/home/felipenucleo/nucleogov-e2e/docs/cobertura-documentacao-anexos.md)

## Convenções para Novas Specs

- prefira usar `buildManifestacaoOuvidoria()` e `buildSolicitacaoSic()` indiretamente via commands
- só informe `overrides` que o cenário realmente precisa alterar
- quando o documento puder já existir no ambiente, aceite o ramo de `usuário cadastrado`
- quando precisar evitar colisão com a base local, gere documentos únicos
- para upload, use sempre extensões suportadas pelo portal, como `.pdf` e `.csv`
- se o cenário depende de Ouvidoria anônima, mantenha isso somente na rota de `denúncia`
