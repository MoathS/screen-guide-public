// Example clip: a visitor searches a site and opens a result (read-only: guard aborts any write).
// Run: FR=<skill>/scripts; $FR/run.sh $JOB scripts/A.js && $FR/clip.sh $JOB A
const fr = require("/fr/scripts/lib");
fr.record("A", { url: "https://example.com/", layout: "portrait", guard: true }, async (s) => {
  await s.wait(1000);
  await s.tap("input[type=search]", { mark: "search" });
  await s.type("input[type=search]", "blue shoes", 95);
  await s.wait(1100);
  await s.tap(".result", { mark: "pick" });
  await s.wait(2600);
  s.mark("details"); await s.scroll("end", 3000);
  await s.wait(1500);
});
