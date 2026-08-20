import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminVenues from './pages/AdminVenues';

function Nav({ user, logout }: any) {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Home', role: ['CUSTOMER', 'ORGANISER', 'ADMIN'] },
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

function Home() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto p-4">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Welcome, {user?.name}!</h2>
        <p className="text-gray-600">Phases 3-7 coming soon...</p>
      </div>
    </div>
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
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
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
