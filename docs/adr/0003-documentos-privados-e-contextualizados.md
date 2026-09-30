# Documentos privados e contextualizados

Documentos são registros multi-tenant vinculados a um Funcionário, com tipo, origem, autor, nome original, MIME, tamanho e pathname. O banco armazena somente metadados; o conteúdo fica em uma store privada da Vercel Blob em produção. Downloads são intermediados por uma rota que resolve a identidade, o tenant e o registro antes de buscar o objeto.

Arquivos de até 25 MB usam upload direto e multipart no navegador. Há dois modelos de autorização: o Gestor autenticado emite o token de uploads gerenciais; no onboarding documental, o link individual do Funcionário é uma credencial bearer com hash persistido, escopo de Tenant, Funcionário e solicitação, validade de 15 dias e rotação em renovação ou primeira reprovação. Em ambos os modelos, a aplicação restringe prefixo do pathname, tipos permitidos e tamanho máximo. O callback assinado e a conclusão explícita convergem para criação idempotente do registro. A auditoria registra a origem e a solicitação documental, sem persistir token ou dados pessoais desnecessários. Em desenvolvimento sem Blob, um adaptador local grava em `.data/uploads`; esse caminho não é aceito como storage de produção.

Escolhemos uma abstração de storage para permitir futura política de retenção sem quebrar vínculos históricos. Arquivos não são sobrescritos e a chave de contexto inclui tenant e Funcionário.
