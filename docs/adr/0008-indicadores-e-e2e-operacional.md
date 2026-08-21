# ADR 0008 — Indicadores mensais e E2E operacional

O dashboard usa a competência corrente calculada em `America/Sao_Paulo`. Os indicadores gerais de pessoas consideram o tenant; pendências e valores mensais consideram as alocações atribuídas ao gestor autenticado. Custos usam o valor congelado na aprovação e faturamento usa a condição comercial vigente aplicada aos minutos aprovados.

Cards de pessoas e estados de competência navegam para listagens filtradas quando existe uma lista correspondente. Valores financeiros permanecem como fotografias sintéticas do mês e não são recalculados a partir do cadastro atual do funcionário.

O smoke E2E executa requests HTTP reais contra uma aplicação em execução, cria um tenant descartável e percorre provisionamento, onboarding, contratos, alocação, horas, aprovação, previsão PDF, Nota Fiscal e pagamento. Ao final, valida dashboard e portal renderizados e remove dados e arquivos sintéticos mesmo quando o teste falha.
