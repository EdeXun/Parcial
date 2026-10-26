<?php
namespace Tests\Feature;

use Tests\TestCase;

class DashboardTest extends TestCase
{
    public function test_incomplete_configuration_returns_service_unavailable(): void
    {
        config(['metabase.secret' => null, 'metabase.dashboard_id' => 0]);
        $this->getJson('/api/dashboard')->assertStatus(503)->assertJsonStructure(['error']);
    }

    public function test_token_is_signed_and_restricted_to_configured_dashboard(): void
    {
        $secret = str_repeat('a', 64);
        config(['metabase.secret' => $secret, 'metabase.dashboard_id' => 19, 'metabase.url' => 'http://localhost:3000']);
        $response = $this->getJson('/api/dashboard?dashboardId=99')->assertOk();
        $token = basename(parse_url($response->json('url'), PHP_URL_PATH));
        [$header, $payload, $signature] = explode('.', $token);
        $decoded = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
        $this->assertSame(19, $decoded['resource']['dashboard']);
        $this->assertSame(600, $decoded['exp'] - $decoded['iat']);
        $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $header.'.'.$payload, $secret, true)), '+/', '-_'), '=');
        $this->assertSame($expected, $signature);
        $this->assertStringNotContainsString($secret, $response->getContent());
    }
}
