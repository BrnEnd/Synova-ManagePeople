# Estado da implementação

Este arquivo é o ponto de retomada operacional da V1 descrita no issue GitHub #1.

## Checkpoint atual

**Etapa 8 — Infraestrutura, segredos, deploy e validação em produção** (`codex/complete-v1`, commit desta etapa)

Entregue nesta etapa:

- projeto Vercel `synova-manage-people` publicado em `https://synova-manage-people.vercel.app`;
- Neon PostgreSQL isolado e Vercel Blob privado em `gru1`;
- migrações aplicadas fora do runtime com credencial proprietária;
- runtime separado entre `synova_app_prod` e `synova_provisioner`, ambas sem superusuário e sem `BYPASSRLS`;
- segredos aleatórios protegidos nos ambientes Vercel e cron diário configurado;
- runbook de migração, rotação, publicação, validação e provisionamento inicial.

Validação desta etapa:

- deployment produtivo `dpl_3bLqTFWDqsFqasvWAKTtc6A3aHFh` em estado `Ready`;
- integração completa no Neon produtivo aprovada com roles restritas;
- E2E HTTP público aprovado do provisionamento ao pagamento com Blob privado;
- `/entrar` respondeu HTTP 200 com HTTPS/HSTS;
- 19 tabelas com RLS habilitada e forçada; 0 tenants e 0 blobs sintéticos após cleanup;
- nenhum erro HTTP 500 nos logs do deployment após o smoke.

Os dados e o banco sintéticos foram removidos.

## Checkpoint anterior

**Etapa 7 — Portal do funcionário, dashboards e E2E completo** (`14e19e2`)

Entregou dashboard gerencial, histórico financeiro do funcionário e E2E integral reutilizável.

## Checkpoint anterior à etapa 7

**Etapa 6 — Previsão PDF, Nota Fiscal e pagamento** (`29239fb`)

Entregou previsão PDF, Nota Fiscal, pagamento pelo valor congelado e comprovante.

## Checkpoint anterior à etapa 6

**Etapa 5 — Aprovação, ajustes, calendário e notificações** (`ab13b73`)

Entregou envio, revisão, ajustes, aprovação, fotografia financeira, eventos, notificações e lembretes no último dia útil nacional.

## Checkpoint anterior à etapa 5

**Etapa 4 — Competências e apontamentos** (`e03ac35`)

Entregue nesta etapa:

- competência mensal vinculada automaticamente ao funcionário, alocação, cliente e gestor;
- apontamentos diários em minutos, com uma linha por data e observação opcional;
- inclusão, edição pela mesma data e exclusão com total recalculado no banco;
- bloqueio de alterações fora dos estados editáveis;
- portal do funcionário com planilha responsiva, resumo e histórico mensal;
- APIs autenticadas, auditoria, RLS e referências compostas de tenant.

Validação desta etapa:

- typecheck, lint e 54 testes unitários aprovados;
- migrações completas em PostgreSQL vazio e integração com roles restritas aprovada;
- isolamento RLS de competências e apontamentos;
- smoke HTTP com sessão de funcionário, criação, edição, totalização, renderização e exclusão.

Os dados e o banco sintéticos foram removidos.

## Checkpoint anterior à etapa 4

**Etapa 3 — Contratos, alocações e condições** (`898b5e1`)

Entregue nesta etapa:

- contratos vinculáveis a documentos do funcionário e encerramento sem exclusão;
- alocações históricas entre funcionário, cliente e gestor responsável;
- condições financeiras e comerciais independentes, em centavos e versionadas por vigência;
- RLS forçada, referências compostas de tenant, auditoria e índices de vigência aberta;
- rotas autenticadas para CLI e painel completo na ficha do funcionário.

Validação desta etapa:

- typecheck, lint e 49 testes unitários aprovados;
- migrações completas em PostgreSQL vazio e integração com roles restritas aprovada;
- isolamento RLS das quatro novas tabelas;
- smoke HTTP de criação, versionamento, visualização e encerramento.

Os dados e o banco sintéticos foram removidos.

## Checkpoint anterior à etapa 3

**Etapa 2 — Clientes** (`677daa7`)

Entregue nesta etapa:

- Cliente multi-tenant com nome, razão social, CNPJ, contato, endereço e observações;
- criação, consulta, edição e inativação sem exclusão histórica;
- APIs operacionais autenticadas para UI e CLI;
- auditoria, RLS e unicidade de CNPJ dentro do tenant;
- listagem, detalhe e indicador navegável no dashboard.

Validação desta etapa:

- `npm run typecheck`, `npm run lint`, `npm test -- --run` — 45 testes passaram;
- `npm run db:check` e migrações completas em PostgreSQL vazio;
- integração com roles restritas e isolamento real de Cliente;
- smoke HTTP de criação, edição, listagem, detalhe e inativação.

Os dados sintéticos e o banco temporário foram removidos.

## Checkpoint anterior à etapa 2

**Etapa 1 — Funcionários, onboarding e documentos** (`0cc7663`)

Entregue:

- perfil PJ com dados pessoais, profissionais, endereço e data de entrada;
- pendências explícitas e bloqueio de ativação enquanto o onboarding estiver incompleto;
- atualização, notas gerenciais e histórico auditável;
- documentos PDF/JPEG/PNG/WebP de até 25 MB, privados e contextualizados;
- upload multipart para Vercel Blob e fallback local exclusivo de desenvolvimento;
- download autorizado por tenant;
- RLS e FKs compostas para Funcionário, Documento, Nota, autor e uploader;
- tela de detalhe responsiva na Visão Gestão.

Validação executada:

- `npm run typecheck`;
- `npm run lint`;
- `npm test -- --run` — 41 testes passaram e 1 integração ficou condicionada às URLs;
- `npm run db:check`;
- migrações completas em banco PostgreSQL vazio;
- teste PostgreSQL com roles restritas;
- smoke HTTP real de login, troca de senha, cadastro, upload, ativação, nota, renderização e download idêntico.

Os recursos sintéticos do smoke e o banco temporário foram removidos. O banco local de desenvolvimento e o usuário `gestor.teste@synova.local` foram preservados.

## Estado final

As etapas 1 a 8 da V1 estão implementadas, validadas e publicadas. O banco produtivo permanece sem tenant permanente; o primeiro tenant e seus usuários devem ser criados pelas requests protegidas do README quando as credenciais operacionais forem definidas.

Os dados do smoke foram removidos. Nenhuma senha temporária ou segredo foi versionado.
