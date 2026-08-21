# Synova Manage People

Portal multi-tenant para gestão de funcionários, competências, documentos e pagamentos da Synova.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local` e configure Postgres e os segredos.
2. Instale as dependências com `npm install`.
3. Aplique as migrações com `npm run db:migrate`.
4. Inicie a aplicação com `npm run dev`.

Verificações disponíveis:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Provisionamento inicial

As requests exigem `Authorization: Bearer <PROVISIONING_SECRET>` e uma chave de idempotência exclusiva para a operação.

### Criar tenant

```bash
curl -X POST "$APP_URL/api/internal/provisioning/tenants" \
  -H "Authorization: Bearer $PROVISIONING_SECRET" \
  -H "Idempotency-Key: tenant-synova-v1" \
  -H "Content-Type: application/json" \
  --data '{"name":"Synova","slug":"synova"}'
```

### Criar gestor

```bash
curl -X POST "$APP_URL/api/internal/provisioning/users" \
  -H "Authorization: Bearer $PROVISIONING_SECRET" \
  -H "Idempotency-Key: gestor-inicial-v1" \
  -H "Content-Type: application/json" \
  --data '{"tenantId":"<TENANT_ID>","email":"<EMAIL>","displayName":"<NOME>","role":"manager","temporaryPassword":"<SENHA_TEMPORARIA>"}'
```

Use `role: "employee"` para criar um usuário de funcionário. A associação ao cadastro profissional será disponibilizada junto ao módulo de Funcionários.

### Redefinir senha temporária

```bash
curl -X POST "$APP_URL/api/internal/provisioning/users/<USER_ID>/password" \
  -H "Authorization: Bearer $PROVISIONING_SECRET" \
  -H "Idempotency-Key: reset-<USER_ID>-v1" \
  -H "Content-Type: application/json" \
  --data '{"tenantId":"<TENANT_ID>","temporaryPassword":"<NOVA_SENHA_TEMPORARIA>"}'
```

A senha temporária deve ter de 12 a 128 caracteres e incluir letra maiúscula, letra minúscula, número e símbolo. O usuário será obrigado a trocá-la no primeiro acesso.
