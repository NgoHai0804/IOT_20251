import { Navigate, useLocation } from 'react-router-dom';
import type { ProtectedRouteProps, PublicRouteProps } from '@/types';

export function ProtectedRoute({ children, isAuthenticated }: ProtectedRouteProps) {
  const location = useLocation();
  
  if (!isAuthenticated) {
    // Redirect to home page with return url
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
}

export function PublicRoute({ children, isAuthenticated }: PublicRouteProps) {
  if (isAuthenticated) {
    // If user is already logged in, redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}