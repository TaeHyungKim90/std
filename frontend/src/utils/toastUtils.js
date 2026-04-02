import toast from 'react-hot-toast';

export const toastWarn = (msg, opts = {}) =>
	toast(msg, {
		icon: '⚠️',
		style: { background: '#FFF3CD', color: '#856404' },
		duration: 5000,
		...opts,
	});
export const toastInfo = (msg) => toast(msg, { icon: '💡', style: { background: '#E2E3E5', color: '#383D41' }});

export const toastSuccess = toast.success;
export const toastError = toast.error;
export const toastLoading = toast.loading;
export const toastPromise = toast.promise;