import {basicSetup} from "codemirror"
import {EditorView} from "@codemirror/view"
import {python} from "@codemirror/lang-python"


document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div id="docs">
  <button type="button" class="btn btn-success" onclick="evaluatePython()">
      Run
  </button> 
</div>
<div id="code-container">
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
