import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IdCopyChip from './IdCopyChip';
import * as Notify from 'utils/toastUtils';

jest.mock('utils/toastUtils', () => ({
	toastSuccess: jest.fn(),
	toastError: jest.fn(),
	toastWarn: jest.fn(),
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

	test('isolateRowClick이면 복사 버튼의 keydown이 부모로 전파되지 않는다', () => {
		const onKeyDown = jest.fn();
		const longId = 'employee_login_id_very_long_value_12345';
		render(
			<div onKeyDown={onKeyDown}>
				<IdCopyChip value={longId} minAbbreviateLen={10} isolateRowClick />
			</div>,
		);
		fireEvent.keyDown(screen.getByRole('button', { name: new RegExp(`${longId} 복사`) }), { key: ' ', code: 'Space' });
		expect(onKeyDown).not.toHaveBeenCalled();
	});

	test('isolateRowClick이 아니면 복사 버튼 keydown이 부모까지 전파된다', () => {
		const onKeyDown = jest.fn();
		const longId = 'employee_login_id_very_long_value_12345';
		render(
			<div onKeyDown={onKeyDown}>
				<IdCopyChip value={longId} minAbbreviateLen={10} />
			</div>,
		);
		fireEvent.keyDown(screen.getByRole('button', { name: new RegExp(`${longId} 복사`) }), { key: 'Enter', code: 'Enter' });
		expect(onKeyDown).toHaveBeenCalled();
	});

	test('Clipboard API 실패 시 execCommand 폴백이 성공하면 성공 토스트를 띄운다', async () => {
		const longId = 'employee_login_id_very_long_value_12345';
		navigator.clipboard.writeText.mockRejectedValueOnce(new Error('NotAllowedError'));
		const prevExec = document.execCommand;
		const execCmd = jest.fn(() => true);
		document.execCommand = execCmd;
		try {
			render(<IdCopyChip value={longId} minAbbreviateLen={10} />);
			await userEvent.click(screen.getByRole('button', { name: new RegExp(`${longId} 복사`) }));

			await waitFor(() => {
				expect(Notify.toastSuccess).toHaveBeenCalledWith('클립보드에 복사했습니다.');
				expect(Notify.toastWarn).not.toHaveBeenCalled();
			});
			expect(execCmd).toHaveBeenCalledWith('copy');
		} finally {
			document.execCommand = prevExec;
		}
	});

	test('Clipboard·폴백 모두 실패하면 안내 토스트를 띄운다', async () => {
		const longId = 'employee_login_id_very_long_value_12345';
		navigator.clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
		const prevExec = document.execCommand;
		document.execCommand = jest.fn(() => false);
		try {
			render(<IdCopyChip value={longId} minAbbreviateLen={10} />);
			await userEvent.click(screen.getByRole('button', { name: new RegExp(`${longId} 복사`) }));

			await waitFor(() => {
				expect(Notify.toastWarn).toHaveBeenCalledWith(
					expect.stringContaining('HTTPS'),
					expect.objectContaining({ duration: 7000 }),
				);
				expect(Notify.toastSuccess).not.toHaveBeenCalled();
			});
		} finally {
			document.execCommand = prevExec;
		}
	});
});
