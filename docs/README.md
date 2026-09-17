# Documentação dos testes de despesas

Documentação separada por script para os adaptadores de despesas do portal.
Os comentários de implementação permanecem nos respectivos arquivos Cypress;
este diretório concentra a documentação funcional, os comandos de execução e a
lista de cenários.

## Prodata — SGDespesas

- [Filtro avançado](prodata-sgdespesas-filtro-avancado.md)
- [Filtros externos](prodata-sgdespesas-filtros-externos.md)
- [Exportações de arquivos](prodata-sgdespesas-exportacoes.md)

## Megasoft — SGDespesas

- [Filtro avançado](megasoft-sgdespesas-filtro-avancado.md)
- [Filtros externos](megasoft-sgdespesas-filtros-externos.md)
- [Exportações de arquivos](megasoft-sgdespesas-exportacoes.md)

## MegaSoft — MGDespesas

- [Filtros e exportações](megasoft-mgdespesas.md)
- [Exportações de arquivos](megasoft-mgdespesas-exportacoes.md)

## Centi — CNTDespesas

- [Filtro avançado](centi-cntdespesas-filtro-avancado.md)
- [Filtros externos](centi-cntdespesas-filtros-externos.md)
- [Exportações de arquivos](centi-cntdespesas-exportacoes.md)

## Convenção

Cada documento identifica o script correspondente, apresenta o comando para
`cy:open` e `cy:run`, explica o fluxo e lista todos os testes do arquivo. Ao
criar um novo cenário, atualize a documentação do script correspondente e o
índice acima se um novo arquivo for criado.

## Como ler os scripts

Os testes Cypress são executados em uma fila de comandos. Por isso, funções
que fazem `cy.get`, `cy.visit` ou outra ação Cypress normalmente retornam o
chainable para que o próximo passo espere o anterior terminar.

A nomenclatura ajuda a identificar a responsabilidade:

- `obter...`: consulta a tela e devolve um valor que será usado pelo cenário;
- `preencher...`: digita um valor em um campo de texto;
- `selecionar...`: abre um select e escolhe uma opção;
- `pesquisar...`: executa uma busca ou combina interação e validação;
- `aguardar...`: espera loader, tabela, popup ou campo dinâmico;
- `validar...`: compara o resultado esperado com o retorno do portal;
- `normalizar...` e `converter...`: preparam valores para comparação sem
  alterar necessariamente o texto exibido ao usuário.

Um cenário normalmente pode ser lido nesta ordem: `beforeEach` prepara a
página, uma função `obter` captura o dado real, uma função `selecionar` ou
`preencher` aplica o filtro, `aguardarListagem` espera a resposta e uma função
`validar` confirma o resultado.
