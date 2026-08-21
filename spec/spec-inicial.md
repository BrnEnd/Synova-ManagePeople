# Especificação Funcional — Portal de Funcionários Synova

## 1. Objetivo

Desenvolver uma plataforma web interna para gerenciamento de funcionários e prestadores da Synova.

A plataforma deverá centralizar todo o ciclo operacional do profissional, desde sua contratação até o acompanhamento mensal de horas, aprovação, emissão de Nota Fiscal e pagamento.

O sistema deverá contemplar duas experiências principais:

* **Visão Gestão**
* **Visão Funcionário**

O objetivo da primeira versão é permitir que a Synova execute de ponta a ponta o seguinte fluxo:

**Contratação**

→ cadastro do funcionário

→ documentação e contrato

→ alocação em cliente

→ definição das condições financeiras

→ apontamento mensal de horas

→ aprovação das horas

→ geração da previsão de pagamento

→ envio da Nota Fiscal

→ pagamento

→ disponibilização do comprovante

→ manutenção de todo o histórico.

---

# 2. Diretrizes iniciais para desenvolvimento

Antes de iniciar qualquer implementação, deverão ser lidas integralmente todas as **Skills e instruções existentes no projeto `Synova-ManagePeople`**.


As Skills do projeto deverão ser consideradas a principal referência para decisões relacionadas a:

* arquitetura;
* estrutura de código;
* organização de pastas;
* padrões de desenvolvimento;
* segurança;
* autenticação;
* persistência;
* APIs;
* nomenclaturas;
* testes;
* deploy;
* boas práticas.

Os requisitos funcionais descritos neste documento deverão ser preservados, enquanto as decisões técnicas para implementá-los deverão seguir prioritariamente as Skills do projeto.

---

# 3. Referência visual

O projeto existente **`page-synova`** deverá ser utilizado como referência visual da nova aplicação.

Deverão ser observados principalmente:

* identidade visual;
* paleta de cores;
* tipografia;
* botões;
* formulários;
* espaçamentos;
* cards;
* tabelas;
* navegação;
* cabeçalhos;
* modais;
* feedback visual;
* padrões responsivos;
* experiência geral da interface.

O objetivo é fazer com que o Portal de Funcionários pareça parte do mesmo ecossistema Synova.

O `page-synova` deverá ser utilizado **somente como referência visual e de experiência**.

Não deverão ser copiadas automaticamente regras de negócio do Portal de Vagas, Portal de Recrutamento ou demais módulos existentes.

---

# 4. Infraestrutura geral

O sistema deverá ser uma aplicação web preparada para publicação na **Vercel**.

A persistência deverá utilizar uma solução de banco de dados integrada ou compatível com o ambiente utilizado na Vercel, seguindo as definições técnicas existentes nas Skills do projeto.

Documentos enviados ou gerados pelo sistema deverão possuir armazenamento seguro e permanecer vinculados aos respectivos registros da aplicação.

As credenciais e permissões de publicação já configuradas no ambiente de desenvolvimento deverão ser utilizadas conforme as práticas definidas nas Skills.

---

# 5. Multi-tenant

O sistema deverá ser desenvolvido desde sua primeira versão com suporte a **multi-tenancy**.

Mesmo que inicialmente a plataforma seja utilizada apenas internamente pela Synova, as principais entidades deverão possuir relacionamento explícito com o tenant ao qual pertencem.

Nenhuma regra de negócio deverá depender da premissa de que existe apenas um tenant.

O isolamento deverá ser aplicado tanto na persistência quanto na autorização de acesso.

Um usuário não deverá conseguir consultar registros pertencentes a outro tenant.

---

# 6. Modelo funcional conceitual

A implementação deverá considerar, conceitualmente, pelo menos as seguintes entidades:

* Tenant
* Usuário
* Perfil/Papel
* Funcionário
* Cliente
* Alocação
* Contrato
* Condição financeira
* Apontamento de horas
* Competência mensal
* Aprovação
* Documento
* Previsão de pagamento
* Nota Fiscal
* Pagamento
* Anotação
* Evento de histórico
* Notificação
* Registro de integração

A nomenclatura técnica final poderá ser definida durante a implementação.

O importante é preservar as responsabilidades e relações descritas neste documento.

---

# 7. Usuários, funcionários e perfis

A entidade responsável pela autenticação do sistema não deverá ser tratada como sinônimo do cadastro do funcionário.

Deverá existir separação conceitual entre:

**Usuário**

Responsável por autenticação, autorização e perfil de acesso.

**Funcionário**

Responsável pelas informações profissionais, contratuais, financeiras, alocações e histórico.

Um funcionário poderá possuir um usuário associado.

Essa separação permitirá futuramente a existência de usuários administrativos que não necessariamente sejam funcionários cadastrados no mesmo modelo operacional.

---

# 8. Perfis de acesso

Inicialmente deverão existir pelo menos dois perfis.

## 8.1. Gestor

O gestor deverá poder, conforme suas permissões:

* visualizar o dashboard;
* cadastrar funcionários;
* editar funcionários;
* consultar funcionários;
* cadastrar clientes;
* gerenciar alocações;
* consultar contratos;
* adicionar documentos;
* consultar condições financeiras;
* aprovar horas;
* solicitar ajustes;
* acompanhar competências;
* visualizar Notas Fiscais;
* registrar pagamentos;
* adicionar comprovantes;
* consultar históricos;
* registrar anotações.

## 8.2. Funcionário

O funcionário deverá possuir acesso somente às informações que lhe dizem respeito.

Deverá poder:

* consultar seu perfil;
* consultar sua alocação;
* consultar seus contratos disponibilizados;
* preencher horas;
* fechar competência;
* acompanhar aprovação;
* visualizar solicitações de ajuste;
* consultar previsão de pagamento;
* enviar Nota Fiscal;
* acompanhar pagamento;
* visualizar comprovante;
* consultar competências anteriores.

A solução de autorização deverá permitir a criação futura de outros perfis sem reformulação estrutural da aplicação.

---

# 9. Gestão de Funcionários

A visão Gestão deverá possuir um módulo específico para gerenciamento de funcionários.

## 9.1. Cadastro

O cadastro deverá suportar inicialmente:

* nome completo;
* documento de identificação necessário;
* endereço;
* telefone;
* e-mail pessoal;
* e-mail corporativo Synova;
* status;
* data de entrada;
* informações profissionais;
* cliente atual;
* alocação atual;
* gestor responsável;
* contrato;
* condições financeiras;
* documentos;
* anotações.

Todos os profissionais serão inicialmente considerados **PJ**.

Entretanto, a modelagem deverá permitir que outros tipos de vínculo sejam adicionados futuramente.

---

# 10. Situação do funcionário

O cadastro deverá possuir um status próprio, independente do status da competência mensal.

Exemplos iniciais:

* Pré-cadastro
* Documentação pendente
* Ativo
* Inativo

Outros estados poderão ser adicionados futuramente.

Um funcionário inativo não deverá ter seu histórico removido.

---

# 11. Onboarding e documentos pendentes

O sistema deverá possuir um onboarding básico para novas contratações.

Funcionários criados manualmente ou recebidos através do Portal de Vagas poderão entrar inicialmente como:

**Documentação pendente**

A gestão deverá conseguir identificar quais informações ou documentos ainda precisam ser recebidos.

Esse mecanismo deverá alimentar o indicador de:

**Novas contratações pendentes de documentos**

existente no dashboard.

A primeira versão não precisa possuir um workflow avançado de onboarding, mas deverá ser possível identificar claramente se o cadastro está completo ou possui pendências.

---

# 12. Contratos

O sistema deverá permitir armazenar o contrato firmado entre a Synova e o funcionário.

Cada contrato deverá permanecer vinculado ao profissional correspondente.

A estrutura deverá permitir:

* contrato atual;
* contratos anteriores;
* data de início;
* data de término, quando houver;
* situação;
* documento correspondente.

Uma renovação contratual não deverá apagar o contrato anterior.

---

# 13. Gestão de Clientes

Deverá existir uma entidade própria de **Cliente**.

O cliente não deverá ser armazenado apenas como texto dentro do cadastro do funcionário.

O cadastro deverá possuir inicialmente informações suficientes para sua identificação e utilização nas alocações.

Exemplos:

* nome;
* razão social, quando aplicável;
* CNPJ, quando aplicável;
* status;
* contatos básicos;
* observações.

A estrutura deverá permitir evolução futura para:

* contratos comerciais;
* responsáveis;
* centros de custo;
* projetos;
* outras informações administrativas.

---

# 14. Gestão de Alocações

O relacionamento entre funcionário e cliente deverá ocorrer através de uma **Alocação**.

Uma alocação deverá permitir identificar:

* funcionário;
* cliente;
* gestor responsável;
* data de início;
* data de término;
* status;
* condições financeiras aplicáveis;
* condições comerciais aplicáveis.

Quando um funcionário mudar de cliente, a alocação anterior não deverá ser sobrescrita.

Deverá ser possível consultar todo o histórico de alocações.

---

# 15. Gestor responsável

Cada alocação deverá possuir, quando aplicável, um **gestor responsável**.

Esse gestor será utilizado como referência para os principais workflows da competência.

Quando o funcionário fechar suas horas, a competência deverá ser direcionada ao gestor responsável correspondente.

A solução deverá permitir alteração do gestor responsável sem perda do histórico anterior.

---

# 16. Condições financeiras do funcionário

O sistema deverá armazenar as condições utilizadas para calcular o valor devido ao funcionário.

Deverá suportar inicialmente:

* valor-hora;
* valor mensal, quando aplicável;
* modelo de pagamento;
* início de vigência;
* término de vigência, quando aplicável.

Alterações futuras não deverão sobrescrever valores anteriores.

O sistema deverá conseguir identificar qual condição financeira estava vigente em determinado período.

---

# 17. Condições comerciais da alocação

Para suportar indicadores como **valor previsto de faturamento no mês**, a alocação poderá possuir também condições comerciais relacionadas ao cliente.

Esses valores deverão ser distintos do valor pago ao funcionário.

A estrutura deverá suportar, quando aplicável:

* valor-hora faturado ao cliente;
* valor mensal faturado ao cliente;
* início de vigência;
* término de vigência.

Dessa forma, deverão existir conceitos distintos de:

**Custo do funcionário**

e

**Faturamento do cliente**

Essa separação será importante para futuras análises financeiras.

---

# 18. Histórico do Funcionário

O cadastro deverá apresentar uma visão histórica do relacionamento entre o profissional e a Synova.

O histórico poderá combinar eventos automáticos e anotações manuais.

Exemplos de eventos:

* funcionário criado;
* contratação efetivada;
* contrato adicionado;
* documento recebido;
* alteração de valor;
* início de alocação;
* troca de cliente;
* troca de gestor;
* competência enviada;
* horas aprovadas;
* pagamento realizado;
* funcionário inativado.

---

# 19. Anotações gerenciais

Gestores deverão poder adicionar anotações ao cadastro do funcionário.

Cada anotação deverá registrar:

* conteúdo;
* autor;
* data;
* horário.

Uma anotação deverá permanecer no histórico e não substituir registros anteriores.

---

# 20. Portal do Funcionário

O funcionário deverá possuir uma área autenticada dedicada às próprias informações.

A página inicial deverá apresentar de forma clara suas principais pendências e informações da competência atual.

Exemplos:

* competência atual;
* horas lançadas;
* situação da competência;
* solicitação de ajuste;
* previsão de pagamento;
* pendência de Nota Fiscal;
* pagamento pendente;
* último pagamento.

---

# 21. Apontamento de horas

O funcionário deverá possuir uma interface de apontamento de horas semelhante a uma planilha.

Cada linha deverá representar um lançamento de trabalho.

Inicialmente deverá conter:

* data;
* quantidade de horas;
* observação.

A interface deverá apresentar:

* competência;
* cliente;
* total de horas;
* situação;
* ações disponíveis.

O sistema deverá relacionar automaticamente os lançamentos ao:

* funcionário;
* tenant;
* competência;
* alocação correspondente.

Enquanto a competência estiver em estado editável, o funcionário poderá alterar seus lançamentos.

---

# 22. Competência mensal

Os apontamentos deverão ser agrupados por competência.

Exemplo:

**Agosto/2026**

Cada competência possuirá seu próprio ciclo de vida.

Uma competência deverá ser tratada como uma unidade independente de processamento.

---

# 23. Estados da competência

| Status                        | Responsável principal | Comportamento                                      |
| ----------------------------- | --------------------- | -------------------------------------------------- |
| Em preenchimento              | Funcionário           | Horas podem ser preenchidas e alteradas            |
| Aguardando aprovação de horas | Gestor                | Funcionário já enviou o consolidado                |
| Ajustes solicitados           | Funcionário           | Horas retornam para correção                       |
| Aguardando envio de NF        | Funcionário           | Horas aprovadas e previsão de pagamento disponível |
| Aguardando pagamento          | Gestão                | NF recebida e pagamento pendente                   |
| Pagamento realizado           | Gestão                | Pagamento registrado e comprovante disponível      |

A implementação deverá utilizar uma máquina de estados ou mecanismo equivalente que impeça transições inválidas.

---

# 24. Fechamento das horas

Ao final da competência, o funcionário deverá executar explicitamente a ação:

**Enviar horas para aprovação**

Antes do envio, deverá conseguir visualizar o consolidado.

Depois da confirmação:

* os lançamentos deverão ser consolidados;
* o total de horas deverá ser registrado;
* o funcionário não deverá mais editar livremente os registros;
* a competência deverá mudar para **Aguardando aprovação de horas**;
* o gestor responsável deverá receber a pendência.

---

# 25. Aprovação de horas

Na visão Gestão, o responsável deverá conseguir analisar:

* funcionário;
* cliente;
* período;
* lançamentos;
* total de horas;
* observações.

O gestor poderá:

* aprovar;
* solicitar ajustes.

---

# 26. Solicitação de ajustes

Ao solicitar ajustes, o gestor deverá informar o motivo.

O status deverá mudar para:

**Ajustes solicitados**

O funcionário deverá receber a pendência e poderá editar novamente os lançamentos necessários.

Após a correção, deverá realizar novo envio.

Todo o histórico deverá ser preservado.

Deverá ser possível saber:

* quando foi enviado;
* quem analisou;
* quando foi devolvido;
* motivo;
* quando foi reenviado.

---

# 27. Aprovação definitiva

Ao aprovar as horas, o sistema deverá:

1. registrar o responsável pela aprovação;
2. registrar data e hora;
3. congelar os dados financeiros utilizados naquela competência;
4. congelar o total de horas aprovado;
5. calcular o valor devido;
6. gerar a previsão de pagamento;
7. disponibilizá-la ao funcionário;
8. alterar o status para **Aguardando envio de NF**.

Alterações futuras no valor-hora do funcionário não deverão alterar uma competência já aprovada.

---

# 28. Fotografia financeira da competência

Depois da aprovação, a competência deverá manter uma fotografia dos dados utilizados no cálculo.

Deverão ser preservados pelo menos:

* funcionário;
* cliente;
* alocação;
* competência;
* horas aprovadas;
* valor-hora utilizado;
* valor total;
* condições comerciais aplicáveis, quando utilizadas;
* gestor responsável;
* data de aprovação.

Essas informações não deverão depender exclusivamente dos valores atuais do cadastro.

Isso garante consistência histórica.

---

# 29. Previsão de Pagamento

Ao aprovar as horas, o sistema deverá gerar automaticamente um documento de **Previsão de Pagamento**.

O documento deverá ser disponibilizado preferencialmente em PDF.

Deverá conter pelo menos:

* identificação Synova;
* identificação do funcionário;
* competência;
* cliente;
* período;
* total de horas aprovadas;
* valor-hora considerado;
* valor total previsto;
* data da aprovação.

O objetivo do documento será informar ao funcionário o valor que deverá ser utilizado como referência para emissão da Nota Fiscal.

---

# 30. Imutabilidade da previsão

A previsão de pagamento gerada deverá permanecer vinculada à competência.

Caso futuramente exista necessidade de recalcular uma competência, a alteração deverá gerar uma nova versão ou evento explícito.

O documento originalmente utilizado não deverá simplesmente ser substituído sem histórico.

---

# 31. Envio da Nota Fiscal

Quando o status estiver em **Aguardando envio de NF**, o funcionário deverá conseguir enviar sua Nota Fiscal pelo próprio portal.

O documento deverá permanecer relacionado a:

* funcionário;
* competência;
* previsão de pagamento;
* pagamento correspondente.

Após o envio, o status deverá mudar para:

**Aguardando pagamento**

---

# 32. Pagamento

A visão Gestão deverá possuir uma área para acompanhar pagamentos pendentes.

O gestor deverá conseguir visualizar conjuntamente:

* funcionário;
* cliente;
* competência;
* horas aprovadas;
* valor-hora;
* valor previsto;
* previsão de pagamento;
* Nota Fiscal;
* status.

O pagamento financeiro em si será realizado externamente na primeira versão.

Após realizar o pagamento, a gestão deverá registrá-lo no sistema.

---

# 33. Registro do pagamento

O registro deverá permitir pelo menos:

* data do pagamento;
* valor efetivamente pago;
* observação, quando necessária;
* comprovante.

Ao concluir o registro, o status deverá mudar para:

**Pagamento realizado**

A competência deverá ser considerada encerrada.

---

# 34. Comprovante de pagamento

O comprovante deverá permanecer armazenado e vinculado ao pagamento.

O funcionário deverá conseguir consultar posteriormente:

* previsão;
* Nota Fiscal enviada;
* pagamento;
* comprovante.

---

# 35. Histórico financeiro

O funcionário deverá possuir um histórico de competências e pagamentos.

Deverá ser possível consultar, para cada mês:

* competência;
* cliente;
* horas;
* valor-hora;
* valor total;
* previsão de pagamento;
* Nota Fiscal;
* status;
* data de pagamento;
* comprovante.

Mudanças futuras no cadastro não deverão modificar registros históricos.

---

# 36. Fluxo principal

O fluxo principal deverá ser:

**Em preenchimento**

↓ Funcionário envia as horas

**Aguardando aprovação de horas**

↓ Gestor aprova

↓ Sistema gera previsão de pagamento

**Aguardando envio de NF**

↓ Funcionário envia Nota Fiscal

**Aguardando pagamento**

↓ Gestão realiza o pagamento e registra comprovante

**Pagamento realizado**

---

# 37. Fluxo de correção

O fluxo alternativo deverá ser:

**Aguardando aprovação de horas**

↓ Gestor solicita alteração

**Ajustes solicitados**

↓ Funcionário corrige

↓ Funcionário envia novamente

**Aguardando aprovação de horas**

Nenhum ciclo anterior deverá ser perdido.

---

# 38. Alertas e notificações

O sistema deverá possuir inicialmente um mecanismo simples de notificações.

Um caso obrigatório será o lembrete de fechamento da competência.

Ao se aproximar ou atingir o período definido para fechamento, funcionários que ainda não enviaram suas horas deverão ser identificados.

O sistema deverá alertar o funcionário de que sua competência precisa ser concluída.

Também deverão ser geradas notificações ou pendências para eventos como:

* horas devolvidas para ajuste;
* horas aprovadas;
* previsão de pagamento disponível;
* Nota Fiscal pendente;
* pagamento realizado.

A primeira versão poderá utilizar notificações internas no portal.

Outros canais, como e-mail, poderão ser adicionados conforme a infraestrutura disponível.

---

# 39. Dashboard da Gestão

A primeira versão deverá possuir um dashboard gerencial.

O objetivo é apresentar rapidamente informações operacionais relevantes.

Indicadores iniciais:

* total de funcionários ativos;
* novas contratações;
* novas contratações com documentação pendente;
* funcionários que ainda não enviaram as horas da competência;
* competências aguardando aprovação;
* competências aguardando Nota Fiscal;
* competências aguardando pagamento;
* previsão de pagamento aos funcionários no mês;
* previsão de faturamento no mês, quando existirem condições comerciais cadastradas.

Sempre que fizer sentido, os cards deverão permitir navegação para a listagem correspondente.

Exemplo:

**5 competências aguardando aprovação**

→ clicar

→ abrir lista das 5 competências.

---

# 40. Gestão de documentos

Deverá existir uma estratégia centralizada para gestão de documentos.

Inicialmente serão utilizados:

* contrato;
* documentos de onboarding;
* previsão de pagamento;
* Nota Fiscal;
* comprovante de pagamento.

Cada documento deverá possuir contexto e metadados suficientes para identificar:

* tenant;
* funcionário;
* tipo;
* competência, quando aplicável;
* data;
* origem;
* responsável pelo envio.

Arquivos não deverão existir de maneira desconectada das respectivas entidades.

---

# 41. Integração com Portal de Vagas

O Portal de Funcionários deverá disponibilizar uma API para criação de novos funcionários através de sistemas externos.

O primeiro consumidor previsto será o **Portal de Vagas Synova**.

Quando um candidato tiver sua situação alterada para **Contratado**, o Portal de Vagas deverá poder solicitar a criação do respectivo cadastro no Portal de Funcionários.

---

# 42. Endpoint de criação externa

Deverá existir um endpoint autenticado capaz de criar o pré-cadastro de um funcionário.

O endpoint deverá prever:

* autenticação;
* autorização;
* validação;
* idempotência;
* prevenção de duplicidade;
* tratamento de erros;
* logs;
* identificação do sistema de origem;
* tenant.

A API deverá ser estruturada de forma que outros sistemas possam utilizá-la futuramente.

---

# 43. Pré-cadastro via integração

Um funcionário criado através do Portal de Vagas não precisará necessariamente possuir todos os dados no momento da integração.

O sistema deverá aceitar a criação de um **pré-cadastro**.

Exemplo:

Portal de Vagas envia:

* identificador da contratação;
* nome;
* e-mail pessoal;
* telefone;
* cargo ou função;
* informações disponíveis do processo.

O Portal de Funcionários cria o profissional e sinaliza os campos/documentos ainda pendentes.

Essas pendências deverão aparecer para a Gestão.

---

# 44. Idempotência da integração

Uma mesma contratação enviada mais de uma vez pelo sistema de origem não deverá gerar múltiplos funcionários.

A integração deverá possuir algum identificador externo ou mecanismo equivalente para reconhecer requisições já processadas.

---

# 45. Auditoria

Eventos relevantes deverão gerar rastreabilidade.

Deverá ser possível identificar, quando aplicável:

* quem realizou a ação;
* qual ação foi realizada;
* data;
* horário;
* entidade alterada.

Exemplos:

* funcionário criado;
* cadastro alterado;
* documento enviado;
* contrato alterado;
* valor alterado;
* alocação alterada;
* horas enviadas;
* ajustes solicitados;
* horas aprovadas;
* Nota Fiscal enviada;
* pagamento registrado;
* comprovante enviado.

---

# 46. Exclusão e preservação histórica

Entidades com histórico financeiro, contratual ou operacional não deverão ser simplesmente apagadas da base.

Quando necessário, deverá ser utilizado conceito equivalente a:

* inativação;
* cancelamento;
* arquivamento.

Registros históricos deverão permanecer disponíveis para auditoria.

---

# 47. Provisionamento futuro do Google Workspace

A criação automática de e-mail corporativo através do Google Workspace ficará **fora da primeira versão**.

Entretanto, a arquitetura deverá permitir sua inclusão futura.

Fluxo futuro:

**Funcionário contratado**

→ Portal de Funcionários recebe/cria cadastro

→ serviço de provisionamento é acionado

→ conta Google Workspace é criada

→ e-mail corporativo é retornado

→ cadastro do funcionário é atualizado.

Essa integração deverá futuramente ser tratada como serviço externo desacoplado do núcleo funcional da aplicação.

---

# 48. Fora do escopo inicial

Não fazem parte da primeira versão:

* provisionamento automático de Google Workspace;
* pagamento bancário automático;
* integração bancária;
* folha de pagamento CLT;
* BI avançado;
* gestão completa de projetos;
* contratos comerciais avançados com clientes;
* gestão fiscal completa;
* automação avançada de onboarding;
* automação avançada de offboarding;
* comunicação externa multicanal avançada.

Esses pontos deverão ser considerados possíveis evoluções.

---

# 49. Princípios obrigatórios

## Histórico

Nenhuma alteração futura poderá destruir informações históricas relevantes.

## Competência como fotografia

Uma competência aprovada representa uma fotografia daquele período.

Mudanças posteriores no cadastro não podem modificar seu cálculo.

## Separação entre custo e faturamento

Valor pago ao funcionário e valor faturado ao cliente são conceitos diferentes e não devem utilizar o mesmo campo.

## Documentos contextualizados

Todo documento deverá possuir vínculo claro com funcionário, contrato, competência ou pagamento.

## Segurança

Funcionários só poderão visualizar informações permitidas sobre si próprios.

## Multi-tenancy

Todas as entidades relevantes deverão respeitar isolamento de tenant.

## APIs

As principais regras de negócio não deverão existir somente na camada visual.

## Auditoria

Ações relevantes deverão possuir rastreabilidade.

## Idempotência

Integrações externas não poderão criar registros duplicados devido à repetição da mesma solicitação.

---

# 50. Critério funcional de conclusão da primeira versão

A primeira versão será considerada funcionalmente completa quando for possível executar o seguinte cenário de ponta a ponta:

1. Gestor cadastra um cliente.
2. Um funcionário é criado manualmente ou recebido pelo Portal de Vagas.
3. O sistema apresenta eventuais documentos pendentes.
4. A gestão completa o cadastro.
5. O contrato é anexado.
6. O funcionário é associado a um cliente.
7. Um gestor responsável é definido.
8. As condições financeiras são cadastradas.
9. O funcionário acessa o portal.
10. O funcionário lança suas horas durante o mês.
11. O sistema informa o total acumulado.
12. O funcionário envia sua competência para aprovação.
13. O gestor analisa.
14. O gestor pode solicitar ajustes.
15. O funcionário corrige e reenvia.
16. O gestor aprova.
17. O sistema congela os valores utilizados na competência.
18. O sistema calcula o valor devido.
19. O sistema gera a Previsão de Pagamento.
20. O funcionário consulta a previsão.
21. O status muda para Aguardando envio de NF.
22. O funcionário envia sua Nota Fiscal.
23. O status muda para Aguardando pagamento.
24. A Gestão visualiza a pendência no dashboard.
25. A Gestão realiza o pagamento externamente.
26. A Gestão registra o pagamento.
27. A Gestão adiciona o comprovante.
28. O status muda para Pagamento realizado.
29. O funcionário consegue consultar o comprovante.
30. Todo o processo continua disponível no histórico.

Esse fluxo constitui o **núcleo funcional da primeira versão do Portal de Funcionários Synova**.

---

# 51. Orientação para execução pelo Codex

Este documento representa a **visão funcional macro do produto**.

Antes de desenvolver, o Codex deverá:

1. ler todas as Skills e instruções do projeto;
2. analisar a estrutura existente do repositório;
3. analisar o `page-synova` exclusivamente como referência visual;
4. propor a estrutura de dados necessária para suportar os requisitos;
5. identificar dependências entre os módulos;
6. organizar o desenvolvimento de forma incremental;
7. evitar implementar antecipadamente funcionalidades declaradas como fora de escopo;
8. preservar desde o início multi-tenancy, histórico, segurança, auditoria e extensibilidade.

Sempre que uma funcionalidade puder afetar dados históricos, pagamentos, permissões ou isolamento entre tenants, a implementação deverá priorizar consistência e rastreabilidade em vez de simplificações que dificultem evoluções futuras.
