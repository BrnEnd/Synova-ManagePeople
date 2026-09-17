# ADR 0009 — Escopo gerencial e fotografias financeiras por dia

## Status

Aceita.

## Contexto

Gestores precisam alternar entre a equipe sob sua responsabilidade e todos os funcionários do tenant ao consultar competências e indicadores de horas. Alterações de alocação e de valores também podem ocorrer dentro de uma competência mensal, de modo que uma única taxa mensal não representa corretamente custo e faturamento.

## Decisão

- Consultas de competências e indicadores de horas oferecem os escopos `mine` e `all`. O escopo `all` continua limitado ao tenant autenticado.
- Aprovar, solicitar ajuste e demais mutações de uma competência continuam restritos ao gestor responsável por ela. A visualização por outro gestor é somente leitura.
- Cada lançamento referencia a alocação vigente em `workDate`.
- Na aprovação, custo e receita são calculados por lançamento usando as condições financeira e comercial vigentes em `workDate`, e os valores são gravados em snapshots imutáveis.
- Backfills sem todas as condições históricas gravam `pricing_complete = false`; totais derivados desses snapshots são apresentados como indisponíveis, nunca como zero válido.
- Os totais da competência são a soma dos snapshots diários. O valor-hora agregado mantido na competência serve para compatibilidade e não substitui os snapshots.

## Consequências

Esta decisão substitui a restrição da ADR 0008 que limitava os indicadores mensais de horas e valores ao gestor responsável. Também substitui, na ADR 0004, a premissa de uma única taxa para toda a competência quando existirem múltiplas vigências no mês. O isolamento por tenant e a autorização de escrita permanecem inalterados.
