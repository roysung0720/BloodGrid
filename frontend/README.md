# Frontend

This folder contains the Next.js dashboard. The first increment is a map-first display of the selected scenario: stations, hospitals, Blood Response Units, demand proxies, approved rendezvous points, and the simulated blood request.

Do not add a multi-page marketing site. The main operational dashboard is the product's first screen.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

The dashboard expects the FastAPI service at `http://localhost:8000`. It reads the Mapbox browser token from the root `.env` file and uses `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.
