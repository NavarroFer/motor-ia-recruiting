"""Modelo de costos - Motor IA Recruiting. Precios USD, us-east-1, octubre 2026.
Uso: python3 docs/costos.py
"""

M = 1_000_000
H = 730  # horas/mes

# --- Precios (fuentes en la propuesta) ---
HAIKU_BATCH_IN, HAIKU_BATCH_OUT = 0.05 / M, 0.25 / M   # Haiku 5.5 batch, prompts <=100k
HAIKU_IN, HAIKU_OUT = 0.10 / M, 0.50 / M               # Haiku 5.5 estandar
HAIKU_CACHE_READ_BATCH = HAIKU_BATCH_IN * 0.1
EMB = 0.02 / M                                         # text-embedding-3-small
TEXTRACT_PAGE = 0.0015
FARGATE_VCPU_H, FARGATE_GB_H = 0.04048, 0.004445
RDS_T4G_MED_H = 0.065
RDS_R6G_LARGE_MAZ_H = 0.450
GP3_GB = 0.115
S3_GB = 0.023
ALB_H = 0.0225
VERCEL_PRO = 20  # incluye 1 seat + $20 credito
VERCEL_SEAT = 20

# --- Supuestos por CV ---
SYS_TOKENS = 1_500      # instrucciones + esquema JSON
TOOL_TOKENS = 406       # tool forzada (Haiku 5.5)
CV_TOKENS = 1_800       # CV de ~2 paginas (tokenizer nuevo)
OUT_TOKENS = 800        # JSON estructurado
RETRY = 1.05            # 5% reintentos por validacion
PRIORITY_SHARE = 0.10   # 10% por carril inmediato (precio estandar)
EMB_TOKENS = 500
SCANNED_SHARE = 0.15    # fase 2
PAGES = 2

# --- Supuestos de busqueda ---
CVS_PER_CLIENT = 1_000
SEARCHES_PER_RECRUITER_MONTH = 20 * 22
PARSE_IN, PARSE_OUT = 1_200, 200
EXPL_IN, EXPL_OUT = 1_600, 250
EXPL_PER_SEARCH = 10


def ingest_cost(cache=False):
    sys_cost_batch = (SYS_TOKENS + TOOL_TOKENS) * (HAIKU_CACHE_READ_BATCH if cache else HAIKU_BATCH_IN)
    batch = sys_cost_batch + CV_TOKENS * HAIKU_BATCH_IN + OUT_TOKENS * HAIKU_BATCH_OUT
    std = (SYS_TOKENS + TOOL_TOKENS + CV_TOKENS) * HAIKU_IN + OUT_TOKENS * HAIKU_OUT
    llm = ((1 - PRIORITY_SHARE) * batch + PRIORITY_SHARE * std) * RETRY
    return llm + EMB_TOKENS * EMB


def search_cost(explanations=EXPL_PER_SEARCH):
    parse = PARSE_IN * HAIKU_IN + PARSE_OUT * HAIKU_OUT
    expl = explanations * (EXPL_IN * HAIKU_IN + EXPL_OUT * HAIKU_OUT)
    return parse + expl


def infra(scale):
    if scale == "10k":
        rds = RDS_T4G_MED_H * H + 50 * GP3_GB
        api = 2 * (0.5 * FARGATE_VCPU_H + 1 * FARGATE_GB_H) * H
        workers = 1 * (0.5 * FARGATE_VCPU_H + 1 * FARGATE_GB_H) * H
        s3_gb = 10_000 * 0.3 / 1000 * 12   # 300 KB/CV, 12 meses retenidos
        seats = 1
    else:
        rds = RDS_R6G_LARGE_MAZ_H * H + 2 * 200 * GP3_GB
        api = 4 * (1 * FARGATE_VCPU_H + 2 * FARGATE_GB_H) * H
        workers = 3 * (1 * FARGATE_VCPU_H + 2 * FARGATE_GB_H) * H
        s3_gb = 100_000 * 0.3 / 1000 * 12
        seats = 2
    net_obs = ALB_H * H + 15  # ALB + LCU/CloudWatch aprox.
    vercel = VERCEL_PRO + (seats - 1) * VERCEL_SEAT
    return dict(postgres=rds, api=api, workers=workers, s3=s3_gb * S3_GB,
                red_obs=net_obs, vercel=vercel)


def scenario(cvs, scale):
    clients = cvs // CVS_PER_CLIENT
    searches = clients * SEARCHES_PER_RECRUITER_MONTH
    ia_ingest = cvs * ingest_cost()
    ia_search = searches * search_cost()
    inf = infra(scale)
    total_inf = sum(inf.values())
    subtotal = ia_ingest + ia_search + total_inf
    contingency = 0.20 * subtotal
    total = subtotal + contingency
    return dict(cvs=cvs, clients=clients, searches=searches, ia_ingest=ia_ingest,
                ia_search=ia_search, infra=inf, infra_total=total_inf,
                contingency=contingency, total=total,
                per_cv=total / cvs, per_client=total / clients)


if __name__ == "__main__":
    print(f"Costo IA por CV (base): ${ingest_cost():.6f}")
    print(f"Costo IA por CV (con cache del sistema): ${ingest_cost(cache=True):.6f}")
    print(f"Todo estandar sin batch: ${((SYS_TOKENS+TOOL_TOKENS+CV_TOKENS)*HAIKU_IN+OUT_TOKENS*HAIKU_OUT)*RETRY + EMB_TOKENS*EMB:.6f}")
    print(f"Busqueda (10 explicaciones): ${search_cost():.6f}")
    print(f"Busqueda (3 explicaciones on-demand): ${search_cost(3):.6f}")
    print(f"OCR por CV escaneado (Textract, {PAGES} pags): ${PAGES*TEXTRACT_PAGE:.4f}")
    print(f"OCR fase 2 a 100k ({SCANNED_SHARE:.0%} escaneados): ${100_000*SCANNED_SHARE*PAGES*TEXTRACT_PAGE:.2f}/mes")
    for cvs, sc in [(10_000, "10k"), (100_000, "100k")]:
        r = scenario(cvs, sc)
        print(f"\n=== {cvs:,} CVs/mes ({r['clients']} clientes, {r['searches']:,} busquedas) ===")
        print(f"IA ingesta: ${r['ia_ingest']:.2f}")
        print(f"IA busqueda: ${r['ia_search']:.2f}")
        for k, v in r["infra"].items():
            print(f"  {k}: ${v:.2f}")
        print(f"Infra total: ${r['infra_total']:.2f}")
        print(f"Contingencia 20%: ${r['contingency']:.2f}")
        print(f"TOTAL: ${r['total']:.2f}  | por CV ${r['per_cv']:.4f} | por cliente ${r['per_client']:.2f}")
