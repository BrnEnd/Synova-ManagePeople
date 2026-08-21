# Especificação de Implementação — Portal de Funcionários Synova

## Problem Statement

A Synova precisa operar, de forma segura e auditável, o relacionamento com funcionários e prestadores PJ: contratação, documentação, alocação, apontamento de horas, aprovação, previsão de pagamento, Nota Fiscal e confirmação de pagamento. Hoje esse ciclo não possui uma aplicação única, histórico imutável ou isolamento preparado para múltiplos tenants.

## Solution

Construir uma aplicação web interna, independente do `page-synova`, preparada para Vercel e visualmente coerente com o ecossistema Synova. A aplicação terá a Visão Gestão e o Portal do Funcionário, persistirá dados multi-tenant, controlará a competência mensal por uma máquina de estados e preservará a fotografia financeira e documental de cada período.

## User Stories

1. Como gestor, quero criar um tenant para que a operação de uma organização fique isolada das demais.
2. Como gestor, quero criar usuários gestores para que a administração do tenant possa acessar a plataforma.
3. Como gestor, quero criar um usuário associado a um funcionário para que ele possa entrar no seu portal.
4. Como usuário recém-criado, quero trocar a senha temporária no primeiro acesso para que somente eu conheça minha credencial.
5. Como gestor, quero criar e completar o cadastro de um funcionário PJ para que sua contratação seja acompanhada centralmente.
6. Como gestor, quero visualizar campos e documentos pendentes de um pré-cadastro para que o onboarding seja concluído.
7. Como gestor, quero inativar um funcionário sem excluir seu histórico para que a auditoria financeira e contratual seja preservada.
8. Como gestor, quero cadastrar clientes como entidades próprias para que alocações e faturamento não dependam de texto livre.
9. Como gestor, quero registrar alocações com vigência, cliente e gestor responsável para que o histórico de movimentações seja consultável.
10. Como gestor, quero encerrar uma alocação sem substituí-la para que mudanças de cliente preservem o passado.
11. Como gestor, quero registrar contratos e suas vigências para que contrato atual e anteriores permaneçam disponíveis.
12. Como gestor, quero anexar documentos contextualizados para que contratos, onboarding, NFs e comprovantes não fiquem desconectados dos seus registros.
13. Como gestor, quero cadastrar condições financeiras versionadas para que cada competência use o valor-hora vigente no período.
14. Como gestor, quero registrar condições comerciais de alocação separadamente para que custo do funcionário e faturamento do cliente não sejam confundidos.
15. Como gestor, quero adicionar anotações ao histórico do funcionário para que informações gerenciais tenham autor e data.
16. Como funcionário, quero consultar somente o meu perfil, contratos, alocações e documentos autorizados para que meus dados permaneçam privados.
17. Como funcionário, quero lançar horas por data e observação na competência atual para que meu trabalho mensal seja consolidado.
18. Como funcionário, quero editar os lançamentos enquanto a competência estiver editável para que erros possam ser corrigidos antes do envio.
19. Como funcionário, quero visualizar cliente, competência, total acumulado e situação para que eu saiba o que falta concluir.
20. Como funcionário, quero enviar explicitamente minhas horas para aprovação para que o gestor responsável possa analisá-las.
21. Como gestor, quero revisar lançamentos e total de horas pendentes para que eu possa aprovar ou solicitar correções.
22. Como gestor, quero justificar uma solicitação de ajuste para que o funcionário saiba o que deve corrigir.
23. Como funcionário, quero corrigir e reenviar uma competência devolvida para que ela volte ao fluxo de aprovação sem perder as análises anteriores.
24. Como gestor, quero aprovar uma competência para que as horas, valores e condições daquele período sejam congelados.
25. Como funcionário, quero consultar a previsão de pagamento em PDF para que eu emita a Nota Fiscal com o valor de referência.
26. Como funcionário, quero enviar a Nota Fiscal para uma competência aprovada para que a gestão possa iniciar o pagamento.
27. Como gestor, quero acompanhar pagamentos pendentes com horas, valor previsto, NF e documentos para que nenhuma obrigação seja esquecida.
28. Como gestor, quero registrar a data, valor, observação e comprovante de um pagamento externo para que a competência seja encerrada.
29. Como funcionário, quero consultar previsões, NFs e comprovantes de competências anteriores para que meu histórico financeiro permaneça acessível.
30. Como gestor, quero ver indicadores operacionais clicáveis no dashboard para que eu navegue às pendências correspondentes.
31. Como funcionário, quero receber uma notificação interna no último dia útil nacional do mês para que eu me lembre de fechar minhas horas.
32. Como funcionário, quero receber notificações de ajustes, aprovação, previsão, NF pendente e pagamento realizado para que eu acompanhe o ciclo sem depender de comunicação externa.
33. Como sistema externo autorizado, quero criar um pré-cadastro idempotente para que uma contratação do Portal de Vagas não gere funcionários duplicados.
34. Como auditor, quero consultar eventos relevantes com autor, entidade e data para que ações operacionais sejam rastreáveis.
35. Como administrador de plataforma, quero usar requests de provisionamento protegidas para que o primeiro tenant e usuários sejam criados em produção sem interface pública.

## Implementation Decisions

### Plataforma, identidade e isolamento

- A aplicação será uma nova aplicação Next.js preparada para Vercel, usando Postgres com Drizzle para dados relacionais e armazenamento de objetos compatível com Vercel para documentos.
- A interface adotará os tokens e os padrões de experiência do `page-synova` sem reutilizar seu domínio de vagas ou recrutamento: tema escuro, laranja Synova, tipografia Barlow, feedback visual claro, responsividade e animações discretas.
- `Usuário` e `Funcionário` são entidades distintas. Um usuário pode existir sem funcionário associado; um funcionário pode receber associação de usuário posteriormente.
- Existirão dois papéis iniciais: `gestor` e `funcionário`. Todo gestor tem acesso integral aos registros do próprio tenant. O funcionário acessa exclusivamente os próprios dados e competências.
- Toda entidade de negócio terá `tenantId`. A resolução de tenant ocorrerá na autenticação/chave de serviço e será aplicada na autorização e em toda consulta ou mutação persistida. O banco também deverá proteger acessos entre tenants.
- Sessões serão protegidas por cookie HTTP-only, `Secure` em produção, `SameSite=Strict`, expiração definida e verificação do usuário ativo a cada solicitação. Senhas serão armazenadas por derivação resistente a força bruta, com limitação de tentativas de login.

### Modelo temporal e histórico

- Funcionário, cliente, contrato, alocação, condição financeira, condição comercial, documento, anotação, evento de histórico, notificação e registro de integração serão modelados como responsabilidades separadas.
- Contratos, alocações e condições financeiras/comerciais terão início de vigência, término opcional, situação e registro histórico. Registros financeiros, contratuais e operacionais serão inativados, cancelados ou arquivados em vez de apagados.
- Toda ação relevante criará um evento de histórico com autor quando aplicável, data/hora, tipo de evento e referência da entidade afetada.
- A competência representa um único funcionário, uma competência mensal e a alocação aplicável ao período. Lançamentos de horas guardam data, quantidade e observação.

### Fluxo da competência e fotografia financeira

- A competência terá os estados `em_preenchimento`, `aguardando_aprovacao`, `ajustes_solicitados`, `aguardando_nf`, `aguardando_pagamento` e `pagamento_realizado`.
- Somente o funcionário poderá enviar ou reenviar horas; somente o gestor poderá aprovar, solicitar ajustes ou registrar pagamento; somente o funcionário poderá enviar NF no estado autorizado.
- Solicitações de ajuste são obrigatoriamente justificadas e preservam data, gestor e todos os ciclos de envio, devolução e reenvio.
- Ao aprovar, uma única operação transacional congelará lançamentos consolidados, total de horas aprovadas, funcionário, cliente, alocação, gestor responsável, valor-hora vigente, condição comercial aplicável e valor total. O valor devido será sempre `horas aprovadas × valor-hora`.
- A aprovação gera automaticamente uma previsão de pagamento versionada, em PDF, contendo identificação Synova, funcionário, competência, cliente, período, horas, valor-hora, total e data de aprovação. Uma previsão já emitida não é sobrescrita.
- O envio de NF move a competência para aguardando pagamento. O registro de pagamento contém data, valor efetivamente pago, observação e comprovante, e então encerra a competência.

### Documentos, notificações e dashboard

- Serão aceitos PDF, JPEG, PNG e WebP de até 25 MB. Tipo MIME, tamanho, contexto, autor, origem, data e vínculos de negócio serão validados e persistidos; arquivos jamais poderão ser acessados por URL pública sem uma autorização do tenant.
- Documentos de onboarding, contratos, previsão, NF e comprovante usarão a mesma estratégia de armazenamento, com tipo e referência ao funcionário, contrato, competência ou pagamento.
- Um trabalho diário em horário fixo de `America/Sao_Paulo` avaliará fins de semana e feriados nacionais brasileiros por uma biblioteca de calendário. Às 9h do último dia útil do mês, funcionários sem envio da competência atual receberão notificação interna.
- Notificações internas também serão criadas para ajustes solicitados, aprovação, previsão disponível, NF pendente e pagamento realizado. E-mail e outros canais são adaptações futuras.
- O dashboard gerencial mostrará funcionários ativos, novas contratações, pendências documentais, competências não enviadas, aguardando aprovação, NF e pagamento, previsão de custo e previsão de faturamento quando houver condições comerciais. Cada indicador navegável aplicará o filtro correspondente.

### Provisionamento e integração externa

- Requests administrativos internos criarão tenant, usuário, associação entre usuário e funcionário e redefinição de senha. Serão protegidos por `PROVISIONING_SECRET` como Bearer token, mantido somente no ambiente servidor, auditados e idempotentes.
- Senhas temporárias serão entregues somente no canal operacional da criação e não serão retornadas por consultas. O primeiro login exigirá troca de senha.
- A rota de pré-cadastro externo estará disponível nesta entrega. Ela aceitará dados mínimos, identificará a origem como Portal de Vagas, criará o funcionário em pré-cadastro/documentação pendente e registrará os campos ou documentos faltantes.
- A rota externa exigirá chave de serviço específica por tenant, armazenada somente como hash, `externalHiringId` e `Idempotency-Key`. Repetições equivalentes retornarão o resultado já criado, sem duplicar funcionário ou evento. O Portal de Vagas não será modificado para chamar essa rota nesta entrega.

### Módulos e interfaces de teste

- O módulo de Identidade exporá autenticação, sessão, recuperação/troca de senha e identidade resolvida. Adaptadores de sessão e persistência ficarão internos a esse módulo.
- O módulo de Competência exporá operações de criar/abrir competência, registrar horas, enviar, solicitar ajuste, aprovar, enviar NF e registrar pagamento. Ele encapsulará autorização contextual, transições, cálculo, snapshots, PDF, notificações e eventos.
- O módulo de Documentos exporá autorização de upload/download e associação contextual, escondendo o adaptador de armazenamento.
- O módulo de Provisionamento exporá comandos idempotentes para tenant, usuário, vínculo e senha. As requests internas serão adaptadores desse módulo.
- O módulo de Integração exporá o comando de pré-cadastro idempotente; a rota do Portal de Vagas será seu adaptador.

## Testing Decisions

- Testes verificarão comportamento pelas interfaces públicas dos módulos e requests, sem testar colaboradores internos ou detalhes de persistência.
- O principal seam é a interface do módulo de Competência: testes exercitarão transições autorizadas e inválidas, edição bloqueada, ajustes sucessivos, cálculo por valor-hora e a imutabilidade da fotografia aprovada.
- O seam de Identidade e autorização cobrirá sessão, papéis, funcionário acessando somente a própria informação, gestor acessando o tenant completo e negação de acesso cruzado entre tenants.
- O seam de Documentos cobrirá limite de 25 MB, tipos permitidos/negados, autorização de download e vínculo obrigatório a uma entidade contextual.
- O seam de Provisionamento cobrirá Bearer token, idempotência, obrigatoriedade de troca de senha e auditoria. O seam de Integração cobrirá autenticação de serviço, `externalHiringId`, `Idempotency-Key`, dados mínimos e repetição segura.
- Testes de integração validarão persistência transacional, políticas de isolamento, geração da previsão e registro consistente de pagamento.
- Testes ponta a ponta cobrirão o cenário funcional completo e o fluxo de correção, nos papéis gestor e funcionário, em desktop e viewport móvel.

## Out of Scope

- Provisionamento automático de Google Workspace e criação de e-mail corporativo.
- Pagamentos automáticos, integração bancária e conciliação financeira.
- Folha de pagamento CLT, impostos, descontos e regras fiscais avançadas.
- E-mail, SMS, WhatsApp ou outros canais externos de notificação.
- Feriados estaduais ou municipais.
- BI avançado, gestão de projetos, contratos comerciais avançados e automação completa de onboarding/offboarding.
- Alterações no Portal de Vagas para consumir a rota de integração.

## Further Notes

- O primeiro tenant e gestor serão criados em produção pelas requests de provisionamento, usando o segredo configurado no ambiente. O segredo deve ser rotacionado conforme a política operacional da Synova.
- A competência usa somente feriados nacionais brasileiros e o fuso `America/Sao_Paulo` para o lembrete mensal.
- Não há política de retenção definida nesta versão; a arquitetura de documentos deve permitir defini-la posteriormente sem romper vínculos históricos.
