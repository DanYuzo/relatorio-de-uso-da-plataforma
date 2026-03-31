# Epic 1: Integração CursoEduca API — Automação da Extração de Dados

## Epic Goal

Eliminar a necessidade de extração manual de 4 dos 5 CSVs da plataforma CursoEduca, conectando diretamente via API REST para buscar dados de acessos, conclusões, progresso e último acesso. O `referencia.csv` permanece como upload manual (fonte de verdade curada para mapeamento email→empresa). Manter modo CSV completo como fallback.

## Epic Description

### Existing System Context

- **Funcionalidade atual:** App React + TypeScript (Vite) que recebe 5 CSVs via upload manual, processa client-side e gera dashboards interativos por empresa com export HTML/ZIP
- **Technology stack:** React 19, TypeScript 5.8, Vite 7, TailwindCSS v4, PapaParse, Recharts, Chart.js, JSZip, Netlify
- **Integration points:** Pipeline `processDataset()` → `computeMetrics()` → dashboard/export. Interface central: `ParsedDataset` em `src/types/csv.ts`

### Enhancement Details

- **O que muda:** Novo backend proxy (Netlify Functions) + client API + adapter que transforma dados da CursoEduca API nos mesmos tipos CSV existentes (`ReferenciaRow`, `AcessoRow`, etc.)
- **Como integra:** Adapter Pattern — nova camada converte API → `ParsedDataset`. Pipeline downstream (`metricsComputer`, `exportHelpers`, componentes de dashboard) permanece inalterada
- **Modo híbrido:** Upload `referencia.csv` manual + fetch automático dos outros 4 datasets via API
- **Fallback:** Modo CSV completo (upload dos 5 arquivos) continua 100% funcional

### Success Criteria

- [ ] Dados de acessos, conclusões, progresso e último acesso são buscados automaticamente da API CursoEduca
- [ ] referencia.csv continua sendo uploaded manualmente como fonte de verdade
- [ ] Dashboard renderiza corretamente com dados da API (mesmas métricas que com CSV)
- [ ] Export HTML/ZIP funciona identicamente com dados da API
- [ ] Modo CSV completo continua funcionando como fallback
- [ ] API key armazenada seguramente como variável de ambiente (nunca exposta client-side)

---

## Decisões Arquiteturais

### referencia.csv É Fonte de Verdade (INEGOCIÁVEL)

Os grupos de acesso na CursoEduca estão mal configurados — contêm pessoas erradas. A planilha `referencia.csv` é curada manualmente com exatamente as pessoas corretas de cada time/empresa. **Email é a chave primária** (nomes causam problemas de formatação: maiúsculas/minúsculas, sobrenomes diferentes).

**Implicação:** O mapeamento email→empresa vem SEMPRE do `referencia.csv`, nunca dos grupos da API. A API fornece apenas dados de atividade (acessos, conclusões, progresso).

### Mapeamento CSV → API

| CSV Atual | Endpoint API | Serviço | Paginação |
|-----------|-------------|---------|-----------|
| `referencia.csv` | **MANTÉM UPLOAD MANUAL** | — | — |
| `acessos.csv` | `GET /reports/access` | Members (`prof.curseduca.pro`) | limit/offset, filtros de data |
| `conclusoes.csv` | `GET /reports/progress` | Contents (`clas.curseduca.pro`) | max 100/página |
| `progresso.csv` | `GET /api/reports/enrollments` | Contents (`clas.curseduca.pro`) | max 100/página |
| `ultimo_acesso.csv` | `GET /members` (campo `lastAccess`) | Members (`prof.curseduca.pro`) | limit/offset |

### Autenticação

- Header: `api_key: {chave}` para chamadas server-to-server
- Armazenada como variável de ambiente Netlify (`CURSEDUCA_API_KEY`)
- Proxy serverless injeta header automaticamente

---

## Stories

### Story 1.1: Backend Proxy + Tipos da API

- **Description:** Criar Netlify Function como proxy seguro para a CursoEduca API + interfaces TypeScript das respostas
- **Executor:** `@dev`
- **Quality Gate:** `@architect`
- **Quality Gate Tools:** `[security_review, api_contract_validation]`
- **Scope:**
  - Criar `netlify/functions/api-proxy.ts` — proxy que lê `CURSEDUCA_API_KEY` de env vars, aceita `{ service, endpoint, params }`, repassa para `prof.curseduca.pro` ou `clas.curseduca.pro`
  - Criar `src/types/api.ts` — interfaces `ApiMember`, `ApiGroup`, `ApiAccessReport`, `ApiProgressReport`, `ApiEnrollment`, `ApiPaginatedResponse<T>`
  - Atualizar `netlify.toml` — adicionar `[functions] directory = "netlify/functions"`
  - Adicionar `@netlify/functions` ao `package.json`
- **Acceptance Criteria:**
  - [ ] Proxy responde em `/.netlify/functions/api-proxy`
  - [ ] API key nunca é exposta no client-side
  - [ ] Requisições são repassadas corretamente para ambos os serviços (members/contents)
  - [ ] Erros da API são tratados e retornados com status codes adequados
  - [ ] Tipos TypeScript cobrem todas as respostas necessárias
- **Quality Gates:**
  - Pre-Commit: Validação de segurança (API key não hardcoded), validação de tipos
  - Pre-PR: Teste manual com `netlify dev`
- **Files:**
  - `netlify/functions/api-proxy.ts` (novo)
  - `src/types/api.ts` (novo)
  - `netlify.toml` (modificar)
  - `package.json` (modificar)

### Story 1.2: Client API + Adapter Layer

- **Description:** Criar client HTTP com paginação automática + camada de transformação API → tipos CSV existentes + orchestrator unificado
- **Executor:** `@dev`
- **Quality Gate:** `@architect`
- **Quality Gate Tools:** `[code_review, pattern_validation, unit_tests]`
- **Scope:**
  - Criar `src/services/cursEducaClient.ts` — métodos `fetchMembers()`, `fetchGroups()`, `fetchAccessReports(dateRange?)`, `fetchProgressReports(dateRange?)`, `fetchEnrollments(dateRange?)` com paginação automática e callback de progresso
  - Criar `src/services/apiAdapter.ts` — transformadores:
    - `transformMembersToUltimoAcesso(members) → UltimoAcessoRow[]`
    - `transformAccessToAcessos(reports) → AcessoRow[]`
    - `transformProgressToConclusoes(reports) → ConclusaoRow[]`
    - `transformEnrollmentsToProgresso(enrollments) → ProgressoRow[]`
    - `buildParsedDatasetFromApi(referencia, members, access, progress, enrollments) → ParsedDataset`
  - Criar `src/services/dataSourceOrchestrator.ts` — entry point `loadData('api' | 'csv', ...)` que retorna `ParsedDataset`
  - Escrever `tests/unit/apiAdapter.test.ts` — testes dos transformadores
- **Acceptance Criteria:**
  - [ ] Client pagina automaticamente todas as respostas até `hasMore === false`
  - [ ] Callback de progresso é emitido a cada página
  - [ ] Transformadores produzem `ParsedDataset` estruturalmente idêntico ao CSV
  - [ ] `buildParsedDatasetFromApi` recebe referencia (do CSV) como parâmetro, NÃO usa grupos da API
  - [ ] `computeMetrics()` funciona corretamente com `ParsedDataset` gerado pelo adapter
  - [ ] Testes unitários passam com dados mock
- **Quality Gates:**
  - Pre-Commit: Lint, typecheck, testes unitários
  - Pre-PR: Teste de paridade CSV vs API (mesma estrutura de output)
- **Files:**
  - `src/services/cursEducaClient.ts` (novo)
  - `src/services/apiAdapter.ts` (novo)
  - `src/services/dataSourceOrchestrator.ts` (novo)
  - `tests/unit/apiAdapter.test.ts` (novo)

### Story 1.3: UI — Modo Dual (API Híbrido + CSV)

- **Description:** Integrar modo dual na interface: toggle entre "API Híbrido" (upload referencia + fetch automático) e "CSV Manual" (upload completo dos 5 arquivos)
- **Executor:** `@dev`
- **Quality Gate:** `@architect`
- **Quality Gate Tools:** `[code_review, ui_review, e2e_tests]`
- **Scope:**
  - Criar `src/components/upload/DataSourceSelector.tsx` — toggle visual entre modos
  - Criar `src/components/upload/ApiConnectionPanel.tsx` — UI do modo API: upload de referencia.csv + botão fetch + barra de progresso + status de conexão
  - Modificar `src/components/upload/UploadScreen.tsx` — renderização condicional por modo (API mostra `ApiConnectionPanel`, CSV mostra upload completo existente)
  - Modificar `src/App.tsx` — novo state `dataSource: 'api' | 'csv'`, `handleProcess` usa `dataSourceOrchestrator`
- **Acceptance Criteria:**
  - [ ] Toggle entre "Conexão API" e "Upload Manual" funciona
  - [ ] Modo API: permite upload de referencia.csv + botão "Buscar Dados"
  - [ ] Modo API: barra de progresso mostra andamento do fetch
  - [ ] Modo API: dashboard renderiza corretamente com dados híbridos
  - [ ] Modo CSV: funciona identicamente ao sistema atual (sem regressão)
  - [ ] Export HTML/ZIP funciona com dados de ambos os modos
  - [ ] Design segue o branding Prosperus (Midnight Blue + Gold)
  - [ ] Responsivo (mobile + desktop)
- **Quality Gates:**
  - Pre-Commit: Lint, typecheck
  - Pre-PR: Teste E2E de ambos os fluxos, teste de export
- **Files:**
  - `src/components/upload/DataSourceSelector.tsx` (novo)
  - `src/components/upload/ApiConnectionPanel.tsx` (novo)
  - `src/components/upload/UploadScreen.tsx` (modificar)
  - `src/App.tsx` (modificar)

---

## Compatibility Requirements

- [x] Pipeline downstream (`metricsComputer.ts`, `exportHelpers.ts`) permanece inalterada
- [x] Tipos CSV existentes (`csv.ts`) são o target do adapter — sem breaking changes
- [x] Modo CSV completo continua funcionando sem alterações
- [x] Deploy no Netlify — Netlify Functions são nativas à plataforma

## Risk Mitigation

- **Primary Risk:** Formato das respostas da API diferir da documentação
- **Mitigation:** Interfaces com campos opcionais + fallbacks defensivos no adapter
- **Rollback Plan:** Modo CSV completo permanece funcional — basta selecionar "Upload Manual"

**Riscos adicionais:**

| Risco | Mitigação |
|-------|-----------|
| Volume alto de paginação | Client faz N chamadas sequenciais; UI mostra progresso real |
| Timeout Netlify Functions (10s) | Proxy faz 1 página por chamada, nunca acumula |
| Dados inconsistentes entre CSV e API | Testes de paridade estrutural no adapter |
| API indisponível | Fallback para modo CSV completo |

## Definition of Done

- [ ] Stories 1.1, 1.2, 1.3 completas com acceptance criteria atendidos
- [ ] Modo API Híbrido funcional: referencia.csv manual + fetch automático
- [ ] Modo CSV Manual funcional sem regressão
- [ ] Export HTML/ZIP idêntico em ambos os modos
- [ ] Testes unitários e E2E passando
- [ ] Lint e typecheck sem erros
- [ ] API key configurada como env var no Netlify
- [ ] Documentação atualizada

---

## Story Manager Handoff

"Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing system running React 19 + TypeScript 5.8 + Vite 7 + TailwindCSS v4, deployed on Netlify
- **CRITICAL:** referencia.csv is the source of truth for email→empresa mapping. Groups in CursoEduca are misconfigured. NEVER use API groups as reference.
- Integration points: `ParsedDataset` interface in `src/types/csv.ts` is the contract between data source and pipeline. Adapter must produce identical structure.
- Existing patterns to follow: PapaParse for CSV, Recharts for charts, Tailwind for styling, Prosperus brand theme (Midnight Blue #031A2B + Gold #FFDA71)
- Critical compatibility requirements: `metricsComputer.ts` and `exportHelpers.ts` must work with API data without ANY changes
- Each story must include verification that existing CSV functionality remains intact
- Stories should be developed in sequence: 1.1 → 1.2 → 1.3 (each depends on the previous)

The epic should maintain system integrity while delivering automated data extraction from CursoEduca API."
