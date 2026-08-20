import React, { createContext, useState, useCallback } from 'react';

export type Role = 'ADMIN' | 'ORGANISER' | 'CUSTOMER';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: Role) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Login failed');
      const { token, user } = await res.json();
      setToken(token);
      setUser(user);
      localStorage.setItem('token', token);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  const register = useCallback(
    async (email: string, password: string, name: string, role: Role) => {
      setLoading(true);
      try {
        const res = await fetch(`${apiUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, role }),
        });
        if (!res.ok) throw new Error('Register failed');
        const { token, user } = await res.json();
        setToken(token);
        setUser(user);
        localStorage.setItem('token', token);
      } finally {
        setLoading(false);
      }
    },
    [apiUrl]
  );

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth outside AuthProvider');
  return context;
}
