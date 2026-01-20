import type { ConditionTrace, RuleTrace } from "./types";

export function explainTrace(trace: RuleTrace[], name?: string): string {
  const header = name ? `Ruleset ${name}` : "Ruleset";
  const lines = [header];

  for (const rule of trace) {
    const tags = rule.meta?.tags?.length ? ` [tags: ${rule.meta.tags.join(", ")}]` : "";
    const reason = rule.meta?.reasonCode ? ` [reason: ${rule.meta.reasonCode}]` : "";
    const skipped = rule.skippedReason ? ` (skipped: ${rule.skippedReason})` : "";
    lines.push(
      `- Rule ${rule.ruleId}: ${rule.matched ? "matched" : "skipped"}${skipped}${tags}${reason}`,
    );
    for (const condition of rule.conditions) {
      lines.push(...renderCondition(condition, 2));
    }
    for (const note of rule.notes) {
      lines.push(`  - note: ${note}`);
    }
  }

  return lines.join("\n");
}

function formatCondition(condition: ConditionTrace): string {
  const parts = [`[${condition.result ? "true" : "false"}]`, condition.label];
  if (condition.reasonCode) {
    parts.push(`{reason: ${condition.reasonCode}}`);
  }
  if (condition.op) {
    const left = formatValue(condition.left);
    const right = formatValue(condition.right);
    parts.push(`(${left} ${condition.op} ${right})`);
  }
  return parts.join(" ");
}

function renderCondition(condition: ConditionTrace, indent: number): string[] {
  const pad = " ".repeat(indent);
  const lines = [`${pad}- ${formatCondition(condition)}`];
  if (condition.children && condition.children.length > 0) {
    for (const child of condition.children) {
      lines.push(...renderCondition(child, indent + 2));
    }
  }
  return lines;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  return String(value);
}
