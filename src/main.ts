import {basicSetup} from "codemirror"
import {EditorView} from "@codemirror/view"
import {python} from "@codemirror/lang-python"
import { loadPyodide, version as pyodideVersion } from "pyodide";


document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div id="docs">
  <button type="button" id="run-btn" class="btn btn-success" disabled>
      Run
  </button> 
</div>
<div id="code-container">
</div>
<div>
    <h3>Output</h3>
    <textarea id="output" name="output" rows="15" readonly>
    </textarea>
</div>
`

let runBtnElt = document.querySelector<HTMLButtonElement>('#run-btn')!;

const view = new EditorView({
  parent: document.getElementById("code-container"),
  extensions: [basicSetup, python()]
})

view.dispatch({
  changes: {from: 0, insert: `\
print("ducks")
`}
})

async function initPyodide() {
  let outputElt = document.querySelector<HTMLTextAreaElement>('#output')!;

  outputElt.value = `Pyodide ${pyodideVersion} loading...`;

  const pyodide = await loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
    stdout: (text) => {
      outputElt.value += text + "\n";
    },
    stderr: (text) => {
      outputElt.value += text + "\n";
    }
  });

  outputElt.value = `Pyodide ${pyodideVersion} loaded.\n`;
  runBtnElt.disabled = false;

  return pyodide;
}

let pyodideFuture = initPyodide();

async function evaluatePython() {
  let pyodide = await pyodideFuture;
  runBtnElt.disabled = true;
  try {
      document.querySelector<HTMLTextAreaElement>('#output')!.value = "";
      let text = view.state.doc.toString();
      let output = pyodide.runPython(text);
      document.querySelector<HTMLTextAreaElement>('#output')!.value += output;
  } catch (err) {
      document.querySelector<HTMLTextAreaElement>('#output')!.value += err;
  }
  runBtnElt.disabled = false;
}

runBtnElt.addEventListener('click', evaluatePython);
