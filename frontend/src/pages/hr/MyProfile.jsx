import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';
import { authApi } from 'api/authApi';
import { useAuth } from 'context/AuthContext';
import 'assets/css/my-profile.css';

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
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authApi.getMe();
			const data = res.data;
			setProfile(data);
			setNickname(data.user_nickname ?? '');
			setPhone(data.user_phone_number ?? '');
			setCurrentPassword('');
			setNewPassword('');
		} catch (err) {
			console.error(err);
			Notify.toastError(formatApiDetail(err) || '내 정보를 불러오지 못했습니다.');
			setProfile(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const social = useMemo(() => isSocialLoginId(profile?.user_login_id), [profile?.user_login_id]);

	const vacation = profile?.vacation;
	const totalDays = vacation?.total_days ?? 0;
	const usedDays = vacation?.used_days ?? 0;
	const remainingDays = vacation?.remaining_days ?? 0;
	const usedPct = totalDays > 0 ? Math.min(100, Math.round((usedDays / totalDays) * 1000) / 10) : 0;

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!profile || saving) return;

		const payload = {};
		const nickTrim = (nickname || '').trim();
		const prevNick = (profile.user_nickname || '').trim();
		if (nickTrim !== prevNick) {
			payload.user_nickname = nickTrim || null;
		}

		const phoneDigits = (phone || '').replace(/\D/g, '');
		const prevPhone = (profile.user_phone_number || '').replace(/\D/g, '');
		if (phoneDigits !== prevPhone) {
			payload.user_phone_number = phoneDigits || null;
		}

		if (!social && (newPassword || currentPassword)) {
			if (!newPassword || !currentPassword) {
				Notify.toastError('비밀번호를 변경하려면 현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.');
				return;
			}
			payload.current_password = currentPassword;
			payload.new_password = newPassword;
		}

		if (Object.keys(payload).length === 0) {
			Notify.toastInfo('변경된 내용이 없습니다.');
			return;
		}

		setSaving(true);
		try {
			const res = await authApi.patchMe(payload);
			setProfile(res.data);
			setNickname(res.data.user_nickname ?? '');
			setPhone(res.data.user_phone_number ?? '');
			setCurrentPassword('');
			setNewPassword('');
			await checkAuth();
			Notify.toastSuccess('저장되었습니다.');
		} catch (err) {
			console.error(err);
			Notify.toastError(err.message || formatApiDetail(err) || '저장에 실패했습니다.');
		} finally {
			setSaving(false);
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
				<div className="my-profile-grid">
					<label htmlFor="mp-name">이름</label>
					<input id="mp-name" className="my-profile-readonly" type="text" value={profile.user_name || ''} readOnly />
					
					<label htmlFor="mp-join">입사일</label>
					<input id="mp-join" className="my-profile-readonly" type="text" value={formatYmd(profile.join_date)} readOnly />
					<label htmlFor="mp-nick">닉네임</label>
					<div>
						<input
							id="mp-nick"
							type="text"
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							autoComplete="nickname"
							maxLength={50}
						/>
					</div>
					<label htmlFor="mp-phone">전화번호</label>
					<div>
						<input
							id="mp-phone"
							type="tel"
							inputMode="numeric"
							placeholder="숫자만 10~11자리"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							autoComplete="tel"
						/>
						<div className="my-profile-hint">하이픈 없이 입력해 주세요.</div>
					</div>
					{!social ? (
						<>
							<label htmlFor="mp-cur-pw">현재 비밀번호</label>
							<div>
								<input
									id="mp-cur-pw"
									type="password"
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									autoComplete="current-password"
								/>
							</div>
							<label htmlFor="mp-new-pw">새 비밀번호</label>
							<div>
								<input
									id="mp-new-pw"
									type="password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									autoComplete="new-password"
								/>
								<div className="my-profile-hint">변경 시에만 입력하세요. 6자 이상.</div>
							</div>
						</>
					) : (
						<>
							<span className="my-profile-value">비밀번호</span>
							<span className="my-profile-value">
								소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.
							</span>
						</>
					)}
				</div>
				<div className="my-profile-actions">
					<button type="submit" className="my-profile-btn my-profile-btn--primary" disabled={saving}>
						{saving ? '저장 중…' : '저장'}
					</button>
				</div>
			</form>

			<section className="my-profile-card">
				<h2 className="my-profile-card__title">내 연차</h2>
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
					<p className="my-profile-empty">
						등록된 연차 정보가 없습니다. 휴가 일정을 등록하면 자동으로 반영됩니다.
					</p>
				)}
			</section>
		</div>
	);
};

export default MyProfile;
