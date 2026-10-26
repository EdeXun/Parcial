# Revisión de la práctica

Dashboard: http://localhost:3000/dashboard/7 · Colección Parcial2 (8).

| Pregunta | Comprobación |
|---|---|
| 90 · Distribución | Barras. X: categorías A, B, C, D, F. Y: conteo. Total: 12,025 registros. |
| 91 · Educación parental | Barras agrupadas. X: nivel educativo de madre y padre. Y: promedio de nota final. Series por género. 42 combinaciones. Etiquetas traducidas al español y tarjeta ampliada. |
| 92 · Estudio | Dispersión. X: horas semanales. Y: nota final porcentual. 12,025 filas devueltas; sin truncamiento de la consulta. |
| 93 · Brecha digital | Dona de aprobados/reprobados con porcentajes y filtro de acceso a internet. Criterio explícito: nota final >= 60/100. |
| 94 · Asistencia | Líneas. X: inicio del intervalo de asistencia (50, 60, 70, 80, 90); Y: promedio de nota final. Se muestran solo intervalos con registros. |

## Filtro de internet comprobado

| Acceso | Aprobados | Reprobados | Total | Aprobación |
|---|---:|---:|---:|---:|
| Sin internet (0) | 4,166 | 1,798 | 5,964 | 69.85% |
| Con internet (1) | 4,763 | 1,117 | 5,880 | 81.00% |
| Ambos, sin filtro | 8,929 | 2,915 | 11,844 | 75.39% |

Se excluyen 181 registros sin acceso a internet informado. El filtro afecta únicamente a la dona, de acuerdo con el análisis solicitado.

## Interpretación de asistencia

La gráfica 5 se restauró al formato original solicitado: inicios de intervalo 50, 60, 70, 80 y 90, con promedios 66.30, 63.39, 64.54, 66.66 y 69.16. Los rangos son [50,60), [60,70), [70,80), [80,90) y [90,100]. No se muestran los rangos vacíos. Los datos no permiten afirmar un umbral crítico sólido.

Las gráficas muestran asociaciones; no demuestran causalidad. Se cuentan los registros tal como fueron importados. La aprobación de 60/100 es una decisión explícita de esta práctica, no un umbral proporcionado por el enunciado.

Comprobación reproducible: ejecutar `npm run review:metabase` desde `backend/`. Los resultados se guardan en `data/revision-metabase.json`. La exportación a PDF sigue siendo un entregable pendiente.
