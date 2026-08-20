import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShows } from '../hooks/useShows';

export default function ShowDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchShow } = useShows();
  const [show, setShow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchShow(parseInt(id)).then((data) => {
        setShow(data);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!show) return <div className="p-4 text-center text-red-600">Show not found</div>;

  const seatGrid = show.seats || [];
  const maxRow = seatGrid.length > 0 ? Math.max(...seatGrid.map((s: any) => s.seat.gridRow)) + 1 : 0;
  const maxCol = seatGrid.length > 0 ? Math.max(...seatGrid.map((s: any) => s.seat.gridCol)) + 1 : 0;

  const grid: any[][] = Array.from({ length: maxRow }, () => Array(maxCol).fill(null));
  seatGrid.forEach((ss: any) => {
    grid[ss.seat.gridRow][ss.seat.gridCol] = ss;
  });

  const categoryMap = new Map(
    show.venue.categories.map((c: any) => [c.id, c])
  );

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

      {/* Seat Map Preview */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Seat Map</h2>
        <div className="mb-4 text-center">
          <div className="inline-block px-8 py-2 bg-gray-800 text-white rounded-t-lg">
            SCREEN / STAGE
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {grid.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1 mb-1">
                <div className="w-8 text-sm text-gray-600 flex items-center justify-center">
                  {String.fromCharCode(65 + rowIdx)}
                </div>
                {row.map((showSeat, colIdx) => {
                  if (!showSeat) return <div key={colIdx} className="w-8 h-8"></div>;
                  const cat = categoryMap.get(showSeat.categoryId);
                  const isAvailable = showSeat.status === 'AVAILABLE';
                  return (
                    <div
                      key={colIdx}
                      className={`w-8 h-8 rounded border-2 flex items-center justify-center text-xs ${
                        isAvailable
                          ? 'cursor-pointer hover:scale-110 transition'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      style={{
                        backgroundColor: isAvailable ? cat?.colorHex : '#ccc',
                        borderColor: cat?.colorHex || '#999',
                      }}
                      title={`${showSeat.seat.rowLabel}${showSeat.seat.seatNumber} - ${showSeat.status}`}
                    >
                      {showSeat.seat.seatNumber}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 text-center">
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
            Book Tickets (Phase 4)
          </button>
        </div>
      </div>
    </div>
  );
}
