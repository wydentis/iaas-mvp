import axios from 'axios';

const api = axios.create({
  baseURL: 'https://serverdam.wydentis.xyz/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh logic as per your documentation
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token');
      const { data } = await axios.post(`${api.baseURL}/auth/refresh`, { refresh_token: refresh });
      localStorage.setItem('access_token', data.access_token);
      err.config.headers.Authorization = `Bearer ${data.access_token}`;
      return api(err.config);
    }
    return Promise.reject(err);
  }
);

export default api;