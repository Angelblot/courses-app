import { useState, useRef, useEffect, useCallback } from 'react';

const SWIPE_THRESHOLD = 90;

export function SwipeStack({
  items,
  onAccept,
  onReject,
  renderCard,
  emptyState,
  getId = (item) => item.id,
}) {
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(null);
  const [exit, setExit] = useState(null);
  const startRef = useRef(null);
  const itemsKey = items.map(getId).join('|');

  useEffect(() => {
    setIdx(0);
    setDrag(null);
    setExit(null);
  }, [itemsKey]);

  const topItem = items[idx];

  const commitSwipe = useCallback(
    (direction) => {
      if (!topItem || exit) return;
      setExit(direction);
      setDrag(null);
      const item = topItem;
      window.setTimeout(() => {
        if (direction === 'right') onAccept?.(item);
        else onReject?.(item);
        setIdx((i) => i + 1);
        setExit(null);
      }, 260);
    },
    [topItem, exit, onAccept, onReject],
  );

  function onPointerDown(e) {
    if (e.target.closest('[data-no-drag], button, input, label, select, textarea, a')) return;
    if (!topItem || exit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0 });
  }

  function onPointerMove(e) {
    if (!drag || exit || !startRef.current) return;
    setDrag({
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
    });
  }

  function onPointerUp() {
    if (!drag || exit) return;
    if (Math.abs(drag.x) > SWIPE_THRESHOLD) {
      commitSwipe(drag.x > 0 ? 'right' : 'left');
    } else {
      setDrag(null);
    }
  }

  if (!topItem) return emptyState || null;

  const visible = items.slice(idx, idx + 3);

  return (
    <div className="swipe-wrap">
      <div className="swipe-stack">
        {visible
          .slice()
          .reverse()
          .map((item, rIdx) => {
            const layer = visible.length - 1 - rIdx;
            const isTop = layer === 0;
            let style;
            if (isTop && exit) {
              const x = exit === 'right' ? 540 : -540;
              const r = exit === 'right' ? 22 : -22;
              style = {
                transform: `translate(${x}px, 0) rotate(${r}deg)`,
                opacity: 0,
                transition: 'transform 260ms ease, opacity 260ms ease',
              };
            } else if (isTop && drag) {
              const r = drag.x / 22;
              style = {
                transform: `translate(${drag.x}px, ${drag.y * 0.3}px) rotate(${r}deg)`,
                transition: 'none',
              };
            } else {
              style = {
                transform: `translateY(${layer * 10}px) scale(${1 - layer * 0.04})`,
                opacity: layer === 2 ? 0.8 : 1,
                transition: 'transform 260ms ease, opacity 260ms ease',
              };
            }

            const acceptOpacity = isTop && drag ? Math.min(1, Math.max(0, drag.x / SWIPE_THRESHOLD)) : 0;
            const rejectOpacity = isTop && drag ? Math.min(1, Math.max(0, -drag.x / SWIPE_THRESHOLD)) : 0;

            return (
              <div
                key={getId(item)}
                className={`swipe-card ${isTop ? 'swipe-card--top' : ''}`}
                style={style}
                onPointerDown={isTop ? onPointerDown : undefined}
                onPointerMove={isTop ? onPointerMove : undefined}
                onPointerUp={isTop ? onPointerUp : undefined}
                onPointerCancel={isTop ? onPointerUp : undefined}
              >
                {renderCard(item, { isTop, commitSwipe })}
                {isTop && (
                  <>
                    <div className="swipe-badge swipe-badge--accept" style={{ opacity: acceptOpacity }}>
                      Garder
                    </div>
                    <div className="swipe-badge swipe-badge--reject" style={{ opacity: rejectOpacity }}>
                      Passer
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
