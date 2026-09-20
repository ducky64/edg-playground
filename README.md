# edg-playground

Run the web app on [Github Pages](https://ducky64.github.io/edg-playground/)!

Web app demo for the [Polymorphic Blocks / edg](https://github.com/BerkeleyHCI/PolymorphicBlocks/) PCB HDL.
Run HDL code in the browser and compile to a KiCad netlist and JLCPCB-friendly BoM.

This is a basic demonstrator, to try out the HDL with zero setup cost.
This should compile most example board designs, but is limited to single-file designs and does not save code across web page reloads.
Multiple Block definitions within a single file are OK, but schematic-defined blocks are not supported.
For more serious work, use the HDL system locally (`pip install edg`).

This builds into a fully client side web app, using pyodide to run Python in the browser and scala.js to transpile the Scala board compiler into Javascript.


# Work in Progress

This is a work in progress.

Planned features
- [ ] Library browser
- [ ] Generate HDL code from library browser
- [ ] Basic design inspector
