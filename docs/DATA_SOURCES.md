# Data Sources and Provenance

Every file added under `data/` needs a short provenance record containing:

- source name and URL/provider;
- download or creation date;
- geographic coverage;
- important fields and transformations;
- limitations;
- whether the values are real or synthetic.

## Expected data categories

| Category | MVP source approach | Label |
| --- | --- | --- |
| Geography, road travel, stations, hospitals | Public real-world sources where practical | REAL |
| Severe-trauma demand | Public crash geography or another defensible proxy | REAL PROXY |
| Blood inventory, expiration, credentials, availability, shifts | Purpose-built demo values | SYNTHETIC |
| Live incidents | Controlled demo scenarios | SYNTHETIC |

Synthetic values must never be represented as live EMS, blood-bank, or patient data. Source notes will live beside each dataset or in a central manifest as the data world is created.
