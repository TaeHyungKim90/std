import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authApi } from 'api/authApi';
import { PATHS } from 'constants/paths';
import { useAuth } from 'context/AuthContext';
import { useLoading } from 'context/LoadingContext';
import React from 'react';

import LoginForm from './LoginForm';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
	...jest.requireActual('react-router-dom'),
	useNavigate: () => mockNavigate,
}));

jest.mock('context/AuthContext', () => ({
	useAuth: jest.fn(),
}));

jest.mock('context/LoadingContext', () => ({
	useLoading: jest.fn(),
}));

jest.mock('api/authApi', () => ({
	authApi: {
		login: jest.fn(),
	},
}));

jest.mock('utils/toastUtils', () => ({
	toastPromise: (p) => p,
	toastApiFailure: jest.fn(),
	toastLoading: jest.fn(() => 'loading-id'),
	toastSuccess: jest.fn(),
	toastError: jest.fn(),
	toastWarn: jest.fn(),
	toastInfo: jest.fn(),
}));

jest.mock('utils/formatApiError', () => ({
	formatApiDetail: () => '',
}));

jest.mock('react-hot-toast', () => ({
	__esModule: true,
	default: {
		dismiss: jest.fn(),
	},
}));

describe('LoginForm', () => {
	let checkAuthSpy;

	beforeEach(() => {
		jest.clearAllMocks();
		checkAuthSpy = jest.fn().mockResolvedValue(true);
		useAuth.mockReturnValue({
			isLoggedIn: false,
			loading: false,
			checkAuth: checkAuthSpy,
		});
		useLoading.mockReturnValue({
			showLoading: jest.fn(),
			hideLoading: jest.fn(),
		});
		authApi.login.mockResolvedValue({ data: { success: true } });
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
});

