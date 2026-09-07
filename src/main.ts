import {basicSetup} from "codemirror"
import {EditorView} from "@codemirror/view"
import {python} from "@codemirror/lang-python"
import { loadPyodide, version as pyodideVersion } from "pyodide";


document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div id="docs">
  <button type="button" class="btn btn-success" onclick="evaluatePython()">
      Run
  </button> 
</div>
<div id="code-container">
</div>
<div>
    <h3>Output</h3>
    <textarea id="output" name="output" rows="15">
    </textarea>
</div>
`

const view = new EditorView({
  parent: document.getElementById("code-container"),
  extensions: [basicSetup, python()]
})

view.dispatch({
  changes: {from: 0, insert: `\
from edg import *
`}
})

async function initPyodide() {
  document.querySelector<HTMLTextAreaElement>('#output')!.disabled = true;
  document.querySelector<HTMLTextAreaElement>('#output')!.value = `Pyodide ${pyodideVersion} loading...`;

  const pyodide = await loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
  });

  document.querySelector<HTMLTextAreaElement>('#output')!.value = `Pyodide ${pyodideVersion} loaded.`;
  document.querySelector<HTMLTextAreaElement>('#output')!.disabled = false;

  return pyodide;
}

await initPyodide();
