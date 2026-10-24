import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

/** After any successful sign-in: remember the user, confirm with a toast, return to where they were headed. */
export default function useFinishSignIn() {
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  return useCallback((user, message) => {
    setUser(user);
    toast.success(message ?? `Welcome back, ${user.name.split(' ')[0]}.`);
    navigate(typeof from === 'string' && from.startsWith('/') ? from : '/', { replace: true });
  }, [setUser, toast, navigate, from]);
}
