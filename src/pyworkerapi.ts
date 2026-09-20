export type PyWorkerRequest = {type: 'RUN', code: string};

export type PyWorkerResponse = 
  { type: 'READY' } |
  { type: 'STDOUT' | 'STDERR' | 'PROGRESS', data: string } |
  PyWorkerResult |
  { type: 'ERROR', error: string };

export type PyWorkerResult = 
  { type: 'RESULT', name: string, netlist: string, bom: string, json: string };


export async function evaluatePython(pyWorker: Worker, code: string, onStream: (data: string) => void): Promise<PyWorkerResult> {
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<PyWorkerResponse>) => {
      switch (event.data.type) { 
        case 'RESULT':
          pyWorker.removeEventListener("message", listener);
          resolve(event.data as PyWorkerResult);
          break;
        case 'ERROR':
          pyWorker.removeEventListener("message", listener);
          reject(event.data.error);
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