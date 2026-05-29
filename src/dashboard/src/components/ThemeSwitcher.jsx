const THEMES = [
  {
    id: 'terminal-red',
    label: 'Terminal',
    title: 'Terminal Red — pure dark, red accent, monospace font',
    swatchStyle: { background: '#161616', border: '1.5px solid #2a2a2a' },
    dot: '#e63535',
  },
  {
    id: 'default',
    label: 'Auto',
    title: 'Auto — follows your OS light / dark setting',
    swatchStyle: {
      background: 'linear-gradient(135deg, #f5f5f7 50%, #1a1a28 50%)',
      border: '1.5px solid #c0c0cc',
    },
    dot: '#2563eb',
  },
  {
    id: 'vm-brand',
    label: 'VM Brand',
    title: 'Virgin Media Brand — red accent, OS-adaptive',
    swatchStyle: { background: '#ffffff', border: '1.5px solid #e6d8d8' },
    dot: '#cc0000',
  },
  {
    id: 'dark-analytics',
    label: 'Analytics',
    title: 'Dark Analytics — GitHub-dark with electric blue, always dark',
    swatchStyle: { background: '#161b22', border: '1.5px solid #30363d' },
    dot: '#38bdf8',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    title: 'Midnight — deep purple, always dark',
    swatchStyle: { background: '#14112b', border: '1.5px solid #2e2a52' },
    dot: '#a78bfa',
  },
  {
    id: 'corporate',
    label: 'Corporate',
    title: 'Clean Corporate — crisp white & navy, always light',
    swatchStyle: { background: '#f8fafc', border: '1.5px solid #cbd5e1' },
    dot: '#1d4ed8',
  },
];

export default function ThemeSwitcher({ theme, setTheme }) {
  return (
    <div className="theme-switcher" aria-label="Choose colour theme">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            className={`theme-btn${active ? ' theme-btn-active' : ''}`}
            title={t.title}
            aria-pressed={active}
            onClick={() => setTheme(t.id)}
          >
            {/* colour swatch */}
            <span className="theme-swatch" style={t.swatchStyle}>
              <span className="theme-swatch-dot" style={{ background: t.dot }} />
            </span>
            {/* label — visible on wider screens */}
            <span className="theme-label">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
