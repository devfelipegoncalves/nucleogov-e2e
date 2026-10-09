# Rotinas de transparência

Esta pasta agrupa os módulos com rotas compartilhadas entre diferentes
sistemas de gestão, como `SGReceitas` e `SGDespesas`.

O nome da pasta representa a rotina funcional, não o fornecedor da integração.
Quando existem implementações diferentes para a mesma rota, o fornecedor fica
apenas no nome do arquivo, por exemplo:

- `filtros-externos-megasoft.cy.js`
- `filtros-externos-prodata.cy.js`

Isso evita criar uma árvore de diretórios que sugira que a rota `sg` pertence a
um único sistema de gestão.
