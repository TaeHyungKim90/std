import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { recruitmentApi } from 'api/recruitmentApi';
import { MemoryRouter } from 'react-router-dom';
import { syncApplicantSessionFromServer } from 'utils/applicantSession';

import ApplicantLoginPage from './ApplicantLoginPage';

const mockNavigate = vi.fn();
const mockReturnState = { returnUrl: '/careers/apply/42', job: { id: 42 } };

vi.mock('react-router-dom', async () => ({
	...(await vi.importActual('react-router-dom')),
	useNavigate: () => mockNavigate,
	useLocation: () => ({ pathname: '/careers/login', state: mockReturnState }),
}));

vi.mock('api/recruitmentApi', () => ({
	recruitmentApi: {
		loginApplicant: vi.fn(),
	},
}));

vi.mock('utils/applicantSession', () => ({
	syncApplicantSessionFromServer: vi.fn(),
	clearCachedApplicantUser: vi.fn(),
}));

vi.mock('utils/toastUtils', () => ({
	toastPromise: (p) => p,
	toastError: vi.fn(),
}));

vi.mock('utils/formatApiError', () => ({
	formatApiDetail: () => '',
}));

describe('ApplicantLoginPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
		});
		await waitFor(() => {
			expect(syncApplicantSessionFromServer).toHaveBeenCalled();
		});
		await waitFor(() => {
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
