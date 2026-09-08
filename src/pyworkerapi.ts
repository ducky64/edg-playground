export type PyWorkerRequest = {type: 'RUN', code: string};

export type PyWorkerResponse = 
  { type: 'READY' } |
  { type: 'STDOUT' | 'STDERR', data: string } |
  { type: 'RESULT', data: string };
