import {basicSetup} from "codemirror"
import {EditorView, keymap} from "@codemirror/view"
import { Prec } from "@codemirror/state";
import {python} from "@codemirror/lang-python"
import type {PyWorkerRequest, PyWorkerResponse} from "./pyworkerapi.ts";

// take up the whole vertical space
document.documentElement.style.height = '100%';
document.body.style.height = '100%';
document.body.style.margin = '0';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.style.height = '100%';
app.style.display = 'flex';
app.style.flexDirection = 'column';

app.innerHTML = `
<div id="helpPopover" popover>
  <h3>EDG Playground</h3>
  <p>
    This is a web demo for <a href="https://github.com/BerkeleyHCI/PolymorphicBlocks/">EDG / Polymorphic Blocks</a>,
    a fully open-source, Python-embedded PCB HDL featuring subcircuit generator libraries. <br/>
    This provides basic functionality to try out the HDL by runing code and generating a KiCad netlist and JLC-compatible BoM. <br/>
    <br/>
    New? Try following the <a href="https://github.com/BerkeleyHCI/PolymorphicBlocks/blob/master/getting-started.md">getting started tutorial</a> here. <br/>
    <br/>
    For more serious work, use the <a href="https://pypi.org/project/edg/">edg pip package</a> with your favorite local Python dev environment. <br/>
    <br/>
    See the source code and file issues on <a href="https://github.com/ducky64/edg-playground">GitHub</a>. <br/>
    This uses Pyodide and Scala.js to run the EDG compiler fully locally in the browser.
  </p>
</div>
<section id="control">
  <a href="https://github.com/ducky64/edg-playground">edg-playground</a> v0.0 (preview)
  <button popovertarget="helpPopover">?</button>
  <button type="button" id="run-btn" class="btn btn-success" disabled></button> 
  <button type="button" id="download-netlists-btn" class="btn btn-success" disabled>Download KiCad netlist</button> 
  <button type="button" id="download-bom-btn" class="btn btn-success" disabled>Download BoM</button>
  <button type="button" id="download-json-btn" class="btn btn-success" disabled>Download JSON</button>
</section>
<section id="code-container" style="flex: 8; display: flex; flex-direction: column; min-height: 100px">
</section>
<section id="output-container" style="flex: 2; display: flex; flex-direction: column; min-height: 100px">
    <h3>Output</h3>
    <textarea id="output" name="output" style="width: 100%; height: 100%; box-sizing: border-box;" readonly>
    </textarea>
</section>
`

let runBtnElt = document.querySelector<HTMLButtonElement>('#run-btn')!;
let downloadNetlistElt = document.querySelector<HTMLButtonElement>('#download-netlists-btn')!;
let downloadBomElt = document.querySelector<HTMLButtonElement>('#download-bom-btn')!;
let downloadJsonElt = document.querySelector<HTMLButtonElement>('#download-json-btn')!;
let outputElt = document.querySelector<HTMLTextAreaElement>('#output')!;

const runKeymap = Prec.highest(keymap.of([{
  key: "Mod-Enter",
  run: () => {
    runBtnElt.click();
    return true;
  }
}]));
let editorTheme = EditorView.theme({
  "&": { height: "100%" },
  ".cm-scroller": { overflow: "auto" }
});
const view = new EditorView({
  parent: document.getElementById("code-container")!,
  extensions: [basicSetup, runKeymap, editorTheme, python()]
})
view.dispatch({
  changes: {from: 0, insert: `\
from edg import *

class MyBoard(SimpleBoardTop):
    def contents(self) -> None:
        super().contents()
        self.mcu = self.Block(Xiao_Rp2040())
        self.led = self.Block(IndicatorLed())
        self.connect(self.mcu.gnd, self.led.gnd)
        self.connect(self.mcu.gpio.request("led"), self.led.signal)

compile_block(MyBoard)
`}
})

function appendOutput(text: string) {
  outputElt.value += text;
  outputElt.scrollTop = outputElt.scrollHeight;
}


runBtnElt.textContent = "Run (loading...)";
outputElt.value = "";
appendOutput("Loading...\n");
const pyWorker = new Worker(new URL('./pyworker.ts', import.meta.url), { type: 'module' });

pyWorker.addEventListener('message', function readyListener (event: MessageEvent<PyWorkerResponse>) {
  switch (event.data.type) { 
    case 'READY':
      runBtnElt.textContent = "Run (Ctrl+↵)";
      runBtnElt.disabled = false;
      pyWorker.removeEventListener("message", readyListener);
      appendOutput("Ready\n");
      break;
    case 'PROGRESS':
      appendOutput(event.data.data + '\n');
      break;
    case 'STDOUT':
    case 'STDERR':
      break;
    default:
      console.log("readyListener: unexpected message from pyWorker", event.data);
  }
})

let lastResult: PyWorkerResponse | null = null;

function downloadAsFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadNetlist() {
  if (lastResult && lastResult.type === 'RESULT') {
    downloadAsFile(lastResult.name + '.net', lastResult.netlist);
  }
}
downloadNetlistElt.addEventListener('click', downloadNetlist);
function downloadBom() {
  if (lastResult && lastResult.type === 'RESULT') {
    downloadAsFile(lastResult.name + '.csv', lastResult.bom);
  }
}
downloadBomElt.addEventListener('click', downloadBom);
function downloadJson() {
  if (lastResult && lastResult.type === 'RESULT') {
    downloadAsFile(lastResult.name + '.json', lastResult.json);
  }
}
downloadJsonElt.addEventListener('click', downloadJson);

async function evaluatePython() {
  runBtnElt.disabled = true;
  runBtnElt.textContent = "Run (running...)";
  lastResult = null;
  downloadNetlistElt.disabled = true;
  downloadBomElt.disabled = true;
  downloadJsonElt.disabled = true;
  outputElt.value = "";

  let code = view.state.doc.toString();
  let output = await evaluatePythonInner(
    code,
    (streamData) => {
      appendOutput(streamData + "\n");
    }
  );

  if (output.type === 'RESULT') {
    appendOutput("Compilation complete\n");
    lastResult = output;
    downloadNetlistElt.disabled = false;
    downloadBomElt.disabled = false;
    downloadJsonElt.disabled = false;
  } else if (output.type === 'ERROR') {
    appendOutput("Error: " + output.error + "\n");
  } else {
    appendOutput("Unknown compilation completion result\n");
  }
  
  runBtnElt.textContent = "Run (Ctrl+↵)";
  runBtnElt.disabled = false;
}

async function evaluatePythonInner(code: string, onStream: (data: string) => void): Promise<PyWorkerResponse> {
  return new Promise((resolve, _reject) => {
    const listener = (event: MessageEvent<PyWorkerResponse>) => {
      switch (event.data.type) { 
        case 'RESULT':
        case 'ERROR':
          pyWorker.removeEventListener("message", listener);
          resolve(event.data);
          break;
        case 'STDOUT':
        case 'STDERR':
        case 'PROGRESS':
          onStream(event.data.data);
          break;
        default:
          console.log("evaluatePythonInner: unexpected message from pyWorker", event.data);
      }
    }
    pyWorker.addEventListener('message', listener);
    pyWorker.postMessage({type: 'RUN', code} as PyWorkerRequest);
  });
}

runBtnElt.addEventListener('click', evaluatePython);
