# LinkedIn Scraper Cloud Function

Simple proxy to Toolhouse API for LinkedIn profile scraping.

## Deploy

```bash
gcloud functions deploy scrape-linkedin \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=scrape_linkedin \
  --trigger-http \
  --allow-unauthenticated \
  --project=crafty-cairn-469222-a8
```

## Test

```bash
curl -X POST https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/scrape-linkedin \
  -H "Content-Type: application/json" \
  -d '{"message": "Please scrape my full LinkedIn profile from https://www.linkedin.com/in/eimis-pacheco. Return ONLY the JSON data with no additional text before or after."}'
```

## What It Does

1. Receives request from extension with `{message: "..."}`
2. Forwards EXACT request to Toolhouse API
3. Returns EXACT response from Toolhouse
4. No parsing, no modifications - just a simple proxy
