// frontend/src/pages/auth/OAuthCallback.jsx
import { PATHS } from 'constants/paths';
import { useAuth } from 'context/AuthContext';
import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as Notify from 'utils/toastUtils';

const OAuthCallback = () => {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { checkAuth } = useAuth();
	const isProcessed = useRef(false);

	useEffect(() => {
		const verifySocialLogin = async () => {
			// 이미 한 번 실행되었다면 바로 종료!
			if (isProcessed.current) return;
			isProcessed.current = true;
			const socialStatus = searchParams.get('social_status');
			const provider = searchParams.get('provider') === 'naver' ? '네이버' : '카카오';

			if (socialStatus === 'already_registered') {
				Notify.toastWarn(`${provider}로 이미 가입된 계정입니다. 로그인 페이지에서 소셜 로그인을 이용해 주세요.`);
				navigate(PATHS.SIGNUP, { replace: true });
				return;
			}
			if (socialStatus === 'not_registered') {
				Notify.toastWarn(`${provider}로 가입된 계정이 없습니다. 회원가입 페이지에서 소셜 회원가입을 진행해 주세요.`);
				navigate(PATHS.LOGIN, { replace: true });
				return;
			}

			// 🌟 1. 인증 확인 로직을 하나의 태스크로 묶습니다.
			const authTask = async () => {
				const isAuthenticated = await checkAuth();
				if (!isAuthenticated) {
					throw new Error("소셜 로그인 인증 실패");
				}
				return true;
			};

			// 🌟 2. 지저분한 try-catch를 지우고 toastPromise로 덮어씌웁니다!
			Notify.toastPromise(
				authTask(),
				{
					loading: '인증 정보를 확인하고 있습니다... 🔐',
					success: () => {
						if (socialStatus === 'signed_up') {
							return `${provider} 회원가입이 완료되어 로그인되었습니다. 🎉`;
						}
						return `${provider} 로그인되었습니다. 🎉`;
					},
					error: () => {
						navigate(PATHS.LOGIN, { replace: true });
						return '로그인에 실패했습니다. 다시 시도해 주세요. 🚫';
					}
				}
			).then(() => {
				// 성공 시 깔끔하게 메인으로 이동
				navigate(PATHS.HOME, { replace: true });
			}).catch((error) => {
				console.error('소셜 로그인 처리 중 에러:', error);
			});
		};

		verifySocialLogin();
	}, [checkAuth, navigate, searchParams]);

	return (
		<div className="oauth-callback-page">
			<h2>소셜 로그인 처리 중입니다... 🚀</h2>
		</div>
	);
};

export default OAuthCallback;