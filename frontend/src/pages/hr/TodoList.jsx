import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { getContrastColor } from 'utils/colorUtils';
import { todoService } from 'api/todoApi';
import { holidayApi } from 'api/holidayApi';
import { useAuth } from 'context/AuthContext';

import TodoSidebar from 'components/hr/TodoSidebar';
import TodoEditModal from 'components/hr/TodoEditModal';
import TodoDetailModal from 'components/common/TodoDetailModal';
import TodoTemplateModal from 'components/hr/TodoTemplateModal';

//import 'assets/css/layout.css';
import 'assets/css/calendar.css';

const TodoListView = () => {
	const [events, setEvents] = useState([]);
	const holidaysRef = useRef([]);
	const [categories, setCategories] = useState([]);
	const [colorModal, setColorModal] = useState({isOpen: false, targetCat: null, selectedColor: '#3DAF7A', selectedDescription: ''});
	const { userId } = useAuth();
	const calendarRef = useRef(null);
	const externalEventsRef = useRef(null);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [selectedDate, setSelectedDate] = useState(null);
	const [selectedEvent, setSelectedEvent] = useState(null);
	const [modalMode, setModalMode] = useState('create');

	const fetchCategoriesAndConfigs = useCallback(async () => {
		const fetchCategoriesTask = async () => {
			const [catRes, configRes] = await Promise.all([todoService.getCategories(), todoService.getTodoConfigs()]);
			return { catRes, configRes };
		};
		Notify.toastPromise(fetchCategoriesTask(), {
			loading: '카테고리 설정을 불러오는 중입니다...',
			success: '카테고리 설정을 불러왔습니다.',
			error: '카테고리 정보를 불러오지 못했습니다.'
		}).then(({ catRes, configRes }) => {
			const masterCategories = catRes.data;
			const userConfigs = configRes.data;
			const mergedCategories = masterCategories.map(cat => {
				const userConf = userConfigs.find(c => c.category_key === cat.category_key);
				return { ...cat, hasCustomConfig: !!userConf, color: userConf?.color || '#3DAF7A', default_description: userConf?.default_description || '' };
			});
			setCategories(mergedCategories);
		}).catch((err) => { 
			console.error("카테고리 및 설정 로드 실패", err); 
		});
	}, []);

	const fetchTodos = useCallback(async () => {
		const fetchTodosTask = async () => {
			const currentYear = new Date().getFullYear().toString();
			const [todoRes, holidayRes] = await Promise.all([todoService.getTodos(), holidayApi.getHolidays(currentYear)]);
			return { todoRes, holidayRes };
		};
		Notify.toastPromise(fetchTodosTask(), {
			loading: '일정 데이터를 불러오는 중입니다...',
			success: '일정 데이터를 불러왔습니다.',
			error: '일정 데이터를 불러오는데 실패했습니다.'
		}).then(({ todoRes, holidayRes }) => {
			const formattedTodos = todoRes.data.map(todo => {
				const isOwner = todo.user_id === userId;
				const endDate = new Date(todo.end_date);
				endDate.setSeconds(endDate.getSeconds() + 1);
				const nickname = todo.author?.user_nickname || '';
				const name = todo.author?.user_name || '';
				const eventTextColor = getContrastColor(todo.color);
				
				return {
					id: todo.id.toString(), title: `[${nickname}(${name})] ${todo.title}`,
					start: todo.start_date, end: endDate, allDay: true, backgroundColor: todo.color, borderColor: todo.color, textColor: eventTextColor,
					startEditable: isOwner, durationEditable: isOwner, extendedProps: { ...todo, isHoliday: false }, className: todo.category === 'vacation' ? 'event-vacation' : ''
				};
			});
			holidaysRef.current = holidayRes.data || [];
			setEvents(formattedTodos);
		}).catch((err) => { 
			console.error("데이터 로드 실패", err); 
		});
	}, [userId]);

	const handleSwitchToEdit = () => { setIsDetailOpen(false); setModalMode('edit'); setIsEditOpen(true); };
	const handleDateClick = (info) => { setSelectedDate({ start: info.dateStr, end: info.dateStr }); setModalMode('create'); setIsEditOpen(true); };
	const handleEventClick = (info) => { 
		const event = info.event.toPlainObject(); 
		const props = event.extendedProps; 
		if (props.isHoliday) return; 
		setSelectedEvent({ id: event.id, title: props.title || '제목 없음', start: props.start_date.split('T')[0], end: props.end_date.split('T')[0], category: props.category || 'report', color: event.backgroundColor, description: props.description || '', user_id: props.user_id, author: props.author }); 
		setIsDetailOpen(true); 
	};
	
	const handleEventUpdate = async (info) => {
		const { event } = info;
		if (event.extendedProps.isHoliday) { info.revert(); return; }

		const startStr = event.startStr || "";
		const startDate = startStr.includes('T') ? startStr.split('T')[0] + "T00:00:00" : startStr + "T00:00:00";
		const toLocalISO = (date) => new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('.')[0];
		
		let endDate;
		if (event.end) {
			const tempEnd = new Date(event.end);
			tempEnd.setSeconds(tempEnd.getSeconds() - 1);
			endDate = toLocalISO(tempEnd);
		} else { endDate = event.startStr.split('T')[0] + "T23:59:59"; }

		// 🌟 toastPromise 로 드래그 앤 드롭 수정 처리!
		Notify.toastPromise(
			todoService.updateTodo(event.id, {
				title: event.extendedProps.title, start_date: startDate, end_date: endDate,
				category: event.extendedProps.category || 'report', color: event.backgroundColor
			}),
			{
				loading: '일정을 수정하고 있습니다...',
				success: '일정이 성공적으로 변경되었습니다! 🔄',
				error: (e) => {
					info.revert();
					return e.response?.data?.detail || "일정 수정 중 오류가 발생했습니다.";
				}
			}
		).then(() => {
			fetchTodos();
		}).catch((err) => {
			console.error("일정 수정 실패:", err);
		});
	};

	const handleEventReceive = async (info) => {
		const { event } = info;
		const newTodo = {
			title: event.title,
			start_date: event.startStr.includes('T') ? event.startStr : `${event.startStr}T00:00:00`,
			end_date: event.startStr.includes('T') ? event.startStr : `${event.startStr}T23:59:59`,
			color: event.backgroundColor, 
			category: event.extendedProps?.category || 'report', 
			description: event.extendedProps?.description || '',
			status: "CREATED"
		};
		info.revert();
		Notify.toastPromise(
			todoService.createTodo(newTodo),
			{
				loading: '새로운 일정을 등록하고 있습니다...',
				success: '일정이 성공적으로 등록되었습니다! 🎉',
				error: (e) => e.response?.data?.detail || "일정 등록 중 오류가 발생했습니다."
			}
		).then(() => {
			fetchTodos(); 
		}).catch((err) => {
			console.error("일정 등록 실패:", err);
		});
	};

	const openColorModal = (cat) => { setColorModal({ isOpen: true, targetCat: cat, selectedColor: cat.color, selectedDescription: cat.default_description || '' }); };

	useEffect(() => { 
		fetchTodos(); fetchCategoriesAndConfigs();
		let draggable;
		if (externalEventsRef.current) {
			draggable = new Draggable(externalEventsRef.current, {
				itemSelector: '.fc-event',
				eventData: (eventEl) => ({ title: eventEl.getAttribute('data-title'), color: eventEl.getAttribute('data-color'), extendedProps: { category: eventEl.getAttribute('data-category'), description: eventEl.getAttribute('data-description') } }),
			});
		}
		return () => { if (draggable) draggable.destroy(); };
	}, [fetchTodos, fetchCategoriesAndConfigs]);

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
					events={events}
					editable={true}
					droppable={true}
					dayCellContent={(arg) => { 
						const dateStr = new Date(arg.date.getTime() - (arg.date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
						const holiday = holidaysRef.current.find(h => h.holiday_date === dateStr);
						const isHoliday = !!holiday;
						let dateColor = '';
						if (isHoliday) { dateColor = '#FF4B4B'; } else if (arg.date.getDay() === 0) { dateColor = '#FF4B4B'; } else if (arg.date.getDay() === 6) { dateColor = '#2E8AF6'; }
						return (
							<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '100%', padding: '2px 4px' }}>
								<span style={{ color: dateColor, fontWeight: isHoliday ? 'bold' : 'normal' }}>{arg.dayNumberText}</span>
								{isHoliday && <span style={{ fontSize: '0.75rem', color: '#FF4B4B', fontWeight: 'bold', marginTop: '2px' }}>{holiday.holiday_name}</span>}
							</div>
						);
					}}
					eventAllow={(dropInfo, draggedEvent) => {
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
					eventDrop={handleEventUpdate}
					eventResize={handleEventUpdate}
					eventReceive={handleEventReceive}
				/>
			</section>
			
			{/* 🌟 지저분했던 인라인 모달이 컴포넌트 한 줄로 깔끔해졌습니다! */}
			<TodoTemplateModal isOpen={colorModal.isOpen} onClose={() => setColorModal({...colorModal, isOpen: false})} colorModal={colorModal} setColorModal={setColorModal} fetchCategoriesAndConfigs={fetchCategoriesAndConfigs} />

			<TodoEditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} mode={modalMode} selectedDate={selectedDate} event={selectedEvent} fetchTodos={fetchTodos} categories={categories} />
			<TodoDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} event={selectedEvent} fetchTodos={fetchTodos} onEditClick={handleSwitchToEdit} categories={categories} />
		</div>
	);
};

export default TodoListView;