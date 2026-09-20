// Aggregator: combines all section files into a single ordered array.
// Order matters: cover -> 1 -> 2 -> ... -> 26.
module.exports = [
  // cover (special — no H1, runs first)
  function coverSection(H) { H.cover(); },

  // 1
  require("./pdf-sections-1a.js")[0],
  // 2
  require("./pdf-sections-1b.js")[0],
  // 3
  require("./pdf-sections-2a.js")[0],
  // 4
  require("./pdf-sections-2b.js")[0],
  // 5
  require("./pdf-sections-3a.js")[0],
  // 6a (dev flow + routes)
  require("./pdf-sections-3b1.js")[0],
  // 6b (layout + sidebar)
  require("./pdf-sections-3b2.js")[0],
  // 7a (modules)
  require("./pdf-sections-4a.js")[0],
  // 7b (rest of backend)
  require("./pdf-sections-4b.js")[0],
  // 8a + 8b
  require("./pdf-sections-5a.js")[0],
  require("./pdf-sections-5b.js")[0],
  // 9
  require("./pdf-sections-6a.js")[0],
  // 10
  require("./pdf-sections-6b.js")[0],
  // 11+12
  ...require("./pdf-sections-7a.js"),
  // 13
  require("./pdf-sections-7b.js")[0],
  // 14a
  require("./pdf-sections-8a.js")[0],
  // 14b
  require("./pdf-sections-8b.js")[0],
  // 15+16
  require("./pdf-sections-9a.js")[0],
  // 17+18+19
  ...require("./pdf-sections-9b.js"),
  // 20
  require("./pdf-sections-10a.js")[0],
  // 21
  require("./pdf-sections-10b.js")[0],
  // 22
  require("./pdf-sections-11a.js")[0],
  // 23+24
  require("./pdf-sections-11b.js")[0],
  // 25+26
  ...require("./pdf-sections-12a.js"),
];
