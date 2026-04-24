import { useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';

export function AsyncImage({
  src: srcProp,
  keyword,
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
    const kw = (keyword || '').trim();
    if (!kw) {
      setStatus('error');
      setSrc('');
      return;
    }
    setStatus('loading');
    setSrc(`https://source.unsplash.com/featured/?${encodeURIComponent(kw)}`);
  }, [srcProp, keyword]);

  const wrapperClass = [
    'async-img',
    rounded && 'async-img--round',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style = aspect ? { aspectRatio: aspect } : undefined;

  return (
    <div className={wrapperClass} style={style}>
      {src && status !== 'error' && (
        <img
          key={src}
          src={src}
          alt={alt}
          className={`async-img__img ${status === 'loaded' ? 'async-img__img--loaded' : ''}`}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
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
