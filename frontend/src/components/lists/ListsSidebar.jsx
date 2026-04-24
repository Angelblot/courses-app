export function ListsSidebar({ lists, selectedId, onSelect }) {
  if (lists.length === 0) {
    return <div className="empty">Aucune liste</div>;
  }

  return (
    <div className="lists-sidebar">
      {lists.map((l) => (
        <button
          key={l.id}
          onClick={() => onSelect(l.id)}
          className={`list-tab ${selectedId === l.id ? 'list-tab--active' : ''}`}
          aria-current={selectedId === l.id ? 'true' : undefined}
        >
          <div style={{ fontWeight: 600 }}>{l.name}</div>
          <div className="list-tab__count">{l.items?.length || 0} articles</div>
        </button>
      ))}
    </div>
  );
}
