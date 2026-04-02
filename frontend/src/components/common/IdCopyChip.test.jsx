import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IdCopyChip from './IdCopyChip';
import * as Notify from 'utils/toastUtils';

jest.mock('utils/toastUtils', () => ({
	toastSuccess: jest.fn(),
	toastError: jest.fn(),
}));

describe('IdCopyChip', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: jest.fn(() => Promise.resolve()) },
			configurable: true,
			writable: true,
		});
	});

	test('긴 ID는 복사 버튼 클릭 시 클립보드에 전체 값이 들어가고 성공 토스트를 띄운다', async () => {
		const longId = 'employee_login_id_very_long_value_12345';
		render(<IdCopyChip value={longId} minAbbreviateLen={10} />);

		await userEvent.click(screen.getByRole('button', { name: new RegExp(`${longId} 복사`) }));

		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(longId);
			expect(Notify.toastSuccess).toHaveBeenCalledWith('클립보드에 복사했습니다.');
		});
	});

	test('짧은 값(8자 미만)은 복사 버튼이 없다', () => {
		render(<IdCopyChip value="short" minAbbreviateLen={99} />);
		expect(screen.queryByRole('button', { name: /복사/ })).not.toBeInTheDocument();
		expect(screen.getByText('short')).toBeInTheDocument();
	});

	test('빈 값은 emptyLabel을 표시한다', () => {
		render(<IdCopyChip value="" emptyLabel="없음" />);
		expect(screen.getByText('없음')).toBeInTheDocument();
	});
});
