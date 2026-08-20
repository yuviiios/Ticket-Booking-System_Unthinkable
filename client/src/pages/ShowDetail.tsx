import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShows } from '../hooks/useShows';
import SeatMap from '../components/SeatMap';
import { useAuth } from '../context/AuthContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ShowDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { fetchShow } = useShows();
  const [show, setShow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [seatsWanted, setSeatsWanted] = useState(1);

  useEffect(() => {
    if (id) {
      fetchShow(parseInt(id)).then((data) => {
        setShow(data);
        setLoading(false);
      });
    }
  }, [id]);

  const handleJoinWaitlist = async () => {
    if (!selectedCategory) return;
    try {
      const res = await fetch(`${apiUrl}/api/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ showId: show.id, categoryId: selectedCategory, seatsWanted }),
      });
      if (res.ok) {
        alert('Joined waitlist! You will be notified if seats become available.');
        setWaitlistOpen(false);
        navigate('/waitlist');
      } else {
        const data = await res.json();
        alert(data.error || 'Join failed');
      }
    } catch {
      alert('Join waitlist failed');
    }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!show) return <div className="p-4 text-center text-red-600">Show not found</div>;

  const isCustomer = user?.role === 'CUSTOMER';
  const availableCount = show.seats?.filter((s: any) => s.status === 'AVAILABLE').length || 0;

  return (
    <div className="container mx-auto p-4">
      <button
        onClick={() => navigate('/browse')}
        className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Back
      </button>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{show.title}</h1>
            <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">
              {show.type}
            </span>
          </div>
          <span className="text-sm px-3 py-1 bg-green-100 text-green-800 rounded font-semibold">
            {show.status}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2 text-gray-700">
            <div><strong>Venue:</strong> {show.venue.name}</div>
            <div><strong>City:</strong> {show.venue.city}</div>
            <div><strong>Date:</strong> {new Date(show.startsAt).toLocaleString()}</div>
            <div><strong>Organiser:</strong> {show.organiser.name}</div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Pricing</h3>
            <div className="space-y-2">
              {show.prices.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: p.category.colorHex }}
                  ></div>
                  <span className="flex-1">{p.category.name}</span>
                  <span className="font-semibold">${(p.priceCents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {show.description && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-gray-700">{show.description}</p>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Select Seats</h2>
          <div className="text-sm text-gray-600">
            {availableCount} seat{availableCount !== 1 ? 's' : ''} available
          </div>
        </div>
        {isCustomer ? (
          <>
            <SeatMap show={show} />
            {availableCount === 0 && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 font-semibold mb-2">Show is sold out!</p>
                <button
                  onClick={() => setWaitlistOpen(!waitlistOpen)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Join Waitlist
                </button>
              </div>
            )}
            {waitlistOpen && (
              <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                <h3 className="font-semibold mb-3">Join Waitlist</h3>
                <div className="space-y-3">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value={0}>Select Category</option>
                    {show.venue.categories.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={seatsWanted}
                    onChange={(e) => setSeatsWanted(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Seats wanted"
                  />
                  <button
                    onClick={handleJoinWaitlist}
                    disabled={!selectedCategory}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Join Waitlist
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-600">
            Login as CUSTOMER to book seats
          </div>
        )}
      </div>
    </div>
  );
}
