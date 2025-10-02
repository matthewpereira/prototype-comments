// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { commentManager, isCommentsEnabled, exportComments } from '../index';

type Props = {
  className?: string;
  style?: React.CSSProperties;
};

export const PrototypeCommentsControls: React.FC<Props> = ({ className, style }) => {
  const [visible, setVisible] = useState<boolean>(() => (commentManager as any).isVisible?.() ?? true);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleVisibility = useCallback(() => {
    (commentManager as any).toggleVisibility?.();
    setVisible((v) => !v);
  }, []);

  useEffect(() => {
    const onClick = () => setMenuOpen(false);
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, []);

  const controlsStyle = useMemo<React.CSSProperties>(() => ({
    position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 2147483647,
    display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'saturate(180%) blur(8px)', border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 9999, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', ...style
  }), [style]);

  const mkBtn = (label: string, onClick: React.MouseEventHandler<HTMLButtonElement>, accent?: boolean) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      style={{
        cursor: 'pointer', border: '1px solid #e5e7eb', borderRadius: 9999, padding: '8px 12px',
        background: accent ? '#111827' : 'white', color: accent ? 'white' : '#111827',
        font: '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
      }}
      className={className}
    >{label}</button>
  );

  const download = (content: string | object) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let blob: Blob; let filename: string;
    if (typeof content === 'string') { blob = new Blob([content], { type: 'text/markdown;charset=utf-8' }); filename = `comments-${stamp}.md`; }
    else { const json = JSON.stringify(content, null, 2); blob = new Blob([json], { type: 'application/json;charset=utf-8' }); filename = `comments-${stamp}.json`; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';
    a.addEventListener('click', (ev) => ev.stopPropagation(), { once: true });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  if (!isCommentsEnabled()) return null;
  if (!visible) return (
    <div style={controlsStyle} className={className}>
      {mkBtn('Show comments', () => toggleVisibility())}
    </div>
  );

  return (
    <div style={controlsStyle} className={className}>
      <div style={{ position: 'relative' }}>
        {mkBtn('Export', () => setMenuOpen((o) => !o))}
        {menuOpen && (
          <div style={{ position: 'absolute', right: 0, bottom: 42, background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12, padding: 8, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} onClick={(e) => e.stopPropagation()}>
            {mkBtn('Export JSON', () => { download(exportComments()); setMenuOpen(false); })}
            {mkBtn('Export Markdown', () => {
              const data = exportComments();
              if (typeof data === 'string') download(data); else {
                const lines: string[] = [];
                const arr = data as any[];
                if (arr.length) {
                  lines.push('# Comments', '');
                  for (const c of arr) {
                    const when = new Date(c.timestamp).toISOString();
                    lines.push(`- (${c.x}, ${c.y}) ${String(c.text).replace(/[\\`*_{}\[\]()#+\-.!|]/g, (m) => `\\${m}`)} — ${when}`);
                  }
                }
                download(lines.join('\n'));
              }
              setMenuOpen(false);
            })}
            <div style={{ height: 8 }} />
            {mkBtn('Cancel', () => setMenuOpen(false), true)}
          </div>
        )}
      </div>
      {mkBtn('Clear', () => commentManager.clear())}
      {mkBtn('Hide comments', () => toggleVisibility())}
    </div>
  );
};

export default PrototypeCommentsControls;


