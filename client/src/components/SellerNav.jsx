import { NavLink } from 'react-router-dom';

export const SELLER_LINKS = [
  { to: '/sell', label: 'Dashboard', end: true },
  { to: '/sell/products', label: 'My products', end: false },
  { to: '/sell/products/new', label: 'Add product', end: true },
  { to: '/sell/orders', label: 'Orders', end: false },
];

/** Seller workspace navigation, used in the header while selling. */
export default function SellerNav({ pill }) {
  return (
    <nav aria-label="Seller workspace" className="min-w-0 flex-1">
      <ul className="flex gap-1 overflow-x-auto">
        {SELLER_LINKS.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to} end={l.end} className={({ isActive }) => `${pill} font-semibold ${isActive ? 'bg-hero-fg/10 text-hero-fg' : ''}`}>{l.label}</NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
