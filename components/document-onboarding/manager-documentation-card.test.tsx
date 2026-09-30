// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ManagerDocumentationCard } from '@/components/document-onboarding/manager-documentation-card';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

describe('ManagerDocumentationCard', () => {
  test('permite solicitar documentação apenas para novo pré-cadastro sem acesso', () => {
    render(<ManagerDocumentationCard
      employeeId="employee-a" personalEmail="bruna@example.com" employmentType="pj"
      status="pre_registration" userId={null} detail={null}
    />);

    expect(screen.getByRole('button', { name: 'Solicitar documentação' })).not.toBeNull();
  });

  test('mantém funcionários existentes exclusivamente no fluxo legado', () => {
    render(<ManagerDocumentationCard
      employeeId="employee-a" personalEmail="bruna@example.com" employmentType="pj"
      status="active" userId="portal-user" detail={null}
    />);

    expect(screen.queryByRole('button', { name: 'Solicitar documentação' })).toBeNull();
    expect(screen.getByText(/restrita a novos pré-cadastros/i)).not.toBeNull();
  });
});
