import React, { useState, useEffect, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';
import { useLoading } from 'context/LoadingContext';
import { useNavigate } from 'react-router-dom';
import { recruitmentApi } from 'api/recruitmentApi';
import PaginationBar from 'components/common/PaginationBar';
import { usePaginationSearchParams } from 'hooks/usePaginationSearchParams';

const PAGE_SIZE = 12;

const JobListPage = () => {
	const { showLoading, hideLoading } = useLoading();
	const [jobs, setJobs] = useState([]);
	const [total, setTotal] = useState(null);
	const [page, setPage] = usePaginationSearchParams({ pageSize: PAGE_SIZE, total });
	const navigate = useNavigate();

	const fetchJobs = useCallback(async () => {
		showLoading('채용 공고를 불러오는 중입니다... ⏳');
		try {
			const skip = (page - 1) * PAGE_SIZE;
			const res = await recruitmentApi.getPublicJobs({ skip, limit: PAGE_SIZE });
			const d = res.data;
			setJobs(Array.isArray(d?.items) ? d.items : []);
			setTotal(typeof d?.total === 'number' ? d.total : 0);
		} catch (error) {
			console.error('공고 로드 실패', error);
			Notify.toastError(error.message || '공고를 불러오지 못했습니다.');
		} finally {
			hideLoading();
		}
	}, [page, showLoading, hideLoading]);

	useEffect(() => {
		fetchJobs();
	}, [fetchJobs]);

	return (
		<div className="careers-content-wrapper">
			<header className="careers-header">
				<h1>채용 공고</h1>
				<p>우리를 가슴 뛰게 할 당신을 기다립니다.</p>
			</header>
			<div>
				{total === 0 ? (
					<div className="glass-box job-list__empty-glass">
						현재 진행 중인 채용 공고가 없습니다.
					</div>
				) : (
					<>
						<div className="job-cards">
							{jobs.map((job, index) => (
								<div
									key={job.id}
									className="job-card stagger-item"
									style={{ animationDelay: `${index * 0.04}s` }}
									onClick={() => navigate(`/careers/${job.id}`, { state: { job } })}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											navigate(`/careers/${job.id}`, { state: { job } });
										}
									}}
									role="button"
									tabIndex={0}
								>
									<h3>{job.title}</h3>
									<p className="deadline">
										마감일:{' '}
										{job.deadline ? new Date(job.deadline).toLocaleDateString() : '상시채용'}
									</p>
								</div>
							))}
						</div>
						{jobs.length === 0 && (
							<p className="job-list__page-empty">이 페이지에 표시할 공고가 없습니다.</p>
						)}
						<PaginationBar page={page} pageSize={PAGE_SIZE} total={total ?? 0} onPageChange={setPage} />
					</>
				)}
			</div>
		</div>
	);
};

export default JobListPage;
