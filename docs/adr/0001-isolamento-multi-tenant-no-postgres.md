# Isolamento multi-tenant no Postgres

Cada tabela operacional guarda `tenantId`, e o Postgres aplica Row-Level Security usando o tenant definido localmente na transação. Requests normais só operam com esse contexto; o adaptador interno de provisionamento ativa, exclusivamente dentro da própria transação, um modo privilegiado auditado para criar o primeiro tenant e seus usuários. Escolhemos essa defesa adicional porque filtros apenas na aplicação são mais fáceis de omitir e um vazamento entre tenants teria impacto alto.
