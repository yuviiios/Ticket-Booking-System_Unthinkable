import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useNavigate } from 'react-router-dom';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SeatMapProps {
  show: any;
  onHoldCreated?: (holdId: number, expiresAt: string) => void;
}

export default function SeatMap({ show, onHoldCreated }: SeatMapProps) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { connected, on, off } = useSocket(show.id);
  const [seats, setSeats] = useState<Map<number, any>>(new Map());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [myHoldId, setMyHoldId] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show.seats) return;
    const seatMap = new Map();
    show.seats.forEach((ss: any) => {
      seatMap.set(ss.seatId, ss);
    });
    setSeats(seatMap);
  }, [show.seats]);

  useEffect(() => {
    on('seat:update', (data: { showId: number; seats: any[] }) => {
      if (data.showId !== show.id) return;
      setSeats((prev) => {
        const updated = new Map(prev);
        data.seats.forEach((s) => {
          const existing = updated.get(s.seatId);
          if (existing) {
            updated.set(s.seatId, { ...existing, status: s.status, heldUntil: s.heldUntil });
          }
        });
        return updated;
      });
    });

    return () => off('seat:update');
  }, [show.id]);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const left = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        setMyHoldId(null);
        setExpiresAt(null);
        setSelected(new Set());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleSeatClick = (seatId: number, showSeat: any) => {
    if (myHoldId) return; // Already holding
    if (showSeat.status !== 'AVAILABLE') return;

    setSelected((prev) => {
      const updated = new Set(prev);
      if (updated.has(seatId)) {
        updated.delete(seatId);
      } else {
        if (updated.size >= 10) {
          setError('Max 10 seats');
          return prev;
        }
        updated.add(seatId);
      }
      return updated;
    });
    setError('');
  };

  const handleHold = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/api/holds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ showId: show.id, seatIds: Array.from(selected) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Hold failed');
      }

      const data = await res.json();
      setMyHoldId(data.holdId);
      setExpiresAt(new Date(data.expiresAt));
      if (onHoldCreated) onHoldCreated(data.holdId, data.expiresAt);
    } catch (err: any) {
      setError(err.message);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!myHoldId) return;
    try {
      await fetch(`${apiUrl}/api/holds/${myHoldId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyHoldId(null);
      setExpiresAt(null);
      setSelected(new Set());
    } catch (err) {
      console.error('Release failed:', err);
    }
  };

  const handleCheckout = async () => {
    if (!myHoldId) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ holdId: myHoldId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Booking failed');
      }

      const data = await res.json();
      setMyHoldId(null);
      setExpiresAt(null);
      setSelected(new Set());
      navigate(`/booking/success?ref=${data.bookingRef}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const seatGrid = show.seats || [];
  const maxRow = seatGrid.length > 0 ? Math.max(...seatGrid.map((s: any) => s.seat.gridRow)) + 1 : 0;
  const maxCol = seatGrid.length > 0 ? Math.max(...seatGrid.map((s: any) => s.seat.gridCol)) + 1 : 0;

  const grid: any[][] = Array.from({ length: maxRow }, () => Array(maxCol).fill(null));
  seatGrid.forEach((ss: any) => {
    const updated = seats.get(ss.seatId) || ss;
    grid[ss.seat.gridRow][ss.seat.gridCol] = updated;
  });

  const categoryMap = new Map<number, { colorHex: string }>(
    show.venue.categories.map((c: any) => [c.id, c])
  );

  const getSeatStyle = (showSeat: any) => {
    const cat = categoryMap.get(showSeat.categoryId);
    const isSelected = selected.has(showSeat.seatId);
    const isMyHold = myHoldId && showSeat.holdId === myHoldId;

    if (isSelected || isMyHold) {
      return {
        backgroundColor: '#10b981',
        borderColor: '#059669',
        cursor: 'pointer',
      };
    }

    if (showSeat.status === 'AVAILABLE') {
      return {
        backgroundColor: cat?.colorHex || '#ccc',
        borderColor: cat?.colorHex || '#999',
        cursor: 'pointer',
      };
    }

    return {
      backgroundColor: '#d1d5db',
      borderColor: '#9ca3af',
      cursor: 'not-allowed',
      opacity: 0.5,
    };
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded ${connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {connected ? '🟢 Live' : '🔴 Offline'}
          </div>
          <div className="text-sm text-gray-600">
            Selected: {selected.size} {selected.size > 0 && `/ 10`}
          </div>
        </div>
        {timeLeft !== null && timeLeft > 0 && (
          <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded font-semibold">
            ⏱ Hold expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="mb-4 text-center">
        <div className="inline-block px-12 py-3 bg-gray-800 text-white rounded-t-lg font-semibold">
          SCREEN / STAGE
        </div>
      </div>

      <div className="overflow-x-auto mb-6">
        <div className="inline-block min-w-full">
          {grid.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1 mb-1">
              <div className="w-10 text-sm text-gray-600 flex items-center justify-center font-semibold">
                {String.fromCharCode(65 + rowIdx)}
              </div>
              {row.map((showSeat, colIdx) => {
                if (!showSeat) return <div key={colIdx} className="w-10 h-10"></div>;
                const style = getSeatStyle(showSeat);
                return (
                  <button
                    key={colIdx}
                    onClick={() => handleSeatClick(showSeat.seatId, showSeat)}
                    disabled={myHoldId !== null || showSeat.status !== 'AVAILABLE'}
                    className="w-10 h-10 rounded border-2 flex items-center justify-center text-xs font-semibold transition hover:scale-110 disabled:hover:scale-100"
                    style={style}
                    title={`${showSeat.seat.rowLabel}${showSeat.seat.seatNumber} - ${showSeat.status}`}
                  >
                    {showSeat.seat.seatNumber}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        {!myHoldId ? (
          <button
            onClick={handleHold}
            disabled={selected.size === 0 || loading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Holding...' : `Hold ${selected.size} Seat${selected.size !== 1 ? 's' : ''}`}
          </button>
        ) : (
          <>
            <button
              onClick={handleRelease}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 disabled:bg-gray-400"
            >
              Release Hold
            </button>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? 'Booking...' : 'Complete Booking'}
            </button>
          </>
        )}
      </div>

      <div className="mt-6 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 border-2 rounded"></div>
          <span>Unavailable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 border-2 border-green-600 rounded"></div>
          <span>Your Selection</span>
        </div>
        {show.venue.categories.map((cat: any) => (
          <div key={cat.id} className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 rounded" style={{ backgroundColor: cat.colorHex, borderColor: cat.colorHex }}></div>
            <span>{cat.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
