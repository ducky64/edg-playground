import { edgjs } from '../target/scala-2.13/edgwebcompiler-fastopt/main.js';

const result = edgjs.processData("hello from TS");
console.log(result);
