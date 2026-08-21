# ADR 0005 — Apontamentos em minutos inteiros

## Status

Aceita em 21 de agosto de 2026.

## Decisão

Cada competência representa um funcionário, uma alocação e um mês, identificado pelo primeiro dia desse mês. Cada lançamento representa um dia de trabalho e armazena sua duração em minutos inteiros, entre 1 e 1.440.

Existe no máximo um lançamento por competência e data. Salvar novamente a mesma data atualiza a linha existente. O total da competência é recalculado no banco após toda inclusão, alteração ou exclusão.

Lançamentos somente podem mudar quando a competência estiver em `filling` ou `adjustments_requested`. A autorização confere o usuário associado ao funcionário além do `tenant_id` protegido por RLS.

## Consequências

- totais não sofrem imprecisão de ponto flutuante;
- a interface pode aceitar horas decimais e convertê-las para minutos;
- a mesma data não é duplicada acidentalmente;
- o ciclo de aprovação consegue congelar os lançamentos sem migrar os dados.
