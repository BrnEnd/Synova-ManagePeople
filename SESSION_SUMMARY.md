# Resumo da sessão — onboarding documental

Atualizado em: 27/09/2026  
Repositório: `Synova-ManagePeople`  
Branch atual: `main`  
Último commit existente: `158bee3 feat: prefill employee temporary password`

## Situação atual

Foi implementada, mas **ainda não commitada, enviada ao remoto, migrada em produção ou publicada**, a primeira versão completa do fluxo de solicitação e aprovação de documentos de admissão.

O diretório de trabalho contém todas as alterações como arquivos modificados/novos. Não descartar o worktree.

Validações concluídas:

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm test -- --reporter=dot`: 111 testes aprovados e 2 integrações ignoradas por ausência de `TEST_DATABASE_URL`/`TEST_PROVISIONING_DATABASE_URL`.
- `DATABASE_URL=postgresql://localhost/synova npm run db:check`: aprovado.
- `git diff --check`: aprovado.
- `npx next build --webpack`: aprovado após a retomada, incluindo geração das 25 páginas.
- O build padrão com Turbopack falhou somente porque o ambiente não permitiu abrir a porta interna do processador de CSS. O build Webpack, oficialmente suportado pelo Next 16, passou após liberar o acesso ao Google Fonts.

## Requisitos confirmados

### Fluxo geral

- O gestor aciona manualmente o botão `Solicitar documentação` após o pré-cadastro.
- O gestor escolhe CLT ou PJ.
- É enviado um link individual para o e-mail pessoal do funcionário.
- O link vale 15 dias; a validade aparece explicitamente no e-mail e no formulário.
- Não há OTP. O token funciona como credencial individual, é armazenado apenas como hash e é substituído quando renovado ou quando uma correção é solicitada.
- O formulário salva rascunho automaticamente, é responsivo/mobile-first e aceita múltiplos arquivos.
- Formatos: PDF, JPEG, PNG e WebP, até 25 MB por arquivo.
- Após o envio, o formulário é bloqueado.
- Em caso de reprovação, somente os itens reprovados ficam habilitados para reenvio; itens aprovados são preservados.
- Versões anteriores dos documentos ficam registradas.
- Cada documento é aprovado ou reprovado separadamente; reprovação exige motivo.
- Todos os gestores podem visualizar/revisar.
- A criação do usuário do portal só é liberada após:
  - aprovação da documentação;
  - conclusão das pendências já existentes de cadastro, alocação e condições financeira/comercial;
  - ativação do funcionário.
- As credenciais continuam sendo enviadas somente aos responsáveis internos, usando o fluxo já existente.

### Convivência com o fluxo legado

- Funcionários existentes permanecem no modo legado.
- O fluxo digital é ativado individualmente por funcionário novo.
- Antes do primeiro upload, o gestor pode cancelar e voltar ao modo legado.
- Depois do primeiro upload, o retorno ao legado fica bloqueado.
- Uma solicitação cancelada sem upload pode ser criada novamente.

### Checklist CLT

Documentos/campos implementados:

- RG ou CIN, com múltiplos arquivos.
- CPF em campo textual separado.
- Título de eleitor.
- Comprovante de endereço.
- ASO/atestado admissional.
- CTPS: número e arquivo.
- Foto 3x4.
- PIS/NIS: número **ou** comprovante.
- Reservista obrigatório quando o gênero for masculino.
- Certidão de casamento ou marcação explícita de que não se aplica.
- Telefone.
- Gênero: Masculino/Feminino.
- Raça/cor conforme opções do IBGE, incluindo `Prefiro não informar`.
- Vale-transporte Sim/Não; quando Sim, quantidade inteira de passagens por dia, sem máximo.
- Adiantamento mensal de 40% Sim/Não.
- Declaração de veracidade obrigatória.
- Dependentes repetíveis com nome, nascimento, CPF, parentesco, IRRF e salário-família.
- Comprovante de dependente obrigatório apenas para salário-família ou relações especiais como enteado/tutelado/menor sob guarda.

Não aparecem no formulário do funcionário: empresa, data de admissão, horário, função e salário. Esses dados continuam com o gestor.

### Checklist PJ

- Cartão CNPJ obrigatório.
- Comprovante de residência obrigatório.
- Contrato assinado opcional e não bloqueante; pode ser anexado posteriormente pelo gestor no fluxo existente.

### Notificações e retenção

- Foi criada uma central de notificações no cabeçalho da gestão, com contador e painel.
- Eventos gerados para envio, correção, aprovação, expiração em até 3 dias, expiração e análise pendente.
- O cron diário existente também executa os lembretes de documentação.
- Rascunhos expirados há 90 dias têm arquivos físicos removidos, registros de documento arquivados, dados pessoais do rascunho limpos e evento de auditoria registrado.
- Downloads e visualizações da documentação geram eventos de auditoria.
- Downloads continuam com `Cache-Control: private, no-store`.

## Estrutura implementada

### Banco de dados

Alterações principais em `lib/db/schema.ts`:

- Novos tipos de documento:
  - `voter_registration`
  - `dependent_certificate`
  - `military_certificate`
  - `marriage_certificate`
  - `medical_admission`
  - `work_card`
  - `photo`
  - `pis_proof`
  - `cnpj_card`
- Novos campos em `employees`:
  - `gender`
  - `race_color`
  - `documentation_mode`
  - `documentation_status`
- `employee_id` opcional em `notifications`.
- Novas tabelas:
  - `document_onboarding_requests`
  - `document_onboarding_items`
  - `document_onboarding_files`
- RLS habilitado e forçado nas três tabelas novas.

Migrações geradas:

- `drizzle/0016_next_mother_askani.sql`
- `drizzle/0017_clumsy_sue_storm.sql`
- `drizzle/0018_special_thunderbolt.sql`
- snapshots correspondentes e journal atualizados.

Importante: `0016` foi complementada manualmente com as políticas de RLS. Não regenerar ou sobrescrever sem preservar esse trecho.

### Domínio e backend

Nova pasta `lib/document-onboarding/`:

- `domain.ts`: checklists e validações condicionais.
- `domain.test.ts`: testes de reservista, PIS e dependentes.
- `token.ts`: criação, parsing, hash SHA-256 e comparação segura do token.
- `email.ts`: e-mails via Resend com validade explícita.
- `service.ts`: criação, consulta, autosave, vínculo de arquivo, envio, revisão, renovação, cancelamento, notificações, expiração e retenção.
- `server.ts`: singleton do serviço.
- `http.ts`: respostas padronizadas de erro.

Novas APIs:

- Gestão:
  - `POST /api/employees/[employeeId]/documentation`
  - `POST /api/employees/[employeeId]/documentation/review`
  - `POST /api/employees/[employeeId]/documentation/renew`
  - `POST /api/employees/[employeeId]/documentation/cancel`
- Públicas por token:
  - `PUT /api/documentation/[token]/draft`
  - `POST /api/documentation/[token]/submit`
  - `POST /api/documentation/[token]/documents` para armazenamento local
  - `POST /api/documentation/[token]/complete` para concluir Blob
  - `POST /api/documentation/upload` para upload direto ao Vercel Blob

`proxy.ts` foi atualizado para aceitar o callback público do novo upload do Vercel Blob.

### Interface

- Nova página pública: `app/documentacao/[token]/page.tsx`.
- Formulário: `components/document-onboarding/public-documentation-form.tsx`.
- Card do gestor: `components/document-onboarding/manager-documentation-card.tsx`.
- Central de notificações: `components/management/management-notifications.tsx`.
- A ficha do funcionário agora mostra o fluxo digital, dados enviados, documentos e ações de revisão.
- O seletor de vínculo da ficha aceita CLT e PJ.
- Documentos do onboarding passam a aparecer também na grade geral da ficha.
- O card de criação de acesso informa especificamente quando a documentação ainda não foi aprovada.

O skill de design do Emil foi usado para orientar a hierarquia visual, os estados claros, botões responsivos e feedback de progresso/erro, sem animações decorativas.

## Segurança e isolamento

- O token público contém tenant/request/segredo, mas somente o hash é persistido.
- Toda consulta pública abre transação com o tenant contido no token e só continua após comparar o hash em tempo constante.
- Tokens antigos são invalidados em renovação ou primeira reprovação da rodada.
- Tabelas novas têm RLS por `app.tenant_id`.
- O tipo do documento é derivado do checklist no servidor, não confiado ao cliente.
- Caminhos de upload são validados contra tenant e funcionário.
- Documentos aprovados não podem ser alterados pelo funcionário.
- Arquivos e dados sensíveis não usam cache público.
- Downloads e visualizações gerenciais são auditados.

## Pesquisa legal usada na decisão sobre dependentes

- Manual eSocial S-1.3 consolidado em 2026: dependentes do RGPS devem ser informados quando relevantes para IRRF ou salário-família.
- INSS: certidão de nascimento é exigida para salário-família; enteado/tutelado exige documentação comprobatória adequada.
- LGPD: aplicação do princípio da necessidade/minimização.

Fontes oficiais:

- https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais/mos-s-1-3-consolidada-ate-a-no-s-1-3-07-2026.pdf
- https://www.gov.br/inss/pt-br/saiba-mais/salario-familia/cadastrar-ou-atualizar-dependentes-para-salario-familia
- https://www.planalto.gov.br/ccivil_03/decreto/d3048compilado.htm
- https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm

## Pontos que precisam de validação manual antes da produção

1. Executar o fluxo completo em um banco de teste real:
   - criar funcionário com e-mail pessoal;
   - solicitar CLT e PJ;
   - conferir recebimento e conteúdo do e-mail;
   - testar upload local e Vercel Blob;
   - salvar/recuperar rascunho;
   - enviar;
   - aprovar e reprovar itens;
   - confirmar invalidação do link anterior;
   - reenviar correção;
   - aprovar tudo;
   - completar pendências gerenciais;
   - criar acesso ao portal.
2. Confirmar se o proxy do site público encaminha o cabeçalho `x-synova-portal-proxy` para a página e APIs públicas. O callback do Blob já foi liberado diretamente em `proxy.ts`.
3. Conferir o remetente/domínio do Resend e o valor de `CANONICAL_PORTAL_URL` no ambiente de produção.
4. Rodar as migrações primeiro e só depois publicar a aplicação, pois o código novo consulta colunas e tabelas adicionadas.
5. Exercitar o cron manualmente em staging para validar lembretes, expiração e purga de 90 dias.
6. Validar visualmente o formulário em celular real, principalmente captura de foto e múltiplos arquivos.

## Correções feitas na retomada de 27/09/2026

- Cada item agora possui o estado `reviewable`: um upload somente pode ser revisado após o funcionário enviar a rodada atual.
- Itens ainda não revisados da rodada anterior continuam disponíveis ao gestor mesmo depois da primeira reprovação.
- A API bloqueia alterações dos dados pessoais durante uma rodada de correção e aceita novos arquivos somente nos itens reprovados.
- Tokens são revalidados dentro da mesma transação das mutações, eliminando a janela entre validação e gravação.
- Links expirados são negados em todos os estados; solicitações em preenchimento/correção são marcadas como expiradas em transação separada.
- Renovação deixou de aparecer/funcionar durante análise e preserva o estado de correção quando aplicável.
- Duas revisões concorrentes do mesmo item são resolvidas atomicamente; a segunda recebe conflito.
- Aprovação PJ não remove indevidamente as pendências pessoais de identificação e telefone.
- Ativação do funcionário no fluxo digital passou a exigir aprovação documental também no backend/repositório.
- Smoke E2E e teardown PostgreSQL foram atualizados para limpar as tabelas novas.
- Foi adicionado um teste de integração PostgreSQL específico do onboarding; ele roda quando `TEST_DATABASE_URL` e `TEST_PROVISIONING_DATABASE_URL` estiverem disponíveis.

## Próximos passos recomendados

1. Revisar o diff, especialmente `lib/document-onboarding/service.ts` e as migrações.
2. Fazer teste manual em staging com Resend e Vercel Blob reais.
3. Ajustar qualquer problema encontrado no teste ponta a ponta.
4. Commitar as alterações em um único commit de feature ou separar em banco/backend/UI.
5. Executar migrações no banco de produção.
6. Publicar a aplicação.
7. Fazer smoke test em produção com um funcionário de teste, sem reutilizar dados pessoais reais.

## Comandos úteis para retomada

```bash
cd /Users/brunoalexandrino/Desktop/Workspace/Synova/Synova-ManagePeople
git status --short
npm run lint
npm run typecheck
npm test -- --reporter=dot
DATABASE_URL=postgresql://localhost/synova npm run db:check
npx next build --webpack
```

Não executar `db:migrate`, commit, push ou deploy sem revisar o ambiente/credenciais e confirmar a sequência migração → aplicação.
