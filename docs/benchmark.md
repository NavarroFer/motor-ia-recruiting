# Benchmark de búsqueda

Fecha: 2026-10-24 05:43 UTC
Máquina: Apple M5 · 10 núcleos · 16 GB
Base: Postgres 16 + pgvector (docker)

| Métrica | Valor |
|---|---|
| Perfiles indexados | 100.000 |
| Búsquedas | 200 (concurrencia 1) |
| p50 | 33 ms |
| p95 | 46 ms |
| p99 | 81 ms |
| Máximo | 250 ms |
| Throughput | 28.3 búsquedas/s |
| Candidatos que cumplen (promedio, top 50) | 24.3 |
| Explicación por requisitos, top 10 | 35 ms |
| Consulta vectorial usa HNSW | sí |

Qué mide: la función `search()` de la app de punta a punta (vector de la consulta desde caché, kNN con HNSW,
evaluación de requisitos, score y guardado de la búsqueda). No incluye la interpretación de la consulta con IA
(0,5–1 s la primera vez; 0 s si está en caché) ni la red hasta el navegador.
Datos sintéticos: skills al azar y vectores agrupados en 40 clusters. Costo de APIs: USD 0.
