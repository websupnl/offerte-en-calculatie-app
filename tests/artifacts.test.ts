import assert from "node:assert/strict";
import test from "node:test";
import { ARTIFACT_TEMPLATES, clampArtifactHeight, validateArtifactHtml } from "../mcp-server/src/artifacts";
import { ARTIFACT_MAX_HEIGHT, artifactHeight, buildArtifactDocument } from "../src/lib/artifact-document";

test("elk sjabloon met voorbeeldinvulling doorstaat de eigen validator", () => {
  assert.ok(ARTIFACT_TEMPLATES.length > 0);
  for (const template of ARTIFACT_TEMPLATES) {
    const html = template.render(template.example);
    assert.deepEqual(validateArtifactHtml(html), [], `${template.id} wordt afgekeurd`);
    assert.ok(template.height > 0 && template.height <= ARTIFACT_MAX_HEIGHT, `${template.id} heeft een ongeldige hoogte`);
  }
});

test("sjablonen escapen invoer, ook in lijsten", () => {
  const payload = `"><img src=x onerror=alert(1)><script>alert(1)</script>`;
  for (const template of ARTIFACT_TEMPLATES) {
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template.example)) {
      params[key] = Array.isArray(value)
        ? value.map((entry) =>
            entry && typeof entry === "object"
              ? Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, typeof v === "string" ? payload : v]))
              : payload)
        : typeof value === "string" ? payload : value;
    }
    const html = template.render(params);
    assert.ok(!html.includes("<img src=x"), `${template.id} laat markup uit invoer door`);
    // Het enige <script> dat mag voorkomen is dat van het sjabloon zelf.
    const ownScripts = template.render(template.example).match(/<script/g)?.length ?? 0;
    assert.equal(html.match(/<script/g)?.length ?? 0, ownScripts, `${template.id} laat een script uit invoer door`);
  }
});

test("validator keurt gevaarlijke HTML af", () => {
  const bad: [string, RegExp][] = [
    ['<iframe src="https://x.nl"></iframe>', /iframe/],
    ['<form action="/x"></form>', /form/],
    ['<script src="https://x.nl/a.js"></script>', /Externe scripts/],
    ["<script>fetch('/api/x')</script>", /Netwerkverkeer/],
    ["<script>document.cookie</script>", /cookies/],
    ['<meta http-equiv="refresh" content="0;url=https://x.nl">', /refresh/],
    ['<link rel="stylesheet" href="https://evil.nl/a.css">', /Google Fonts/],
    ["", /leeg/],
  ];
  for (const [html, pattern] of bad) {
    const problems = validateArtifactHtml(html);
    assert.ok(problems.some((problem) => pattern.test(problem)), `niet afgekeurd: ${html}`);
  }
  assert.ok(validateArtifactHtml("x".repeat(60_001)).some((problem) => /60\.000/.test(problem)));
});

test("het artifact-document zet de beveiliging en de schaling klaar", () => {
  const doc = buildArtifactDocument("<p>hoi</p>", "#247EB2");
  assert.match(doc, /connect-src 'none'/);
  assert.match(doc, /form-action 'none'/);
  assert.match(doc, /--accent:#247EB2/);
  assert.match(doc, /id="ws-fit"/);
  // Een ongeldige accentkleur mag nooit als CSS in het document komen.
  assert.ok(!buildArtifactDocument("x", "red;}</style><script>").includes("red;}"));
});

test("hoogte wordt begrensd", () => {
  assert.equal(artifactHeight([{ height: 5000 }]), ARTIFACT_MAX_HEIGHT);
  assert.equal(artifactHeight([]), 360);
  assert.equal(artifactHeight([{ height: -3 }]), 360);
  assert.equal(clampArtifactHeight(undefined, 320), 320);
  assert.equal(clampArtifactHeight(2000, 320), ARTIFACT_MAX_HEIGHT);
});
