import 'assets/css/my-profile.css';
import 'assets/css/my-profile-extra.css';

import { authApi } from 'api/authApi';
import { commonApi } from 'api/commonApi';
import AppModal from 'components/common/AppModal';
import AvatarImageCropModal from 'components/common/AvatarImageCropModal';
import UserAvatar from 'components/common/UserAvatar';
import PasswordChangeModal from 'components/hr/PasswordChangeModal';
import { useAuth } from 'context/AuthContext';
import { Camera } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Notify from 'utils/toastUtils';

function formatYmd(value) {
	if (value == null || value === '') return '—';
	if (typeof value === 'string') return value.split('T')[0];
	try {
		return String(value).slice(0, 10);
	} catch {
		return '—';
	}
}

function isSocialLoginId(loginId) {
	if (!loginId || typeof loginId !== 'string') return false;
	return loginId.startsWith('kakao_') || loginId.startsWith('naver_');
}

const MyProfile = () => {
	const { checkAuth } = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [profile, setProfile] = useState(null);

	const [nickname, setNickname] = useState('');
	const [phone, setPhone] = useState('');
	const [salaryBankName, setSalaryBankName] = useState('');
	const [salaryAccountNumber, setSalaryAccountNumber] = useState('');

	const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null); // blob URL or /uploads/...
	const [photoFile, setPhotoFile] = useState(null); // File (선택된 즉시 업로드용)
	const [avatarAdjust, setAvatarAdjust] = useState({ zoom: 1, offsetX: 0, offsetY: 0 });
	const [cropModalOpen, setCropModalOpen] = useState(false);
	const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
	const [vacationDetailOpen, setVacationDetailOpen] = useState(false);
	/** 동일 /uploads 경로일 때 브라우저가 옛 이미지를 캐시하는 문제 방지 */
	const [avatarImgCacheKey, setAvatarImgCacheKey] = useState(0);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authApi.getMe();
			const data = res.data;
			setProfile(data);
			setNickname(data.user_nickname ?? '');
			setPhone(data.user_phone_number ?? '');
			setSalaryBankName(data.salary_bank_name ?? '');
			setSalaryAccountNumber(data.salary_account_number ?? '');
			setPhotoPreviewUrl(data.user_profile_image_url ?? null);
			setAvatarAdjust({
				zoom: Number(data.avatar_zoom ?? 1),
				offsetX: Number(data.avatar_offset_x ?? 0),
				offsetY: Number(data.avatar_offset_y ?? 0),
			});
			setAvatarImgCacheKey((k) => k + 1);
		} catch (err) {
			Notify.toastApiFailure(err, '내 정보를 불러오지 못했습니다.');
			setProfile(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => {
		// blob: 미리보기 URL 메모리 해제
		return () => {
			if (photoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl);
		};
	}, [photoPreviewUrl]);

	const social = useMemo(() => isSocialLoginId(profile?.user_login_id), [profile?.user_login_id]);

	const vacation = profile?.vacation;
	const totalDays = vacation?.total_days ?? 0;
	const usedDays = vacation?.used_days ?? 0;
	const remainingDays = vacation?.remaining_days ?? 0;
	const usedPct = totalDays > 0 ? Math.min(100, Math.round((usedDays / totalDays) * 1000) / 10) : 0;

	const joinYmd = formatYmd(profile?.join_date);
	const tenureDays = useMemo(() => {
		if (!profile?.join_date) return null;
		const d = new Date(profile.join_date);
		if (Number.isNaN(d.getTime())) return null;
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24))) + 1;
	}, [profile?.join_date]);

	const openVacationDetail = () => setVacationDetailOpen(true);
	const closeVacationDetail = () => setVacationDetailOpen(false);

	const openPasswordChange = () => setPasswordChangeOpen(true);
	const closePasswordChange = () => setPasswordChangeOpen(false);

	const [passwordSaving, setPasswordSaving] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!profile || saving) return;
		setSaving(true);
		try {
			const payload = {};

			// 닉네임
			const nickTrim = (nickname || '').trim();
			const prevNick = (profile.user_nickname || '').trim();
			if (nickTrim !== prevNick) payload.user_nickname = nickTrim || null;

			// 전화번호(숫자만)
			const phoneDigits = (phone || '').replace(/\D/g, '');
			const prevPhone = (profile.user_phone_number || '').replace(/\D/g, '');
			if (phoneDigits !== prevPhone) payload.user_phone_number = phoneDigits || null;

			// 급여 계좌
			const bankTrim = (salaryBankName || '').trim();
			const prevBank = (profile.salary_bank_name || '').trim();
			if (bankTrim !== prevBank) payload.salary_bank_name = bankTrim || null;

			const acctDigits = (salaryAccountNumber || '').replace(/\D/g, '');
			const prevAcct = (profile.salary_account_number || '').replace(/\D/g, '');
			if (acctDigits !== prevAcct) payload.salary_account_number = acctDigits || null;

			// 사진 업로드(선택된 경우)
			if (photoFile) {
				const formData = new FormData();
				formData.append('files', photoFile);
				const uploadRes = await commonApi.uploadFiles(formData);
				const nextFilePath = uploadRes.data?.[0]?.file_path ?? null;
				const prevPhoto = profile.user_profile_image_url ?? null;
				if (nextFilePath !== prevPhoto) payload.user_profile_image_url = nextFilePath;
			}
			if (Number(profile.avatar_zoom ?? 1) !== Number(avatarAdjust.zoom ?? 1)) payload.avatar_zoom = Number(avatarAdjust.zoom ?? 1);
			if (Number(profile.avatar_offset_x ?? 0) !== Number(avatarAdjust.offsetX ?? 0)) payload.avatar_offset_x = Number(avatarAdjust.offsetX ?? 0);
			if (Number(profile.avatar_offset_y ?? 0) !== Number(avatarAdjust.offsetY ?? 0)) payload.avatar_offset_y = Number(avatarAdjust.offsetY ?? 0);

			if (Object.keys(payload).length === 0) {
				Notify.toastInfo('변경된 내용이 없습니다.');
				return;
			}

			const res = await authApi.patchMe(payload);
			setProfile(res.data);
			setNickname(res.data.user_nickname ?? '');
			setPhone(res.data.user_phone_number ?? '');
			setSalaryBankName(res.data.salary_bank_name ?? '');
			setSalaryAccountNumber(res.data.salary_account_number ?? '');
			setPhotoPreviewUrl(res.data.user_profile_image_url ?? null);
			setAvatarAdjust({
				zoom: Number(res.data.avatar_zoom ?? 1),
				offsetX: Number(res.data.avatar_offset_x ?? 0),
				offsetY: Number(res.data.avatar_offset_y ?? 0),
			});
			setPhotoFile(null);
			setAvatarImgCacheKey((k) => k + 1);
			// 비밀번호 변경은 별도 모달에서만 처리합니다.
			await checkAuth();
			Notify.toastSuccess('저장되었습니다.');
		} catch (err) {
			Notify.toastApiFailure(err, '저장에 실패했습니다.');
		} finally {
			setSaving(false);
		}
	};

	const BANK_OPTIONS = [
		'KB국민은행',
		'신한은행',
		'우리은행',
		'하나은행',
		'IBK기업은행',
		'NH농협은행',
		'카카오뱅크',
		'수협은행',
	];

	const handlePhotoChange = () => {
		setCropModalOpen(true);
	};

	const handleCropConfirm = async (nextFile, nextUrl, nextAdjust) => {
		if (!profile) return;
		const nextAvatarAdjust = {
			zoom: Number(nextAdjust?.zoom ?? 1),
			offsetX: Number(nextAdjust?.offsetX ?? 0),
			offsetY: Number(nextAdjust?.offsetY ?? 0),
		};

		const savePhotoTask = async () => {
			let nextFilePath = profile.user_profile_image_url ?? null;
			if (nextFile) {
				const formData = new FormData();
				formData.append('files', nextFile);
				const uploadRes = await commonApi.uploadFiles(formData);
				nextFilePath = uploadRes.data?.[0]?.file_path ?? null;
			}
			return authApi.patchMe({
				user_profile_image_url: nextFilePath,
				avatar_zoom: nextAvatarAdjust.zoom,
				avatar_offset_x: nextAvatarAdjust.offsetX,
				avatar_offset_y: nextAvatarAdjust.offsetY,
			});
		};

		try {
			const res = await Notify.toastPromise(savePhotoTask(), {
				loading: '프로필 사진을 저장하는 중입니다...',
				success: '프로필 사진이 저장되었습니다.',
				error: '프로필 사진 저장에 실패했습니다.',
			});

			if (photoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl);
			setPhotoFile(null);
			setPhotoPreviewUrl(res.data?.user_profile_image_url ?? nextUrl ?? null);
			setAvatarAdjust({
				zoom: Number(res.data?.avatar_zoom ?? nextAvatarAdjust.zoom),
				offsetX: Number(res.data?.avatar_offset_x ?? nextAvatarAdjust.offsetX),
				offsetY: Number(res.data?.avatar_offset_y ?? nextAvatarAdjust.offsetY),
			});
			setProfile((prev) => (prev ? { ...prev, ...res.data } : res.data));
			setAvatarImgCacheKey((k) => k + 1);
			setCropModalOpen(false);
		} catch (err) {
			Notify.toastApiFailure(err, '프로필 사진 저장 실패');
		}
	};

	const handleConfirmPasswordChange = async ({ currentPassword, newPassword }) => {
		if (social) return;
		if (passwordSaving) return;

		const nextCurrent = (currentPassword || '').trim();
		const nextNew = (newPassword || '').trim();
		if (!nextCurrent || !nextNew) return;
		if (nextNew.length < 6) {
			Notify.toastError('새 비밀번호는 6자 이상 입력해 주세요.');
			return;
		}

		setPasswordSaving(true);
		try {
			await authApi.patchMe({
				current_password: nextCurrent,
				new_password: nextNew,
			});

			setPasswordChangeOpen(false);
			await checkAuth();
			Notify.toastSuccess('비밀번호가 변경되었습니다.');
		} catch (err) {
			Notify.toastApiFailure(err, '비밀번호 변경에 실패했습니다.');
		} finally {
			setPasswordSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="my-profile-page">
				<p className="my-profile-empty">불러오는 중…</p>
			</div>
		);
	}

	if (!profile) {
		return (
			<div className="my-profile-page">
				<p className="my-profile-empty">내 정보를 표시할 수 없습니다. 다시 로그인해 주세요.</p>
			</div>
		);
	}

	return (
		<div className="my-profile-page">
			<h1 className="my-profile-page__title">내 정보</h1>
			<p className="my-profile-page__lead">기본 프로필을 관리하고, 올해 연차 사용 현황을 확인할 수 있습니다.</p>

			<form className="my-profile-card" onSubmit={handleSubmit}>
				<h2 className="my-profile-card__title">내 정보 관리</h2>
				<div className="my-profile-edit-top">
					<div className="my-profile-photo-panel">
						<button type="button" className="my-profile-photo-preview-trigger" onClick={handlePhotoChange}>
							<UserAvatar
								imageUrl={photoPreviewUrl}
								nickname={nickname}
								name={profile.user_name}
								size={92}
								avatarAdjust={avatarAdjust}
								imageCacheBust={avatarImgCacheKey}
							/>
							<span className="my-profile-photo-preview-trigger__badge" aria-hidden="true">
								<Camera size={14} />
							</span>
						</button>
						<div className="my-profile-photo-name">{profile.user_name || ''}</div>
						<div className="my-profile-photo-sub">
							{(profile.department_name || '부서 없음').trim()} · {(profile.position_name || '직급 없음').trim()}
						</div>
						<div className="my-profile-photo-meta">
							<div className="my-profile-photo-meta-item">
								<div className="my-profile-photo-meta-label">입사일</div>
								<div className="my-profile-photo-meta-value">{joinYmd}</div>
							</div>
							<div className="my-profile-photo-meta-divider" />
							<div className="my-profile-photo-meta-item">
								<div className="my-profile-photo-meta-label">근속일</div>
								<div className="my-profile-photo-meta-value">{tenureDays ?? '—'}일차</div>
							</div>
						</div>

						<section className="my-profile-vacation-mini-card" aria-label="잔여 연차 현황">
							<div className="my-profile-vacation-mini-card__header">
								<h3 className="my-profile-vacation-mini-card__title">잔여 연차 현황</h3>
								<button
									type="button"
									className="my-profile-vacation-mini-card__detail"
									onClick={openVacationDetail}
								>
									상세보기
								</button>
							</div>

							{vacation ? (
								<>
									<div className="vacation-summary-text my-profile-vacation-mini-card__summary">
										올해 총 <strong>{totalDays}</strong>일 중 <strong>{usedDays}</strong>일 사용,
										잔여 휴가: <strong>{remainingDays}</strong>일
									</div>

									<div className="vacation-progress vacation-progress--mini" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100}>
										<div className="vacation-progress__fill" style={{ width: `${usedPct}%` }} />
									</div>

									<div className="vacation-progress__labels my-profile-vacation-mini-card__labels">
										<span>사용 {usedDays}일</span>
										<span>잔여 {remainingDays}일</span>
									</div>
								</>
							) : (
								<p className="my-profile-empty my-profile-vacation-mini-card__empty">
									등록된 연차 정보가 없습니다.
								</p>
							)}
						</section>
					</div>

					<div className="my-profile-basic-edit-panel">
						<div className="my-profile-basic-edit-panel__header">
							<h3 className="my-profile-basic-edit-panel__title">기본 정보 수정</h3>
						</div>

						<div className="my-profile-basic-edit-panel__content">
							{/* test3.html 기준: 이름/닉네임/휴대폰(좌/우) + 빈칸 */}
							<div className="my-profile-basic-info-grid">
								<div className="my-profile-field">
									<label htmlFor="mp-name">이름</label>
									<input
										id="mp-name"
										className="my-profile-readonly"
										type="text"
										value={profile.user_name || ''}
										readOnly
									/>
								</div>

								<div className="my-profile-field my-profile-field--empty" />

								<div className="my-profile-field">
									<label htmlFor="mp-nick">닉네임</label>
									<input
										id="mp-nick"
										type="text"
										value={nickname}
										onChange={(e) => setNickname(e.target.value)}
										autoComplete="nickname"
										maxLength={50}
									/>
								</div>

								<div className="my-profile-field">
									<label htmlFor="mp-phone">휴대폰 번호</label>
									<input
										id="mp-phone"
										type="tel"
										inputMode="numeric"
										placeholder="010-0000-0000"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
										autoComplete="tel"
									/>
									<div className="my-profile-hint">하이픈 없이 입력해 주세요.</div>
								</div>
							</div>

							{/* test3.html 기준: 급여 계좌 / 비밀번호 변경 카드 */}
							<div className="my-profile-basic-subcard-grid">
								<div className="my-profile-subcard">
									<h3 className="my-profile-subcard__title">급여 수령 계좌</h3>
									<div className="my-profile-subcard__body">
										<select
											id="mp-salary-bank"
											value={salaryBankName}
											onChange={(e) => setSalaryBankName(e.target.value)}
											aria-label="급여 은행"
										>
											<option value="">은행 선택</option>
											{BANK_OPTIONS.map((b) => (
												<option key={b} value={b}>
													{b}
												</option>
											))}
										</select>

										<input
											type="text"
											inputMode="numeric"
											placeholder="계좌번호 입력 ('-' 제외)"
											value={salaryAccountNumber}
											onChange={(e) =>
												setSalaryAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 20))
											}
											aria-label="급여 계좌번호"
										/>
									</div>
								</div>

								<div className="my-profile-subcard">
									<h3 className="my-profile-subcard__title">비밀번호 변경</h3>
									<div className="my-profile-subcard__body">
										{!social ? (
											<>
												<button type="button" className="my-profile-password-auth-btn" onClick={openPasswordChange}>
													변경하기
												</button>
												<p className="my-profile-password-hint">주기적인 비밀번호 변경을 권장합니다.</p>
											</>
										) : (
											<p className="my-profile-password-social-msg">
												소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.
											</p>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="my-profile-actions my-profile-form-actions">
					<button type="submit" className="my-profile-btn my-profile-btn--primary" disabled={saving}>
						{saving ? '저장 중…' : '변경사항 저장하기'}
					</button>
				</div>
			</form>

			<AppModal
				isOpen={vacationDetailOpen}
				onClose={closeVacationDetail}
				contentClassName="my-profile-vacation-detail-modal"
			>
				<h2 className="my-profile-vacation-detail-modal__title">연차 상세</h2>
				{vacation ? (
					<>
						<p className="vacation-summary-text">
							올해 총 <strong>{totalDays}</strong>일 중 <strong>{usedDays}</strong>일 사용, 잔여 휴가:{' '}
							<strong>{remainingDays}</strong>일
						</p>
						<div className="vacation-progress" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100}>
							<div className="vacation-progress__fill" style={{ width: `${usedPct}%` }} />
						</div>
						<div className="vacation-progress__labels">
							<span>사용 {usedDays}일</span>
							<span>잔여 {remainingDays}일</span>
						</div>
					</>
				) : (
					<p className="my-profile-empty">등록된 연차 정보가 없습니다.</p>
				)}
			</AppModal>

			<PasswordChangeModal
				isOpen={passwordChangeOpen}
				onClose={closePasswordChange}
				social={social}
				passwordSaving={passwordSaving}
				onConfirm={handleConfirmPasswordChange}
			/>
			<AvatarImageCropModal
				isOpen={cropModalOpen}
				file={null}
				initialImageUrl={photoPreviewUrl || profile?.user_profile_image_url || null}
				initialAdjust={avatarAdjust}
				onClose={() => {
					setCropModalOpen(false);
				}}
				onConfirm={handleCropConfirm}
			/>
		</div>
	);
};

export default MyProfile;
