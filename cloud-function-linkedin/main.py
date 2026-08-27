"""
Google Cloud Function for LinkedIn Profile Scraping
Simple proxy that forwards requests to Toolhouse API
"""

import functions_framework
import requests
from flask import jsonify

@functions_framework.http
def scrape_linkedin(request):
    """
    Simple proxy to Toolhouse API
    Forwards request body to Toolhouse, returns exact response
    """
    # Enable CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    try:
        # Get request body (should have 'message' field)
        request_json = request.get_json(silent=True)

        if not request_json:
            return (jsonify({'error': 'No request body'}), 400, headers)

        print(f'📤 Forwarding to Toolhouse: {request_json}')

        # Forward EXACT request to Toolhouse
        toolhouse_url = 'https://agents.toolhouse.ai/7078fef9-081e-4f8c-b8ac-c816ef13c75f'

        response = requests.post(
            toolhouse_url,
            json=request_json,
            headers={'Content-Type': 'application/json'},
            timeout=60
        )

        print(f'📥 Received from Toolhouse: {response.status_code}')

        if not response.ok:
            return (jsonify({'error': f'Toolhouse error: {response.status_code}'}), 500, headers)

        # Return EXACT response from Toolhouse
        return (jsonify(response.json()), 200, headers)

    except Exception as e:
        print(f'❌ Error: {str(e)}')
        return (jsonify({'error': str(e)}), 500, headers)
