# ADR 0007 — Previsão e pagamento congelados por competência

A aprovação congela minutos, valor-hora e valor devido na competência. A previsão de pagamento é gerada em PDF a partir dessa fotografia, armazenada como documento privado e vinculada uma única vez à revisão aprovada.

A Nota Fiscal só pode ser enviada pelo funcionário associado enquanto a competência estiver em `awaiting_invoice`. O registro move a competência para `awaiting_payment`. O comprovante só pode ser usado pela gestão no mesmo tenant e no tipo documental correto.

O pagamento é sempre o valor congelado calculado por `valor-hora × minutos / 60`; a API não aceita um valor informado manualmente. A gestão informa a data, pode adicionar observações e deve anexar o comprovante. A operação persiste pagamento, evento, notificação e transição para `paid` na mesma transação.

Essa decisão impede divergência entre aprovação, previsão e pagamento, preserva documentos históricos e mantém autorização contextual e RLS em todo o fluxo.
