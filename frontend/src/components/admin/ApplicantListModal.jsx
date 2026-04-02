import 'assets/css/applicantListModal.css';

import { recruitmentApi } from 'api/recruitmentApi';
import AdminFilePreviewModal from 'components/admin/AdminFilePreviewModal';
import { useLoading } from 'context/LoadingContext';
import React, { useEffect,useState } from 'react';
import * as Notify from 'utils/toastUtils';

const STATUS_MAP = {
    'applied': { text: '서류 접수', color: '#4A90E2', bg: '#EFF6FF' },
    'document_passed': { text: '서류 합격', color: '#F39C12', bg: '#FEF9C3' },
    'interviewing': { text: '면접 진행', color: '#9B59B6', bg: '#F3E8FF' },
    'final_passed': { text: '최종 합격', color: '#3FAF7A', bg: 'rgba(63, 175, 122, 0.16)' },
    'rejected': { text: '불합격', color: '#FF6A3D', bg: '#FEE2E2' }
};

const ApplicantListModal = ({ isOpen, onClose, jobId, jobTitle }) => {
    const { showLoading, hideLoading } = useLoading();
    const [applicants, setApplicants] = useState([]);
    const [isLoading, setModalLoading] = useState(false);
    const [filePreview, setFilePreview] = useState(null);

    useEffect(() => {
        if (isOpen && jobId) {
            const fetchApplicants = async () => {
                setModalLoading(true);
                showLoading("지원자 목록을 불러오는 중입니다... ⏳");
                try {
                    const res = await recruitmentApi.getApplicationsByJob(jobId);
                    setApplicants(res.data || res);
                } catch (error) {
                    setApplicants([]);
					Notify.toastApiFailure(error, "지원자 목록을 불러오지 못했습니다.");
                } finally {
                    hideLoading();
                    setModalLoading(false);
                }
            };
            fetchApplicants();
        } else {
            setApplicants([]);
        }
    }, [isOpen, jobId, showLoading, hideLoading]);

    if (!isOpen) return null;

    return (
        <>
        <div className="applicant-list-modal__backdrop">
            <div className="dynamic-enter applicant-list-modal__panel">
                <div className="applicant-list-modal__header">
                    <div className="applicant-list-modal__title-row">
                        <h2 className="applicant-list-modal__title">📋 지원자 목록 - {jobTitle}</h2>
                        <span className="applicant-list-modal__count">
                            (총 접수자: {applicants.length}명)
                        </span>
                    </div>
                    <button type="button" onClick={onClose} className="applicant-list-modal__close">&times;</button>
                </div>

                <div className="applicant-list-modal__body-scroll">
                    {isLoading ? (
                        <div className="applicant-list-modal__loading">데이터를 불러오는 중입니다...</div>
                    ) : (
                        <table className="applicant-list-modal__table">
                            <thead className="applicant-list-modal__thead">
                                <tr>
                                    <th className="applicant-list-modal__th">이름</th>
                                    <th className="applicant-list-modal__th">연락처</th>
                                    <th className="applicant-list-modal__th">이메일</th>
                                    <th className="applicant-list-modal__th">현재 상태</th>
                                    <th className="applicant-list-modal__th">첨부 서류</th>
                                    <th className="applicant-list-modal__th">지원일</th>
                                </tr>
                            </thead>
                            <tbody>
                                {applicants.length > 0 ? applicants.map((app, index) => {
                                    const statusInfo = STATUS_MAP[app.status] || { text: '알 수 없음', color: '#666', bg: '#f3f4f6' };

                                    return (
                                        <tr key={app.id} className="stagger-item applicant-list-modal__row" style={{ animationDelay: `${index * 0.04}s` }}>
                                            <td className="applicant-list-modal__td applicant-list-modal__td--name">{app.applicant?.name}</td>
                                            <td className="applicant-list-modal__td applicant-list-modal__td--muted">{app.applicant?.phone || '-'}</td>
                                            <td className="applicant-list-modal__td applicant-list-modal__td--muted">{app.applicant?.email_id}</td>
                                            <td className="applicant-list-modal__td">
                                                <span
                                                    className="applicant-list-modal__status-pill"
                                                    style={{
                                                        backgroundColor: statusInfo.bg,
                                                        color: statusInfo.color,
                                                        border: `1px solid ${statusInfo.color}33`,
                                                    }}
                                                >
                                                    {statusInfo.text}
                                                </span>
                                            </td>
                                            <td className="applicant-list-modal__td">
                                                <div className="applicant-list-modal__file-actions">
                                                    {app.resume_file_url && (
                                                        <button type="button" className="applicant-list-modal__file-btn" onClick={() => setFilePreview({ url: app.resume_file_url, label: '이력서' })}>
                                                            📄 이력서
                                                        </button>
                                                    )}
                                                    {app.portfolio_file_url && (
                                                        <button type="button" className="applicant-list-modal__file-btn" onClick={() => setFilePreview({ url: app.portfolio_file_url, label: '포트폴리오' })}>
                                                            🎨 포플
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="applicant-list-modal__td applicant-list-modal__td--date">{new Date(app.applied_at).toLocaleDateString()}</td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="6" className="applicant-list-modal__empty">
                                            아직 이 공고에 지원한 사람이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="applicant-list-modal__footer">
                    <button type="button" onClick={onClose} className="applicant-list-modal__footer-btn">닫기</button>
                </div>
            </div>
        </div>
        <AdminFilePreviewModal
            isOpen={!!filePreview}
            onClose={() => setFilePreview(null)}
            fileUrl={filePreview?.url}
            fileLabel={filePreview?.label}
        />
        </>
    );
};

export default ApplicantListModal;
