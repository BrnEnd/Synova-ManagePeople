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

Quando a role comum não for proprietária das tabelas, conceda a ela `SELECT, INSERT, UPDATE, DELETE` nas tabelas operacionais após cada migração. As políticas de RLS continuam sendo aplicadas mesmo com esses privilégios.

## Documentos

Documentos aceitam PDF, JPEG, PNG e WebP de até 25 MB. Em desenvolvimento, quando Blob não está configurado, os arquivos ficam em `.data/uploads`, que é ignorado pelo Git. Em produção, configure uma store privada da Vercel por OIDC (`BLOB_STORE_ID`) ou `BLOB_READ_WRITE_TOKEN`.

Com Blob configurado, o navegador envia arquivos diretamente por upload multipart. A aplicação emite o token somente após autenticar o gestor, restringe tipo, tamanho e pathname ao tenant/funcionário e registra os metadados após conferir o objeto armazenado. Downloads sempre passam por uma rota autenticada; o endereço bruto do blob não é exposto na interface.

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

## Clientes via CLI

Operações de clientes usam uma sessão de gestor e permanecem sob RLS. Autentique a CLI e reutilize o cookie somente no canal operacional:

```bash
curl -c synova-session.txt -X POST "$APP_URL/api/auth/session" \
  -H "Content-Type: application/json" \
  --data '{"tenantSlug":"<TENANT_SLUG>","email":"<GESTOR_EMAIL>","password":"<GESTOR_SENHA>"}'

curl -b synova-session.txt -X POST "$APP_URL/api/clients" \
  -H "Content-Type: application/json" \
  --data '{"name":"<NOME>","legalName":"<RAZAO_SOCIAL>","taxId":"<CNPJ>","contactName":null,"email":null,"phone":null,"address":null,"observations":null}'
```

O arquivo de cookies contém uma sessão autenticada e deve ser eliminado ao terminar a operação.

## Contratos, alocações e condições via CLI

As requests abaixo reutilizam a sessão de gestor criada na seção anterior. Valores monetários são enviados em centavos.

```bash
curl -b synova-session.txt -X POST "$APP_URL/api/employees/<EMPLOYEE_ID>/contracts" \
  -H "Content-Type: application/json" \
  --data '{"contractType":"Prestação de serviços","startDate":"2026-08-01","endDate":null,"documentId":null,"observations":null}'

curl -b synova-session.txt -X POST "$APP_URL/api/employees/<EMPLOYEE_ID>/financial-conditions" \
  -H "Content-Type: application/json" \
  --data '{"hourlyRateCents":12500,"effectiveFrom":"2026-08-01","observations":null}'

curl -b synova-session.txt -X POST "$APP_URL/api/employees/<EMPLOYEE_ID>/allocations" \
  -H "Content-Type: application/json" \
  --data '{"clientId":"<CLIENT_ID>","managerUserId":"<MANAGER_USER_ID>","roleTitle":"Consultor","startDate":"2026-08-01","endDate":null,"observations":null}'

curl -b synova-session.txt -X POST "$APP_URL/api/allocations/<ALLOCATION_ID>/commercial-conditions" \
  -H "Content-Type: application/json" \
  --data '{"hourlyRateCents":22000,"effectiveFrom":"2026-08-01","observations":null}'

curl -b synova-session.txt -X POST "$APP_URL/api/contracts/<CONTRACT_ID>/end" \
  -H "Content-Type: application/json" --data '{"endDate":"2026-12-31"}'

curl -b synova-session.txt -X POST "$APP_URL/api/allocations/<ALLOCATION_ID>/end" \
  -H "Content-Type: application/json" --data '{"endDate":"2026-12-31"}'
```

Cada nova condição cria uma vigência; ela não sobrescreve valores históricos.

## Competências e apontamentos via CLI

As rotas usam a sessão do próprio funcionário. A competência é aberta automaticamente com a alocação válida no mês, e as durações são enviadas em minutos.

```bash
curl -c synova-employee-session.txt -X POST "$APP_URL/api/auth/session" \
  -H "Content-Type: application/json" \
  --data '{"tenantSlug":"<TENANT_SLUG>","email":"<FUNCIONARIO_EMAIL>","password":"<FUNCIONARIO_SENHA>"}'

curl -b synova-employee-session.txt -X POST "$APP_URL/api/portal/competencies" \
  -H "Content-Type: application/json" --data '{"month":"2026-08"}'

curl -b synova-employee-session.txt -X POST "$APP_URL/api/portal/competencies/<COMPETENCE_ID>/entries" \
  -H "Content-Type: application/json" \
  --data '{"workDate":"2026-08-03","minutes":480,"observation":"Atividades do dia"}'

curl -b synova-employee-session.txt "$APP_URL/api/portal/competencies/<COMPETENCE_ID>"

curl -b synova-employee-session.txt -X DELETE \
  "$APP_URL/api/portal/competencies/<COMPETENCE_ID>/entries/<ENTRY_ID>"
```

Salvar novamente a mesma data atualiza a linha existente. O cookie de sessão deve ser eliminado após o uso.

## Aprovação e notificações via CLI

```bash
# Funcionário envia o consolidado
curl -b synova-employee-session.txt -X POST \
  "$APP_URL/api/portal/competencies/<COMPETENCE_ID>/submit"

# Gestor consulta sua fila e uma competência
curl -b synova-session.txt "$APP_URL/api/management/competencies"
curl -b synova-session.txt "$APP_URL/api/management/competencies/<COMPETENCE_ID>"

# Gestor solicita ajustes ou aprova
curl -b synova-session.txt -X POST \
  "$APP_URL/api/management/competencies/<COMPETENCE_ID>/adjustments" \
  -H "Content-Type: application/json" --data '{"reason":"Detalhar as atividades."}'
curl -b synova-session.txt -X POST \
  "$APP_URL/api/management/competencies/<COMPETENCE_ID>/approve"

# Qualquer usuário autenticado consulta suas notificações
curl -b synova-employee-session.txt "$APP_URL/api/notifications"
```

O job `/api/internal/jobs/month-close-reminders` exige `Authorization: Bearer $CRON_SECRET`. A configuração da Vercel chama a rota diariamente às 12:00 UTC; a aplicação só gera lembretes no último dia útil nacional, considerando a data em `America/Sao_Paulo`.

## Nota Fiscal e pagamento via CLI

Depois da aprovação, o funcionário baixa a previsão e envia a Nota Fiscal. Em ambiente local, o exemplo usa multipart; com Vercel Blob configurado, a interface faz upload direto e conclui o registro pelas rotas de documentos.

```bash
curl -b synova-employee-session.txt -o previsao.pdf \
  "$APP_URL/api/documents/<FORECAST_DOCUMENT_ID>/download"

curl -b synova-employee-session.txt -X POST \
  "$APP_URL/api/portal/competencies/<COMPETENCE_ID>/invoice" \
  -F 'file=@nota-fiscal.pdf;type=application/pdf'

curl -b synova-session.txt -X POST \
  "$APP_URL/api/management/competencies/<COMPETENCE_ID>/payment" \
  -F 'paidDate=2026-08-20' \
  -F 'notes=Pagamento realizado externamente' \
  -F 'file=@comprovante.pdf;type=application/pdf'
```

O valor do pagamento não é recebido pela API: ele é sempre recuperado da fotografia congelada na aprovação.
