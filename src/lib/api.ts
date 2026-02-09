const API_BASE = '/api';
const REQUEST_TIMEOUT = 15000;

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(error.error || 'Ошибка сервера');
  }
  return response.json();
}

function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).then(response => {
    clearTimeout(timeoutId);
    return response;
  }).catch(err => {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Превышено время ожидания ответа. Проверьте подключение к интернету.');
    }
    throw err;
  });
}

export const api = {
  get: async <T>(url: string): Promise<T> => {
    const response = await fetchWithTimeout(`${API_BASE}${url}`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    return handleResponse<T>(response);
  },

  post: async <T>(url: string, data?: any): Promise<T> => {
    const response = await fetchWithTimeout(`${API_BASE}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  put: async <T>(url: string, data: any): Promise<T> => {
    const response = await fetchWithTimeout(`${API_BASE}${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<T>(response);
  },

  delete: async <T>(url: string, data?: any): Promise<T> => {
    const response = await fetchWithTimeout(`${API_BASE}${url}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: data ? { 'Content-Type': 'application/json', ...getAuthHeaders() } : getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },
};
