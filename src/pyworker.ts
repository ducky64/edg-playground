import { loadPyodide, version as pyodideVersion } from "pyodide";
import type { PyWorkerRequest } from "./pyworkerapi";

import hdlServerSource from './main/python/hdl_server.py?raw';

// @ts-expect-error Scala.js bundle lacks type definitions
import { edgjs } from 'scalajs:main.js';

let pyodide: Awaited<ReturnType<typeof loadPyodide>>;
let context: any;
let postprocessor: any;

async function init() {
  self.postMessage({ type: 'PROGRESS', data: "Loading Pyodide..." });
  pyodide = await loadPyodide({
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
  context = {};
  pyodide.runPython(hdlServerSource, context);

  postprocessor = pyodide.globals.get("postprocess_compiled_result")

  self.postMessage({ type: 'READY', ready: true });
}

const initPromise = init();

self.onmessage = async (event: MessageEvent<PyWorkerRequest>) => {
  await initPromise;

  switch (event.data.type) {
    case 'RUN':
      function compilerProgress(progress: string) {
        self.postMessage({ type: 'PROGRESS', data: progress });
      }

      try {
        const request = pyodide.runPython(event.data.code, context);
        const compiled = edgjs.compile(compilerProgress, pyodide, request);
        const result = postprocessor(compiled);

        self.postMessage({ type: 'RESULT', name: result.name, netlist: result.netlist, bom: result.bom, json: result.json });
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: (error as Error).message });
      }
      break;
    default:
      self.postMessage({ type: 'ERROR', error: "Unexpected message type " + event.data.type });
  }
};
