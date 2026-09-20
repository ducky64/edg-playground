import { loadPyodide, version as pyodideVersion } from "pyodide";
import type { PyWorkerRequest } from "./pyworkerapi";

import hdlServerSource from './main/python/hdl_server.py?raw';

import { edgjs } from '../target/scala-2.13/edgwebcompiler-fastopt/main.js';

self.postMessage({ type: 'PROGRESS', data: "Loading Pyodide..." });
const pyodide = await loadPyodide({
  indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
  stdout: (text) => {
    self.postMessage({ type: 'STDOUT', data: text });
  },
  stderr: (text) => {
    self.postMessage({ type: 'STDERR', data: text });;
  }
});

self.postMessage({ type: 'PROGRESS', data: "Loading Python packages..." });
await pyodide.loadPackage(["micropip", "pydantic"]);
const micropip = pyodide.pyimport("micropip");
await micropip.install(new URL('../wheels/edg-0.5.2-py3-none-any.whl', import.meta.url).href);

self.postMessage({ type: 'PROGRESS', data: "Initializing Python environment..." });
const context = {};
pyodide.runPython(hdlServerSource, context);

const postprocessor = pyodide.globals.get("postprocess_compiled_result")

function compilerProgress(progress: string) {
  self.postMessage({ type: 'PROGRESS', data: progress });
}

self.postMessage({ type: 'READY', ready: true });

self.onmessage = async (event: MessageEvent<PyWorkerRequest>) => {
  switch (event.data.type) {
    case 'RUN':
      try {
        const request = pyodide.runPython(event.data.code, context);
        const compiled = edgjs.compile(compilerProgress, pyodide, request);
        const result = postprocessor(compiled);

        self.postMessage({ type: 'RESULT', name: result.name, netlist: result.netlist, bom: result.bom });
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
      }
      break;
  }
};
