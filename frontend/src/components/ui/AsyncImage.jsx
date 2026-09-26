import { useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';

export function AsyncImage({
  src: srcProp,
  keyword,
  fallbackSrc,
  alt = '',
  className = '',
  aspect,
  rounded = false,
  fallbackIcon = 'leaf',
  fallbackIconSize = 32,
}) {
  const [status, setStatus] = useState('loading');
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (typeof srcProp === 'string' && srcProp.trim() !== '') {
      setStatus('loading');
      setSrc(srcProp);
      return;
    }
    setStatus(fallbackSrc ? 'loading' : 'error');
    setSrc(fallbackSrc || '');
  }, [srcProp, keyword, fallbackSrc]);

  const generated = src.startsWith('/media/tablee/');
  const description = generated ? `${alt} — illustration générée` : alt;

  const wrapperClass = [
    'async-img',
    status === 'error' && 'async-img--error',
    rounded && 'async-img--round',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style = aspect ? { aspectRatio: aspect } : undefined;

  return (
    <div className={wrapperClass} style={style} title={generated ? description : undefined}>
      {src && status !== 'error' && (
        <img
          key={src}
          src={src}
          alt={description}
          className={`async-img__img ${status === 'loaded' ? 'async-img__img--loaded' : ''}`}
          onLoad={() => setStatus('loaded')}
          onError={() => {
            if (fallbackSrc && src !== fallbackSrc) { setSrc(fallbackSrc); setStatus('loading'); }
            else setStatus('error');
          }}
          loading="lazy"
          decoding="async"
        />
      )}
      {status === 'loading' && <div className="async-img__skeleton" aria-hidden="true" />}
      {status === 'error' && (
        <div className="async-img__fallback" aria-hidden="true">
          <Icon name={fallbackIcon} size={fallbackIconSize} strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}
