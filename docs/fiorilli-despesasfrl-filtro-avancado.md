# Fiorilli Despesas FRL — filtro avançado

Script relacionado:

`cypress/e2e/portal/transparencia/fiorilli/despesasfrl/filtro-avancado.cy.js`

## Execução

```bash
npm run cy:open -- --e2e --spec "cypress/e2e/portal/transparencia/fiorilli/despesasfrl/filtro-avancado.cy.js"
npm run cy:run -- --spec "cypress/e2e/portal/transparencia/fiorilli/despesasfrl/filtro-avancado.cy.js"
```

## Objetivo

Validar o popup de filtro avançado do módulo público `despesas_frl` da
integração Fiorilli. Os valores são obtidos de registros reais da listagem ou
do detalhamento, aplicados no filtro e conferidos no resultado retornado.

A rota utilizada é:

`/cidadao/transparencia/despesas_frl`

Antes de cada cenário, o teste visita a listagem, aguarda o carregamento e
confirma que existe pelo menos uma despesa real disponível.

## Testes cobertos

1. Número do empenho, validado no detalhamento.
2. Processo, extraído do HTML exportado das despesas.
3. Histórico/descrição, extraído do HTML exportado.
4. Favorecido.
5. CPF/CNPJ.
6. Órgão.
7. Unidade.
8. Função.
9. Subfunção.
10. Programa.
11. Ação.
12. Fonte.
13. Categoria econômica.
14. Grupo.
15. Modalidade de aplicação.
16. Elemento.
17. Intervalo de data inicial e data final.
18. Valor empenhado.
19. Valor liquidado.
20. Valor pago.
21. COVID-19 = Sim.
22. COVID-19 = Não.
23. Obrigatoriedade de Grupo quando somente a Categoria Econômica é
    selecionada.
24. Limpeza dos campos do popup sem fechar o formulário.

Também existem cenários preparados, mas temporariamente ignorados (`it.skip`),
para validar intervalos monetários invertidos e intervalo de datas inválido.

## Regras de validação

- Os filtros textuais usam dados reais para evitar números e nomes fixos no
  código.
- Processo e histórico são lidos do relatório HTML antes da pesquisa, pois
  essas informações não ficam disponíveis diretamente em todas as colunas da
  listagem.
- CPF/CNPJ é comparado pelos dígitos normalizados.
- Valores monetários são convertidos do padrão brasileiro para comparação
  numérica.
- Datas retornadas devem permanecer dentro do intervalo informado.
- Campos dependentes respeitam a regra do portal: selecionar somente a
  Categoria Econômica exige também um Grupo.
- O teste aguarda o carregamento da listagem e do retorno do filtro antes de
  validar o resultado.

## Exportação usada como fonte de dados

Os cenários de Processo e Histórico baixam o relatório HTML pelo menu
`#exportar`. O arquivo é limpo antes do download e lido pela task do Node.js
`readDownloadedFile`, que aguarda um arquivo não vazio em:

`cypress/artifacts/downloads/`

São aceitos os nomes `relatorio-despesas.html` e
`relatório-despesas.html`, acomodando a variação de acentuação apresentada pelo
portal.

## Manutenção

Prefira obter valores do portal a usar dados fixos. Ao alterar um filtro,
atualize este documento e mantenha a validação próxima da interação
correspondente no spec. Remova qualquer `it.only` antes de versionar.
