import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sellerApi } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import { useToast } from '../context/ToastContext.jsx';
import PageBand from '../components/PageBand.jsx';
import ProductImage from '../components/ProductImage.jsx';
import SellerGate from '../components/SellerGate.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

function Products() {
  const toast = useToast();
  const list = useRemote((signal) => sellerApi.products(signal), []);
  const [busyId, setBusyId] = useState(null);
  const [local, setLocal] = useState({}); // server-confirmed changes, by id

  const toggle = async (p) => {
    setBusyId(p.id);
    try {
      const { product } = await sellerApi.updateProduct(p.id, { isActive: !p.isActive });
      setLocal((prev) => ({ ...prev, [p.id]: product }));
      toast.success(product.isActive ? 'Product is live again.' : 'Product hidden from shoppers.');
    } catch (err) {
      toast.error(err.message || 'Could not update this product. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const products = (list.data?.products ?? []).map((p) => local[p.id] ?? p);
  return (
    <div className="settle">
      <PageBand title="My products" note={list.data ? `${products.length} product${products.length === 1 ? '' : 's'}` : undefined} />
      <div className="mt-6">
        {list.status === 'error' && <ErrorNotice error={list.error} onRetry={list.retry} />}
        {list.status === 'loading' && !list.data && <div className="skeleton h-40 rounded-3xl" role="status" aria-label="Loading your products" />}
        {list.data && products.length === 0 && (
          <section className="mx-auto max-w-lg rounded-3xl bg-peach p-8 text-center">
            <h2 className="text-3xl">No products yet</h2>
            <p className="mt-2 text-sm text-muted">Products you add show up here and in search.</p>
            <Link to="/sell/products/new" className="mt-5 inline-block rounded-full bg-orange px-6 py-2.5 font-semibold text-orange-fg">Add a product</Link>
          </section>
        )}
        {products.length > 0 && (
          <ul className="space-y-3" aria-label="Your products">
            {products.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-3xl border border-line-strong bg-surface p-4">
                <ProductImage product={{ id: p.id, title: p.title, brand: p.brand, category: p.category, images: p.images }} size="thumb" alt="" className="h-20 w-20 shrink-0 rounded-2xl border border-line p-1" />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="line-clamp-2 font-semibold">{p.title}</p>
                  <p className="text-sm text-muted">{p.category.label}</p>
                  <p className="mt-1 text-sm"><strong>{formatPrice(p.priceCents)}</strong> · {p.stockQty < 1 ? <span className="font-semibold text-bad">Out of stock</span> : `${p.stockQty} in stock`}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${p.isActive ? 'bg-pale' : 'bg-butter'}`}>{p.isActive ? 'Live' : 'Hidden'}</span>
                <div className="flex gap-2 text-sm font-semibold">
                  <Link to={`/sell/products/${p.id}`} className="rounded-full border border-line-strong px-4 py-1.5 hover:bg-pale">Edit</Link>
                  <button type="button" disabled={busyId === p.id} onClick={() => toggle(p)} aria-label={`${p.isActive ? 'Hide' : 'Show'} ${p.title}`} className="rounded-full border border-line-strong px-4 py-1.5 hover:bg-pale disabled:opacity-60">{p.isActive ? 'Hide' : 'Show'}</button>
                  {p.isActive && <Link to={`/product/${p.id}`} className="rounded-full px-4 py-1.5 text-primary hover:underline">View</Link>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function SellerProductsPage() {
  return <SellerGate><Products /></SellerGate>;
}
