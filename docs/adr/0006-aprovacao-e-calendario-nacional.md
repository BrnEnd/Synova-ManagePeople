# ADR 0006 — Aprovação e calendário nacional

## Status

Aceita em 21 de agosto de 2026.

## Decisão

O ciclo mensal usa transições explícitas e eventos imutáveis. O funcionário pode enviar competências em preenchimento ou devolvidas; somente o gestor responsável pode aprovar ou solicitar ajustes. Toda devolução exige motivo.

Na aprovação, a competência congela minutos aprovados, valor-hora financeiro vigente no fim do mês e valor devido em centavos. O cálculo é `round(valor-hora × minutos / 60)`.

Lembretes de fechamento usam `date-holidays` configurado para feriados públicos nacionais do Brasil. Um cron diário às 12:00 UTC — 09:00 em `America/Sao_Paulo` na configuração brasileira atual — executa apenas quando a data local é o último dia útil nacional. Chaves de deduplicação impedem notificações repetidas.

## Consequências

- transições inválidas são rejeitadas pelo estado e pelo responsável;
- reajustes preservam revisão, motivo, autor e horário;
- alterações financeiras futuras não modificam competências aprovadas;
- feriados estaduais e municipais não reduzem o calendário nacional;
- o job pode ser chamado novamente com segurança no mesmo mês.
