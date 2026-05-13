import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { attendanceApi } from 'api/attendanceApi';
import { holidayApi } from 'api/holidayApi';
import { reportApi } from 'api/reportApi';
import { useAuth } from 'context/AuthContext';
import React from 'react';

import MyReports from './MyReports';

jest.mock('context/AuthContext', () => ({
	useAuth: jest.fn(),
}));

jest.mock('api/attendanceApi', () => ({
	attendanceApi: {
		getAttendanceDaySessions: jest.fn(),
		getClockContext: jest.fn(),
	},
}));

jest.mock('api/holidayApi', () => ({
	holidayApi: {
		getHolidays: jest.fn(),
	},
}));

jest.mock('api/reportApi', () => ({
	reportApi: {
		getDailyRange: jest.fn(),
		getWeekly: jest.fn(),
		putDaily: jest.fn(),
		putWeekly: jest.fn(),
	},
}));

jest.mock('utils/toastUtils', () => ({
	toastLoading: jest.fn(() => 'loading-id'),
	toastSuccess: jest.fn(),
	toastApiFailure: jest.fn(),
	toastError: jest.fn(),
	toastWarn: jest.fn(),
	toastInfo: jest.fn(),
	toastPromise: (p) => p,
}));

jest.mock('react-hot-toast', () => ({
	__esModule: true,
	default: {
		dismiss: jest.fn(),
	},
}));

describe('MyReports', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		useAuth.mockReturnValue({
			loading: false,
			joinDate: '2000-01-01',
			refreshAuth: jest.fn().mockResolvedValue(true),
		});

		holidayApi.getHolidays.mockResolvedValue({ data: [] });
		attendanceApi.getClockContext.mockResolvedValue({ data: null });

		reportApi.getDailyRange.mockResolvedValue({ data: [] });
		reportApi.getWeekly.mockResolvedValue({ data: { summary: '' } });
		reportApi.putDaily.mockResolvedValue({ data: {} });
		reportApi.putWeekly.mockResolvedValue({ data: {} });

		attendanceApi.getAttendanceDaySessions.mockResolvedValue({
			data: {
				items: [
					{
						id: 1,
						clock_in_time: '2026-04-01T09:00:00',
						clock_out_time: '2026-04-01T18:00:00',
						status: 'NORMAL',
						night_work_minutes: 0,
						shift_status: 'CLOSED',
					},
				],
				summary: { total_work_minutes: 480, overtime_minutes: 0, total_night_minutes: 0 },
			},
		});
	});

	test('일일 보고 저장 시 textarea 입력 후 putDaily가 호출되고 Drawer가 닫힌다', async () => {
		render(<MyReports />);

		await waitFor(() => {
			expect(screen.getAllByRole('button', { name: /\d{4}-\d{2}-\d{2}/ }).length).toBeGreaterThan(0);
		});

		const dayButtons = screen.getAllByRole('button', { name: /\d{4}-\d{2}-\d{2}/ });
		await userEvent.click(dayButtons[0]);

		const textarea = await screen.findByLabelText('업무 내역');
		await userEvent.clear(textarea);
		await userEvent.type(textarea, '테스트 업무 내용');

		await userEvent.click(screen.getByRole('button', { name: '저장' }));

		await waitFor(() => expect(reportApi.putDaily).toHaveBeenCalled());

		const payload = reportApi.putDaily.mock.calls[0][0];
		expect(payload.content).toBe('테스트 업무 내용');
		expect(payload.report_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

		await waitFor(() => expect(screen.queryByLabelText('업무 내역')).not.toBeInTheDocument());
	});

	test('일일 보고 입력 중 오버레이 클릭 시 확인 모달이 뜨고 취소하면 내용이 유지된다', async () => {
		render(<MyReports />);

		await waitFor(() => {
			expect(screen.getAllByRole('button', { name: /\d{4}-\d{2}-\d{2}/ }).length).toBeGreaterThan(0);
		});

		const dayButtons = screen.getAllByRole('button', { name: /\d{4}-\d{2}-\d{2}/ });
		await userEvent.click(dayButtons[0]);

		const textarea = await screen.findByLabelText('업무 내역');
		await userEvent.clear(textarea);
		await userEvent.type(textarea, '작성 중인 초안');

		const overlay = document.querySelector('.rep-drawer-overlay');
		expect(overlay).toBeTruthy();
		await userEvent.click(overlay);

		expect(await screen.findByText('저장되지 않은 내용')).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: '취소' }));

		await waitFor(() => {
			expect(screen.queryByText('저장되지 않은 내용')).not.toBeInTheDocument();
		});
		expect(screen.getByLabelText('업무 내역')).toHaveValue('작성 중인 초안');
	});
});

