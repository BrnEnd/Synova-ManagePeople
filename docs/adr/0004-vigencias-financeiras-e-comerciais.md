# ADR 0004 — Vigências financeiras e comerciais

## Status

Aceita em 21 de agosto de 2026.

## Decisão

O custo do funcionário e o preço comercial da alocação são históricos independentes. Cada alteração cria uma nova condição com `effective_from`; a condição aberta anterior recebe `effective_to` igual ao dia anterior à nova vigência.

Valores monetários são armazenados em centavos inteiros. O pagamento do funcionário será calculado exclusivamente como valor-hora financeiro vigente multiplicado pelas horas aprovadas da competência. A condição comercial não participa desse cálculo.

Contratos e alocações são encerrados, nunca excluídos. Todas as entidades carregam `tenant_id`, possuem RLS forçada e referências compostas para impedir vínculos entre tenants.

## Consequências

- consultas por competência conseguem recuperar exatamente os valores vigentes no período;
- reajustes não alteram previsões ou pagamentos históricos;
- apenas uma condição aberta é permitida por funcionário ou alocação;
- correções retroativas exigem uma operação específica futura, auditável, em vez de editar registros silenciosamente.
