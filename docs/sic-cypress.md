# SIC no Cypress

Este documento descreve a organização atual da automação do SIC no repositório `nucleogov-e2e`, os custom commands criados, as validações já cobertas e a forma recomendada de expandir os testes.

## Objetivo

A automação do SIC foi estruturada para reduzir duplicação em um fluxo que:

- tem múltiplos passos
- muda campos conforme o tipo de identificação
- desvia entre cadastro novo e usuário já cadastrado
- usa `select` customizado em vez de `select` nativo
- depende de JS para renderizar e avançar entre etapas

Por isso, a base foi separada entre:

- `helpers`: massa de dados e regras utilitárias
- `commands`: ações reutilizáveis
- `specs`: cenários funcionais

## Estrutura dos Arquivos

### Helper de domínio

Arquivo:

- [cypress/support/helpers/sic.js](/home/felipenucleo/nucleogov-e2e/cypress/support/helpers/sic.js)

Responsabilidades:

- gerar massa padrão da solicitação
- escolher CPF ou CNPJ válido conforme o cenário
- gerar data de nascimento formatada
- permitir `overrides` por cenário

Funções disponíveis:

- `buildSolicitacaoSic(overrides)`

### Commands

Arquivo:

- [cypress/support/commands.js](/home/felipenucleo/nucleogov-e2e/cypress/support/commands.js)

Responsabilidades:

- abrir a home pública do SIC
- encapsular a navegação até o formulário
- preencher os passos do fluxo
- tratar cadastro novo
- tratar o card de usuário já cadastrado
- criar solicitações ponta a ponta

Commands disponíveis:

- `cy.abrirHomeSic()`
- `cy.iniciarSolicitacaoSic(overrides)`
- `cy.preencherIdentificacaoSic(overrides)`
- `cy.avancarAposIdentificacaoSic(overrides)`
- `cy.preencherCamposOpcionaisCadastroSic(overrides)`
- `cy.preencherCadastroSolicitanteSic(overrides)`
- `cy.prosseguirUsuarioCadastradoSic(overrides)`
- `cy.preencherNotificacaoSic(overrides)`
- `cy.criarSolicitacaoSic(overrides)`

## Rotas Públicas

Rotas públicas utilizadas:

```text
/cidadao/informacao/sic
/ouvidoria/sic_solicitar
/ouvidoria/sic_acompanhar
```

Observação:

- a home válida do ambiente atual é `/cidadao/informacao/sic`
- o formulário continua sendo acessado a partir do link `sic_solicitar`

## Fluxo Atual Automatizado

Fluxo base coberto hoje:

1. abrir a home do SIC
2. navegar para o formulário público
3. preencher a mensagem inicial
4. avançar para identificação
5. selecionar tipo de identificação
6. preencher documento
7. decidir o ramo do cadastro:
8. `novo documento` -> abrir cadastro completo do solicitante
9. `documento existente` -> abrir card de usuário já cadastrado
10. avançar para notificação
11. confirmar e-mail e telefone
12. enviar solicitação
13. validar a tela de sucesso
14. capturar o texto do protocolo

## Como os Commands Foram Divididos

### `cy.abrirHomeSic()`

Uso:

- centraliza a rota pública correta do SIC
- valida a presença do módulo antes dos fluxos internos

### `cy.iniciarSolicitacaoSic()`

Uso:

- entra pela home do SIC
- clica no link correto do formulário
- preenche o primeiro passo
- para antes da identificação

Ideal para testes de:

- mensagem obrigatória
- mensagem curta
- disponibilidade do formulário

### `cy.preencherIdentificacaoSic()`

Uso:

- interage apenas com o passo de identificação
- respeita campos dinâmicos
- preenche `tipo_identificacao` quando necessário

Ideal para testes de:

- máscara de CPF
- máscara de CNPJ
- campo extra de `Registro Profissional`
- campo extra de `Outro`

### `cy.avancarAposIdentificacaoSic()`

Uso:

- resolve o desvio após a identificação
- abre cadastro novo quando o documento não existe
- abre card resumido quando o documento já existe

### `cy.preencherCamposOpcionaisCadastroSic()`

Uso:

- preenche os campos opcionais do cadastro do solicitante
- seleciona opções aleatórias em campos dependentes

Campos opcionais cobertos:

- `data_nasc`
- `cep`
- `endereco`
- `profissao`
- `sexo`
- `raca`
- `escolaridade`
- `estado`
- `cidade`

### `cy.preencherCadastroSolicitanteSic()`

Uso:

- executa o ramo de cadastro novo
- preenche obrigatórios
- preenche opcionais quando `preencherCamposOpcionais = true`
- ajusta os switches do formulário

### `cy.prosseguirUsuarioCadastradoSic()`

Uso:

- valida o card de usuário existente
- confirma nome e documento
- segue para o próximo passo

### `cy.preencherNotificacaoSic()`

Uso:

- preenche a etapa de notificação
- confirma e-mail e telefone antes do envio

### `cy.criarSolicitacaoSic()`

Uso:

- executa o fluxo ponta a ponta
- decide automaticamente entre cadastro novo e cadastro existente
- valida a tela final de sucesso
- expõe o alias `@protocoloSic`

## Specs Atuais

Arquivos:

- [cypress/e2e/portal/atendimento/sic/home.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/sic/home.cy.js)
- [cypress/e2e/portal/atendimento/sic/documentacao-anexos.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/sic/documentacao-anexos.cy.js)
- [cypress/e2e/portal/atendimento/sic/obrigatorios.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/sic/obrigatorios.cy.js)
- [cypress/e2e/portal/atendimento/sic/identificacao.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/sic/identificacao.cy.js)
- [cypress/e2e/portal/atendimento/sic/cadastro.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/sic/cadastro.cy.js)
- [cypress/e2e/portal/atendimento/sic/solicitacao-envio.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/sic/solicitacao-envio.cy.js)

Cobertura atual:

- home do SIC
- mensagem obrigatória
- mensagem curta
- identificação obrigatória
- CPF inválido
- CNPJ inválido
- tipo de documento obrigatório para `Registro Profissional`
- nome completo obrigatório no cadastro
- máscaras e persistência de `CPF`, `CNPJ`, `RG`, `CNH`, `Registro Profissional` e `Outro`
- abertura de cadastro novo
- reaproveitamento de usuário já cadastrado
- envio ponta a ponta da solicitação
- envio com anexos
- envio com `CPF`, `CNPJ`, `RG`, `CNH`, `Registro Profissional/CRM` e `Outro`

## Execução

Para executar apenas a suíte do SIC:

```bash
npx cypress run --spec 'cypress/e2e/portal/atendimento/sic/**/*.cy.js'
```

Para checar lint:

```bash
npm run lint
```
