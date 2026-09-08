import { loadPyodide, version as pyodideVersion } from "pyodide";
import type { PyWorkerRequest } from "./pyworkerapi";

const pyodide = await loadPyodide({
  indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
  stdout: (text) => {
    self.postMessage({ type: 'STDOUT', data: text });
  },
  stderr: (text) => {
    self.postMessage({ type: 'STDERR', data: text });;
  }
});
await pyodide.loadPackage(["micropip", "pydantic"]);
const micropip = pyodide.pyimport("micropip");
await micropip.install(new URL('../wheels/edg-0.5.2-py3-none-any.whl', import.meta.url).href);

const scalaWorker = new Worker(new URL('./scalaworker.ts', import.meta.url), { type: 'module' });

self.postMessage({ type: 'READY', ready: true });

self.onmessage = async (event: MessageEvent<PyWorkerRequest>) => {
  switch (event.data.type) {
    case 'RUN':
      try {
        const context = {};
        const result = await pyodide.runPythonAsync(event.data.code, context);
        console.log(result.toString());
        self.postMessage({ type: 'RESULT', data: result });
      } catch (error) {
        self.postMessage({ type: 'RESULT', data: error.message });
      }
      break;
  }
};
