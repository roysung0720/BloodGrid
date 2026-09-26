# Frontend

This folder contains the Next.js dashboard. It displays the selected scenario: stations, hospitals, Blood Response Units, approved rendezvous points, the simulated blood request, and road-based baseline coverage for synthetic demand proxies.

Do not add a multi-page marketing site. The main operational dashboard is the product's first screen.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

The dashboard expects the FastAPI service at `http://localhost:8000`. It reads the Mapbox browser token from the root `.env` file and uses `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. Baseline coverage is calculated by the backend, not in the browser, and selecting a demand point shows its fastest eligible response resource and estimated time breakdown.
