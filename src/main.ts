import {basicSetup} from "codemirror"
import {EditorView} from "@codemirror/view"
import {python} from "@codemirror/lang-python"
import type {PyWorkerRequest, PyWorkerResponse} from "./pyworkerapi.ts";


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
let outputElt = document.querySelector<HTMLTextAreaElement>('#output')!;

const view = new EditorView({
  parent: document.getElementById("code-container"),
  extensions: [basicSetup, python()]
})
view.dispatch({
  changes: {from: 0, insert: `\
print("ducks")
`}
})

runBtnElt.textContent = "Wait, Pyodide loading";
const pyWorker = new Worker(new URL('./pyworker.ts', import.meta.url), { type: 'module' });

pyWorker.addEventListener('message', function readyListener (event: MessageEvent<PyWorkerResponse>) {
  switch (event.data.type) { 
    case 'READY':
      runBtnElt.textContent = "Run";
      runBtnElt.disabled = false;
      pyWorker.removeEventListener("message", readyListener);
      break;
    default:
      console.log("readyListener: unexpected message from pyWorker", event.data);
  }
})

async function evaluatePython() {
  runBtnElt.disabled = true;
  outputElt.value = "";

  let code = view.state.doc.toString();
  let output = await evaluatePythonInner(
    code,
    (streamData) => {
      outputElt.value += streamData + "\n";
    }
  );

  outputElt.value += output;
  runBtnElt.disabled = false;
}

async function evaluatePythonInner(code: string, onStream: (data: string) => void) {
  return new Promise((resolve, reject) => {
    pyWorker.addEventListener('message', function listener (event: MessageEvent<PyWorkerResponse>) {
      switch (event.data.type) { 
        case 'RESULT':
          pyWorker.removeEventListener("message", listener);
          resolve(event.data.data);
          break;
        case 'STDOUT':
        case 'STDERR':
          onStream(event.data.data);
          break;
        default:
          console.log("evaluatePythonInner: unexpected message from pyWorker", event.data);
      }
    })
    pyWorker.postMessage({type: 'RUN', code} as PyWorkerRequest);
  });
}

runBtnElt.addEventListener('click', evaluatePython);


