# Deployment

BloodGrid can be shared as a public HackGT demo without committing any keys.
The current public-demo setup uses GitHub Pages for the static Next.js frontend
and Render for the FastAPI backend. Vercel remains a compatible alternative if
the project later needs preview deployments.

## Before Deployment

- Keep `.env` out of Git. It contains local Mapbox values.
- Use a Mapbox public token for `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` and restrict
  it to `https://roysung0720.github.io` after Pages is live.
- Use a separate Mapbox token for `MAPBOX_ACCESS_TOKEN` on Render. This one is
  server-side and must never be exposed to the browser or committed to Git.
- Deploy the backend first, because the Pages workflow needs its public URL
  during the frontend build.

## Backend: Render

1. In Render, create a Blueprint from the GitHub repository. It will detect
   `render.yaml` and create the `bloodgrid-api` web service.
2. Keep the free service type for the hackathon prototype.
3. Add these environment values in Render's service settings:
   - `MAPBOX_ACCESS_TOKEN`: private Mapbox routing token.
   - `BLOODGRID_FRONTEND_ORIGINS`: the Pages browser origin,
     `https://roysung0720.github.io`. Do not add a trailing slash or the
     `/BloodGrid/` path.
4. After deployment, open `/health` on the Render URL. It should return an
   `ok` status and the selected scenario ID.

Render's free web service may sleep after inactivity. Open the public demo a
minute or two before presenting so it can wake up.

## Frontend: GitHub Pages

1. In GitHub repository **Settings** -> **Secrets and variables** ->
   **Actions**, add a repository secret named
   `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` containing the restricted public Mapbox
   browser token. It is intentionally compiled into the browser bundle, but is
   kept out of source control.
2. In **Settings** -> **Pages**, select **GitHub Actions** as the source.
3. The tracked `.github/workflows/deploy-pages.yml` workflow builds the
   `frontend/` app and deploys it after each push to `main`.
4. The public demo URL is `https://roysung0720.github.io/BloodGrid/`.
5. Set Render's `BLOODGRID_FRONTEND_ORIGINS` to
   `https://roysung0720.github.io`, save, and redeploy the API service.

The Pages workflow builds `NEXT_PUBLIC_BACKEND_BASE_URL` as
`https://bloodgrid-api.onrender.com`. It compiles the Mapbox public token into
the static browser files, so a Pages redeploy is required after changing that
secret.

## Presentation Check

1. Open the GitHub Pages URL from a browser that was not used for development.
2. Confirm the map appears and the System and Ambulance views both load.
3. Select a synthetic incident and confirm route lines and times appear.
4. Keep the demo labeled as synthetic decision-support data, not live EMS or
   clinical guidance.

## Security and Limits

- Never put `MAPBOX_ACCESS_TOKEN` in the frontend or GitHub.
- The browser token is public by design. Restrict it to the GitHub Pages domain in
  Mapbox and do not give it backend routing privileges.
- The backend only permits browser calls from the exact origins in
  `BLOODGRID_FRONTEND_ORIGINS`.
- The free hosts are suitable for a prototype, not a production EMS service.
