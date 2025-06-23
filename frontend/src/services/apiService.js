import api from './authService';

export const clientService = {
  async getClients(params = {}) {
    const response = await api.get('/clients', { params });
    return response.data;
  },

  async getClient(id) {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  async createClient(data) {
    const response = await api.post('/clients', data);
    return response.data;
  },

  async updateClient(id, data) {
    const response = await api.put(`/clients/${id}`, data);
    return response.data;
  },

  async deleteClient(id) {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },

  async getClientStats() {
    const response = await api.get('/clients/stats/overview');
    return response.data;
  },
};

export const projectService = {
  async getProjects(params = {}) {
    const response = await api.get('/projects', { params });
    return response.data;
  },

  async getProject(id) {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  async createProject(data) {
    const response = await api.post('/projects', data);
    return response.data;
  },

  async updateProject(id, data) {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
  },

  async deleteProject(id) {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },

  async archiveProject(id, isArchived) {
    const response = await api.put(`/projects/${id}/archive`, { isArchived });
    return response.data;
  },

  async getProjectStats() {
    const response = await api.get('/projects/stats/overview');
    return response.data;
  },
};

export const taskService = {
  async getTasks(params = {}) {
    const response = await api.get('/tasks', { params });
    return response.data;
  },

  async getTask(id) {
    const response = await api.get(`/tasks/${id}`);
    return response.data;
  },

  async createTask(data) {
    const response = await api.post('/tasks', data);
    return response.data;
  },

  async updateTask(id, data) {
    const response = await api.put(`/tasks/${id}`, data);
    return response.data;
  },

  async deleteTask(id) {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  },

  async addComment(id, text) {
    const response = await api.post(`/tasks/${id}/comments`, { text });
    return response.data;
  },

  async updateChecklist(id, checklist) {
    const response = await api.put(`/tasks/${id}/checklist`, { checklist });
    return response.data;
  },

  async getTaskStats() {
    const response = await api.get('/tasks/stats/overview');
    return response.data;
  },
};

export const invoiceService = {
  async getInvoices(params = {}) {
    const response = await api.get('/invoices', { params });
    return response.data;
  },

  async getInvoice(id) {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },

  async createInvoice(data) {
    const response = await api.post('/invoices', data);
    return response.data;
  },

  async updateInvoice(id, data) {
    const response = await api.put(`/invoices/${id}`, data);
    return response.data;
  },

  async deleteInvoice(id) {
    const response = await api.delete(`/invoices/${id}`);
    return response.data;
  },

  async sendInvoice(id) {
    const response = await api.post(`/invoices/${id}/send`);
    return response.data;
  },

  async markPaid(id) {
    const response = await api.put(`/invoices/${id}/mark-paid`);
    return response.data;
  },

  async getInvoiceStats() {
    const response = await api.get('/invoices/stats/overview');
    return response.data;
  },
};

export const dashboardService = {
  async getOverview() {
    const response = await api.get('/dashboard/overview');
    return response.data;
  },

  async getRecentActivity(limit = 10) {
    const response = await api.get('/dashboard/recent-activity', {
      params: { limit },
    });
    return response.data;
  },

  async getUpcomingDeadlines(limit = 10, days = 7) {
    const response = await api.get('/dashboard/upcoming-deadlines', {
      params: { limit, days },
    });
    return response.data;
  },

  async getProductivityStats(period = 'week') {
    const response = await api.get('/dashboard/productivity-stats', {
      params: { period },
    });
    return response.data;
  },
};

