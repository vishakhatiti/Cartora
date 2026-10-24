import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/** Seller pages only render for seller accounts. The server enforces the same rule on every seller endpoint. */
export default function SellerGate({ children }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="skeleton h-48 rounded-3xl" role="status" aria-label="Checking sign-in" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  if (!user.isSeller) return <Navigate to="/sell/start" replace />;
  return children;
}
