import AppModal from 'components/common/AppModal';
import React, { useEffect, useState } from 'react';
import * as Notify from 'utils/toastUtils';

const PasswordChangeModal = ({
	isOpen,
	onClose,
	social,
	passwordSaving,
	onConfirm,
}) => {
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');

	useEffect(() => {
		if (!isOpen) return;
		setCurrentPassword('');
		setNewPassword('');
		setConfirmPassword('');
	}, [isOpen]);

	const handleSubmit = () => {
		if (social) return;

		const cur = (currentPassword || '').trim();
		const next = (newPassword || '').trim();
		const confirm = (confirmPassword || '').trim();

		if (!cur || !next || !confirm) {
			Notify.toastError('현재 비밀번호와 새 비밀번호(확인)를 모두 입력해 주세요.');
			return;
		}
		if (next !== confirm) {
			Notify.toastError('새 비밀번호 확인 값이 일치하지 않습니다.');
			return;
		}
		if (next.length < 6) {
			Notify.toastError('새 비밀번호는 6자 이상 입력해 주세요.');
			return;
		}

		onConfirm({ currentPassword: cur, newPassword: next });
	};

	return (
		<AppModal
			isOpen={isOpen}
			onClose={onClose}
			contentClassName="my-profile-password-detail-modal"
		>
			<h2 className="my-profile-vacation-detail-modal__title">비밀번호 변경</h2>

			{social ? (
				<p className="my-profile-password-social-msg">
					소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.
				</p>
			) : (
				<>
					<div className="my-profile-password-fields">
						<label htmlFor="mp-modal-cur-pw">현재 비밀번호</label>
						<input
							id="mp-modal-cur-pw"
							type="password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							autoComplete="current-password"
						/>

						<label htmlFor="mp-modal-new-pw">새 비밀번호</label>
						<input
							id="mp-modal-new-pw"
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							autoComplete="new-password"
						/>

						<label htmlFor="mp-modal-confirm-pw">새 비밀번호 확인</label>
						<input
							id="mp-modal-confirm-pw"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							autoComplete="new-password"
						/>

						<div className="my-profile-hint">변경 시에만 입력하세요. 6자 이상.</div>
					</div>

					<div className="my-profile-modal-actions">
						<button
							type="button"
							className="my-profile-btn my-profile-btn--secondary"
							onClick={onClose}
						>
							취소
						</button>
						<button
							type="button"
							className="my-profile-btn my-profile-btn--primary"
							disabled={passwordSaving}
							onClick={handleSubmit}
						>
							{passwordSaving ? '변경 중…' : '변경하기'}
						</button>
					</div>
				</>
			)}
		</AppModal>
	);
};

export default PasswordChangeModal;

