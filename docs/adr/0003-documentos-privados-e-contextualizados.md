# Documentos privados e contextualizados

Documentos são registros multi-tenant vinculados a um Funcionário, com tipo, origem, autor, nome original, MIME, tamanho e pathname. O banco armazena somente metadados; o conteúdo fica em uma store privada da Vercel Blob em produção. Downloads são intermediados por uma rota que resolve a identidade, o tenant e o registro antes de buscar o objeto.

Arquivos de até 25 MB usam upload direto e multipart no navegador. A aplicação só emite o token após validar gestor, Funcionário, prefixo do pathname, tipos permitidos e tamanho máximo. O callback assinado e uma conclusão autenticada convergem para criação idempotente do registro. Em desenvolvimento sem Blob, um adaptador local grava em `.data/uploads`; esse caminho não é aceito como storage de produção.

Escolhemos uma abstração de storage para permitir futura política de retenção sem quebrar vínculos históricos. Arquivos não são sobrescritos e a chave de contexto inclui tenant e Funcionário.
