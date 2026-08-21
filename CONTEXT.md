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
