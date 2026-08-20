import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function AcceptOffer() {
  const { token: offerToken } = useParams();
  const navigate = useNavigate();
  const { token: authToken } = useAuth();
  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (offerToken) {
      fetchOffer();
    }
  }, [offerToken]);

  useEffect(() => {
    if (!offer) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const expires = new Date(offer.offer.expiresAt).getTime();
      const left = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        setError('Offer expired');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [offer]);

  const fetchOffer = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/waitlist/offers/${offerToken}`);
      if (res.ok) {
        setOffer(await res.json());
      } else {
        setError('Offer not found');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/waitlist/offers/${offerToken}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Booking confirmed! Ref: ${data.bookingRef}\nCheck email for QR ticket.`);
        navigate('/bookings');
      } else {
        const data = await res.json();
        setError(data.error || 'Accept failed');
      }
    } finally {
      setAccepting(false);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (error && !offer) return <div className="p-4 text-center text-red-600">{error}</div>;
  if (!offer) return <div className="p-4 text-center text-red-600">Offer not found</div>;

  const expired = timeLeft === 0;

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="bg-white p-6 rounded-lg shadow">
        <h1 className="text-3xl font-bold mb-2">Waitlist Offer</h1>
        {timeLeft !== null && timeLeft > 0 && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded font-semibold">
            ⏱ Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        )}
        {expired && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded font-semibold">
            This offer has expired
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">{offer.show.title}</h2>
          <p className="text-gray-600">{offer.show.venue} • {new Date(offer.show.startsAt).toLocaleString()}</p>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">Your Seats</h3>
          <p className="text-lg">
            <span className="font-semibold">{offer.category}</span>:{' '}
            {offer.seats.map((s: any) => `${s.rowLabel}${s.seatNumber}`).join(', ')}
          </p>
        </div>

        {error && !expired && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        <div className="flex gap-4">
          <button
            onClick={() => navigate('/waitlist')}
            className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Back to Waitlist
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting || expired}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {accepting ? 'Accepting...' : 'Accept & Book'}
          </button>
        </div>
      </div>
    </div>
  );
}
