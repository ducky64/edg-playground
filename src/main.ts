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

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div id="helpPopover" popover>
  <h3>EDG Playground</h3>
  <p>
    This is a web demo for <a href="https://github.com/BerkeleyHCI/PolymorphicBlocks/">EDG / Polymorphic Blocks</a>,
    a fully open-source, Python-embedded board HDL featuring libraries of subcircuit generators. <br/>
    This provides basic functionality to try out the HDL by runing code and generating a KiCad netlist and JLC-compatible BoM. <br/>
    <br/>
    New? Try following the <a href="https://github.com/BerkeleyHCI/PolymorphicBlocks/blob/master/getting-started.md">getting started tutorial</a> here. <br/>
    <br/>
    For more serious work, use the <a href="https://pypi.org/project/edg/">edg pip package</a> with your favorite local Python dev environment. <br/>
    <br/>
    See the source code and file issues on <a href="https://github.com/ducky64/edg-playground">GitHub</a>
    This uses Pyodide and Scala.js to run the EDG compiler fully locally in the browser.
  </p>
</div>
<section id="control">
  <button popovertarget="helpPopover">?</button>
  <button type="button" id="run-btn" class="btn btn-success" disabled></button> 
  <button type="button" id="download-netlists-btn" class="btn btn-success" disabled>Download netlist</button> 
  <button type="button" id="download-bom-btn" class="btn btn-success" disabled>Download BoM</button> 
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
  parent: document.getElementById("code-container"),
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
const pyWorker = new Worker(new URL('./pyworker.ts', import.meta.url), { type: 'module' });

pyWorker.addEventListener('message', function readyListener (event: MessageEvent<PyWorkerResponse>) {
  switch (event.data.type) { 
    case 'READY':
      runBtnElt.textContent = "Run (Ctrl+↵)";
      runBtnElt.disabled = false;
      pyWorker.removeEventListener("message", readyListener);
      break;
    default:
      console.log("readyListener: unexpected message from pyWorker", event.data);
  }
})

async function evaluatePython() {
  runBtnElt.disabled = true;
  runBtnElt.textContent = "Run (running...)";
  downloadNetlistElt.disabled = true;
  downloadBomElt.disabled = true;
  outputElt.value = "";

  let code = view.state.doc.toString();
  let output = await evaluatePythonInner(
    code,
    (streamData) => {
      appendOutput(streamData + "\n");
    }
  );

  appendOutput(output);
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
