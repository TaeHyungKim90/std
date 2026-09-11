import 'assets/css/expense.css';

import { expenseApi } from 'api/expenseApi';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

const labels = { DRAFT: '임시저장', REQUESTED: '결재 요청', APPROVED: '승인', REJECTED: '반려', WITHDRAWN: '회수', ACCOUNTED: '회계처리 완료', CANCELED: '취소' };
const fields = [
  ['expense_date', '지출일자', 'date'], ['expense_type', '지출구분'], ['account_code', '계정과목'],
  ['merchant_name', '거래처'], ['business_number', '사업자등록번호'],
  ['supply_amount', '공급가액', 'number'], ['vat_amount', '부가세', 'number'], ['total_amount', '합계금액', 'number'],
  ['payment_method', '결제수단'], ['masked_card_number', '카드번호 (****1234)'], ['purpose', '사용목적'], ['memo', '비고'],
];
const actions = { DRAFT: [['submit', '결재 요청'], ['cancel', '작성 취소']], REQUESTED: [['withdraw', '상신 회수']], REJECTED: [['reopen', '수정 후 재상신']], WITHDRAWN: [['reopen', '다시 작성']] };
const adminActions = { REQUESTED: [['approve', '승인'], ['reject', '반려']], APPROVED: [['account', '회계처리 완료']] };

export default function Expenses() {
  const { tenantSlug, expenseId } = useParams();
  const location = useLocation();
  const admin = location.pathname.startsWith(`/${tenantSlug}/admin/`);
  const base = `/${tenantSlug}/${admin ? 'admin' : 'my'}/expenses`;
  const navigate = useNavigate();
  const [listing, setListing] = useState({ items: [], total: 0 });
  const [report, setReport] = useState(null);
  const [form, setForm] = useState({});
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [comment, setComment] = useState('');
  const [preview, setPreview] = useState('');
  const accept = useCallback(row => {
    setReport(row);
    setForm(Object.fromEntries(fields.map(([key]) => [key, row[key] ?? ''])));
    setReviewed(false);
    setComment('');
  }, []);
  useEffect(() => {
    let active = true;
    setReport(null);
    setError('');
    const request = expenseId ? expenseApi.get(admin, expenseId) : expenseApi.list(admin, { status: status || undefined, skip: page * 20, limit: 20 });
    request.then(data => { if (active) { if (expenseId) accept(data); else setListing(data); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [admin, expenseId, status, page, accept]);
  useEffect(() => {
    let active = true;
    let url;
    setPreview('');
    if (report?.receipt_file_id) {
      expenseApi.download(report.receipt_file_id).then(blob => {
        if (active) { url = URL.createObjectURL(blob); setPreview(url); }
      }).catch(e => { if (active) setError(e.message); });
    }
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [report?.receipt_file_id]);
  const run = async task => {
    setBusy(true); setError('');
    try { await task(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const save = async () => {
    const payload = Object.fromEntries(fields.map(([key, , type]) => [key, type === 'number' ? (form[key] || '0') : (form[key] || null)]));
    const row = await expenseApi.save(report.id, { ...payload, version: report.version });
    accept(row);
    return row;
  };
  const act = action => run(async () => {
    const row = action === 'submit' ? await save() : report;
    accept(await expenseApi.action(admin, row.id, action, { version: row.version, comment: comment || null, reviewed }));
  });
  const editable = !admin && report?.status === 'DRAFT';

  return <section className="expense-page">
    <header><h1>{admin ? '지출결의서 관리' : '내 지출결의서'}</h1>{expenseId && <Link to={base}>목록으로</Link>}</header>
    {error && <p role="alert" className="expense-error">{error}</p>}
    {!expenseId ? <div className="expense-panel">
      <div className="expense-actions expense-toolbar">
        {!admin && <button className="expense-primary" disabled={busy} onClick={() => run(async () => { const row = await expenseApi.create(); navigate(`${base}/${row.id}`); })}>새 지출결의서</button>}
        <label>상태 <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">전체</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <div className="expense-table"><table><thead><tr><th>결의번호</th><th>신청자</th><th>지출일자</th><th>거래처</th><th>금액</th><th>상태</th></tr></thead><tbody>
        {listing.items.map(row => <tr key={row.id}><td><Link to={`${base}/${row.id}`}>{row.report_no}</Link></td><td>{row.user_id}</td><td>{row.expense_date}</td><td>{row.merchant_name || '미입력'}</td><td>{row.total_amount}</td><td>{labels[row.status]}</td></tr>)}
      </tbody></table></div>
      {!listing.items.length && <p className="expense-empty">지출결의서가 없습니다.</p>}
      <div className="expense-actions expense-pagination"><button disabled={!page} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} 페이지 · 총 {listing.total}건</span><button disabled={(page + 1) * 20 >= listing.total} onClick={() => setPage(page + 1)}>다음</button></div>
    </div> : report ? <div className="expense-panel">
      <p><strong className="expense-status">{labels[report.status]}</strong> · {report.user_id} · {report.department || '부서 미등록'}</p>
      <p>{report.report_no}</p>
      {preview && <img className="expense-preview" src={preview} alt="첨부 영수증" />}
      <fieldset disabled={busy}>
        {editable && <label className="expense-upload">영수증 이미지 (JPG/PNG, 10MB 이하)<input type="file" accept="image/jpeg,image/png" onChange={e => {
          const file = e.target.files[0]; e.target.value = '';
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) { setError('10MB 이하 파일을 선택해 주세요.'); return; }
          run(async () => {
            const saved = await save();
            const row = await expenseApi.receipt(saved.id, file, saved.version);
            accept(row);
            if (row.ocr?.status === 'SUCCEEDED') setForm(previous => ({ ...previous, ...Object.fromEntries(fields.filter(([key]) => row.ocr.data[key] != null).map(([key]) => [key, row.ocr.data[key]])) }));
          });
        }} /></label>}
        {report.ocr && <p role="status">{report.ocr.status === 'FAILED' ? 'OCR 분석에 실패했습니다. 영수증은 저장되었으며 직접 입력할 수 있습니다.' : report.ocr.ocr_provider === 'mock' ? 'Mock OCR: 실제 영수증을 읽지 않은 예시 데이터입니다. 모든 값을 확인하고 수정해 주세요.' : 'OCR 결과를 확인하고 수정해 주세요.'}</p>}
        {report.receipt_file_id && <button type="button" onClick={() => run(async () => {
          const blob = await expenseApi.download(report.receipt_file_id);
          const url = URL.createObjectURL(blob); const link = document.createElement('a');
          link.href = url; link.download = `receipt-${report.id}.${blob.type === 'image/png' ? 'png' : 'jpg'}`; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        })}>영수증 다운로드</button>}
        <div className="expense-form">{fields.map(([key, label, type]) => <label key={key} className={key === 'purpose' || key === 'memo' ? 'expense-wide' : undefined}>{label}<input type={type || 'text'} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} readOnly={!editable} value={form[key] ?? ''} onChange={e => { setForm({ ...form, [key]: e.target.value }); setReviewed(false); }} /></label>)}</div>
        {editable && <label className="expense-check"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />영수증과 입력 내용을 확인했습니다.</label>}
        {(admin ? adminActions : actions)[report.status]?.length > 0 && <label>의견 (반려 시 필수)<textarea value={comment} maxLength={2000} onChange={e => setComment(e.target.value)} /></label>}
        <div className="expense-actions expense-submit-actions">
          {editable && <button onClick={() => run(save)}>임시저장</button>}
          {((admin ? adminActions : actions)[report.status] || []).map(([action, label]) => <button key={action} className={['submit', 'approve', 'account'].includes(action) ? 'expense-primary' : ['cancel', 'reject'].includes(action) ? 'expense-danger' : undefined} disabled={(action === 'submit' && !reviewed) || (action === 'reject' && !comment.trim())} onClick={() => act(action)}>{label}</button>)}
        </div>
      </fieldset>
      {busy && <p role="status">처리 중입니다…</p>}
      <h2>결재 이력</h2>
      {!report.history.length && <p>아직 결재 이력이 없습니다.</p>}
      <ol>{report.history.map(h => <li key={h.id}>{labels[h.from_status]} → {labels[h.to_status]} · {h.actor_id} · {h.created_at}<p>{h.comment}</p></li>)}</ol>
      <p>회계처리 완료는 회계 반영을 뜻하며 실제 지급을 실행하지 않습니다.</p>
    </div> : <p>불러오는 중입니다…</p>}
  </section>;
}
