import React, { useEffect, useState, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';
import { useLoading } from 'context/LoadingContext';
import { recruitmentApi } from 'api/recruitmentApi';
import JobPostingModal from 'components/admin/JobPostingModal';
import ApplicantListModal from 'components/admin/ApplicantListModal';
import PaginationBar from 'components/common/PaginationBar';
import { usePaginationSearchParams } from 'hooks/usePaginationSearchParams';
import { DEFAULT_ADMIN_PAGE_SIZE } from 'constants/apiConfig';
const PAGE_SIZE = DEFAULT_ADMIN_PAGE_SIZE;

const RecruitmentAdmin = () => {
	const { showLoading, hideLoading } = useLoading();
	const [jobs, setJobs] = useState([]);
	const [total, setTotal] = useState(null);
	const [page, setPage] = usePaginationSearchParams({ pageSize: PAGE_SIZE, total });
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedJob, setSelectedJob] = useState(null);

	const [isApplicantModalOpen, setIsApplicantModalOpen] = useState(false);
	const [selectedJobForApplicants, setSelectedJobForApplicants] = useState(null);

	const loadJobs = useCallback(async () => {
		const skip = (page - 1) * PAGE_SIZE;
		const res = await recruitmentApi.getJobPostings({ skip, limit: PAGE_SIZE });
		const d = res.data;
		setJobs(Array.isArray(d?.items) ? d.items : []);
		setTotal(typeof d?.total === 'number' ? d.total : 0);
	}, [page]);

	const refreshJobs = () =>
		loadJobs().catch((err) => {
			console.error("공고 목록 로드 실패", err);
			Notify.toastError("공고 목록을 불러오지 못했습니다.");
		});

	useEffect(() => {
		showLoading("채용 공고를 불러오는 중입니다... ⏳");
		loadJobs()
			.catch((err) => {
				console.error("공고 목록 로드 실패", err);
				Notify.toastError(err.message || "공고 목록을 불러오지 못했습니다.");
			})
			.finally(() => hideLoading());
	}, [loadJobs, showLoading, hideLoading]);

	// 👉 수정 모달 열기 핸들러
	const handleEditClick = (job) => {
		setSelectedJob(job);
		setIsModalOpen(true);
	};

	// 👉 공고 삭제 핸들러
	const handleDeleteClick = async (jobId) => {
		if (!window.confirm("정말 이 공고를 삭제하시겠습니까?\n(관련 지원자 정보가 함께 삭제될 수 있습니다)")) return;
		Notify.toastPromise(recruitmentApi.deleteJobPosting(jobId), {
			loading: '공고를 삭제하는 중입니다...',
			success: '공고가 삭제되었습니다.',
			error: '삭제에 실패했습니다.'
		}).then(() => {
			loadJobs();
		}).catch((err) => {
			console.error(err);
		});
	};
	const handleApplicantClick = (job) => {
		setSelectedJobForApplicants(job);
		setIsApplicantModalOpen(true);
	};
	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>📢 채용 공고 관리</h2>
				<button className="btn-primary" onClick={() => { setSelectedJob(null); setIsModalOpen(true); }}>
					+ 새 공고 등록
				</button>
			</div>

			<div className="admin-table-wrapper">
				<table className="admin-table">
					<thead>
						<tr>
							<th>상태</th>
							<th>공고명</th>
							<th>마감일</th>
							<th>등록일</th>
							<th className="recruitment-admin__th-actions">관리</th> {/* 버튼 들어갈 자리 넓힘 */}
						</tr>
					</thead>
					<tbody>
						{jobs?.length > 0 ? jobs.map((job, index) => (
							<tr key={job.id} className="stagger-item" style={{ animationDelay: `${index * 0.04}s` }}>
								<td>
									<span className={`status-badge ${job.status}`}>
										{job.status === 'open' ? '진행중' : '마감'}
									</span>
								</td>
								<td className="recruitment-admin__cell-title">{job.title}</td>
								<td>{job.deadline || '상시채용'}</td>
								<td>{new Date(job.created_at).toLocaleDateString()}</td>
								<td>
									{/* 👉 세 가지 버튼으로 나누어 배치 */}
									<button className="btn-save recruitment-admin__btn-lead" onClick={() => handleApplicantClick(job)}>
										지원자
									</button>
									<button className="btn-edit" onClick={() => handleEditClick(job)}>수정</button>
									<button className="btn-delete-small" onClick={() => handleDeleteClick(job.id)}>삭제</button>
								</td>
							</tr>
						)) : (
							<tr><td colSpan="5" className="admin-table__empty">등록된 공고가 없습니다.</td></tr>
						)}
					</tbody>
				</table>
			</div>
			<PaginationBar page={page} pageSize={PAGE_SIZE} total={total ?? 0} onPageChange={setPage} />

			<JobPostingModal 
				isOpen={isModalOpen} 
				onClose={() => setIsModalOpen(false)} 
				onRefresh={refreshJobs} 
				editingJob={selectedJob} 
			/>
			<ApplicantListModal
				isOpen={isApplicantModalOpen}
				onClose={() => setIsApplicantModalOpen(false)}
				jobId={selectedJobForApplicants?.id}
				jobTitle={selectedJobForApplicants?.title}
			/>
		</div>
	);
};

export default RecruitmentAdmin;