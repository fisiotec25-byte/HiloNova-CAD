/* Web Worker del acomodo automático */
importScripts('nest-core.js');
self.onmessage = function (e) {
  var d = e.data;
  try {
    var out = self.HNNest.run(d.items, {
      W: d.W, res: d.res, gap: d.gap, orilla: d.orilla, timeMs: d.timeMs, seed: d.seed,
      onProgress: function (p) { self.postMessage({ type: 'progress', p: p }); },
    });
    self.postMessage({ type: 'done', out: out });
  } catch (err) {
    self.postMessage({ type: 'done', out: { error: String(err && err.message || err) } });
  }
};
