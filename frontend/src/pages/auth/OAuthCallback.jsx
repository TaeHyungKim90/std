// frontend/src/pages/auth/OAuthCallback.jsx
import { authApi } from 'api/authApi';
import { useAuth } from 'context/AuthContext';
import { useAppPaths } from 'context/TenantContext';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as Notify from 'utils/toastUtils';

async function navigateAfterLogin(navigate, paths) {
	try {
		const meRes = await authApi.getMe();
		const role = meRes?.data?.role;
		const birth = meRes?.data?.birth_date;
		if (role !== 'admin' && (!birth || !String(birth).trim())) {
			try {
				sessionStorage.setItem('vp_birth_date_prompted', '1');
			} catch {
				/* ignore */
			}
			window.alert(
				'생년월일이 등록되어 있지 않습니다.\n확인을 누르면 내 정보 화면으로 이동합니다. 생년월일을 입력해 주세요.'
			);
			navigate(paths.MY_PROFILE, { replace: true });
			return;
		}
	} catch {
		/* fall through */
	}
	navigate(paths.MY_TODOS, { replace: true });
}

const OAuthCallback = () => {
	const paths = useAppPaths();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { checkAuth } = useAuth();
	const isProcessed = useRef(false);

	useEffect(() => {
		const verifySocialLogin = async () => {
			if (isProcessed.current) return;
			isProcessed.current = true;
			const socialStatus = searchParams.get('social_status');
			const provider = searchParams.get('provider') === 'naver' ? '네이버' : '카카오';

			if (socialStatus === 'complete_required') {
				Notify.toastInfo(`${provider} 인증이 완료되었습니다. 주소 등 추가 정보를 입력해 가입을 완료해 주세요.`);
				navigate(paths.SOCIAL_SIGNUP_COMPLETE, { replace: true });
				return;
			}
			if (socialStatus === 'pending_approval') {
				Notify.toastWarn(
					`${provider} 회원가입이 접수되었습니다. 관리자 승인 후 로그인해 주세요.`
				);
				navigate(paths.LOGIN, { replace: true });
				return;
			}
			if (socialStatus === 'already_registered') {
				Notify.toastWarn(`${provider}로 이미 가입된 계정입니다. 로그인 페이지에서 소셜 로그인을 이용해 주세요.`);
				navigate(paths.SIGNUP, { replace: true });
				return;
			}
			if (socialStatus === 'not_registered') {
				Notify.toastWarn(`${provider}로 가입된 계정이 없습니다. 회원가입 페이지에서 소셜 회원가입을 진행해 주세요.`);
				navigate(paths.LOGIN, { replace: true });
				return;
			}
			if (socialStatus === 'link_conflict') {
				Notify.toastWarn(`${provider} 계정이 이미 다른 사용자와 연동되어 있습니다.`);
				navigate(paths.MY_PROFILE, { replace: true });
				return;
			}
			if (socialStatus === 'link_failed') {
				Notify.toastError(`${provider} 계정 연동에 실패했습니다. 다시 시도해 주세요.`);
				navigate(paths.MY_PROFILE, { replace: true });
				return;
			}
			if (socialStatus === 'linked') {
				Notify.toastPromise(
					(async () => {
						const ok = await checkAuth();
						if (!ok) throw new Error('연동 후 인증 실패');
						return true;
					})(),
					{
						loading: '연동 결과를 확인하는 중입니다...',
						success: `${provider} 계정이 연동되었습니다.`,
						error: '연동 확인에 실패했습니다.',
					}
				).then(() => {
					navigate(paths.MY_PROFILE, { replace: true });
				});
				return;
			}

			const authTask = async () => {
				const isAuthenticated = await checkAuth();
				if (!isAuthenticated) {
					throw new Error("소셜 로그인 인증 실패");
				}
				return true;
			};

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
						navigate(paths.LOGIN, { replace: true });
						return '로그인에 실패했습니다. 다시 시도해 주세요. 🚫';
					}
				}
			).then(() => navigateAfterLogin(navigate, paths)).catch((error) => {
				console.error('소셜 로그인 처리 중 에러:', error);
			});
		};

		verifySocialLogin();
	}, [checkAuth, navigate, paths, searchParams]);

	return (
		<div className="oauth-callback-page">
			<h2>소셜 로그인 처리 중입니다... 🚀</h2>
		</div>
	);
};

export default OAuthCallback;
