export const api = {
  get: async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
      throw new Error(`Expected JSON but got HTML for ${url}`);
    }
    return { data: await res.json() };
  }
};
