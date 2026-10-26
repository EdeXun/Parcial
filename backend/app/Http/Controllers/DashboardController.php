<?php
namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function config(): JsonResponse
    {
        $url = config('metabase.url');
        $id = config('metabase.dashboard_id');
        return response()->json(['collectionUrl' => $url.'/collection/8-parcial2', 'dashboardUrl' => $id > 0 ? $url.'/dashboard/'.$id : null]);
    }

    public function embed(): JsonResponse
    {
        $secret = config('metabase.secret');
        $id = config('metabase.dashboard_id');
        $url = config('metabase.url');
        if (!$secret || strlen($secret) < 32 || $id < 1) {
            return response()->json(['error' => 'Configura METABASE_SECRET_KEY y METABASE_DASHBOARD_ID en .env. Después ejecuta php artisan config:clear.'], 503)->header('Cache-Control', 'no-store');
        }
        if (!filter_var($url, FILTER_VALIDATE_URL) || !in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'])) {
            return response()->json(['error' => 'La URL de Metabase no es válida.'], 503);
        }
        $encode = static fn (string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
        $now = time();
        $expires = $now + 600;
        $header = $encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $payload = $encode(json_encode(['resource' => ['dashboard' => $id], 'params' => (object) [], 'iat' => $now, 'exp' => $expires], JSON_THROW_ON_ERROR));
        $signature = $encode(hash_hmac('sha256', $header.'.'.$payload, $secret, true));
        return response()->json([
            'url' => $url.'/embed/dashboard/'.$header.'.'.$payload.'.'.$signature.'#bordered=false&titled=false&theme=night',
            'expiresAt' => $expires * 1000,
        ])->header('Cache-Control', 'no-store')->header('Referrer-Policy', 'no-referrer');
    }
}
