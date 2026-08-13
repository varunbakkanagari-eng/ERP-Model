import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Always authenticated as system administrator
  const [token] = useState('dummy_token');
  const [user] = useState({
    UserID: 1,
    Username: 'admin',
    FullName: 'System Administrator',
    Role: 'ADMIN',
    IsPaid: true
  });

  const login = async () => ({ success: true });
  const register = async () => ({ success: true });
  const continueAsGuest = async () => ({ success: true });
  const logout = () => {};
  const upgradeSession = () => {};

  const value = {
    token,
    user,
    isAuthenticated: true,
    isPaid: true,
    loading: false,
    login,
    register,
    continueAsGuest,
    logout,
    upgradeSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
