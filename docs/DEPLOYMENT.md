# Deployment

BloodGrid can be shared as a public HackGT demo without committing any keys.
The recommended free-tier setup is Vercel for the Next.js frontend and Render
for the FastAPI backend.

## Before Deployment

- Keep `.env` out of Git. It contains local Mapbox values.
- Use a Mapbox public token for `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` and restrict
  it to the final Vercel domain after it is created.
- Use a separate Mapbox token for `MAPBOX_ACCESS_TOKEN` on Render. This one is
  server-side and must never be exposed to the browser or committed to Git.
- Deploy the backend first, because Vercel needs its public URL during the
  frontend build.

## Backend: Render

1. In Render, create a Blueprint from the GitHub repository. It will detect
   `render.yaml` and create the `bloodgrid-api` web service.
2. Keep the free service type for the hackathon prototype.
3. Add these environment values in Render's service settings:
   - `MAPBOX_ACCESS_TOKEN`: private Mapbox routing token.
   - `BLOODGRID_FRONTEND_ORIGINS`: the exact production Vercel URL, for example
     `https://bloodgrid.vercel.app`. Do not add a trailing slash.
4. After deployment, open `/health` on the Render URL. It should return an
   `ok` status and the selected scenario ID.

Render's free web service may sleep after inactivity. Open the public demo a
minute or two before presenting so it can wake up.

## Frontend: Vercel

1. Import the GitHub repository into Vercel.
2. Set the project's Root Directory to `frontend`.
3. Add these environment values for the Production environment *before*
   deploying:
   - `NEXT_PUBLIC_BACKEND_BASE_URL`: the public Render API URL, for example
     `https://bloodgrid-api.onrender.com`.
   - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`: the restricted public Mapbox browser
     token.
4. Deploy. Vercel builds `NEXT_PUBLIC_*` values into the browser bundle, so
   redeploy after changing either value.
5. Copy the exact Vercel URL into Render's `BLOODGRID_FRONTEND_ORIGINS`, save,
   and redeploy the Render service.

## Presentation Check

1. Open the Vercel URL from a browser that was not used for development.
2. Confirm the map appears and the System and Ambulance views both load.
3. Select a synthetic incident and confirm route lines and times appear.
4. Keep the demo labeled as synthetic decision-support data, not live EMS or
   clinical guidance.

## Security and Limits

- Never put `MAPBOX_ACCESS_TOKEN` in the frontend or GitHub.
- The browser token is public by design. Restrict it to the Vercel domain in
  Mapbox and do not give it backend routing privileges.
- The backend only permits browser calls from the exact origins in
  `BLOODGRID_FRONTEND_ORIGINS`.
- The free hosts are suitable for a prototype, not a production EMS service.
