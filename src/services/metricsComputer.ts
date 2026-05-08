import { uniq, countBy, groupBy } from 'lodash-es';
import type { ParsedDataset } from '../types/csv';
import type {
    DashboardMetrics,
    UsuarioTabela,
    ProgressoConteudo,
    AcessoDiario,
    TopEntry,
} from '../types/metrics';
import { pickContentKey, parseProgressValue } from '../utils/pickContentKey';
import { toISODay, safeParseDate } from '../utils/dateHelpers';

// ─── UNIFIED METRICS COMPUTATION ────────────────────────────────────────────
// Single function used by BOTH the in-app dashboard AND the HTML export.
// This eliminates the previous duplication between useMemo(metricas) and
// calculateCompanyMetrics().

/**
 * Computes all dashboard metrics from a (possibly filtered) dataset.
 * Works for both "all companies" and "single company" views.
 */
export function computeMetrics(data: ParsedDataset): DashboardMetrics {
    const totalFuncionarios = data.referencia.length;
    const totalAcessos = data.acessos.length;
    const totalConclusoes = data.conclusoes.length;
    const usuariosAtivos = uniq(
        data.acessos.map((a) => a.Email).filter(Boolean),
    ).length;
    const usuariosInativos = totalFuncionarios - usuariosAtivos;
    const taxaEngajamento =
        totalFuncionarios > 0
            ? ((usuariosAtivos / totalFuncionarios) * 100).toFixed(1)
            : '0';

    // ── Daily access aggregation ──────────────────────────────────────────────
    const acessosByDay = groupBy(
        data.acessos.filter((a) => a.Data),
        (row) => toISODay(row.Data),
    );
    delete acessosByDay['null'];

    const acessosDiarios: AcessoDiario[] = Object.entries(acessosByDay)
        .map(([dia, registros]) => ({
            dia,
            acessos: registros.length,
            usuarios: uniq(registros.map((r) => r.Email).filter(Boolean)).length,
        }))
        .sort((a, b) => a.dia.localeCompare(b.dia));

    // ── Top modules ───────────────────────────────────────────────────────────
    const modulosConcluidos = countBy(
        data.conclusoes.filter((c) => c['Módulo']),
        'Módulo',
    );
    const topModulos: TopEntry[] = Object.entries(modulosConcluidos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([modulo, count]) => ({
            modulo: modulo.substring(0, 40),
            conclusoes: count,
        }));

    // ── Top users ─────────────────────────────────────────────────────────────
    const conclusoesPorUsuario = countBy(data.conclusoes, 'Email');
    const topUsuarios: TopEntry[] = Object.entries(conclusoesPorUsuario)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([email, count]) => {
            const nome =
                data.conclusoes.find((c) => c.Email === email)?.Nome ?? email;
            return { nome: nome.substring(0, 30), conclusoes: count };
        });

    // ── User table ────────────────────────────────────────────────────────────
    const usuarios: Record<string, UsuarioTabela> = {};

    data.referencia.forEach((ref) => {
        if (ref.Email) {
            usuarios[ref.Email.toLowerCase()] = {
                nome: ref.Nome ?? 'Nome não informado',
                email: ref.Email,
                empresa: ref.Empresa ?? 'Empresa não informada',
                acessos: 0,
                conclusoes: 0,
                ultimoAcesso: null,
                historico: [],
                conteudoRecente: [], // New field
            };
        }
    });

    data.acessos.forEach((acesso) => {
        const email = acesso.Email?.toLowerCase();
        if (email && usuarios[email]) {
            usuarios[email].acessos++;
            if (acesso.Data) {
                usuarios[email].historico.push({ data: acesso.Data, tipo: 'acesso' });

                // Update last access if this one is newer
                const currentLast = safeParseDate(usuarios[email].ultimoAcesso);
                const newDate = safeParseDate(acesso.Data);
                if (newDate && (!currentLast || newDate > currentLast)) {
                    usuarios[email].ultimoAcesso = acesso.Data;
                }
            }
        }
    });

    data.conclusoes.forEach((conclusao) => {
        const email = conclusao.Email?.toLowerCase();
        if (email && usuarios[email]) {
            usuarios[email].conclusoes++;

            // Track recent content viewed
            const titulo = conclusao['Nome da aula'] || conclusao['Conteúdo'] || conclusao['Módulo'];
            if (titulo) {
                usuarios[email].conteudoRecente.push({
                    titulo: String(titulo).trim(),
                    data: conclusao['Data de conclusão']
                });
            }
        }
    });

    data.ultimoAcesso.forEach((ultimo) => {
        const email = ultimo.Email?.toLowerCase();
        if (email && usuarios[email] && ultimo['Último acesso']) {
            // Update last access if this one is newer (or if we have none)
            const currentLast = safeParseDate(usuarios[email].ultimoAcesso);
            const newDate = safeParseDate(ultimo['Último acesso']);
            if (newDate && (!currentLast || newDate > currentLast)) {
                usuarios[email].ultimoAcesso = ultimo['Último acesso'];
            }
        }
    });

    const usuariosTabela = Object.values(usuarios).sort((a, b) => {
        const aAtivo = a.acessos > 0 || a.conclusoes > 0;
        const bAtivo = b.acessos > 0 || b.conclusoes > 0;
        if (aAtivo && !bAtivo) return -1;
        if (!aAtivo && bAtivo) return 1;
        if (a.conclusoes !== b.conclusoes) return b.conclusoes - a.conclusoes;
        return b.acessos - a.acessos;
    });

    // Sort full history for each user (descending by date)
    usuariosTabela.forEach(u => {
        u.historico.sort((a, b) =>
            (safeParseDate(b.data)?.getTime() ?? 0) - (safeParseDate(a.data)?.getTime() ?? 0)
        );

        u.conteudoRecente.sort((a, b) =>
            (safeParseDate(b.data)?.getTime() ?? 0) - (safeParseDate(a.data)?.getTime() ?? 0)
        );
    });

    // ── Progress by content ───────────────────────────────────────────────────
    const progressoPorConteudo = computeProgressByContent(data, usuarios);

    const usuariosComProgresso = uniq(
        progressoPorConteudo.map((p) => p.email),
    ).length;

    return {
        totalFuncionarios,
        totalAcessos,
        totalConclusoes,
        usuariosAtivos,
        usuariosInativos,
        taxaEngajamento,
        acessosDiarios,
        topModulos,
        topUsuarios,
        usuariosTabela,
        progressoPorConteudo,
        usuariosComProgresso,
    };
}

// ─── Progress Computation (Internal) ────────────────────────────────────────

function computeProgressByContent(
    data: ParsedDataset,
    usuarios: Record<string, UsuarioTabela>,
): ProgressoConteudo[] {
    // 1) Index progress from progresso.csv
    const progressoIndex: Record<string, Record<string, number>> = {};

    data.progresso.forEach((p) => {
        const email = p.Email?.toLowerCase?.();
        if (!email) return;

        const contentKey = pickContentKey(p as Record<string, unknown>);
        if (!contentKey) return;

        const conteudo = String(p[contentKey]).trim();
        if (!conteudo) return;

        const pct = parseProgressValue(p as Record<string, unknown>);
        if (pct === null) return;

        if (!progressoIndex[email]) progressoIndex[email] = {};
        progressoIndex[email][conteudo] = Math.max(
            progressoIndex[email][conteudo] ?? 0,
            pct,
        );
    });

    // 2) Aggregate completions (lessons/modules counted; % from progressoIndex)
    const conteudosPorUsuario: Record<
        string,
        Record<
            string,
            {
                nome: string;
                email: string;
                conteudo: string;
                aulasCompletas: number;
                modulos: Set<string>;
                progresso?: number;
            }
        >
    > = {};

    data.conclusoes.forEach((conc) => {
        const email = conc.Email?.toLowerCase?.();
        const conteudo = conc['Conteúdo']
            ? String(conc['Conteúdo']).trim()
            : undefined;
        if (!email || !conteudo) return;

        if (!conteudosPorUsuario[email]) conteudosPorUsuario[email] = {};
        if (!conteudosPorUsuario[email][conteudo]) {
            conteudosPorUsuario[email][conteudo] = {
                nome: conc.Nome ?? usuarios[email]?.nome ?? 'Nome não informado',
                email,
                conteudo,
                aulasCompletas: 0,
                modulos: new Set<string>(),
                progresso: progressoIndex[email]?.[conteudo],
            };
        }

        conteudosPorUsuario[email][conteudo].aulasCompletas += 1;
        if (conc['Módulo']) {
            conteudosPorUsuario[email][conteudo].modulos.add(conc['Módulo']);
        }
    });

    // 3) Include courses from progresso.csv not in conclusoes
    data.progresso.forEach((p) => {
        const email = p.Email?.toLowerCase?.();
        const contentKey = pickContentKey(p as Record<string, unknown>);
        const conteudo = contentKey ? String(p[contentKey]).trim() : null;
        if (!email || !conteudo) return;

        if (!conteudosPorUsuario[email]) conteudosPorUsuario[email] = {};
        if (!conteudosPorUsuario[email][conteudo]) {
            conteudosPorUsuario[email][conteudo] = {
                nome: usuarios[email]?.nome ?? p.Nome ?? 'Nome não informado',
                email,
                conteudo,
                aulasCompletas: 0,
                modulos: new Set<string>(),
                progresso: progressoIndex[email]?.[conteudo],
            };
        } else if (progressoIndex[email]?.[conteudo] !== undefined) {
            const atual = conteudosPorUsuario[email][conteudo].progresso ?? 0;
            conteudosPorUsuario[email][conteudo].progresso = Math.max(
                atual,
                progressoIndex[email][conteudo],
            );
        }
    });

    // 4) Flatten into array
    // Show entries that represent real activity:
    //   - any reported progress > 0%, OR
    //   - at least one completed lesson (covers cases where the enrollment
    //     endpoint lags or returns 0% even though lessons were completed)
    const result: ProgressoConteudo[] = [];
    Object.values(conteudosPorUsuario).forEach((cursos) => {
        Object.values(cursos).forEach((curso) => {
            const pct =
                typeof curso.progresso === 'number'
                    ? Math.max(0, Math.min(100, curso.progresso))
                    : 0;

            const hasActivity = pct > 0 || curso.aulasCompletas > 0;
            if (hasActivity) {
                result.push({
                    nome: curso.nome,
                    email: curso.email,
                    conteudo: curso.conteudo,
                    aulasCompletas: curso.aulasCompletas,
                    modulosCompletos: curso.modulos.size,
                    progresso: pct,
                });
            }
        });
    });

    // 5) Sort: Name ASC → Progress DESC → Content ASC
    result.sort((a, b) => {
        const na = (a.nome || '').toLowerCase();
        const nb = (b.nome || '').toLowerCase();
        if (na !== nb) return na.localeCompare(nb, 'pt-BR');
        if (b.progresso !== a.progresso) return b.progresso - a.progresso;
        return (a.conteudo || '')
            .toLowerCase()
            .localeCompare((b.conteudo || '').toLowerCase(), 'pt-BR');
    });

    return result;
}
