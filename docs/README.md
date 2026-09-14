# Documentação dos testes de despesas

Documentação separada por script para os adaptadores de despesas do portal.
Os comentários de implementação permanecem nos respectivos arquivos Cypress;
este diretório concentra a documentação funcional, os comandos de execução e a
lista de cenários.

## Prodata — SGDespesas

- [Filtro avançado](prodata-sgdespesas-filtro-avancado.md)
- [Filtros externos](prodata-sgdespesas-filtros-externos.md)

## Megasoft — SGDespesas

- [Filtro avançado](megasoft-sgdespesas-filtro-avancado.md)
- [Filtros externos](megasoft-sgdespesas-filtros-externos.md)

## Centi — CNTDespesas

- [Filtro avançado](centi-cntdespesas-filtro-avancado.md)
- [Filtros externos](centi-cntdespesas-filtros-externos.md)

## Convenção

Cada documento identifica o script correspondente, apresenta o comando para
`cy:open` e `cy:run`, explica o fluxo e lista todos os testes do arquivo. Ao
criar um novo cenário, atualize a documentação do script correspondente e o
índice acima se um novo arquivo for criado.
