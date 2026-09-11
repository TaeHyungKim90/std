import { client } from './axiosInstance';

export const expenseApi = {
  list: (admin, params) => client.get(admin ? '/admin/expenses' : '/hr/expenses', { params }).then(r => r.data),
  get: (admin, id) => client.get(`${admin ? '/admin' : '/hr'}/expenses/${id}`).then(r => r.data),
  create: () => client.post('/hr/expenses').then(r => r.data),
  save: (id, data) => client.put(`/hr/expenses/${id}`, data).then(r => r.data),
  action: (admin, id, action, data) => client.post(`${admin ? '/admin' : '/hr'}/expenses/${id}/${action}`, data).then(r => r.data),
  receipt: (id, file, version) => {
    const data = new FormData();
    data.append('file', file);
    data.append('version', version);
    return client.post(`/hr/expenses/${id}/receipt`, data).then(r => r.data);
  },
  download: id => client.get(`/common/files/${id}`, { responseType: 'blob' }).then(r => r.data),
};
