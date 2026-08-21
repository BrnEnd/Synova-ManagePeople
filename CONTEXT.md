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
