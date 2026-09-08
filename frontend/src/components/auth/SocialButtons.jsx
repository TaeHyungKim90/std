import { authApi } from 'api/authApi';
import React from 'react';
import * as Notify from 'utils/toastUtils';

const SocialButtons = ({ mode = 'login' }) => {
	const isSignup = mode === 'signup';

	/**
	 * 소셜 로그인 공통 핸들러
	 * @param {string} provider - 'kakao' 또는 'naver'
	 */
	const handleSocialLogin = async (provider) => {
		const socialLoginTask = async () => {
			if (provider === 'kakao') {
				return authApi.getKakaoLoginUrl(mode);
			}
			if (provider === 'naver') {
				return authApi.getNaverLoginUrl(mode);
			}
			throw new Error(`지원하지 않는 소셜 ${isSignup ? '회원가입' : '로그인'} 제공자입니다.`);
		};

		Notify.toastPromise(socialLoginTask(), {
			loading: `${provider === 'kakao' ? '카카오' : '네이버'} ${isSignup ? '회원가입' : '로그인'} 준비 중입니다...`,
			success: '인증 페이지로 이동합니다.',
			error: `${provider === 'kakao' ? '카카오' : '네이버'} ${isSignup ? '회원가입' : '로그인'}을 시작할 수 없습니다.`
		}).then((response) => {
			if (response?.data?.url) {
				window.location.href = response.data.url;
			}
		}).catch((err) => {
			console.error(`${provider} ${isSignup ? '회원가입' : '로그인'} 시도 실패:`, err);
		});
	};

	return (
		<div className="social-login-container">
			<div className="social-divider">{isSignup ? '소셜 회원가입' : '소셜 로그인'}</div>
			<p className="social-login-help">
				{isSignup
					? '소셜 인증 후 이름·생년월일·전화·주소를 확인하고 가입을 완료합니다. 관리자 승인 후 로그인할 수 있습니다.'
					: '승인된 소셜 계정만 로그인됩니다. 승인 대기 중이거나 미가입이면 안내됩니다.'}
			</p>

			{/* 2. 동그란 버튼 그룹 */}
			<div className="social-login-group">

				{/* 카카오 동그라미 버튼 */}
				<button className="circle-btn circle-kakao" onClick={() => handleSocialLogin('kakao')} title={`카카오 ${isSignup ? '회원가입' : '로그인'}`}>
					{/* 실제 카카오 아이콘 이미지가 있다면 아래 img 태그 사용, 없다면 텍스트 'K' 등 사용 */}
					{/* <img src="/images/kakao_icon.png" alt="카카오" /> */}
					<span className="circle-btn__letter--kakao">K</span>
				</button>

				{/* 네이버 동그라미 버튼 */}
				<button className="circle-btn circle-naver" onClick={() => handleSocialLogin('naver')} title={`네이버 ${isSignup ? '회원가입' : '로그인'}`}>
					{/* 실제 네이버 아이콘 이미지가 있다면 아래 img 태그 사용, 없다면 텍스트 'N' 등 사용 */}
					{/* <img src="/images/naver_icon.png" alt="네이버" /> */}
					<span className="circle-btn__letter--naver">N</span>
				</button>

			</div>
		</div>
	);
};

export default SocialButtons;