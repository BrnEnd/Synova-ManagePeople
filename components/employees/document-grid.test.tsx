// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentGrid } from '@/components/employees/document-grid';

describe('DocumentGrid', () => {
  it('identifica cada documento antes de oferecer preview privado ou download', () => {
    render(<DocumentGrid documents={[
      { id: 'pdf', type: 'contract', originalName: 'contrato.pdf', mimeType: 'application/pdf', size: 1024, createdAt: '2026-09-01T12:00:00.000Z' },
      { id: 'image', type: 'identification', originalName: 'rg.png', mimeType: 'image/png', size: 2048, createdAt: '2026-09-02T12:00:00.000Z' },
      { id: 'other', type: 'other', originalName: 'arquivo.bin', mimeType: 'application/octet-stream', size: 10, createdAt: '2026-09-03T12:00:00.000Z' },
    ]} />);
    expect(screen.getByRole('heading', { name: 'Contrato' })).toBeTruthy();
    expect(screen.getByTitle('Visualização de contrato.pdf').getAttribute('src')).toContain('/api/documents/pdf/download?preview=1');
    expect(screen.getByRole('img', { name: 'Visualização de rg.png' }).getAttribute('src')).toContain('/api/documents/image/download?preview=1');
    expect(screen.getByText('Pré-visualização indisponível.')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Baixar/ })).toHaveLength(3);
  });
});
