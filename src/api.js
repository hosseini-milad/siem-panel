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
    const data = await response.json();
    if (!response.ok) {
      throw new Error(typeof data.detail === 'string' ? data.detail : 'درخواست انجام نشد');
    }
    return data;
  };
}

export const api = createApi();
