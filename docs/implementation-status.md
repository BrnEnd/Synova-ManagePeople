# Estado da implementação

Este arquivo é o ponto de retomada operacional da V1 descrita no issue GitHub #1.

## Checkpoint atual

**Home objetiva e funções em São Paulo — issues #2 e #3** (`dc3cc18`)

Entregue neste checkpoint:

- home de login com a chamada `Bem-vindo à Synova.` e sem os dois textos explicativos anteriores;
- smoke HTTP público reutilizável para verificar a nova chamada, os identificadores institucionais preservados e a ausência dos textos removidos;
- região das Vercel Functions do People fixada em `gru1`, junto ao gateway em `gru1` e ao Neon em `sa-east-1`;
- deployment produtivo `dpl_EtqPmcBF5ko5d7jHZeLpfuyguNXW` em estado `Ready`.

Validação deste checkpoint:

- typecheck, lint, 66 testes unitários, build e preview local aprovados;
- resumo do deployment confirmou as rotas do People em `gru1`;
- smoke público aprovado em `https://www.synovadigital.com.br/portal/entrar`;
- URL técnica continuou respondendo HTTP 307 para a URL canônica;
- E2E produtivo descartável aprovado para gestor e funcionário, incluindo APIs, banco, Blob privado, PDF, NF, pagamento e cleanup;
- cron respondeu HTTP 401 sem segredo e HTTP 200 com segredo;
- após aquecimento, cinco acessos à home responderam em 123–134 ms, exceto a primeira amostra de 393 ms; uma autenticação inválida respondeu em 650 ms;
- cold starts continuam variáveis e não constituem garantia de latência absoluta.

## Checkpoint anterior

**Portal canônico e provisionamento permanente** (`6f94ab4`)

Entregue neste checkpoint:

- aplicação publicada em `https://www.synovadigital.com.br/portal`, com o People independente atrás do gateway do site Synova;
- login sem campo de organização e tenant operacional fixo em `synova`;
- URL técnica protegida pelo segredo compartilhado do gateway e redirecionada para a URL canônica;
- exceções diretas limitadas ao cron autenticado e ao callback assinado do Vercel Blob;
- `main` do People em `e4c5727` e `main` do site Synova em `c44cd67`;
- deployment People `dpl_EGtNY84PuhkMQyTUyyeb6m5UeLMh` em estado `Ready`;
- tenant permanente `Synova`, gestores Bruno, Carolina e Richard, e funcionário de homologação criados em produção;
- funcionário ativo e vinculado ao usuário, com documento sintético de identificação, contrato vigente, cliente `Homologação Synova`, alocação vigente sob Bruno, condição financeira de R$ 100/h e condição comercial de R$ 200/h;
- nenhuma competência, Nota Fiscal ou pagamento criado pelo provisionamento.

Validação deste checkpoint:

- login dos quatro usuários respondeu HTTP 200 com papel correto e troca obrigatória de senha;
- cookie de sessão limitado a `Path=/portal`;
- página de login, assets, APIs e redirecionamentos validados no domínio canônico;
- upload privado completado e registrado no Vercel Blob;
- cron respondeu HTTP 401 sem segredo e HTTP 200 com segredo, sem processar fora da janela do fechamento;
- URL técnica de interface respondeu HTTP 307 para o domínio canônico;
- banco confirmou onboarding completo, vínculo do usuário, vigências e valores; competências e pagamentos permaneceram zerados.

As senhas temporárias não estão versionadas e devem ser entregues uma única vez pelos canais operacionais.

## Checkpoint anterior

**Etapa 8 — Infraestrutura, segredos, deploy e validação em produção** (`6dbb817`)

Entregue nesta etapa:

- projeto Vercel `synova-manage-people` publicado em `https://synova-manage-people.vercel.app`;
- Neon PostgreSQL isolado e Vercel Blob privado em `gru1`;
- migrações aplicadas fora do runtime com credencial proprietária;
- runtime separado entre `synova_app_prod` e `synova_provisioner`, ambas sem superusuário e sem `BYPASSRLS`;
- segredos aleatórios protegidos nos ambientes Vercel e cron diário configurado;
- runbook de migração, rotação, publicação, validação e provisionamento inicial.

Validação desta etapa:

- deployment produtivo `dpl_FT6tuFqhwjyiKFdQ2GLCw2iuaXDW` em estado `Ready`;
- integração completa no Neon produtivo aprovada com roles restritas;
- E2E HTTP público aprovado do provisionamento ao pagamento com Blob privado;
- `/entrar` respondeu HTTP 200 com HTTPS/HSTS;
- 19 tabelas com RLS habilitada e forçada; 0 tenants e 0 blobs sintéticos após cleanup;
- nenhum erro HTTP 500 nos logs do deployment após o smoke.

Os dados e o banco sintéticos foram removidos.

## Checkpoint anterior à etapa 8

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

As etapas 1 a 8 da V1 e a integração canônica sob `/portal` estão implementadas, validadas e publicadas. O tenant permanente e os quatro usuários iniciais estão provisionados em produção.

Os dados do smoke foram removidos. Permanecem apenas os dados permanentes solicitados e o conjunto sintético de homologação. Nenhuma senha temporária ou segredo foi versionado.
