import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Show {
  id: number;
  title: string;
  type: 'MOVIE' | 'CONCERT';
  description?: string;
  startsAt: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
  venue: { name: string; city: string };
  organiser: { name: string };
  prices: Array<{
    id: number;
    priceCents: number;
    category: { id: number; name: string; colorHex: string };
  }>;
}

export function useShows() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  const fetchShows = async (filters?: { type?: string; city?: string; status?: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters as any);
      const res = await fetch(`${apiUrl}/api/shows?${params}`);
      if (!res.ok) throw new Error('Fetch failed');
      setShows(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchShow = async (id: number) => {
    try {
      const res = await fetch(`${apiUrl}/api/shows/${id}`);
      if (!res.ok) throw new Error('Fetch failed');
      return await res.json();
    } catch {
      return null;
    }
  };

  const fetchMyShows = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/shows/my/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Fetch failed');
      return await res.json();
    } catch {
      return [];
    }
  };

  const createShow = async (data: {
    venueId: number;
    title: string;
    type: 'MOVIE' | 'CONCERT';
    description?: string;
    startsAt: string;
    prices: Array<{ categoryId: number; priceCents: number }>;
  }) => {
    try {
      const res = await fetch(`${apiUrl}/api/shows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Create failed');
      return await res.json();
    } catch {
      return null;
    }
  };

  const publishShow = async (id: number) => {
    try {
      const res = await fetch(`${apiUrl}/api/shows/${id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Publish failed');
      return await res.json();
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetchShows();
  }, []);

  return {
    shows,
    loading,
    fetchShows,
    fetchShow,
    fetchMyShows,
    createShow,
    publishShow,
  };
}
