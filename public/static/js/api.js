// ============================================================
// API Client：統一封裝 axios 呼叫、帶入 JWT、錯誤處理
// ============================================================
const API = (() => {
  const client = axios.create({ baseURL: '/api' })

  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('yimu_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  client.interceptors.response.use(
    (res) => res.data,
    (err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem('yimu_token')
        localStorage.removeItem('yimu_user')
        if (location.pathname !== '/login') location.href = '/login'
      }
      const message = err.response?.data?.error || '發生未知錯誤，請稍後再試'
      return Promise.reject(new Error(message))
    }
  )

  return {
    get: (url, params) => client.get(url, { params }),
    post: (url, data) => client.post(url, data),
    put: (url, data) => client.put(url, data),
    delete: (url) => client.delete(url)
  }
})()
