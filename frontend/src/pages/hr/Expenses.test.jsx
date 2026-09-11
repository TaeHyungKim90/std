import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expenseApi } from 'api/expenseApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import Expenses from './Expenses';

vi.mock('api/expenseApi', () => ({ expenseApi: { get: vi.fn(), list: vi.fn(), create: vi.fn(), save: vi.fn(), action: vi.fn(), receipt: vi.fn(), download: vi.fn() } }));
const row = { id: 1, version: 1, user_id: 'employee', status: 'DRAFT', report_no: 'EXP-1', history: [], merchant_name: '상점', total_amount: '11000.00' };
const mount = (path = '/a/my/expenses/1') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/:tenantSlug/my/expenses" element={<Expenses />} /><Route path="/:tenantSlug/my/expenses/:expenseId" element={<Expenses />} /><Route path="/:tenantSlug/admin/expenses/:expenseId" element={<Expenses />} /></Routes></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  expenseApi.get.mockResolvedValue(row);
  expenseApi.list.mockResolvedValue({ items: [], total: 0 });
});

test('creates a persisted draft before offering receipt upload', async () => {
  expenseApi.create.mockResolvedValue(row);
  mount('/a/my/expenses');
  await userEvent.click(await screen.findByText('새 지출결의서'));
  expect(expenseApi.create).toHaveBeenCalledTimes(1);
  expect(await screen.findByLabelText(/영수증 이미지/)).toBeInTheDocument();
});

test('requires review and saves edits before submitting latest version', async () => {
  expenseApi.save.mockResolvedValue({ ...row, version: 2 });
  expenseApi.action.mockResolvedValue({ ...row, version: 3, status: 'REQUESTED' });
  mount();
  const button = await screen.findByRole('button', { name: '결재 요청' });
  expect(button).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(button);
  await waitFor(() => expect(expenseApi.action).toHaveBeenCalledWith(false, 1, 'submit', { version: 2, comment: null, reviewed: true }));
  expect(await screen.findByRole('button', { name: '상신 회수' })).toBeInTheDocument();
});

test('failed OCR keeps manual editing available', async () => {
  expenseApi.get.mockResolvedValue({ ...row, ocr: { status: 'FAILED' } });
  mount();
  expect(await screen.findByText(/OCR 분석에 실패/)).toBeInTheDocument();
  expect(screen.getByLabelText('거래처')).not.toHaveAttribute('readonly');
  expect(screen.getByRole('button', { name: '임시저장' })).toBeEnabled();
});

test('admin review is read only and requires a rejection comment', async () => {
  expenseApi.get.mockResolvedValue({ ...row, status: 'REQUESTED' });
  expenseApi.action.mockResolvedValue({ ...row, status: 'REJECTED', version: 2 });
  mount('/a/admin/expenses/1');
  const button = await screen.findByRole('button', { name: '반려' });
  expect(button).toBeDisabled();
  expect(screen.getByLabelText('거래처')).toHaveAttribute('readonly');
  await userEvent.type(screen.getByLabelText('의견 (반려 시 필수)'), '목적 확인 필요');
  await userEvent.click(button);
  expect(expenseApi.action).toHaveBeenCalledWith(true, 1, 'reject', { version: 1, comment: '목적 확인 필요', reviewed: false });
});
