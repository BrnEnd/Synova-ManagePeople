# Synova Manage People

Portal multi-tenant para gestão de funcionários, competências, documentos e pagamentos da Synova.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local` e configure Postgres e os segredos.
2. Instale as dependências com `npm install`.
3. Aplique as migrações com `npm run db:migrate`.
4. Crie a role restrita de provisionamento e conceda apenas os acessos necessários:

```sql
CREATE ROLE synova_provisioner LOGIN PASSWORD '<SENHA_FORTE>';
GRANT CONNECT ON DATABASE <BANCO> TO synova_provisioner;
GRANT USAGE ON SCHEMA public TO synova_provisioner;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, users, audit_events, idempotency_records, service_keys TO synova_provisioner;
```

5. Configure `PROVISIONING_DATABASE_URL` com essa role e inicie a aplicação com `npm run dev`.

`DATABASE_URL` deve usar outra role, sem superusuário, sem `BYPASSRLS` e sem vínculo com `synova_provisioner`. A separação de credenciais impede que requests normais contornem as políticas de tenant no Postgres.

Verificações disponíveis:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

O teste de persistência e RLS exige um banco já migrado e duas URLs com as mesmas restrições de roles descritas acima:

```bash
TEST_DATABASE_URL='<URL_COMUM>' \
TEST_PROVISIONING_DATABASE_URL='<URL_SYNOVA_PROVISIONER>' \
npm run test:integration
```

## Provisionamento inicial

As requests exigem `Authorization: Bearer <PROVISIONING_SECRET>` e uma chave de idempotência exclusiva para a operação.

`PROVISIONING_SECRET` pode ser rotacionado sem invalidar requests anteriores. `PROVISIONING_IDEMPOTENCY_SECRET` é um segredo separado e estável, usado somente para gerar HMACs do conteúdo idempotente sem persistir um verificador offline das senhas temporárias.

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

Use `role: "employee"` para criar um usuário de funcionário e associe-o ao cadastro profissional pela request seguinte.

### Associar usuário a funcionário

```bash
curl -X POST "$APP_URL/api/internal/provisioning/users/<USER_ID>/employee" \
  -H "Authorization: Bearer $PROVISIONING_SECRET" \
  -H "Idempotency-Key: associacao-<USER_ID>-v1" \
  -H "Content-Type: application/json" \
  --data '{"tenantId":"<TENANT_ID>","employeeId":"<EMPLOYEE_ID>"}'
```

O usuário deve ter papel `employee`, estar ativo e pertencer ao mesmo tenant do funcionário.

### Cadastrar chave do Portal de Vagas

Gere uma chave aleatória de alta entropia no canal operacional e envie seu valor uma única vez. Somente um HMAC não reversível será persistido.

```bash
curl -X POST "$APP_URL/api/internal/provisioning/service-keys" \
  -H "Authorization: Bearer $PROVISIONING_SECRET" \
  -H "Idempotency-Key: portal-vagas-<TENANT_ID>-v1" \
  -H "Content-Type: application/json" \
  --data '{"tenantId":"<TENANT_ID>","name":"Portal de Vagas","serviceKey":"<CHAVE_DE_SERVICO_COM_32_OU_MAIS_CARACTERES>"}'
```

### Redefinir senha temporária

```bash
curl -X POST "$APP_URL/api/internal/provisioning/users/<USER_ID>/password" \
  -H "Authorization: Bearer $PROVISIONING_SECRET" \
  -H "Idempotency-Key: reset-<USER_ID>-v1" \
  -H "Content-Type: application/json" \
  --data '{"tenantId":"<TENANT_ID>","temporaryPassword":"<NOVA_SENHA_TEMPORARIA>"}'
```

A senha temporária deve ter de 12 a 128 caracteres e incluir letra maiúscula, letra minúscula, número e símbolo. O usuário será obrigado a trocá-la no primeiro acesso.

## Integração com o Portal de Vagas

A rota está disponível para o futuro consumidor, mas este repositório não altera o Portal de Vagas. Ela exige a chave de serviço cadastrada para o tenant, `externalHiringId` e `Idempotency-Key`.

```bash
curl -X POST "$APP_URL/api/external/v1/hirings" \
  -H "Authorization: Bearer $PORTAL_VAGAS_SERVICE_KEY" \
  -H "Idempotency-Key: contratacao-<EXTERNAL_HIRING_ID>-v1" \
  -H "Content-Type: application/json" \
  --data '{"externalHiringId":"<EXTERNAL_HIRING_ID>","fullName":"<NOME>","email":"<EMAIL_OPCIONAL>","document":"<DOCUMENTO_OPCIONAL>"}'
```

Repetições equivalentes retornam o mesmo pré-cadastro. Reutilizar o identificador externo ou a chave idempotente com outro conteúdo retorna conflito, sem duplicar o funcionário.
