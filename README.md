# Prosperus Club — Dashboard de Uso da Plataforma

Ferramenta que consolida dados de treinamento corporativo da plataforma CursoEduca e
gera dashboards/relatórios HTML por empresa para o Prosperus Club.

A planilha do Google Sheets é a **fonte de referência** (mapeia e-mail → empresa, define
quem recebe relatório). Os dados de uso (acessos, conclusões, progresso, matrículas) vêm da
**API da CursoEduca**.

## Como funciona

O dashboard tem 3 modos de carregamento de dados (`src/services/dataSourceOrchestrator.ts`):

| Modo | Origem dos dados | Uso |
|---|---|---|
| `auto` | Google Sheets (referência) + CursoEduca API, sem upload | Modo padrão da aplicação web |
| `api`  | CursoEduca API, referência já carregada | Reprocessamento |
| `csv`  | Upload manual de 5 arquivos CSV | Fallback offline |

Além da aplicação web, um **job diário no GitHub Actions** gera os relatórios e os envia
por webhook para cada destinatário (ver "Relatório diário automático").

## Arquitetura / fluxo de dados

```
Navegador (modo auto)
  ├─ /.netlify/functions/sheets-proxy  → Google Sheets (referência)
  └─ /.netlify/functions/api-proxy     → CursoEduca API (acessos/conclusões/progresso/matrículas)

Job diário (scripts/generate-reports.ts, roda no GitHub Actions)
  ├─ lê Google Sheets direto (googleapis)
  ├─ lê CursoEduca API direto
  ├─ gera HTML por empresa
  └─ envia via PROSPERUS_WEBHOOK_URL
```

As credenciais ficam **no servidor** (Netlify Functions / GitHub Secrets) — nunca no bundle do
navegador. As funções `sheets-proxy` e `api-proxy` existem justamente para esconder as chaves.

## Planilha de Referência (Google Sheets)

A planilha é identificada por `GOOGLE_SHEET_ID` e a **aba** (página) por `GOOGLE_SHEET_GID`.

> O `gid` aparece na URL da planilha: `.../edit#gid=1568469200`.
> Atualmente a aba lida é **"Referência"** (`gid=1568469200`).

A leitura usa o range `'<nome da aba>'!A:Z` — pega todas as colunas presentes. O nome da aba é
resolvido automaticamente a partir do `gid` em tempo de execução, então **renomear a aba não
quebra nada**; só não troque o `gid`.

Se `GOOGLE_SHEET_GID` estiver vazio, o sistema lê a **primeira aba** da planilha
(comportamento legado).

### Como apontar para outra aba ou planilha

1. **Outra aba (mesma planilha):** copie o `gid` da URL da nova aba e atualize `GOOGLE_SHEET_GID`
   em três lugares: `.env` (local), GitHub (ver workflow) e Netlify (variáveis de ambiente).
2. **Outra planilha:** atualize `GOOGLE_SHEET_ID` (e o `GOOGLE_SHEET_GID` da aba desejada).
   Garanta que a conta de serviço (`GOOGLE_SHEETS_CREDENTIALS`) tenha acesso de leitura à nova planilha.

### Colunas esperadas

A leitura mapeia o cabeçalho (linha 1) → objeto, dinamicamente. **Colunas extras são ignoradas**
(ex.: `Nº`, `Vencimento`), então adicionar colunas não afeta o processamento.

Colunas efetivamente usadas pelo parser (`src/services/csvParser.ts`):

| Coluna | Uso | Obrigatória |
|---|---|---|
| `Email` | Chave de junção com os dados da API | Sim |
| `Empresa` | Agrupamento dos relatórios por empresa | Sim |
| `Nome` | Exibição | Recomendada |
| `Recebe o relatório?` | `Sim` ⇒ destinatário do relatório diário | Sim (para envio) |

> Atenção a acentos e ao `?` final — os nomes das colunas são comparados exatamente.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha. Veja onde cada variável é usada:

| Variável | Onde | Descrição |
|---|---|---|
| `GOOGLE_SHEETS_CREDENTIALS` | Servidor / CI | JSON da conta de serviço Google (uma linha) |
| `GOOGLE_SHEET_ID` | Servidor / CI | ID da planilha (da URL) |
| `GOOGLE_SHEET_GID` | Servidor / CI | `gid` da aba de referência (da URL). Vazio ⇒ primeira aba |
| `CURSEDUCA_API_KEY` | Servidor / CI | Chave da API CursoEduca |
| `ACCESS_TOKEN` | Servidor / CI | Bearer token da API CursoEduca |
| `PROSPERUS_WEBHOOK_URL` | CI | Endpoint que recebe os relatórios |
| `PROSPERUS_WEBHOOK_SECRET` | CI | Segredo do webhook |
| `VITE_PROSPERUS_WEBHOOK_URL` | Frontend (build) | Webhook usado pelo botão de envio na UI |
| `VITE_PROSPERUS_WEBHOOK_SECRET` | Frontend (build) | Segredo do webhook na UI |

- **Netlify:** configure as variáveis "Servidor" + `VITE_*` em Site settings → Environment variables.
- **GitHub Actions:** as variáveis de CI vêm de Secrets; o `GOOGLE_SHEET_GID` está fixado no
  workflow (`.github/workflows/daily-report.yml`) por não ser sensível.

## Scripts

```bash
npm install
npm run dev               # aplicação web (Vite)
npm run build             # tsc -b && vite build → dist/
npm run preview           # preview local do build
npm run lint              # ESLint
npm run generate-reports  # gera e ENVIA os relatórios diários (ver aviso abaixo)
```

> ⚠️ `npm run generate-reports` **envia relatórios reais** por webhook para todos os
> destinatários marcados com `Sim`. Não rode casualmente. O script lê `process.env` direto e
> não carrega o `.env` sozinho — para rodar localmente, passe a flag do Node via tsx:
> `npx tsx --env-file=.env scripts/generate-reports.ts`.

## Relatório diário automático (GitHub Actions)

Workflow: `.github/workflows/daily-report.yml`

- Agendado para **10h UTC (7h BRT)** todo dia; também pode ser disparado manualmente
  (workflow_dispatch).
- Etapas: lint → typecheck (`tsc -b`) → `npm run generate-reports` → upload dos HTMLs como artifact.
- Requer os Secrets do GitHub listados na tabela de variáveis (seção "CI").

## Deploy (Netlify)

`netlify.toml` configura o build e as funções. Faça deploy de `dist/` (build automático no
push). As Netlify Functions (`netlify/functions/`) são publicadas junto e usam as variáveis
de ambiente do servidor.

## Stack

- React 19 + TypeScript (strict)
- Vite 7 + TailwindCSS v4
- Recharts (no app) + HTML/Chart.js (relatórios exportados)
- PapaParse (CSV) · googleapis (Sheets) · Netlify Functions (proxies)
