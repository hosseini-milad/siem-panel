import { mockRequest } from './mock.js';

export function createApi({ request = mockRequest } = {}) {
  return async function api(path, { method = 'GET', query = {}, body } = {}) {
    const params = new URLSearchParams(
      Object.entries(query).filter(([, value]) => value !== '' && value != null),
    );
    const url = '/api/v1' + path + (params.size ? '?' + params : '');
    const response = await request(url, {
      method,
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(typeof data?.detail === 'string' ? data.detail : 'درخواست انجام نشد');
      error.status = response.status;
      throw error;
    }
    if (!data) throw new Error('پاسخ API معتبر نیست.');
    return data;
  };
}

export const api = createApi();

export const liveApi = createApi({ request: async (url, options) => {
  const response = await fetch(url, options);
  if (response.status === 401 && !url.startsWith('/api/v1/auth/')) {
    window.dispatchEvent(new Event('siem-session-ended'));
  }
  return response;
} });

export const explorerApi = liveApi;
