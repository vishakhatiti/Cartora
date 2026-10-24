import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { sellerApi } from '../lib/api.js';
import { useRemote } from '../hooks/useRemote.js';
import { useToast } from '../context/ToastContext.jsx';
import PageBand from '../components/PageBand.jsx';
import SellerGate from '../components/SellerGate.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);
const toForm = (p) => p ? {
  title: p.title, brand: p.brand ?? '', category: p.category.slug, price: (p.priceCents / 100).toFixed(2), stockQty: String(p.stockQty),
  description: p.description ?? '', features: p.features.join('\n'), imageUrls: p.images.map((i) => i.large).join('\n'),
} : { title: '', brand: '', category: '', price: '', stockQty: '1', description: '', features: '', imageUrls: '' };

function validate(v) {
  const e = {};
  if (v.title.trim().length < 3) e.title = 'Title needs at least 3 characters.';
  if (!v.category) e.category = 'Choose a category.';
  const price = Number(v.price);
  if (!v.price.trim() || !Number.isFinite(price) || price < 0.01) e.price = 'Enter a price of at least $0.01.';
  else if (price > 100000) e.price = 'Price is too high.';
  const stock = Number(v.stockQty);
  if (v.stockQty.trim() === '' || !Number.isInteger(stock) || stock < 0) e.stockQty = 'Stock must be a whole number, 0 or more.';
  const images = lines(v.imageUrls);
  if (images.length === 0) e.imageUrls = 'Add at least one image link.';
  else if (images.length > 4) e.imageUrls = 'You can add up to 4 images.';
  else if (images.some((u) => !/^https:\/\/\S+$/.test(u))) e.imageUrls = 'Every image link must start with https://';
  if (lines(v.features).length > 8) e.features = 'Up to 8 highlights.';
  if (v.description.length > 4000) e.description = 'Description can be at most 4000 characters.';
  return e;
}

function Form({ product }) {
  const navigate = useNavigate();
  const toast = useToast();
  const cats = useRemote((signal) => catalogApi.categories(signal), []);
  const [values, setValues] = useState(() => toForm(product));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const found = validate(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const data = {
      title: values.title.trim(), brand: values.brand.trim(), category: values.category, price: Number(values.price), stockQty: Number(values.stockQty),
      description: values.description.trim(), features: lines(values.features), imageUrls: lines(values.imageUrls),
    };
    try {
      if (product) await sellerApi.updateProduct(product.id, data); else await sellerApi.createProduct(data);
      toast.success(product ? 'Product updated.' : 'Product published. Shoppers can find it now.');
      navigate('/sell/products');
    } catch (err) {
      setFormError(err.message || 'Could not save this product. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5';
  const err = (k) => errors[k] && <p id={`sp-${k}-err`} className="mt-1 text-xs font-medium text-bad">{errors[k]}</p>;
  const aria = (k) => ({ 'aria-invalid': errors[k] ? 'true' : undefined, 'aria-describedby': errors[k] ? `sp-${k}-err` : undefined });
  const previews = lines(values.imageUrls).filter((u) => /^https:\/\/\S+$/.test(u)).slice(0, 4);

  return (
    <div className="settle">
      <PageBand title={product ? 'Edit product' : 'Add a product'} breadcrumb={<><Link className="hover:underline" to="/sell/products">My products</Link> <span aria-hidden="true">›</span> <span className="font-semibold text-orange">{product ? 'Edit' : 'New'}</span></>} />
      <form onSubmit={submit} noValidate className="mt-6 rounded-3xl border border-line-strong bg-surface p-6">
        {formError && <p role="alert" className="mb-4 rounded-xl bg-butter px-4 py-3 text-sm font-medium">{formError}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="sp-title" className="text-sm font-semibold">Title</label><input id="sp-title" value={values.title} onChange={set('title')} maxLength={200} {...aria('title')} className={field} />{err('title')}</div>
          <div><label htmlFor="sp-brand" className="text-sm font-semibold">Brand (optional)</label><input id="sp-brand" value={values.brand} onChange={set('brand')} maxLength={80} className={field} /></div>
          <div><label htmlFor="sp-category" className="text-sm font-semibold">Category</label>
            <select id="sp-category" value={values.category} onChange={set('category')} {...aria('category')} className={field}>
              <option value="">Choose a category</option>
              {(cats.data?.categories ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>{err('category')}</div>
          <div><label htmlFor="sp-price" className="text-sm font-semibold">Price (USD)</label><input id="sp-price" inputMode="decimal" value={values.price} onChange={set('price')} {...aria('price')} className={field} />{err('price')}</div>
          <div><label htmlFor="sp-stock" className="text-sm font-semibold">Units in stock</label><input id="sp-stock" inputMode="numeric" value={values.stockQty} onChange={set('stockQty')} {...aria('stockQty')} className={field} />{err('stockQty')}</div>
          <div className="sm:col-span-2"><label htmlFor="sp-images" className="text-sm font-semibold">Image links, one per line (https, up to 4)</label>
            <textarea id="sp-images" rows={3} value={values.imageUrls} onChange={set('imageUrls')} {...aria('imageUrls')} className={`${field} font-mono text-sm`} />{err('imageUrls')}
            {previews.length > 0 && <ul className="mt-2 flex gap-2" aria-label="Image previews">{previews.map((u) => <li key={u}><img src={u} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-xl border border-line object-contain bg-white" onError={(ev) => { ev.currentTarget.style.visibility = 'hidden'; }} /></li>)}</ul>}</div>
          <div className="sm:col-span-2"><label htmlFor="sp-features" className="text-sm font-semibold">Highlights, one per line (up to 8)</label><textarea id="sp-features" rows={3} value={values.features} onChange={set('features')} {...aria('features')} className={field} />{err('features')}</div>
          <div className="sm:col-span-2"><label htmlFor="sp-desc" className="text-sm font-semibold">Description</label><textarea id="sp-desc" rows={5} value={values.description} onChange={set('description')} maxLength={4000} {...aria('description')} className={field} />{err('description')}</div>
        </div>
        <div className="mt-6 flex gap-3">
          <button type="submit" disabled={busy} className="rounded-full bg-primary px-7 py-3 font-semibold text-primary-fg disabled:opacity-60">{busy ? 'Saving…' : product ? 'Save changes' : 'Publish product'}</button>
          <Link to="/sell/products" className="rounded-full border border-line-strong px-7 py-3 font-semibold hover:bg-pale">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Editor() {
  const { id } = useParams();
  const list = useRemote((signal) => (id ? sellerApi.products(signal) : Promise.resolve(null)), [id]);
  if (!id) return <Form />;
  if (list.status === 'error') return <ErrorNotice error={list.error} onRetry={list.retry} />;
  if (!list.data) return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Loading product" />;
  const product = list.data.products.find((p) => p.id === id);
  if (!product) return <Navigate to="/sell/products" replace />;
  return <Form product={product} key={product.id} />;
}

export default function SellerProductFormPage() {
  return <SellerGate><Editor /></SellerGate>;
}
