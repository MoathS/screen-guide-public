// Example: a logged-in admin flow on a staging site behind HTTP basic auth (landscape).
//   export STAGING_PW=$(cat ~/secrets/staging-pw)   # never hard-code it
//   SG_ENV="STAGING_PW" $SG/run.sh $JOB scripts/admin.js
// The first run signs in inside the clip (persistent profile "admin"); later clips reuse it.
const sg = require("/sg/scripts/lib");
sg.record("admin-add", {
  url: "https://staging.example.com/admin/members",
  layout: "landscape",
  basicAuth: { user: "staging", passEnv: "STAGING_PW" },
  profile: "admin",
  blur: [".requester-phone"],          // app-specific secrets on top of the defaults
}, async (s) => {
  await s.wait(1200);
  await s.tap("a[href$=\"/new\"]", { mark: "add" });
  await s.at("/admin/members/new"); await s.settled();
  await s.tap("#name"); await s.type("#name", "Example Person", 90);
  await s.scroll("#notes", 800, { offset: 220 });
  s.mark("save"); await s.tap("xpath/.//button[normalize-space()=\"Save\"]");
  await s.wait(2500);
});
