import React, { useState, useEffect } from 'react';
import 'assets/css/careers.css';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';
import { recruitmentApi } from 'api/recruitmentApi';
import {
	syncApplicantSessionFromServer,
	setCachedApplicantUser,
	isApplicantSessionPayloadLoggedIn,
} from 'utils/applicantSession';

const ApplicantProfileModal = ({ isOpen, onClose, loggedInUser, onUpdateSuccess }) => {
	// 내부 폼 상태
	const [profileForm, setProfileForm] = useState({ name: '', phone: '', password: '' });

	// 모달이 열릴 때마다 로그인된 유저의 최신 정보를 폼에 세팅
	useEffect(() => {
		if (isOpen && loggedInUser) {
			setProfileForm({
				name: loggedInUser.name || '',
				phone: loggedInUser.phone || '',
				password: '' // 비밀번호는 보안상 항상 빈 칸으로 시작
			});
		}
	}, [isOpen, loggedInUser]);

	// 모달이 닫혀있거나 유저 정보가 없으면 안 그림(렌더링 X)
	if (!isOpen || !loggedInUser) return null;

	// 정보 수정 제출 로직
	const handleProfileUpdate = async (e) => {
		e.preventDefault();
		Notify.toastPromise(
			recruitmentApi.updateApplicant(loggedInUser.id, profileForm),
			{
				loading: '정보를 수정하고 있습니다...',
				success: '회원 정보가 성공적으로 변경되었습니다! 🎉', // 기존 alert 대체
				error: (error) =>
					formatApiDetail(error) || '정보 수정에 실패했습니다.' // 기존 alert 대체
			}
		).then(async (res) => {
			const me = await syncApplicantSessionFromServer();
			if (isApplicantSessionPayloadLoggedIn(me)) {
				onUpdateSuccess(me);
			} else if (res?.data) {
				const merged = { ...res.data, isLoggedIn: true };
				setCachedApplicantUser(merged);
				onUpdateSuccess(merged);
			}
			onClose();
		}).catch((err) => {
			console.error("정보 수정 에러:", err);
		});
	};

	return (
		<div className="applicant-profile-modal__backdrop">
			<div className="dynamic-enter applicant-profile-modal__panel">
				<h2 className="applicant-profile-modal__title">내 정보 수정</h2>
				
				<form onSubmit={handleProfileUpdate} className="applicant-profile-modal__form">
					<div>
						<label className="applicant-profile-modal__label">이메일 (아이디)</label>
						<input type="email" value={loggedInUser.email_id} disabled className="applicant-profile-modal__input" />
					</div>
					
					<div>
						<label className="applicant-profile-modal__label">이름</label>
						<input type="text" value={profileForm.name} required onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} className="applicant-profile-modal__input" />
					</div>

					<div>
						<label className="applicant-profile-modal__label">연락처</label>
						<input type="tel" value={profileForm.phone} required onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} className="applicant-profile-modal__input" />
					</div>

					<div>
						<label className="applicant-profile-modal__label">새 비밀번호 (변경 시에만 입력)</label>
						<input type="password" placeholder="변경할 비밀번호 입력" value={profileForm.password} onChange={(e) => setProfileForm({...profileForm, password: e.target.value})} className="applicant-profile-modal__input" />
					</div>

					<div className="applicant-profile-modal__actions">
						<button type="button" onClick={onClose} className="applicant-profile-modal__btn-cancel">취소</button>
						<button type="submit" className="applicant-profile-modal__btn-submit">저장하기</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default ApplicantProfileModal;
