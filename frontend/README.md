# Frontend

This folder contains the Next.js dashboard. It displays the selected scenario: stations, hospitals, Blood Response Units, approved rendezvous points, the simulated blood request, road-based baseline coverage, and an optimized strategic staging comparison for synthetic demand proxies.

Do not add a multi-page marketing site. The main operational dashboard is the product's first screen.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

The dashboard expects the FastAPI service at `http://localhost:8000`. It reads the Mapbox browser token from the root `.env` file and uses `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. Baseline coverage and strategic deployment are calculated by the backend, not in the browser. The strategic panel switches between current and recommended views, while selecting a demand point shows its estimated response details.
