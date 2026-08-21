import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function createPaymentForecastPdf(input: { employeeName: string; clientName: string; referenceMonth: string; approvedMinutes: number; hourlyRateCents: number; approvedAmountCents: number; approvedAt: Date }) {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 730, width: 595.28, height: 112, color: rgb(0.08, 0.08, 0.09) });
  page.drawText('SYNOVA', { x: 48, y: 792, size: 22, font: bold, color: rgb(1, 0.43, 0.15) });
  page.drawText('Previsao de Pagamento', { x: 48, y: 755, size: 28, font: bold, color: rgb(1, 1, 1) });
  const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  const lines = [
    ['Profissional', input.employeeName], ['Cliente', input.clientName], ['Competencia', input.referenceMonth.slice(0, 7)],
    ['Horas aprovadas', `${(input.approvedMinutes / 60).toFixed(2).replace('.', ',')} h`],
    ['Valor-hora', brl(input.hourlyRateCents)], ['Valor previsto', brl(input.approvedAmountCents)],
    ['Aprovado em', new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(input.approvedAt)],
  ];
  let y = 680; for (const [label, value] of lines) { page.drawText(label, { x: 48, y, size: 11, font: bold, color: rgb(0.42, 0.42, 0.45) }); page.drawText(value, { x: 190, y, size: 13, font: regular, color: rgb(0.08, 0.08, 0.09) }); y -= 48; }
  page.drawRectangle({ x: 48, y: 278, width: 499, height: 1, color: rgb(0.9, 0.9, 0.91) });
  page.drawText('Calculo: valor-hora vigente x horas aprovadas.', { x: 48, y: 245, size: 10, font: regular, color: rgb(0.42, 0.42, 0.45) });
  page.drawText('Documento gerado automaticamente. Os valores permanecem vinculados a fotografia da competencia.', { x: 48, y: 222, size: 9, font: regular, color: rgb(0.55, 0.55, 0.57), maxWidth: 490 });
  pdf.setTitle(`Previsao de Pagamento ${input.referenceMonth.slice(0, 7)} - ${input.employeeName}`); pdf.setProducer('Synova Pessoas');
  return pdf.save();
}
