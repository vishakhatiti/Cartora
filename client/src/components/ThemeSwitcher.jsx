import { useState } from 'react';
import { THEMES, applyTheme, currentTheme } from '../lib/theme.js';

export default function ThemeSwitcher() {
  const [active, setActive] = useState(currentTheme);

  const choose = (id) => {
    applyTheme(id);
    setActive(id);
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          role="radio"
          aria-checked={active === theme.id}
          aria-label={`${theme.label} theme`}
          title={theme.label}
          onClick={() => choose(theme.id)}
          className={`grid h-7 w-7 place-items-center rounded-full transition-transform hover:scale-110 ${
            active === theme.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''
          }`}
        >
          <span
            aria-hidden="true"
            className="block h-5 w-5 rounded-full border border-line"
            style={{ background: `linear-gradient(135deg, ${theme.swatch[0]} 50%, ${theme.swatch[1]} 50%)` }}
          />
        </button>
      ))}
    </div>
  );
}
