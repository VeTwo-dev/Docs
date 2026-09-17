/**
 * API Surface Diff Model.
 *
 * Compares two `ApiSymbol[]` snapshots and classifies changes as
 * breaking / non-breaking / additive. Pure, deterministic, no I/O.
 */

import type { ApiSymbol } from "./models.js";

export type ApiChangeKind = "added" | "removed" | "signature-changed" | "deprecated-added" | "moved";
export type ApiChangeSeverity = "breaking" | "non-breaking" | "additive";

export interface ApiChange {
  readonly kind: ApiChangeKind;
  readonly severity: ApiChangeSeverity;
  readonly symbolName: string;
  readonly qualifiedName: string;
  readonly details?: string;
  readonly before?: ApiSymbol;
  readonly after?: ApiSymbol;
}

export interface ApiDiff {
  readonly changes: readonly ApiChange[];
  readonly breaking: readonly ApiChange[];
  readonly hasBreaking: boolean;
  readonly summary: string;
}

function signatureOf(s: ApiSymbol): string {
  const params = s.parameters?.map((p) => `${p.name}:${p.type}${p.required ? "" : "?"}`).join(",") ?? "";
  return `${s.kind}:${s.name}(${params}):${s.returnType ?? "void"}`;
}

export function diffApis(before: readonly ApiSymbol[], after: readonly ApiSymbol[]): ApiDiff {
  const beforeByName = new Map(before.map((s) => [s.qualifiedName, s] as const));
  const afterByName = new Map(after.map((s) => [s.qualifiedName, s] as const));
  const changes: ApiChange[] = [];

  for (const [qn, b] of beforeByName) {
    const a = afterByName.get(qn);
    if (a === undefined) {
      changes.push({ kind: "removed", severity: "breaking", symbolName: b.name, qualifiedName: qn, before: b, details: `Removed ${b.kind} ${qn}` });
      continue;
    }
    const sigBefore = signatureOf(b);
    const sigAfter = signatureOf(a);
    if (sigBefore !== sigAfter) {
      const isBreaking = b.parameters?.length !== a.parameters?.length || b.returnType !== a.returnType;
      changes.push({
        kind: "signature-changed",
        severity: isBreaking ? "breaking" : "non-breaking",
        symbolName: b.name,
        qualifiedName: qn,
        before: b,
        after: a,
        details: `${sigBefore} → ${sigAfter}`,
      });
    }
    if (b.deprecated === false && a.deprecated !== false) {
      changes.push({ kind: "deprecated-added", severity: "non-breaking", symbolName: b.name, qualifiedName: qn, before: b, after: a, details: `Deprecated ${qn}` });
    }
    if (b.sourceFile !== a.sourceFile) {
      changes.push({ kind: "moved", severity: "non-breaking", symbolName: b.name, qualifiedName: qn, before: b, after: a, details: `${b.sourceFile} → ${a.sourceFile}` });
    }
  }

  for (const [qn, a] of afterByName) {
    if (!beforeByName.has(qn)) {
      changes.push({ kind: "added", severity: "additive", symbolName: a.name, qualifiedName: qn, after: a, details: `Added ${a.kind} ${qn}` });
    }
  }

  const breaking = changes.filter((c) => c.severity === "breaking");
  const summary = breaking.length > 0
    ? `${breaking.length} breaking change(s), ${changes.length - breaking.length} non-breaking`
    : changes.length === 0 ? "No API changes" : `${changes.length} non-breaking change(s)`;
  return { changes, breaking, hasBreaking: breaking.length > 0, summary };
}
