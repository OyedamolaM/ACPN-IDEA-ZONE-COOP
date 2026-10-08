import { jsPDF } from 'jspdf';
import { money, type Transaction } from './finance';

export function exportStatement(transactions: Transaction[], format: 'csv' | 'pdf') {
  if (format === 'csv') {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [['Date', 'Description', 'Category', 'Amount (NGN)'], ...transactions.map(t => [t.date, t.description, t.category, (t.amount / 100).toFixed(2)])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'acpn-idea-coop-statement.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const pdf = new jsPDF();
  pdf.setFontSize(19); pdf.text('ACPN IDEA COOP | Member statement', 16, 23);
  pdf.setFontSize(10); pdf.text('Oyedamola Moreira | Currency: NGN | Simulation statement', 16, 34);
  let y = 49;
  for (const t of transactions) {
    if (y > 265) { pdf.addPage(); y = 25; }
    pdf.text(`${t.date}  |  ${t.category}  |  ${t.description}`, 16, y);
    pdf.text(money(t.amount).replace('₦', 'NGN '), 16, y + 6); y += 19;
  }
  pdf.save('acpn-idea-coop-statement.pdf');
}