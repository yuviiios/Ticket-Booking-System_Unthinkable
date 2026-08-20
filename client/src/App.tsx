import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminVenues from './pages/AdminVenues';
import OrganiserShows from './pages/OrganiserShows';
import Browse from './pages/Browse';
import ShowDetail from './pages/ShowDetail';
import MyBookings from './pages/MyBookings';
import MyWaitlist from './pages/MyWaitlist';
import AcceptOffer from './pages/AcceptOffer';

function Nav({ user, logout }: any) {
  const location = useLocation();
  const navItems = [
    { path: '/browse', label: 'Browse', role: ['CUSTOMER', 'ORGANISER', 'ADMIN'] },
    { path: '/bookings', label: 'My Bookings', role: ['CUSTOMER'] },
    { path: '/waitlist', label: 'Waitlist', role: ['CUSTOMER'] },
    { path: '/organiser/shows', label: 'My Shows', role: ['ORGANISER'] },
    { path: '/admin/venues', label: 'Venues', role: ['ADMIN'] },
  ];

  return (
    <nav className="bg-white shadow p-4 flex justify-between items-center">
      <h1 className="text-2xl font-bold text-gray-900">Ticket Booking</h1>
      {user && (
        <div className="flex items-center gap-6">
          <div className="flex gap-4">
            {navItems
              .filter((item) => item.role.includes(user.role))
              .map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded transition ${
                    location.pathname === item.path
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">
              {user.name} ({user.role})
            </span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  const { user, logout } = useAuth();

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          {user && <Nav user={user} logout={logout} />}
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Navigate to="/browse" />} />
            <Route
              path="/browse"
              element={
                <ProtectedRoute>
                  <Browse />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shows/:id"
              element={
                <ProtectedRoute>
                  <ShowDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings"
              element={
                <ProtectedRoute>
                  <MyBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/waitlist"
              element={
                <ProtectedRoute>
                  <MyWaitlist />
                </ProtectedRoute>
              }
            />
            <Route
              path="/waitlist/accept/:token"
              element={
                <ProtectedRoute>
                  <AcceptOffer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organiser/shows"
              element={
                <ProtectedRoute>
                  <OrganiserShows />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/venues"
              element={
                <ProtectedRoute>
                  <AdminVenues />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
