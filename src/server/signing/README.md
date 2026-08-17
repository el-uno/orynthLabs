# Signing Boundary

Server-only signing code lives here.

Design rule:

- `poolCreator` secret stays in KMS/custody/backend infrastructure
- `launcher` signs as payer
- frontend code must never import or reference private signing material
