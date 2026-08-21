# Estado da implementação

Este arquivo é o ponto de retomada operacional da V1 descrita no issue GitHub #1.

## Checkpoint atual

**Etapa 1 — Funcionários, onboarding e documentos** (`codex/complete-v1`, commit desta etapa)

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

## Próxima etapa

**Etapa 2 — Clientes**

Criar entidade multi-tenant de Cliente, cadastro/edição/listagem/inativação, contatos e observações; adicionar auditoria, RLS, testes, dashboard navegável e request interna de criação via CLI. Ao concluir, atualizar este arquivo e criar novo commit.

## Etapas restantes

1. Etapa 2 — Clientes.
2. Etapa 3 — Contratos, alocações e condições financeiras/comerciais.
3. Etapa 4 — Competências e apontamentos.
4. Etapa 5 — Aprovação, ajustes, último dia útil e notificações.
5. Etapa 6 — Previsão PDF, Nota Fiscal e pagamento.
6. Etapa 7 — Portal do funcionário, dashboards e E2E completo.
7. Etapa 8 — Infraestrutura, segredos, deploy e validação em produção.
