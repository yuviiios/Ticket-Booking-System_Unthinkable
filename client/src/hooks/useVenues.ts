import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Seat {
  id: number;
  rowLabel: string;
  seatNumber: number;
  gridRow: number;
  gridCol: number;
  categoryId: number;
}

export interface Category {
  id: number;
  name: string;
  colorHex: string;
  sortOrder: number;
}

export interface Venue {
  id: number;
  name: string;
  city: string;
  address: string;
  categories?: Category[];
  seats?: Seat[];
}

export function useVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  const fetchVenues = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/venues`);
      if (!res.ok) throw new Error('Fetch failed');
      setVenues(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchVenue = async (id: number) => {
    try {
      const res = await fetch(`${apiUrl}/api/venues/${id}`);
      if (!res.ok) throw new Error('Fetch failed');
      return await res.json();
    } catch {
      return null;
    }
  };

  const createVenue = async (name: string, city: string, address: string) => {
    try {
      const res = await fetch(`${apiUrl}/api/venues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, city, address }),
      });
      if (!res.ok) throw new Error('Create failed');
      const newVenue = await res.json();
      setVenues([...venues, newVenue]);
      return newVenue;
    } catch {
      return null;
    }
  };

  const createCategory = async (venueId: number, name: string, colorHex: string) => {
    try {
      const res = await fetch(`${apiUrl}/api/venues/${venueId}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, colorHex }),
      });
      if (!res.ok) throw new Error('Create failed');
      return await res.json();
    } catch {
      return null;
    }
  };

  const bulkSeats = async (
    venueId: number,
    rows: number,
    cols: number,
    categoryRows: Array<{ endRow: number; categoryId: number }>
  ) => {
    try {
      const res = await fetch(`${apiUrl}/api/venues/${venueId}/seats/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows, cols, categoryRows }),
      });
      if (!res.ok) throw new Error('Bulk create failed');
      return await res.json();
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  return {
    venues,
    loading,
    fetchVenue,
    createVenue,
    createCategory,
    bulkSeats,
  };
}
