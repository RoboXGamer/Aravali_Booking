const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

async function getHeaders() {
  const token = localStorage.getItem('supabase.auth.token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

export const api = {
  async get(endpoint: string) {
    const headers = await getHeaders();
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async post(endpoint: string, body: any) {
    const headers = await getHeaders();
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async delete(endpoint: string) {
    const headers = await getHeaders();
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getDownloadUrl(bookingId: string): string {
    const token = localStorage.getItem('supabase.auth.token') || '';
    return `${BASE_URL}/api/bookings/ticket/${bookingId}/download?token=${token}`;
  }
};
