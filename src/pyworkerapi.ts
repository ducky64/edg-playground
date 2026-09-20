export type PyWorkerRequest = {type: 'RUN', code: string};

export type PyWorkerResponse = 
  { type: 'READY' } |
  { type: 'STDOUT' | 'STDERR' | 'PROGRESS', data: string } |
  { type: 'RESULT', name: string, netlist: string, bom: string, json: string } |
  { type: 'ERROR', error: string };

export async function evaluatePython(pyWorker: Worker, code: string, onStream: (data: string) => void): Promise<PyWorkerResponse> {
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