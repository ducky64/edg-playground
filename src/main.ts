import {basicSetup} from "codemirror"
import {EditorView} from "@codemirror/view"
import {python} from "@codemirror/lang-python"

const view = new EditorView({
  doc: `\
from edg import *
`,
  parent: document.body,
  extensions: [basicSetup, python()]
})

// document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
// <section id="next-steps">
//   <div id="docs">
//     <h2>Documentation</h2>
//     <p>Your questions, answered</p>
//     <ul>
//       <li>
//         <a href="https://vite.dev/" target="_blank">
//           Explore Vite
//         </a>
//       </li>
//       <li>
//         <a href="https://www.typescriptlang.org" target="_blank">
//           Learn more
//         </a>
//       </li>
//     </ul>
//   </div>
// </section>
// `
