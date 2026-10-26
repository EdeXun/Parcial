<?php

use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['application' => 'Parcial2', 'backend' => 'Laravel', 'frontend' => 'http://127.0.0.1:5173']));
Route::get('/api/config', [DashboardController::class, 'config']);
Route::get('/api/dashboard', [DashboardController::class, 'embed']);
Route::get('/api/health', fn () => response()->json(['status' => 'ok', 'framework' => 'Laravel', 'configured' => (bool) (config('metabase.secret') && config('metabase.dashboard_id'))]));
