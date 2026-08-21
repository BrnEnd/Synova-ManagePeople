# Autenticação da integração por tenant

A rota externa de contratações recebe uma chave de serviço específica por tenant. O valor bruto é entregue somente pelo canal operacional; o banco persiste um HMAC derivado com o segredo idempotente estável. A resolução da credencial usa a conexão restrita `synova_provisioner`, pois o tenant ainda não é conhecido nesse ponto.

Depois da autenticação, criação, replay e auditoria do pré-cadastro ocorrem em uma transação comum com `app.tenant_id`. `externalHiringId` e `Idempotency-Key` são únicos dentro do tenant, e conteúdos divergentes retornam conflito. Assim, a credencial não amplia o bypass de RLS para o restante do fluxo.
