# Isolamento multi-tenant no Postgres

Cada tabela operacional guarda `tenantId`, e o Postgres aplica Row-Level Security usando o tenant definido localmente na transação. Requests normais só operam com esse contexto por meio de `withTenantTransaction`.

O provisionamento usa uma segunda conexão autenticada exclusivamente como a role PostgreSQL `synova_provisioner`. As políticas permitem a essa role criar tenants e usuários sem um tenant preexistente, enquanto a conexão comum não pode ativar o bypass por configuração de sessão. Toda operação privilegiada continua autenticada na API, idempotente e auditada.

Escolhemos essa defesa adicional porque filtros apenas na aplicação são mais fáceis de omitir e um vazamento entre tenants teria impacto alto. Em produção, `DATABASE_URL` não pode ser superusuária, possuir `BYPASSRLS` nem assumir a role de provisionamento.
