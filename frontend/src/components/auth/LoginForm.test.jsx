import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authApi } from 'api/authApi';
import { PATHS } from 'constants/paths';
import { useAuth } from 'context/AuthContext';
import { useLoading } from 'context/LoadingContext';

import LoginForm from './LoginForm';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => ({
	...(await vi.importActual('react-router-dom')),
	useNavigate: () => mockNavigate,
}));

vi.mock('context/AuthContext', () => ({
	useAuth: vi.fn(),
}));

vi.mock('context/LoadingContext', () => ({
	useLoading: vi.fn(),
}));

vi.mock('api/authApi', () => ({
	authApi: {
		login: vi.fn(),
		getMe: vi.fn(),
	},
}));

vi.mock('utils/toastUtils', () => ({
	toastPromise: (p) => p,
	toastApiFailure: vi.fn(),
	toastLoading: vi.fn(() => 'loading-id'),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	toastWarn: vi.fn(),
	toastInfo: vi.fn(),
}));

vi.mock('utils/formatApiError', () => ({
	formatApiDetail: () => '',
}));

vi.mock('react-hot-toast', () => ({
	__esModule: true,
	default: {
		dismiss: vi.fn(),
	},
}));

describe('LoginForm', () => {
	let checkAuthSpy;

	beforeEach(() => {
		vi.clearAllMocks();
		checkAuthSpy = vi.fn().mockResolvedValue(true);
		useAuth.mockReturnValue({
			isLoggedIn: false,
			loading: false,
			checkAuth: checkAuthSpy,
		});
		useLoading.mockReturnValue({
			showLoading: vi.fn(),
			hideLoading: vi.fn(),
		});
		authApi.login.mockResolvedValue({ data: { success: true } });
		authApi.getMe.mockResolvedValue({ data: { birth_date: '1990-01-01' } });
	});

	test('로그인 성공 시 checkAuth 호출 후 /my/todos로 이동한다', async () => {
		render(<LoginForm />);

		await userEvent.type(screen.getByPlaceholderText('아이디 (ID)'), 'user1');
		await userEvent.type(screen.getByPlaceholderText('비밀번호 (Password)'), 'secret12');
		await userEvent.click(screen.getByRole('button', { name: '로그인' }));

		await waitFor(() => expect(authApi.login).toHaveBeenCalled());
		await waitFor(() => expect(checkAuthSpy).toHaveBeenCalled());
		await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(PATHS.MY_TODOS));
	});

	test('생년월일 미등록 시 내 정보로 이동한다', async () => {
		authApi.getMe.mockResolvedValue({ data: { birth_date: null, role: 'user' } });
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

		render(<LoginForm />);

		await userEvent.type(screen.getByPlaceholderText('아이디 (ID)'), 'user1');
		await userEvent.type(screen.getByPlaceholderText('비밀번호 (Password)'), 'secret12');
		await userEvent.click(screen.getByRole('button', { name: '로그인' }));

		await waitFor(() => expect(alertSpy).toHaveBeenCalled());
		await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(PATHS.MY_PROFILE));
		alertSpy.mockRestore();
	});

	test('관리자는 생년월일 미등록이어도 할 일로 이동한다', async () => {
		authApi.getMe.mockResolvedValue({ data: { birth_date: null, role: 'admin' } });
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

		render(<LoginForm />);

		await userEvent.type(screen.getByPlaceholderText('아이디 (ID)'), 'admin1');
		await userEvent.type(screen.getByPlaceholderText('비밀번호 (Password)'), 'secret12');
		await userEvent.click(screen.getByRole('button', { name: '로그인' }));

		await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(PATHS.MY_TODOS));
		expect(alertSpy).not.toHaveBeenCalled();
		alertSpy.mockRestore();
	});
});

