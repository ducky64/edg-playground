export type PyWorkerRequest = {type: 'RUN', code: string};

export type PyWorkerResponse = 
  { type: 'READY' } |
  { type: 'STDOUT' | 'STDERR' | 'PROGRESS', data: string } |
  { type: 'RESULT', netlist: string, bom: string } |
  { type: 'ERROR', error: string };
