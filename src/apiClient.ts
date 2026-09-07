export const api = {
  get: async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return { data: await res.json() };
    } catch {
      return { data: null };
    }
  }
};
