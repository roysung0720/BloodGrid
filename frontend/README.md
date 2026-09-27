# Frontend

This folder contains the Next.js dashboard. It displays the selected scenario: stations, hospitals, Blood Response Units, approved rendezvous points, the simulated blood request, road-based baseline coverage, an optimized strategic staging comparison, and a live rendezvous comparison for synthetic data.

Do not add a multi-page marketing site. The main operational dashboard is the product's first screen.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

The dashboard expects the FastAPI service at `http://localhost:8000`. It reads the Mapbox browser token from the root `.env` file and uses `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. Baseline coverage, strategic deployment, and live rendezvous results are calculated by the backend, not in the browser. The live incident panel compares direct transport with approved points, identifies the chosen point on the map, and preserves the supplied hospital as context rather than a selectable recommendation.
