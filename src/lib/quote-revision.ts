/** Keep legacy choice links on the duplicated calculations, never on the source quote. */
export function remapChoiceCalculationIds(value: unknown, idMap: Map<string, string>): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((group) => {
    if (!group || typeof group !== "object" || !Array.isArray(group.choices)) return group;
    return {
      ...group,
      choices: group.choices.map((choice: unknown) => {
        if (!choice || typeof choice !== "object") return choice;
        const record = choice as Record<string, unknown>;
        const oldId = typeof record.calculationId === "string" ? record.calculationId : null;
        return oldId && idMap.has(oldId)
          ? { ...record, calculationId: idMap.get(oldId) }
          : choice;
      }),
    };
  });
}
