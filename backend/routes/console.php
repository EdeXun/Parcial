<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

Artisan::command('db:check', function () {
    try {
        $row = DB::selectOne('SELECT DATABASE() AS db, VERSION() AS version');
        $this->info('Conexión MySQL correcta.');
        $this->line('Host: '.config('database.connections.mysql.host').':'.config('database.connections.mysql.port'));
        $this->line('Base de datos: '.$row->db);
        $this->line('Versión: '.$row->version);
        return 0;
    } catch (Throwable $error) {
        $this->error('No se pudo conectar a MySQL. Revisa host, puerto, nombre de base y credenciales en .env.');
        $this->line('Código: '.$error->getCode());
        return 1;
    }
})->purpose('Verificar la conexión a MySQL sin modificar datos ni mostrar credenciales');
