import React, { useState, useEffect } from 'react';
import * as Notify from 'utils/toastUtils';
import { recruitmentApi } from 'api/recruitmentApi';
import { openFileViewer } from 'utils/fileUtils';

const STATUS_MAP = {
    'applied': { text: '서류 접수', color: '#4A90E2', bg: '#EFF6FF' },
    'document_passed': { text: '서류 합격', color: '#F39C12', bg: '#FEF9C3' },
    'interviewing': { text: '면접 진행', color: '#9B59B6', bg: '#F3E8FF' },
    'final_passed': { text: '최종 합격', color: '#3DAF7A', bg: '#DCFCE7' },
    'rejected': { text: '불합격', color: '#FF6A3D', bg: '#FEE2E2' }
};

const ApplicantListModal = ({ isOpen, onClose, jobId, jobTitle }) => {
    const [applicants, setApplicants] = useState([]);
    const [isLoading, setModalLoading] = useState(false);

    useEffect(() => {
        if (isOpen && jobId) {
            const fetchApplicants = async () => {
                setModalLoading(true);
                Notify.toastPromise(recruitmentApi.getApplicationsByJob(jobId), {
                    loading: '지원자 목록을 불러오는 중입니다...',
                    success: '지원자 목록을 불러왔습니다.',
                    error: () => {
                        setApplicants([]);
                        return '지원자 목록을 불러오지 못했습니다.';
                    }
                }).then((res) => {
                    setApplicants(res.data || res);
                }).catch((error) => {
                    console.error("지원자 목록 로드 실패", error);
                }).finally(() => {
                    setModalLoading(false);
                });
            };
            fetchApplicants();
        } else {
            setApplicants([]); 
        }
    }, [isOpen, jobId]);

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            {/* 모달 창 크기 및 구조 */}
            <div style={{ background: 'white', padding: '30px 40px', borderRadius: '12px', maxWidth: '900px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}> 
                
                {/* 🌟 1. 모달 헤더 (총 접수자 수 추가) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111', paddingBottom: '15px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '15px' }}>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#111' }}>📋 지원자 목록 - {jobTitle}</h2>
                        <span style={{ fontSize: '1rem', color: '#E74C3C', fontWeight: 'bold', marginBottom: '2px' }}>
                            (총 접수자: {applicants.length}명)
                        </span>
                    </div>
                    <button onClick={onClose} style={{ fontSize: '1.8rem', background: 'none', border: 'none', cursor: 'pointer', color: '#999', lineHeight: '1' }}>&times;</button>
                </div>
                
                {/* 🌟 2. 모달 본문 (테이블 디자인 및 스크롤 개선) */}
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '50px 0', color: '#666' }}>데이터를 불러오는 중입니다...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', boxShadow: '0 1px 0 #ddd', zIndex: 1 }}>
                                <tr>
                                    <th style={{ padding: '15px 12px', borderBottom: '1px solid #ddd', color: '#333', fontWeight: 'bold' }}>이름</th>
                                    <th style={{ padding: '15px 12px', borderBottom: '1px solid #ddd', color: '#333', fontWeight: 'bold' }}>연락처</th>
                                    <th style={{ padding: '15px 12px', borderBottom: '1px solid #ddd', color: '#333', fontWeight: 'bold' }}>이메일</th>
                                    <th style={{ padding: '15px 12px', borderBottom: '1px solid #ddd', color: '#333', fontWeight: 'bold' }}>현재 상태</th>
                                    <th style={{ padding: '15px 12px', borderBottom: '1px solid #ddd', color: '#333', fontWeight: 'bold' }}>첨부 서류</th>
                                    <th style={{ padding: '15px 12px', borderBottom: '1px solid #ddd', color: '#333', fontWeight: 'bold' }}>지원일</th>
                                </tr>
                            </thead>
                            <tbody>
                                {applicants.length > 0 ? applicants.map(app => {
                                    const statusInfo = STATUS_MAP[app.status] || { text: '알 수 없음', color: '#666', bg: '#f3f4f6' };
                                    
                                    return (
                                        <tr key={app.id} style={{ borderBottom: '1px solid #eee', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#fcfcfc'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '16px 12px', fontWeight: 'bold', color: '#111' }}>{app.applicant?.name}</td>
                                            <td style={{ padding: '16px 12px', color: '#555' }}>{app.applicant?.phone || '-'}</td>
                                            <td style={{ padding: '16px 12px', color: '#555' }}>{app.applicant?.email_id}</td>
                                            <td style={{ padding: '16px 12px' }}>
                                                <span style={{ padding: '6px 12px', borderRadius: '20px', backgroundColor: statusInfo.bg, color: statusInfo.color, fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                    {statusInfo.text}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 12px' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    {app.resume_file_url && (
                                                        <button onClick={() => openFileViewer(app.resume_file_url)} style={{ padding: '6px 10px', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', color: '#333', fontWeight: '500' }}>
                                                            📄 이력서
                                                        </button>
                                                    )}
                                                    {app.portfolio_file_url && (
                                                        <button onClick={() => openFileViewer(app.portfolio_file_url)} style={{ padding: '6px 10px', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', color: '#333', fontWeight: '500' }}>
                                                            🎨 포플
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 12px', color: '#888', fontSize: '0.9rem' }}>{new Date(app.applied_at).toLocaleDateString()}</td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '60px 0', color: '#888', fontSize: '1.1rem' }}>
                                            아직 이 공고에 지원한 사람이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* 🌟 3. 모달 하단 버튼 */}
                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee', textAlign: 'right' }}>
                    <button onClick={onClose} style={{ padding: '10px 24px', background: '#f3f4f6', color: '#333', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApplicantListModal;