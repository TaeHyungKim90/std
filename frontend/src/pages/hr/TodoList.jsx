import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { attendanceApi } from 'api/attendanceApi';
import { holidayApi } from 'api/holidayApi';
import { todoService } from 'api/todoApi';
import TodoDetailModal from 'components/common/TodoDetailModal';
import TodoEditModal from 'components/hr/TodoEditModal';
import TodoSidebar from 'components/hr/TodoSidebar';
import TodoTemplateModal from 'components/hr/TodoTemplateModal';
import { useAuth } from 'context/AuthContext';
import { useLoading } from 'context/LoadingContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getContrastColor } from 'utils/colorUtils';
import {
	fcAllDaySpanToInclusiveYmd,
	getEmploymentRangeError,
	seoulYmdAddDays,
	todoDbToFullCalendarAllDayRange,
	toSeoulYmd,
} from 'utils/employmentDateUtils';
import { formatApiDetail } from 'utils/formatApiError';
import * as Notify from 'utils/toastUtils';
import {
	hasOwnVacationOnDate,
	hasOwnVacationOverlappingRange,
	MY_VACATION_OVERLAP_MESSAGE,
	VACATION_DEDUCTIBLE_CATEGORIES,
} from 'utils/todoVacationUtils';

function formatAttendanceStampTitle(stamp, userNickname, userName) {
	const nick = userNickname || userName || '직원';
	const name = userName || nick;
	const prefix = `[${nick}(${name})]`;
	if (stamp.image_key === 'vacation') {
		return `${prefix} ${stamp.vacation_label || '휴가'}`;
	}
	const short =
		stamp.image_key === 'attendance_complete'
			? '출근 완료'
			: stamp.image_key === 'clock_in'
				? '출근'
				: stamp.image_key === 'clock_out'
					? '퇴근'
					: stamp.label;
	return `${prefix} ${short}`;
}

function attendanceStampShortText(imageKey) {
	if (imageKey === 'vacation') return '휴가';
	if (imageKey === 'clock_in') return '출근';
	if (imageKey === 'clock_out') return '퇴근';
	return '완료';
}

const TodoListView = () => {
	const [events, setEvents] = useState([]);
	const [stampEvents, setStampEvents] = useState([]);
	const holidaysRef = useRef([]);
	const [categories, setCategories] = useState([]);
	const [colorModal, setColorModal] = useState({isOpen: false, targetCat: null, selectedColor: '#3FAF7A', selectedDescription: ''});
	const { userId, userName, userNickname, joinDate, resignationDate } = useAuth();

	const employmentValidRange = useMemo(() => {
		const o = {};
		if (joinDate) {
			const j = toSeoulYmd(joinDate);
			if (j) o.start = j;
		}
		if (resignationDate) {
			const r = toSeoulYmd(resignationDate);
			if (r) o.end = seoulYmdAddDays(r, 1);
		}
		return Object.keys(o).length ? o : undefined;
	}, [joinDate, resignationDate]);
	const { showLoading, hideLoading } = useLoading();
	const calendarRef = useRef(null);
	const externalEventsRef = useRef(null);
	const calendarViewRef = useRef({
		year: new Date().getFullYear(),
		month: new Date().getMonth() + 1,
	});
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [selectedDate, setSelectedDate] = useState(null);
	const [selectedEvent, setSelectedEvent] = useState(null);
	const [modalMode, setModalMode] = useState('create');
	const [editModalKey, setEditModalKey] = useState(0);
	const defaultCategoryKey = categories[0]?.category_key || null;

	const calendarEvents = useMemo(() => [...events, ...stampEvents], [events, stampEvents]);

	const fetchCategoriesAndConfigs = useCallback(async () => {
		const [catRes, configRes] = await Promise.all([todoService.getCategories(), todoService.getTodoConfigs()]);
		const masterCategories = catRes.data;
		const userConfigs = configRes.data;
		const mergedCategories = masterCategories
			.map((cat) => {
				const userConf = userConfigs.find((c) => c.category_key === cat.category_key);
				return {
					...cat,
					hasCustomConfig: !!userConf,
					color: userConf?.color || '#3FAF7A',
					default_description: userConf?.default_description || '',
				};
			});
		setCategories(mergedCategories);
	}, []);

	const fetchTodos = useCallback(async () => {
		const currentYear = new Date().getFullYear().toString();
		const [todoRes, holidayRes] = await Promise.all([todoService.getTodos(), holidayApi.getHolidays(currentYear)]);
		const formattedTodos = todoRes.data
			.map((todo) => {
			const isOwner = todo.user_id === userId;
			const nickname = todo.author?.user_nickname || '';
			const name = todo.author?.user_name || '';
			const eventTextColor = getContrastColor(todo.color);

			/* DB: 종료일 당일 23:59:59(포함). FC 종일: 배타적 end = 포함 종료일 +1일 (날짜만, floating). */
			const range =
				todoDbToFullCalendarAllDayRange(todo.start_date, todo.end_date) ?? {
					start: toSeoulYmd(todo.start_date),
					end: seoulYmdAddDays(toSeoulYmd(todo.end_date ?? todo.start_date), 1),
				};

			return {
				id: todo.id.toString(), title: `[${nickname}(${name})] ${todo.title}`,
				start: range.start,
				end: range.end,
				allDay: true,
				display: 'block',
				backgroundColor: todo.color, borderColor: todo.color, textColor: eventTextColor,
				startEditable: isOwner, durationEditable: isOwner, extendedProps: { ...todo, isHoliday: false }, className: todo.category === 'vacation' ? 'event-vacation' : ''
			};
		});
		holidaysRef.current = holidayRes.data || [];
		setEvents(formattedTodos);
	}, [userId]);

	const fetchAttendanceStamps = useCallback(async (year, month) => {
		try {
			const res = await attendanceApi.getCalendarStamps({ year, month });
			const stamps = Array.isArray(res.data?.items) ? res.data.items : [];
			setStampEvents(
				stamps.map((stamp) => ({
					id: `attendance-stamp-${stamp.work_date}-${stamp.stamp_type}`,
					title: formatAttendanceStampTitle(stamp, userNickname, userName),
					start: stamp.work_date,
					allDay: true,
					editable: false,
					startEditable: false,
					durationEditable: false,
					display: 'block',
					className: `attendance-stamp-event attendance-stamp-event--${stamp.image_key}`,
					extendedProps: {
						...stamp,
						isAttendanceStamp: true,
					},
				}))
			);
		} catch (err) {
			Notify.toastApiFailure(err, '출퇴근 도장을 불러오지 못했습니다.');
		}
	}, [userName, userNickname]);

	const handleCalendarDatesSet = useCallback((arg) => {
		const baseDate = arg.view.currentStart || arg.start || new Date();
		calendarViewRef.current = {
			year: baseDate.getFullYear(),
			month: baseDate.getMonth() + 1,
		};
		void fetchAttendanceStamps(calendarViewRef.current.year, calendarViewRef.current.month);
	}, [fetchAttendanceStamps]);

	const refreshCalendarAfterMutation = useCallback(() => {
		const { year, month } = calendarViewRef.current;
		return Promise.all([fetchTodos(), fetchAttendanceStamps(year, month)]).catch((err) => {
			Notify.toastApiFailure(err, '캘린더를 새로고침하지 못했습니다.');
		});
	}, [fetchTodos, fetchAttendanceStamps]);

	const refreshCategoriesAfterSave = useCallback(() => {
		return fetchCategoriesAndConfigs().catch((err) => {
			Notify.toastApiFailure(err, "카테고리 정보를 불러오지 못했습니다.");
		});
	}, [fetchCategoriesAndConfigs]);

	const hasMyVacationOnDate = useCallback(
		(ymd) => hasOwnVacationOnDate(events, ymd, userId),
		[events, userId]
	);

	const hasMyVacationInRange = useCallback(
		(startYmd, endYmd) => hasOwnVacationOverlappingRange(events, startYmd, endYmd, userId),
		[events, userId]
	);

	const warnMyVacationOverlap = useCallback(() => {
		Notify.toastWarn(MY_VACATION_OVERLAP_MESSAGE);
	}, []);

	const handleSwitchToEdit = () => {
		setIsDetailOpen(false);
		setModalMode('edit');
		setEditModalKey((prev) => prev + 1);
		setIsEditOpen(true);
	};
	const handleDateClick = (info) => {
		const ymd = toSeoulYmd(info.date);
		const err = getEmploymentRangeError(ymd, ymd, joinDate, resignationDate);
		if (err) {
			Notify.toastWarn(err);
			return;
		}
		if (hasMyVacationOnDate(ymd)) {
			warnMyVacationOverlap();
			return;
		}
		setSelectedDate({ start: ymd, end: ymd });
		setSelectedEvent(null);
		setModalMode('create');
		setEditModalKey((prev) => prev + 1);
		setIsEditOpen(true);
	};
	const handleEventClick = (info) => { 
		const event = info.event.toPlainObject(); 
		const props = event.extendedProps; 
		if (props.isHoliday || props.isAttendanceStamp) return; 
		const fallbackCat = defaultCategoryKey;
		setSelectedEvent({ id: event.id, title: props.title || '제목 없음', start: props.start_date.split('T')[0], end: props.end_date.split('T')[0], category: props.category || fallbackCat, color: event.backgroundColor, description: props.description || '', user_id: props.user_id, author: props.author }); 
		setIsDetailOpen(true); 
	};
	
	const handleEventUpdate = async (info) => {
		const { event } = info;
		if (event.extendedProps.isHoliday) { info.revert(); return; }
		const categoryKey = event.extendedProps.category || defaultCategoryKey;
		if (!categoryKey) {
			info.revert();
			Notify.toastError("기본 카테고리 정보가 없어 일정을 수정할 수 없습니다.");
			return;
		}

		const span = fcAllDaySpanToInclusiveYmd(event.start, event.end);
		const empErr = getEmploymentRangeError(span.startYmd, span.endYmd, joinDate, resignationDate);
		if (empErr) {
			info.revert();
			Notify.toastWarn(empErr);
			return;
		}

		const ymdOk = /^\d{4}-\d{2}-\d{2}$/.test(span.startYmd) && /^\d{4}-\d{2}-\d{2}$/.test(span.endYmd);
		let startDate;
		let endDate;
		if (ymdOk) {
			startDate = `${span.startYmd}T00:00:00`;
			endDate = `${span.endYmd}T23:59:59`;
		} else {
			const startStr = event.startStr || "";
			startDate = startStr.includes('T') ? startStr.split('T')[0] + "T00:00:00" : `${startStr}T00:00:00`;
			if (event.end) {
				const tempEnd = new Date(event.end);
				tempEnd.setSeconds(tempEnd.getSeconds() - 1);
				const y = tempEnd.getFullYear();
				const m = String(tempEnd.getMonth() + 1).padStart(2, '0');
				const d = String(tempEnd.getDate()).padStart(2, '0');
				endDate = `${y}-${m}-${d}T23:59:59`;
			} else {
				endDate = `${event.startStr.split('T')[0]}T23:59:59`;
			}
		}

		// 🌟 toastPromise 로 드래그 앤 드롭 수정 처리!
		Notify.toastPromise(
			todoService.updateTodo(event.id, {
				title: event.extendedProps.title, start_date: startDate, end_date: endDate,
				category: categoryKey, color: event.backgroundColor
			}),
			{
				loading: '일정을 수정하고 있습니다...',
				success: '일정이 성공적으로 변경되었습니다! 🔄',
				error: (e) => {
					info.revert();
					return (
						formatApiDetail(e) ||
						"일정 수정 중 오류가 발생했습니다."
					);
				}
			}
		).then(() => {
			refreshCalendarAfterMutation();
		}).catch((err) => {
			console.error("일정 수정 실패:", err);
		});
	};

	const handleSelect = (info) => {
		const span = fcAllDaySpanToInclusiveYmd(info.start, info.end);
		const empErr = getEmploymentRangeError(span.startYmd, span.endYmd, joinDate, resignationDate);
		if (empErr) {
			Notify.toastWarn(empErr);
			info.view.calendar.unselect();
			return;
		}
		if (hasMyVacationInRange(span.startYmd, span.endYmd)) {
			warnMyVacationOverlap();
			info.view.calendar.unselect();
			return;
		}
		setSelectedDate({ start: span.startYmd, end: span.endYmd });
		setSelectedEvent(null);
		setModalMode('create');
		setEditModalKey((prev) => prev + 1);
		setIsEditOpen(true);
		info.view.calendar.unselect();
	};

	const handleEventReceive = async (info) => {
		const { event } = info;
		const fallbackCat = defaultCategoryKey;
		if (!fallbackCat) {
			info.revert();
			Notify.toastError("기본 카테고리 정보가 없어 일정을 등록할 수 없습니다.");
			return;
		}
		const dropYmd = toSeoulYmd(event.startStr || event.start);
		const empErr = getEmploymentRangeError(dropYmd, dropYmd, joinDate, resignationDate);
		if (empErr) {
			info.revert();
			Notify.toastWarn(empErr);
			return;
		}
		const dropCategory = event.extendedProps?.category || fallbackCat;
		if (
			VACATION_DEDUCTIBLE_CATEGORIES.has(dropCategory) &&
			hasMyVacationOnDate(dropYmd)
		) {
			info.revert();
			warnMyVacationOverlap();
			return;
		}
		const newTodo = {
			title: event.title,
			start_date: event.startStr.includes('T') ? event.startStr : `${event.startStr}T00:00:00`,
			end_date: event.startStr.includes('T') ? event.startStr : `${event.startStr}T23:59:59`,
			color: event.backgroundColor, 
			category: dropCategory,
			description: event.extendedProps?.description || '',
			status: "CREATED"
		};
		info.revert();
		Notify.toastPromise(
			todoService.createTodo(newTodo),
			{
				loading: '새로운 일정을 등록하고 있습니다...',
				success: '일정이 성공적으로 등록되었습니다! 🎉',
				error: (e) =>
					formatApiDetail(e) ||
					"일정 등록 중 오류가 발생했습니다."
			}
		).then(() => {
			refreshCalendarAfterMutation();
		}).catch((err) => {
			console.error("일정 등록 실패:", err);
		});
	};

	const openColorModal = (cat) => { setColorModal({ isOpen: true, targetCat: cat, selectedColor: cat.color, selectedDescription: cat.default_description || '' }); };

	useEffect(() => {
		let cancelled = false;
		let draggable;

		(async () => {
			showLoading("캘린더 초기 데이터를 불러오는 중입니다... ⏳");
			try {
				await Promise.all([fetchCategoriesAndConfigs(), fetchTodos()]);
			} catch (err) {
				Notify.toastApiFailure(err, "초기 데이터를 불러오지 못했습니다.");
			} finally {
				if (!cancelled) hideLoading();
			}

			if (cancelled || !externalEventsRef.current) return;

			draggable = new Draggable(externalEventsRef.current, {
				itemSelector: '.fc-event',
				eventData: (eventEl) => ({ title: eventEl.getAttribute('data-title'), color: eventEl.getAttribute('data-color'), extendedProps: { category: eventEl.getAttribute('data-category'), description: eventEl.getAttribute('data-description') } }),
			});
		})();

		return () => {
			cancelled = true;
			if (draggable) draggable.destroy();
		};
	}, [fetchTodos, fetchCategoriesAndConfigs, showLoading, hideLoading]);

	return (
		<div className="calendar-page-container">
			<TodoSidebar ref={externalEventsRef} categories={categories} openColorModal={openColorModal} />
			<section id="calendar-container" className="calendar-main">
				<FullCalendar
					ref={calendarRef}
					plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
					initialView="dayGridMonth"
					headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
					locale="ko"
					timeZone="Asia/Seoul"
					validRange={employmentValidRange}
					events={calendarEvents}
					editable={true}
					droppable={true}
					dayCellContent={(arg) => {
						const dateStr = toSeoulYmd(arg.date);
						const holiday = holidaysRef.current.find(h => h.holiday_date === dateStr);
						const isHoliday = !!holiday;
						let dateColor = '';
						if (isHoliday) {
							dateColor = '#FF4B4B';
						} else if (arg.date.getDay() === 0) {
							dateColor = '#FF4B4B';
						} else if (arg.date.getDay() === 6) {
							dateColor = '#2E8AF6';
						}
						return (
							<div className={`fc-day-cell-custom${isHoliday ? ' fc-day-cell-custom--holiday' : ''}`}>
								{isHoliday && (
									<span className="fc-holiday-label" title={holiday.holiday_name} aria-label={holiday.holiday_name}>
										{holiday.holiday_name}
									</span>
								)}
								<span className="fc-day-number-text" style={{ color: dateColor, fontWeight: isHoliday ? 'bold' : 'normal' }}>
									{arg.dayNumberText}
								</span>
							</div>
						);
					}}
					selectable
					selectMirror
					select={handleSelect}
					selectAllow={(selectInfo) => {
						const span = fcAllDaySpanToInclusiveYmd(selectInfo.start, selectInfo.end);
						if (
							getEmploymentRangeError(span.startYmd, span.endYmd, joinDate, resignationDate) != null
						) {
							return false;
						}
						return !hasMyVacationInRange(span.startYmd, span.endYmd);
					}}
					eventAllow={(dropInfo, draggedEvent) => {
						const span = fcAllDaySpanToInclusiveYmd(dropInfo.start, dropInfo.end);
						if (
							getEmploymentRangeError(span.startYmd, span.endYmd, joinDate, resignationDate) != null
						) {
							return false;
						}
						const category = draggedEvent.extendedProps.category;
						if (category === "vacation_am" || category === "vacation_pm") {
							const startDate = new Date(dropInfo.start);
							const endDate = new Date(dropInfo.end);
							const diffTime = Math.abs(endDate - startDate);
							const diffDays = diffTime / (1000 * 60 * 60 * 24);
							if (diffDays > 1) {
								Notify.toastWarn("반차는 하루 이상 등록할 수 없습니다. 🚫");
								return false;
							}
						}
						return true;
					}}
					eventResizableFromStart={false}
					eventDurationEditable={true}
					dateClick={handleDateClick}
					eventClick={handleEventClick}
					datesSet={handleCalendarDatesSet}
					eventDrop={handleEventUpdate}
					eventResize={handleEventUpdate}
					eventReceive={handleEventReceive}
					eventOrder={(a, b) => {
						const aStamp = a.extendedProps?.isAttendanceStamp ? 1 : 0;
						const bStamp = b.extendedProps?.isAttendanceStamp ? 1 : 0;
						return aStamp - bStamp;
					}}
					eventContent={(arg) => {
						/* undefined면 FC v6에서 제목이 안 그려짐 → 일정 바는 true로 기본 렌더 */
						if (!arg.event.extendedProps?.isAttendanceStamp) return true;
						const imageKey = arg.event.extendedProps.image_key;
						const label = arg.event.title || arg.event.extendedProps.label;
						if (imageKey === 'attendance_complete') {
							return (
								<span
									className="attendance-stamp-event__stamp attendance-stamp-event__stamp--stacked"
									title={label}
									aria-label={label}
								>
									<span className="attendance-stamp-event__line">출근</span>
									<span className="attendance-stamp-event__line">완료</span>
								</span>
							);
						}
						const text = attendanceStampShortText(imageKey);
						return (
							<span className="attendance-stamp-event__stamp" title={label} aria-label={label}>
								{text}
							</span>
						);
					}}
				/>
			</section>
			
			{/* 🌟 지저분했던 인라인 모달이 컴포넌트 한 줄로 깔끔해졌습니다! */}
			<TodoTemplateModal isOpen={colorModal.isOpen} onClose={() => setColorModal({...colorModal, isOpen: false})} colorModal={colorModal} setColorModal={setColorModal} fetchCategoriesAndConfigs={refreshCategoriesAfterSave} />

			<TodoEditModal key={editModalKey} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} mode={modalMode} selectedDate={selectedDate} event={selectedEvent} fetchTodos={refreshCalendarAfterMutation} categories={categories} />
			<TodoDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} event={selectedEvent} fetchTodos={refreshCalendarAfterMutation} onEditClick={handleSwitchToEdit} categories={categories} />
		</div>
	);
};

export default TodoListView;