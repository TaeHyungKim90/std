import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ApplicantLoginPage from './ApplicantLoginPage';
import { recruitmentApi } from 'api/recruitmentApi';
import { syncApplicantSessionFromServer } from 'utils/applicantSession';

const mockNavigate = jest.fn();
const mockReturnState = { returnUrl: '/careers/apply/42', job: { id: 42 } };

jest.mock('react-router-dom', () => ({
	...jest.requireActual('react-router-dom'),
	useNavigate: () => mockNavigate,
	useLocation: () => ({ pathname: '/careers/login', state: mockReturnState }),
}));

jest.mock('api/recruitmentApi', () => ({
	recruitmentApi: {
		loginApplicant: jest.fn(),
	},
}));

jest.mock('utils/applicantSession', () => ({
	syncApplicantSessionFromServer: jest.fn(),
	clearCachedApplicantUser: jest.fn(),
}));

jest.mock('utils/toastUtils', () => ({
	toastPromise: (p) => p,
	toastError: jest.fn(),
}));

jest.mock('utils/formatApiError', () => ({
	formatApiDetail: () => '',
}));

describe('ApplicantLoginPage', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		recruitmentApi.loginApplicant.mockResolvedValue({ data: { name: '지원자' } });
		syncApplicantSessionFromServer.mockResolvedValue({
			isLoggedIn: true,
			name: '지원자',
			email_id: 'u@test.com',
		});
	});

	test('로그인 성공 후 location.state.returnUrl 로 리다이렉트한다', async () => {
		render(
			<MemoryRouter>
				<ApplicantLoginPage />
			</MemoryRouter>
		);

		await userEvent.type(screen.getByPlaceholderText('이메일 입력'), 'u@test.com');
		await userEvent.type(screen.getByPlaceholderText('비밀번호'), 'secret12');
		await userEvent.click(screen.getByRole('button', { name: '로그인' }));

		await waitFor(() => {
			expect(recruitmentApi.loginApplicant).toHaveBeenCalled();
			expect(syncApplicantSessionFromServer).toHaveBeenCalled();
			expect(mockNavigate).toHaveBeenCalledWith(mockReturnState.returnUrl, {
				replace: true,
				state: mockReturnState,
			});
		});
	});

	test('세션 동기화 실패 시 returnUrl 으로 가지 않는다', async () => {
		syncApplicantSessionFromServer.mockResolvedValue(null);
		render(
			<MemoryRouter>
				<ApplicantLoginPage />
			</MemoryRouter>
		);

		await userEvent.type(screen.getByPlaceholderText('이메일 입력'), 'u@test.com');
		await userEvent.type(screen.getByPlaceholderText('비밀번호'), 'secret12');
		await userEvent.click(screen.getByRole('button', { name: '로그인' }));

		await waitFor(() => {
			expect(syncApplicantSessionFromServer).toHaveBeenCalled();
		});
		expect(mockNavigate).not.toHaveBeenCalled();
	});
});
