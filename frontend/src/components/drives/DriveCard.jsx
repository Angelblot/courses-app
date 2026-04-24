import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';

export function DriveCard({ config, onTest }) {
  return (
    <Card className="drive-card">
      <div className="drive-card__body">
        <div className="drive-card__title">{config.display_name || config.name}</div>
        <div className="drive-card__meta">
          <Badge variant={config.enabled ? 'success' : 'muted'}>
            {config.enabled ? 'Actif' : 'Désactivé'}
          </Badge>
          {config.default_store && <span>{config.default_store}</span>}
        </div>
      </div>
      <Button variant="secondary" onClick={() => onTest(config.name)}>
        Test connexion
      </Button>
    </Card>
  );
}
