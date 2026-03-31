# Plano de Automação Completa — Prosperus Dashboard

> Documento de planejamento para execução futura.
> Criado em: 2026-03-26

## Visão Geral

Automatizar completamente o pipeline do dashboard Prosperus:

1. **Fonte de dados**: Google Sheets (substitui upload manual do referencia.csv)
2. **Geração diária**: Cron job que busca dados da API CursoEduca + planilha, gera relatórios
3. **Distribuição**: Upload automático dos relatórios no app web para acesso dos clientes

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ Google Sheet │───▶│ Cron Job     │───▶│ Gera Relatórios │───▶│ App Web      │
│ (referencia) │    │ (diário)     │    │ (HTML/PDF/ZIP)  │    │ (upload)     │
└─────────────┘    └──────┬───────┘    └─────────────────┘    └──────────────┘
                          │
                   ┌──────▼───────┐
                   │ CursoEduca   │
                   │ API (proxy)  │
                   └──────────────┘
```

---

## Fase 1: Integração com Google Sheets

### Objetivo
Substituir o upload manual do referencia.csv por leitura direta de uma planilha Google Sheets.

### Abordagem Recomendada

**Opção A — Google Sheets API (recomendada)**
- Usar Google Sheets API v4 via service account
- Netlify Function lê a planilha e retorna como JSON
- Sem dependência de export CSV, sem limites de compartilhamento

**Opção B — Publicar como CSV**
- Publicar a planilha como CSV público (File → Share → Publish to web)
- Fetch direto da URL publicada
- Mais simples, mas depende da planilha estar publicada e expõe dados

### Implementação (Opção A)

```
Novo arquivo: netlify/functions/sheets-proxy.ts
```

1. Criar Google Cloud Project + Service Account
2. Compartilhar a planilha com o email da service account
3. Armazenar credenciais JSON como env var no Netlify (`GOOGLE_SHEETS_CREDENTIALS`)
4. Armazenar Sheet ID como env var (`GOOGLE_SHEET_ID`)
5. Netlify Function lê a planilha e retorna `ReferenciaRow[]`

### Mudanças no Frontend

- Adicionar terceiro modo no `DataSourceSelector`: **"Automático"** (icon: Cloud)
- Modo Automático: sem upload, busca referencia da planilha + dados da API
- Botão único: "Gerar Dashboard"

### Dependências
- `googleapis` (npm package) ou `google-auth-library` + fetch direto
- Google Cloud Console: APIs & Services → Enable Sheets API
- Service Account com role Viewer na planilha

### Formato da Planilha

Manter as mesmas colunas do referencia.csv:

| Nome | Cel | Email | Empresa | Programa | PC | Observações |
|------|-----|-------|---------|----------|----|-------------|

Colunas obrigatórias: **Email**, **Empresa**

---

## Fase 2: Geração Diária Automatizada

### Objetivo
Gerar relatórios para todas as empresas automaticamente, sem interação humana.

### Abordagem: Netlify Scheduled Function

Netlify suporta [Scheduled Functions](https://docs.netlify.com/functions/scheduled-functions/) que rodam em cron.

```typescript
// netlify/functions/daily-report.ts
import { Config } from "@netlify/functions";

export default async () => {
  // 1. Buscar referencia da Google Sheets
  // 2. Buscar dados da CursoEduca API (members, access, progress, enrollments)
  // 3. Filtrar por emails do referencia
  // 4. Para cada empresa: gerar relatório HTML
  // 5. Upload dos relatórios (ver Fase 3)
};

export const config: Config = {
  schedule: "0 6 * * *"  // Diariamente às 6h UTC (3h BRT)
};
```

### Considerações

**Timeout**: Netlify Functions têm limite de 10s (free) ou 26s (pro). Para 171K+ registros, isso pode não ser suficiente.

**Alternativas se timeout for problema:**

1. **Netlify Background Functions** — até 15 min de execução
2. **GitHub Actions** — cron schedule, sem limite prático de tempo
3. **Cloudflare Workers + Cron Triggers** — até 30s CPU time
4. **Servidor dedicado** — VPS com cron job Node.js

**Recomendação**: Começar com **Netlify Background Function**. Se não for suficiente, migrar para **GitHub Actions**.

### Abordagem GitHub Actions (fallback)

```yaml
# .github/workflows/daily-report.yml
name: Daily Report Generation
on:
  schedule:
    - cron: '0 6 * * *'  # 6h UTC / 3h BRT
  workflow_dispatch: # Manual trigger

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: node scripts/generate-reports.js
        env:
          CURSEDUCA_API_KEY: ${{ secrets.CURSEDUCA_API_KEY }}
          ACCESS_TOKEN: ${{ secrets.ACCESS_TOKEN }}
          GOOGLE_SHEETS_CREDENTIALS: ${{ secrets.GOOGLE_SHEETS_CREDENTIALS }}
          GOOGLE_SHEET_ID: ${{ secrets.GOOGLE_SHEET_ID }}
      - name: Upload reports
        run: node scripts/upload-reports.js
        env:
          APP_UPLOAD_API_KEY: ${{ secrets.APP_UPLOAD_API_KEY }}
```

### Script de Geração (server-side)

```
Novo arquivo: scripts/generate-reports.js
```

Pipeline:
1. Ler planilha Google Sheets → `ReferenciaRow[]`
2. Buscar 4 endpoints CursoEduca em paralelo (reutilizar lógica do client)
3. `buildParsedDatasetFromApi()` com filtro por email
4. Para cada empresa em `empresasUnicas`:
   - `filterByEmpresa(dataset, empresa)`
   - `computeMetrics(companyData)`
   - `generateCompanyHTML(empresa, metrics, companyData)` (reutilizar de exportHelpers)
5. Salvar HTMLs em `output/reports/{date}/{empresa}.html`

---

## Fase 3: Upload Automático no App Web

### Objetivo
Após gerar os relatórios, fazer upload automático no app web para que os clientes acessem.

### Pré-requisitos
- API ou método de upload do app web (endpoint, autenticação, formato)
- Mapeamento empresa → destino no app (pasta, usuário, canal)

### Implementação Genérica

```
Novo arquivo: scripts/upload-reports.js
```

```javascript
// Pseudo-código — adaptar ao app web específico
async function uploadReports() {
  const reportDir = `output/reports/${today}`;
  const files = fs.readdirSync(reportDir);

  for (const file of files) {
    const empresa = path.basename(file, '.html');
    const content = fs.readFileSync(path.join(reportDir, file));

    await appWebApi.upload({
      empresa,
      content,
      date: today,
      type: 'dashboard-report',
    });
  }
}
```

### Opções de Upload (depende do app)

| Método | Quando usar |
|--------|-------------|
| REST API | App tem endpoint de upload |
| S3/GCS + CDN | App serve arquivos de bucket |
| FTP/SFTP | App legado com acesso FTP |
| Email | Enviar relatório por email para cada empresa |
| Google Drive API | Salvar em pastas compartilhadas do Drive |

### Notificação

Após upload, notificar stakeholders:
- Slack webhook com resumo (empresas processadas, erros)
- Email com link para os relatórios
- Log de execução para auditoria

---

## Cronograma Sugerido

| Fase | Escopo | Estimativa | Dependências |
|------|--------|------------|--------------|
| **1** | Google Sheets integration | 1 epic (2-3 stories) | Google Cloud project, service account |
| **2** | Geração diária | 1 epic (2-3 stories) | Fase 1 concluída, decisão Netlify vs GitHub Actions |
| **3** | Upload automático | 1 epic (1-2 stories) | Fase 2 + definição da API do app web |

### Ordem de Execução

```
Fase 1 (Sheets) → Fase 2 (Cron) → Fase 3 (Upload)
                                  ↑
                         Pode testar manualmente
                         antes de automatizar
```

---

## Decisões Pendentes

| # | Decisão | Quem decide | Impacto |
|---|---------|-------------|---------|
| 1 | Qual app web recebe os relatórios? | Product Owner | Define Fase 3 inteira |
| 2 | Formato do relatório (HTML, PDF, ambos)? | Product Owner | Pode precisar de puppeteer para PDF |
| 3 | Frequência (diário, semanal, sob demanda)? | Product Owner | Define cron schedule |
| 4 | Netlify Background Function vs GitHub Actions? | Tech Lead | Define infra da Fase 2 |
| 5 | Credenciais Google Cloud: quem cria? | DevOps | Bloqueia Fase 1 |
| 6 | Retenção de relatórios (últimos N dias)? | Product Owner | Define cleanup policy |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Access token JWT expira | Alta | Geração para | Implementar refresh automático ou usar service account |
| API CursoEduca muda formato | Baixa | Quebra transformers | Testes automatizados detectam, alertar via Slack |
| Timeout na geração | Média | Relatórios incompletos | GitHub Actions como fallback (sem limite) |
| Google Sheets indisponível | Baixa | Sem referencia | Cache local do último referencia válido |
| Volume de dados cresce muito | Média | Lentidão | Filtro por data (últimos 6 meses) + paginação paralela |

---

## Stack Técnica Prevista

| Componente | Tecnologia |
|------------|------------|
| Planilha | Google Sheets |
| Leitura planilha | Google Sheets API v4 + service account |
| Proxy API | Netlify Functions (já implementado) |
| Scheduler | Netlify Scheduled Functions ou GitHub Actions |
| Geração HTML | Reutilizar `exportHelpers.ts` existente |
| Geração PDF | Puppeteer (se necessário) |
| Upload | REST API do app web (a definir) |
| Notificação | Slack webhook |
| Monitoramento | Netlify Function logs / GitHub Actions logs |

---

*Plano criado por Dex (Dev Agent) + Quinn (QA Agent) — 2026-03-26*
