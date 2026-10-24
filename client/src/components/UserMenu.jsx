import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await signOut();
      toast.info('You are signed out.');
      navigate('/');
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-orange font-semibold text-orange-fg transition-transform hover:scale-105"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          user.name.trim().charAt(0).toUpperCase()
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-surface p-1 shadow-lg">
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-bg">
            Your account
          </Link>
          <button role="menuitem" type="button" onClick={handleSignOut} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
