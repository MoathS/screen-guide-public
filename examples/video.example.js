// Example spec for the clip above: one vertical video, two captions, a title and an outro.
// Run: $FR/run.sh $JOB /fr/scripts/cards.js video.js && node $FR/compose.js $JOB video.js
module.exports = {
  layout: "portrait",
  theme: { bg: "#F4F4F1", ink: "#1F2937", sub: "#6B7280", dark: "#111827", accent: "#F59E0B", ft: "Inter", fb: "Inter" },
  outro: { t: "Example Store", u: "example.com" },
  videos: {
    "search-product": {
      title: { t: "Find any product", s: "in a few taps" },
      segs: [{ clip: "A", speed: 1.1, caps: [[0, "Search", "type what you need"], ["details-0.2", "Every detail", "price, sizes and reviews"]] }],
    },
  },
};
