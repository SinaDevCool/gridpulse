/** File ownership is explicit; unclassified composition is not falsely called a shared domain. */
export function moduleOwner(file) {
  const normalized = file.replaceAll("\\", "/");
  if (
    /^src\/(features|server)\/operations\//.test(normalized) ||
    /^src\/lib\/operations-/.test(normalized)
  )
    return "operations";
  if (
    /^src\/features\/(power-finder|grid-connection|anonymous-workspace|assessments|activation|constraint-exposure|data-centre-planner|legacy-planner|map|operator-enquiry|properties|site-portfolio|grid-forecast)\//.test(
      normalized,
    ) ||
    /^src\/lib\/public-(power-finder|property|c1|grid-stress)/.test(normalized)
  )
    return "planning";
  if (/^src\/(shared\/|features\/theme\/|config\/solution(?:s|\-availability)\.)/.test(normalized))
    return "shared";
  return "composition";
}
export function solutionBoundaryViolation(from, to) {
  const source = moduleOwner(from),
    target = moduleOwner(to);
  if (source === "shared" && (target === "planning" || target === "operations")) return true;
  return (
    (source === "planning" && target === "operations") ||
    (source === "operations" && target === "planning")
  );
}
