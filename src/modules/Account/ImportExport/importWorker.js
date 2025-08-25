// src/modules/Account/components/importWorker.js
// Worker de parsing NDJSON (tolère aussi un JSON tableau).
// Reçoit: postMessage({ file: Blob })
// Émet :
//  - { type: 'progress', readBytes, totalBytes }
//  - { type: 'chunk', data: { module, version, payload } }
//  - { type: 'error', error }
//  - { type: 'eof' }

self.onmessage = async (e) => {
  try {
    const { file } = e.data || {};
    if (!(file instanceof Blob)) {
      self.postMessage({ type: "error", error: "Aucun fichier (Blob) reçu" });
      return;
    }

    const total = file.size ?? 0;
    const reader = file.stream().getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let readBytes = 0;

    const emitProgress = () => {
      self.postMessage({ type: "progress", readBytes, totalBytes: total });
    };

    const emitLine = (line) => {
      const trim = line.trim();
      if (!trim) return;
      try {
        const obj = JSON.parse(trim); // attendu: { module, version, payload }
        self.postMessage({ type: "chunk", data: obj });
      } catch (err) {
        self.postMessage({
          type: "error",
          error: `JSON invalide: ${err.message}`,
        });
      }
    };

    // Lecture en streaming des lignes NDJSON
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      readBytes += value.byteLength;
      emitProgress();

      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        emitLine(line);
      }
    }

    // Flush final (reste du buffer)
    const rest = buffer.trim();
    if (rest) {
      // Si c'est un tableau JSON complet, on l'accepte aussi
      if (rest.startsWith("[")) {
        try {
          const arr = JSON.parse(rest);
          if (!Array.isArray(arr))
            throw new Error("Le JSON n'est pas un tableau");
          for (const obj of arr) {
            self.postMessage({ type: "chunk", data: obj });
          }
        } catch (err) {
          self.postMessage({
            type: "error",
            error: `JSON (tableau) invalide: ${err.message}`,
          });
        }
      } else {
        emitLine(rest);
      }
    }

    self.postMessage({ type: "eof" });
  } catch (err) {
    self.postMessage({ type: "error", error: String(err?.message ?? err) });
  }
};

self.onmessageerror = (e) => {
  self.postMessage({ type: "error", error: "Message worker illisible" });
};
