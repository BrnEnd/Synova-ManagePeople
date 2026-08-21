# Portal de Funcionários Synova

O contexto reúne os conceitos usados para operar o relacionamento entre a Synova e seus profissionais, do cadastro ao encerramento de cada competência mensal.

## Identidade e organização

**Tenant**:
Organização cujos usuários e registros operacionais são isolados dos demais tenants.
_Evitar_: Empresa, conta

**Usuário**:
Identidade que autentica no portal e recebe um papel de acesso dentro de um tenant. Não representa, por si só, um profissional contratado.
_Evitar_: Funcionário, login

**Funcionário**:
Profissional cujo cadastro reúne informações contratuais, financeiras, alocações e histórico. Pode possuir um Usuário associado.
_Evitar_: Usuário, colaborador

**Gestor**:
Papel de Usuário autorizado a administrar todos os registros pertencentes ao próprio tenant.
_Evitar_: Administrador global

## Cadastro e integração

**Pré-cadastro**:
Estado inicial de um Funcionário ainda com informações, documentos ou vínculos operacionais pendentes.
_Evitar_: Funcionário ativo

**Contratação externa**:
Registro idempotente que relaciona o identificador de contratação de um sistema de origem ao Pré-cadastro criado no tenant.
_Evitar_: Usuário, candidatura

**Chave de serviço**:
Credencial não humana, específica por tenant, usada para autenticar uma integração externa. Somente seu HMAC é persistido.
_Evitar_: Senha de usuário, segredo de provisionamento

**Pendência de onboarding**:
Campo obrigatório ou arquivo ainda necessário para permitir a ativação de um Funcionário. É recalculada quando o perfil ou os documentos mudam.
_Evitar_: Erro de cadastro, status da competência

**Documento**:
Arquivo privado e contextualizado por tenant, Funcionário, tipo, origem e responsável pelo envio. O registro de metadados não concede acesso direto ao objeto armazenado.
_Evitar_: Anexo público, URL solta

**Anotação gerencial**:
Registro textual imutável no histórico de um Funcionário, com autor e horário. Complementa eventos automáticos sem substituí-los.
_Evitar_: Campo de observação sobrescrito

**Cliente**:
Organização atendida pela Synova e referenciada por Alocações. Possui identidade, contatos e situação próprios; não é texto livre no Funcionário.
_Evitar_: Projeto, alocação, tenant

**Contrato**:
Vínculo documental e temporal do Funcionário, encerrado sem exclusão do histórico.
_Evitar_: Condição financeira, documento avulso

**Alocação**:
Relação temporal entre Funcionário, Cliente e Gestor responsável.
_Evitar_: Cliente, contrato

**Condição financeira**:
Valor-hora de custo do Funcionário, versionado por vigência.
_Evitar_: Condição comercial, salário sobrescrito

**Condição comercial**:
Valor-hora cobrado na Alocação, versionado separadamente do custo.
_Evitar_: Condição financeira, pagamento do funcionário

**Competência**:
Unidade mensal independente que consolida os apontamentos de um Funcionário em uma Alocação e possui ciclo de vida próprio.
_Evitar_: Mês sem estado, folha de pagamento

**Apontamento de horas**:
Linha diária da Competência, armazenada em minutos e acompanhada de observação opcional.
_Evitar_: Total manual, condição financeira

**Evento de competência**:
Registro imutável de uma transição mensal, com estado anterior, novo estado, autor, horário e motivo quando aplicável.
_Evitar_: Status sobrescrito sem histórico

**Notificação**:
Pendência interna direcionada a um Usuário e protegida contra duplicação pelo evento que a originou.
_Evitar_: E-mail, evento de auditoria

**Previsão de pagamento**:
PDF imutável gerado a partir dos minutos, valor-hora e total congelados quando a Competência é aprovada.
_Evitar_: Simulação recalculada, valor editável

**Nota Fiscal**:
Documento enviado pelo Funcionário para uma Competência aprovada, necessário para liberar o registro do pagamento.
_Evitar_: Previsão de pagamento, comprovante

**Pagamento**:
Confirmação gerencial do pagamento externo, com data, observação opcional, valor congelado e comprovante obrigatório.
_Evitar_: Transferência bancária automática, valor manual
