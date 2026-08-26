# Ouvidoria no Cypress

Este documento descreve a organização atual da automação da Ouvidoria no repositório `nucleogov-e2e`, os custom commands criados, as validações já cobertas e a forma recomendada de expandir os testes.

## Objetivo

A automação da Ouvidoria foi estruturada para reduzir duplicação em um fluxo que:

- tem múltiplos passos
- muda campos conforme o tipo de identificação
- muda comportamento conforme o tipo de manifestação
- usa `select` customizado em vez de `select` nativo
- depende de JS para renderizar e avançar entre etapas

Por isso, a base foi separada entre:

- `helpers`: massa de dados e regras utilitárias
- `commands`: ações reutilizáveis
- `specs`: cenários funcionais

## Estrutura dos Arquivos

### Helper de domínio

Arquivo:

- [cypress/support/helpers/ouvidoria.js](/home/felipenucleo/nucleogov-e2e/cypress/support/helpers/ouvidoria.js)

Responsabilidades:

- gerar massa padrão das manifestações
- gerar CPF válido
- gerar CNPJ válido
- gerar data de nascimento formatada
- permitir `overrides` por cenário

Funções disponíveis:

- `buildManifestacaoOuvidoria(overrides)`
- `buildSolicitacaoOuvidoria(overrides)`
- `gerarCpfValido()`
- `gerarCnpjValido()`
- `gerarDataNascimento()`

Mapa de tipos:

- `denuncia`
- `reclamacao`
- `sugestao`
- `elogio`
- `solicitacaoservico`

### Commands

Arquivo:

- [cypress/support/commands.js](/home/felipenucleo/nucleogov-e2e/cypress/support/commands.js)

Responsabilidades:

- validar carregamento de CSS e JS nas páginas
- encapsular interação com selects customizados
- navegar pelos passos da Ouvidoria
- preencher o cadastro novo
- tratar o card de usuário já cadastrado
- criar manifestações ponta a ponta
- tratar fluxos administrativos do painel e do acompanhamento público

Commands disponíveis:

- `cy.visitPage(path, options)`
- `cy.visitPortal(path)`
- `cy.loginAdmin(overrides)`
- `cy.abrirManifestacaoOuvidoriaNoPainel(protocolo)`
- `cy.anexarArquivosUpload(scopeSelector, arquivos, titleSelector)`
- `cy.acompanharManifestacaoOuvidoria(protocolo, codigoAcesso)`
- `cy.selectCustomOption(containerSelector, optionLabel)`
- `cy.selectCustomRandomOption(containerSelector)`
- `cy.preencherCamposOpcionaisCadastroOuvidoria(overrides)`
- `cy.iniciarManifestacaoOuvidoria(overrides)`
- `cy.iniciarSolicitacaoOuvidoria(overrides)`
- `cy.preencherIdentificacaoOuvidoria(overrides)`
- `cy.avancarParaCadastroManifestanteOuvidoria(overrides)`
- `cy.avancarAposIdentificacaoOuvidoria(overrides)`
- `cy.preencherCadastroManifestanteOuvidoria(overrides)`
- `cy.prosseguirUsuarioCadastradoOuvidoria(overrides)`
- `cy.preencherNotificacaoOuvidoria(overrides)`
- `cy.criarManifestacaoOuvidoria(overrides)`
- `cy.criarSolicitacaoOuvidoria(overrides)`

## Tipos Cobertos

Atualmente a base cobre:

- `solicitacaoservico`
- `elogio`
- `sugestao`
- `reclamacao`
- `denuncia`

Mapeamento interno do projeto:

- `denuncia` -> `tipo_id = 1`
- `reclamacao` -> `tipo_id = 2`
- `sugestao` -> `tipo_id = 3`
- `elogio` -> `tipo_id = 4`
- `solicitacaoservico` -> `tipo_id = 5`

## Rotas Públicas

Rotas públicas utilizadas:

```text
/ouvidoria/denuncia
/ouvidoria/reclamacao
/ouvidoria/sugestao
/ouvidoria/elogio
/ouvidoria/solicitacaoservico
```

## Rotas Administrativas

Rotas administrativas utilizadas:

```text
/painel
/painel/ouvidoria/manifestacoes
```

## Fluxo Atual Automatizado

Fluxo base coberto hoje:

1. abrir a página do tipo de manifestação
2. selecionar assunto
3. preencher mensagem
4. avançar para identificação
5. selecionar tipo de identificação
6. preencher documento
7. decidir o ramo do cadastro:
8. `novo documento` -> abrir cadastro completo do manifestante
9. `documento existente` -> abrir card de usuário já cadastrado
10. em denúncia anônima -> pular cadastro e card
11. avançar para notificação, quando aplicável
12. confirmar e-mail e telefone, quando aplicável
13. enviar manifestação
14. validar a tela de sucesso
15. capturar protocolo e código de acesso

Observação:

- o protocolo e o código de acesso capturados no portal são a base dos testes administrativos, porque permitem reabrir a mesma manifestação no painel e no acompanhamento público sem depender de `id` fixo ou seed de banco

## Como os Commands Foram Divididos

Quando o cenário não informa `assunto`, o command escolhe uma opção aleatória do select de assunto disponível no ambiente.

### `cy.iniciarManifestacaoOuvidoria()`

Uso:

- prepara a página
- preenche o primeiro passo
- para antes do bloco de identificação

Ideal para testes de:

- assunto obrigatório
- mensagem obrigatória
- mensagem curta
- anexo

### `cy.iniciarSolicitacaoOuvidoria()`

Uso:

- alias específico para o tipo `solicitacaoservico`
- mantém compatibilidade com os testes que já existiam antes da generalização

### `cy.preencherIdentificacaoOuvidoria()`

Uso:

- interage apenas com o passo de identificação
- respeita campos dinâmicos
- preenche `tipo_identificacao` quando necessário
- trata `Anônimo` em denúncia

Ideal para testes de:

- máscara de CPF
- máscara de CNPJ
- campo extra de `Registro Profissional`
- campo extra de `Outro`
- comportamento de `Anônimo`

### `cy.avancarParaCadastroManifestanteOuvidoria()`

Uso:

- executa o passo 1
- executa o passo 2
- valida chegada ao cadastro do manifestante

Ideal para testes de:

- persistência dos campos ao avançar
- comportamento do formulário seguinte

### `cy.avancarAposIdentificacaoOuvidoria()`

Uso:

- resolve o desvio após a identificação
- abre cadastro novo quando o documento não existe
- abre card resumido quando o documento já existe
- vai direto ao sucesso quando a denúncia é anônima

### `cy.preencherCamposOpcionaisCadastroOuvidoria()`

Uso:

- preenche os campos opcionais do cadastro do manifestante
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

### `cy.preencherCadastroManifestanteOuvidoria()`

Uso:

- executa o ramo de cadastro novo
- preenche obrigatórios
- preenche opcionais quando `preencherCamposOpcionais = true`
- ajusta os switches

### `cy.prosseguirUsuarioCadastradoOuvidoria()`

Uso:

- valida o card de usuário existente
- confirma nome e documento
- segue para o próximo passo

### `cy.preencherNotificacaoOuvidoria()`

Uso:

- preenche a etapa de notificação
- confirma e-mail e telefone antes do envio

### `cy.criarManifestacaoOuvidoria()`

Uso:

- faz o fluxo ponta a ponta para qualquer tipo
- escolhe automaticamente entre cadastro novo, existente ou anônimo
- expõe aliases com os dados finais

Aliases criados:

- `@protocoloOuvidoria`
- `@codigoAcessoOuvidoria`

### `cy.criarSolicitacaoOuvidoria()`

Uso:

- alias específico para `cy.criarManifestacaoOuvidoria({ tipo: "solicitacaoservico" })`

### `cy.abrirManifestacaoOuvidoriaNoPainel()`

Uso:

- abre a listagem administrativa já filtrada pelo protocolo
- aproveita o comportamento nativo do painel que abre o popup via querystring
- evita depender do `id` interno da manifestação

Fluxo:

1. acessar `/painel/ouvidoria/manifestacoes?protocolo=...`
2. aguardar o popup `#popup_manifestacao`
3. validar o protocolo exibido no card

### `cy.anexarArquivosUpload()`

Uso:

- envia arquivos para componentes `Uploadifive`
- reconsulta o `input[type=file]` a cada upload, porque o componente recria o elemento
- valida o nome exibido na interface após o envio

Casos em que já é usado:

- anexo opcional do cidadão no passo inicial da manifestação
- anexo da resposta no popup do painel

Formato esperado:

- `fileName`: nome exibido na interface
- `contents`: conteúdo textual do arquivo
- `mimeType`: tipo MIME do upload

### `cy.acompanharManifestacaoOuvidoria()`

Uso:

- acessa `/ouvidoria/ouvidoria_acompanhar`
- informa protocolo e código de acesso
- abre a tela pública da manifestação para validações do histórico

## Specs da Ouvidoria

Specs públicas atuais:

- [cypress/e2e/portal/atendimento/ouvidoria/home.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/home.cy.js)
- [cypress/e2e/portal/atendimento/ouvidoria/solicitacao-envio.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/solicitacao-envio.cy.js)
- [cypress/e2e/portal/atendimento/ouvidoria/documentacao-anexos.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/documentacao-anexos.cy.js)
- [cypress/e2e/portal/atendimento/ouvidoria/identificacao.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/identificacao.cy.js)
- [cypress/e2e/portal/atendimento/ouvidoria/cadastro.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/cadastro.cy.js)
- [cypress/e2e/portal/atendimento/ouvidoria/tipos.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/tipos.cy.js)
- [cypress/e2e/portal/atendimento/ouvidoria/matriz.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/matriz.cy.js)
- [cypress/e2e/portal/atendimento/ouvidoria/obrigatorios.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/obrigatorios.cy.js)

Specs administrativas atuais:

- [cypress/e2e/admin/auth/login.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/admin/auth/login.cy.js)
- [cypress/e2e/admin/ouvidoria/ouvidor-resposta.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/admin/ouvidoria/ouvidor-resposta.cy.js)
- [cypress/e2e/admin/ouvidoria/ouvidor-tipos-resposta.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/admin/ouvidoria/ouvidor-tipos-resposta.cy.js)

### O que cada spec administrativa cobre

`ouvidor-resposta.cy.js`

- campo obrigatório da resposta no popup do painel
- resposta simples do tipo `Mensagem`

`ouvidor-tipos-resposta.cy.js`

- `Solicitação de Complementação de Informação`
- `Resposta Final (Decisão Administrativa)`
- `Arquivamento da Manifestação`
- `Encaminhamento` pelo fluxo nativo de troca de departamento
- anexo do cidadão visível no painel
- anexo do painel visível no acompanhamento público

## Fluxo Administrativo Automatizado

Fluxo base coberto no painel:

1. autenticar no `/painel`
2. criar uma manifestação pública para gerar massa real
3. capturar o protocolo gerado no fluxo público
4. abrir `/painel/ouvidoria/manifestacoes?protocolo=...`
5. aguardar o popup da manifestação
6. validar obrigatoriedade do campo de resposta
7. enviar uma resposta do tipo `Mensagem`
8. validar feedback de sucesso
9. validar mudança de situação para `Respondido`
10. validar persistência da mensagem no histórico do popup

Cobertura adicional do painel:

1. `Mensagem` -> status `Respondido`
2. `Solicitação de Complementação de Informação` -> status `Aguardando complementação`
3. `Resposta Final (Decisão Administrativa)` -> status `Concluído`
4. `Arquivamento da Manifestação` -> status `Arquivado`
5. `Encaminhamento` -> validado pelo fluxo nativo de troca de departamento no painel; registra a ação internamente e atualiza o acompanhamento público para `Encaminhado`
6. anexo enviado pelo cidadão fica visível no histórico interno do painel
7. anexo enviado pelo ouvidor fica visível no acompanhamento público da manifestação

## Decisões de Implementação

- Os comentários no código foram concentrados nos trechos em que o comportamento do sistema não é intuitivo, como `Uploadifive`, `force click`, popup de anexos e tratamento de exceções conhecidas do frontend.
- Algumas validações administrativas também conferem o acompanhamento público para provar o resultado final do ponto de vista do cidadão.
- O cenário de encaminhamento foi automatizado pelo fluxo nativo de troca de departamento porque esse é o comportamento mais estável do painel no ambiente atual.

## Observações de Implementação

- Os arquivos de spec continuam separados por responsabilidade. Isso mantém a leitura e a manutenção melhores do que concentrar tudo em uma única spec.
- O comando administrativo usa protocolo em vez de `id` interno para reduzir acoplamento com banco e facilitar reuso entre cenários.
- Os comentários nos commands e nas specs foram mantidos apenas nos trechos em que o comportamento do Nucleogov não é óbvio.

- alias específico para `solicitacaoservico`
- mantém compatibilidade com a API anterior

## Specs Existentes da Ouvidoria

### Envio completo

Arquivo:

- [cypress/e2e/portal/atendimento/ouvidoria/solicitacao-envio.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/solicitacao-envio.cy.js)

Objetivo:

- validar a criação real de uma solicitação
- validar a tela final de sucesso
- garantir que protocolo e código de acesso foram gerados

### Cadastro novo x existente

Arquivo:

- [cypress/e2e/portal/atendimento/ouvidoria/cadastro.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/cadastro.cy.js)

Objetivo:

- validar o ramo de cadastro completo
- validar o ramo de usuário já cadastrado
- garantir que o card resumido aparece quando o documento já existe

### Tipos de identificação

Arquivo:

- [cypress/e2e/portal/atendimento/ouvidoria/identificacao.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/identificacao.cy.js)

Objetivo:

- validar o comportamento dinâmico do formulário conforme o tipo escolhido

Tipos cobertos:

- `CPF`
- `CNPJ`
- `RG`
- `CNH`
- `Registro Profissional`
- `Outro`

O que é validado nessa spec:

- exibição do campo `#tipo_identificacao` só quando exigido
- máscara aplicada corretamente em CPF
- máscara aplicada corretamente em CNPJ
- ausência de máscara indevida nos demais tipos
- persistência do tipo e do documento ao avançar para o cadastro

### Tipos de manifestação

Arquivo:

- [cypress/e2e/portal/atendimento/ouvidoria/tipos.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/tipos.cy.js)

Objetivo:

- validar o envio dos cinco tipos públicos de manifestação
- validar a denúncia anônima
- garantir que o fluxo genérico atende todos os tipos

### Matriz completa

Arquivo:

- [cypress/e2e/portal/atendimento/ouvidoria/matriz.cy.js](/home/felipenucleo/nucleogov-e2e/cypress/e2e/portal/atendimento/ouvidoria/matriz.cy.js)

Objetivo:

- validar todos os tipos de manifestação
- validar dados aleatórios
- validar preenchimento de campos opcionais
- validar usuário novo
- validar usuário já cadastrado
- validar denúncia anônima

Cobertura atual da matriz:

- `denuncia` com cadastro novo
- `denuncia` com usuário já cadastrado
- `denuncia` anônima
- `reclamacao` com cadastro novo
- `reclamacao` com usuário já cadastrado
- `sugestao` com cadastro novo
- `sugestao` com usuário já cadastrado
- `elogio` com cadastro novo
- `elogio` com usuário já cadastrado
- `solicitacaoservico` com cadastro novo
- `solicitacaoservico` com usuário já cadastrado

## Comentários no Código

Os arquivos Cypress da Ouvidoria agora têm comentários curtos com foco em:

- motivo do helper
- responsabilidade de cada command
- intenção do cenário
- comportamento dinâmico do formulário

Regra adotada:

- comentar o porquê e a regra de negócio
- não comentar o óbvio

## Convenções de Expansão

Para manter a suíte legível:

- regras de massa ficam em `helpers/ouvidoria.js`
- interação reaproveitável fica em `commands.js`
- cada spec cobre uma responsabilidade clara
- quando o fluxo for igual e só o tipo mudar, preferir `overrides`

Exemplo:

```js
cy.criarManifestacaoOuvidoria({
  tipo: "reclamacao",
  preencherCamposOpcionais: true,
  tipoCadastro: "novo"
});
```

## Próximos Passos Recomendados

### Cobrir regras do cadastro

Adicionar specs específicas para:

- `assinatura_email`
- `reserva_identidade`
- `assume_responsabilidade`
- nome completo obrigatório
- e-mail inválido
- telefone inválido

### Cobrir tipos de identificação por manifestação

Hoje a validação de tipos de identificação já existe, mas ainda vale expandir com recortes por manifestação, por exemplo:

- denúncia com `CPF`
- denúncia com `Registro Profissional`
- denúncia com `Anônimo`
- elogio com `CNPJ`

### Cobrir acompanhamento

Como o protocolo e o código já são capturados, o próximo bloco natural é:

- abrir a página de acompanhamento
- consultar a manifestação criada
- validar os dados exibidos

## Comandos de Execução

### Rodar envio completo

```bash
npx cypress run --spec cypress/e2e/portal/atendimento/ouvidoria/solicitacao-envio.cy.js
```

### Rodar validação dos tipos de identificação

```bash
npx cypress run --spec cypress/e2e/portal/atendimento/ouvidoria/identificacao.cy.js
```

### Rodar matriz completa

```bash
npx cypress run --spec cypress/e2e/portal/atendimento/ouvidoria/matriz.cy.js
```

### Rodar a suíte atual inteira

```bash
npm run cy:run
```

## Estado Atual

No estado atual:

- os cinco tipos públicos da Ouvidoria estão automatizados
- a denúncia anônima está coberta
- os tipos de identificação já estão validados
- os fluxos de usuário novo e usuário já cadastrado estão cobertos
- os campos opcionais já entram na matriz de execução
- os custom commands estão organizados por etapa do fluxo
- a documentação da base da Ouvidoria está registrada neste arquivo
