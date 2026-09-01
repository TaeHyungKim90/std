import { authApi } from 'api/authApi';
import PasswordChangeModal from 'components/hr/PasswordChangeModal';
import { useAuth } from 'context/AuthContext';
import React, { useState } from 'react';
import * as Notify from 'utils/toastUtils';

/**
 * 부트스트랩·초기 admin 등 mustChangePassword 세션일 때 전역 비밀번호 변경 안내.
 */
const MustChangePasswordGate = () => {
	const { mustChangePassword, userId, refreshAuth, clearMustChangePassword } = useAuth();
	const [passwordSaving, setPasswordSaving] = useState(false);

	const social =
		typeof userId === 'string' &&
		(userId.startsWith('kakao_') || userId.startsWith('naver_'));

	if (!mustChangePassword || social) {
		return null;
	}

	const handleConfirm = async ({ currentPassword, newPassword }) => {
		if (passwordSaving) return;
		setPasswordSaving(true);
		try {
			await authApi.patchMe({
				current_password: currentPassword,
				new_password: newPassword,
			});
			clearMustChangePassword();
			await refreshAuth();
			Notify.toastSuccess('비밀번호가 변경되었습니다. 이제 서비스를 이용할 수 있습니다.');
		} catch (err) {
			Notify.toastApiFailure(err, '비밀번호 변경에 실패했습니다.');
		} finally {
			setPasswordSaving(false);
		}
	};

	return (
		<PasswordChangeModal
			isOpen
			required
			title="초기 비밀번호 변경"
			description="보안을 위해 첫 로그인 시 비밀번호를 변경해 주세요. (기본 비밀번호 1234는 더 이상 사용할 수 없습니다.)"
			social={false}
			passwordSaving={passwordSaving}
			onConfirm={handleConfirm}
		/>
	);
};

export default MustChangePasswordGate;
