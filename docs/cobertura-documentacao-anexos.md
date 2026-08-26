# Cobertura de Documentação e Anexos

Este documento resume a cobertura específica criada para validação de tipos de documento e upload de anexos em `ouvidoria` e `sic`.

## Objetivo

Garantir que os dois módulos aceitam:

- todos os tipos principais de identificação disponíveis no portal
- anexos reais no primeiro passo do fluxo
- os ramos especiais que mudam a navegação

## Ouvidoria

Spec dedicada:

- [cypress/e2e/portal/atendimento/ouvidoria/documentacao-anexos.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/documentacao-anexos.cy.js)

Cobertura:

- `CPF` com anexos
- `CNPJ` com anexos
- `RG` com anexos
- `CNH` com anexos
- `Registro Profissional` com `CRM` e anexos
- `Outro` com `Passaporte` e anexos
- `denúncia anônima` com anexos

## SIC

Spec dedicada:

- [cypress/e2e/portal/atendimento/sic/documentacao-anexos.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/sic/documentacao-anexos.cy.js)

Cobertura:

- `CPF` com anexos
- `CNPJ` com anexos
- `RG` com anexos
- `CNH` com anexos
- `Registro Profissional` com `CRM` e anexos
- `Outro` com `Passaporte` e anexos

## Execução

Ouvidoria:

```bash
npx cypress run --spec 'cypress/e2e/portal/atendimento/ouvidoria/documentacao-anexos.cy.js'
```

SIC:

```bash
npx cypress run --spec 'cypress/e2e/portal/atendimento/sic/documentacao-anexos.cy.js'
```

Tudo junto:

```bash
npx cypress run --spec 'cypress/e2e/portal/atendimento/{ouvidoria,sic}/**/*.cy.js'
```
