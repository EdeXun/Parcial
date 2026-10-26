<?php
return [
    'url' => rtrim(env('METABASE_SITE_URL', 'http://localhost:3000'), '/'),
    'secret' => env('METABASE_SECRET_KEY'),
    'dashboard_id' => (int) env('METABASE_DASHBOARD_ID', 0),
    'collection_id' => 8,
];
