const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
let loading;

/** Loads Google's sign-in script once. Resolves with window.google or rejects if it cannot load. */
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('Google script missing')));
    script.onerror = () => {
      loading = undefined; // allow a retry on the next visit
      reject(new Error('Google script failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
