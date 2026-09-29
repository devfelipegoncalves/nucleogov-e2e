# NucleoGov E2E

Suíte de testes end-to-end do [NucleoGov](https://nucleogov.com.br/) utilizando [Cypress](https://www.cypress.io/).

O projeto automatiza os principais fluxos públicos e administrativos da plataforma, ajudando a validar o funcionamento das funcionalidades e a prevenir regressões.

## Cobertura

- Fluxos de atendimento da Ouvidoria
- Serviço de Informação ao Cidadão (SIC)
- Autenticação e fluxos administrativos
- Testes de fumaça do portal
- Consultas de transparência MegaSoft — SG Despesas e MG Despesas
- Consultas de transparência Fiorilli — Despesas FRL
- Upload de documentos e anexos
- Validações de identificação, cadastro e envio de solicitações

## Tecnologias

- Node.js
- Cypress
- JavaScript
- ESLint
- Prettier

## Pré-requisitos

- Node.js 18 ou superior
- npm
- Instância do NucleoGov disponível para testes

## Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/devfelipegoncalves/nucleogov-e2e.git
cd nucleogov-e2e
npm install
```

Por padrão, os testes utilizam `http://localhost:8000` como endereço da aplicação.

## Configuração

As configurações podem ser definidas em um arquivo `.env` na raiz do projeto ou diretamente no terminal:

```env
CYPRESS_BASE_URL=http://localhost:8000
CYPRESS_ADMIN_USER=seu_usuario
CYPRESS_ADMIN_PASSWORD=sua_senha
CYPRESS_PORTAL_HOST=localhost
```

O arquivo `.env` não deve ser versionado, pois pode conter credenciais.

Para executar contra outro ambiente:

```bash
CYPRESS_BASE_URL=https://seu-dominio.gov.br npm run cy:run
```

## Execução dos testes

Abrir o Cypress em modo interativo:

```bash
npm run cy:open
```

Executar toda a suíte em modo headless:

```bash
npm run cy:run
```

Executar grupos específicos:

```bash
npm run cy:run:smoke
npm run cy:run:admin
npm run cy:run:portal
```

Executar uma especificação específica:

```bash
npx cypress run --spec 'cypress/e2e/portal/atendimento/ouvidoria/identificacao.cy.js'
```

## Qualidade de código

```bash
npm run lint
npm run format
npm run format:write
```

## Estrutura do projeto

```text
cypress/
├── e2e/              # Especificações dos testes
│   ├── admin/        # Fluxos administrativos
│   ├── portal/       # Fluxos públicos do portal
│   └── smoke/        # Testes essenciais de fumaça
├── fixtures/         # Massas de teste estáticas
└── support/
    ├── commands.js   # Comandos customizados do Cypress
    ├── helpers/      # Geração de dados e regras reutilizáveis
    └── selectors/    # Seletores centralizados
docs/                 # Documentação complementar dos fluxos
```

Os helpers concentram a geração de massa e as regras comuns, enquanto as especificações validam o comportamento funcional de cada fluxo.

## Documentação

- [Documentação detalhada da suíte](readme.md)
- [Testes de Ouvidoria](docs/ouvidoria-cypress.md)
- [Testes do SIC](docs/sic-cypress.md)
- [Cobertura de documentação e anexos](docs/cobertura-documentacao-anexos.md)
- [Testes MegaSoft — MG Despesas](docs/megasoft-mgdespesas.md)
- [Fiorilli — filtro avançado de Despesas FRL](docs/fiorilli-despesasfrl-filtro-avancado.md)
- [Fiorilli — exportações de Despesas FRL](docs/fiorilli-despesasfrl-exportacoes.md)

## Licença

Este projeto é privado e destinado ao uso interno do NucleoGov.
