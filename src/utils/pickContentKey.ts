/**
 * Resolves the content/course key from a CSV row that may have different header names.
 * Handles variations like: Conteúdo, Conteudo, CONTEÚDO, Curso, etc.
 */
export function pickContentKey(row: Record<string, unknown>): string | null {
    if (!row) return null;

    const tryKeys = [
        'Conteúdo', 'Conteudo', 'CONTEÚDO', 'CONTEUDO',
        'Curso', 'Nome do curso', 'Content', 'Curso/Conteúdo',
        'curso', 'conteudo', 'conteúdo',
    ];

    for (const k of tryKeys) {
        if (k in row) return k;
    }

    const keys = Object.keys(row);
    const found = keys.find(
        (k) => k.toLowerCase().includes('conteu') || k.toLowerCase().includes('curso'),
    );

    return found ?? null;
}

/**
 * Parses a progress value from various CSV formats.
 * Accepts: "17%", "17,5", "17.5", 17, etc.
 * Returns a number 0–100, or null if unparseable.
 */
export function parseProgressValue(row: Record<string, unknown>): number | null {
    const raw =
        row['Progresso'] ??
        row['Progresso (%)'] ??
        row['%'] ??
        row['Percentual'] ??
        row['Progresso (percentual)'];

    if (raw === undefined || raw === null) return null;

    const num = parseFloat(String(raw).replace('%', '').replace(',', '.'));
    if (Number.isNaN(num)) return null;

    return Math.max(0, Math.min(100, num));
}
