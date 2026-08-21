# Runbook de produção

## Recursos

- Aplicação: Vercel, projeto `synova-manage-people`.
- Banco: Neon PostgreSQL isolado, região `gru1`.
- Arquivos: Vercel Blob privado, região `gru1`.
- Agendamento: Vercel Cron diário às 12:00 UTC; a aplicação decide se a data é o último dia útil nacional em `America/Sao_Paulo`.

## Separação de credenciais

Migrações usam somente a URL proprietária fora do runtime. A aplicação recebe `DATABASE_URL` com a role `synova_app_prod`, sem superusuário e sem `BYPASSRLS`. O provisionamento recebe `PROVISIONING_DATABASE_URL` com a role nominal `synova_provisioner`, limitada a tenants, usuários, auditoria, idempotência e chaves de serviço. Esse nome faz parte das políticas RLS versionadas.

Nunca configure `DATABASE_URL_UNPOOLED`, `POSTGRES_URL` ou outra credencial proprietária como `DATABASE_URL` da aplicação.

## Migração

1. Obtenha temporariamente a URL proprietária no canal operacional.
2. Execute `DATABASE_URL='<URL_PROPRIETARIA>' npm run db:migrate`.
3. Conceda CRUD das novas tabelas operacionais à `synova_app_prod`.
4. Confirme que as novas tabelas têm RLS habilitada e forçada.
5. Execute a integração usando as duas URLs restritas.

## Segredos obrigatórios

- `DATABASE_URL`
- `PROVISIONING_DATABASE_URL`
- `SESSION_SECRET`
- `PROVISIONING_SECRET`
- `PROVISIONING_IDEMPOTENCY_SECRET`
- `CRON_SECRET`
- `BLOB_READ_WRITE_TOKEN` ou OIDC com `BLOB_STORE_ID`
- `CANONICAL_PORTAL_URL=https://www.synovadigital.com.br/portal`
- `PORTAL_PROXY_SECRET`, compartilhado somente com o gateway do `page-synova`

Segredos são gerados aleatoriamente, armazenados como variáveis protegidas da Vercel e nunca versionados. A rotação de `PROVISIONING_SECRET` não deve alterar `PROVISIONING_IDEMPOTENCY_SECRET`, pois este preserva a equivalência das requests idempotentes.

## Publicação e verificação

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
vercel --prod
```

Depois da publicação, valide `/portal/entrar`, execute o smoke E2E com um tenant descartável e confirme que o cleanup removeu banco e blobs sintéticos. Inspecione também o deployment e os logs da Vercel antes de considerar a etapa concluída.

O alias técnico do projeto People deve redirecionar páginas para a URL canônica quando o cabeçalho privado do gateway não estiver presente. Permanecem como exceções somente o cron com Bearer próprio e o callback POST assinado do Vercel Blob. O gateway é responsável por encaminhar o cabeçalho, corpo, query string e cookies sem armazenar respostas autenticadas em cache.

## Provisionamento inicial

Use exclusivamente as requests documentadas no README. Transmita a senha temporária e os segredos por canal operacional seguro, elimine os cookies usados pela CLI e exija a troca de senha no primeiro acesso.
