import React from 'react';

const PRIVACY_POLICY_SECTIONS = [
	{
		title: '수집 항목',
		items: [
			'필수: 이름, 아이디 또는 이메일, 비밀번호, 연락처, 서비스 이용 기록, 접속 로그, 기기 및 브라우저 정보',
			'지원자 추가 항목: 입사 지원 및 채용 절차 진행에 필요한 지원 이력과 제출 자료',
			'민감정보는 법령상 근거가 있거나 별도 동의를 받은 경우에만 최소한으로 처리합니다.',
		],
	},
	{
		title: '이용 목적',
		items: [
			'본인 확인, 계정 생성, 로그인 및 보안 인증, HR 서비스 제공',
			'채용 지원 접수, 지원자 안내, 전형 진행, 문의 대응',
			'부정 이용 방지, 접근 이력 관리, 서비스 품질 및 보안 개선',
		],
	},
	{
		title: '보관 기간',
		items: [
			'회원 정보는 탈퇴 또는 이용 목적 달성 시 지체 없이 파기합니다.',
			'채용 지원 정보는 가입일 또는 최종 지원일로부터 2년간 보관 후 파기합니다.',
			'관계 법령상 보존 의무가 있는 기록은 해당 법령에서 정한 기간 동안 분리 보관합니다.',
		],
	},
	{
		title: '제공 및 위탁',
		items: [
			'개인정보는 원칙적으로 제3자에게 제공하지 않으며, 법령상 의무 또는 별도 동의가 있는 경우에만 제공합니다.',
			'클라우드, 알림, 보안, 채용 운영 등 업무 처리를 위탁할 수 있으며 위탁사는 필요한 범위 안에서 관리합니다.',
		],
	},
	{
		title: '2026 개인정보 보호 원칙',
		items: [
			'목적에 필요한 최소 정보만 수집하고, 기본값은 비공개와 최소 보관을 원칙으로 합니다.',
			'AI 또는 자동화 기능을 사용하는 경우 결과의 주요 기준을 설명하고, 중요한 결정은 사람이 검토할 수 있도록 합니다.',
			'암호화, 접근 권한 최소화, 접속 기록 점검, 이상 징후 모니터링으로 개인정보를 보호합니다.',
		],
	},
	{
		title: '정보주체 권리',
		items: [
			'이용자는 개인정보 열람, 정정, 삭제, 처리 정지, 동의 철회를 요청할 수 있습니다.',
			'권리 행사는 관리자 또는 개인정보 보호 담당자에게 요청할 수 있으며, 회사는 법령에 따라 지체 없이 처리합니다.',
		],
	},
];

const PrivacyPolicyConsent = ({ checked, onChange, className = '' }) => {
	return (
		<section className={`privacy-consent ${className}`.trim()} aria-label="개인정보처리방침 동의">
			<div className="privacy-consent__header">
				<strong>[필수] 개인정보처리방침 및 개인정보 수집·이용 동의</strong>
				<span>시행일: 2026.01.01</span>
			</div>
			<div className="privacy-consent__body" tabIndex={0}>
				<p className="privacy-consent__intro">
					회원가입 전 아래 내용을 확인해 주세요. 회사는 서비스 제공에 필요한 범위에서만 개인정보를 처리하며,
					이용자의 권리와 데이터 보호를 우선합니다.
				</p>
				{PRIVACY_POLICY_SECTIONS.map((section) => (
					<div className="privacy-consent__section" key={section.title}>
						<h3>{section.title}</h3>
						<ul>
							{section.items.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</div>
				))}
			</div>
			<label className="privacy-consent__check-label">
				<input
					type="checkbox"
					checked={checked}
					onChange={(e) => onChange(e.target.checked)}
					className="privacy-consent__check"
				/>
				<span>위 개인정보처리방침을 확인했으며, 개인정보 수집 및 이용에 동의합니다.</span>
			</label>
		</section>
	);
};

export default PrivacyPolicyConsent;
