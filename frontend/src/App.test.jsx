import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('./routes', () => {
	const React = require('react');
	return {
		__esModule: true,
		default: function StubAppRoutes() {
			return <div data-testid="stub-routes" />;
		},
	};
});

jest.mock('api/authApi', () => ({
	authApi: {
		checkAuth: () => Promise.resolve({ data: { isLoggedIn: false } }),
		logout: () => Promise.resolve({ data: { success: true } }),
	},
}));

describe('App', () => {
	test('AuthProvider·Router 셸과 라우트 슬롯이 마운트된다', async () => {
		render(<App />);
		await waitFor(() => {
			expect(screen.getByTestId('stub-routes')).toBeInTheDocument();
		});
	});
});
