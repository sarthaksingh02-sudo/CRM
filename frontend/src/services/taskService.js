import api from './api';

export const taskService = {
    list: (params) => api.get('/tasks/', { params }),
    get: (id) => api.get(`/tasks/${id}`),
    create: (data) => api.post('/tasks/', data),
    update: (id, data) => api.patch(`/tasks/${id}`, data),
    delete: (id) => api.delete(`/tasks/${id}`),

    // State machine
    start: (id) => api.patch(`/tasks/${id}/start`),
    updateProgress: (id, progress_percentage) =>
        api.patch(`/tasks/${id}/progress`, { progress_percentage }),
    submitReview: (id) => api.patch(`/tasks/${id}/submit-review`),
    reviewDecision: (id, data) => api.patch(`/tasks/${id}/review-decision`, data),

    // Sub-resources
    getComments: (id) => api.get(`/tasks/${id}/comments`),
    addComment: (id, content) => api.post(`/tasks/${id}/comments`, { content }),
    getAuditLog: (id) => api.get(`/tasks/${id}/audit`),

    // Metrics
    deptMetrics: () => api.get('/tasks/metrics/department'),
    personalMetrics: () => api.get('/tasks/metrics/personal'),
};

export const userService = {
    list: (params) => api.get('/users/', { params }),
    get: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users/', data),
    update: (id, data) => api.patch(`/users/${id}`, data),
    deactivate: (id) => api.patch(`/users/${id}/deactivate`),
    reactivate: (id) => api.patch(`/users/${id}/reactivate`),
};

export const deptService = {
    list: () => api.get('/departments/'),
    create: (name) => api.post('/departments/', { name }),
    monthlyReport: (id) => api.get(`/departments/${id}/monthly-report`),
};
