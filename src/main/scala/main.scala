package edgjs

import edg.compiler.{
  Compiler,
  DesignAssertionCheck,
  DesignRefsValidate,
  DesignStructuralValidate,
  ExprToString,
  ExprValue,
  ProtobufInterface,
  PythonInterface,
  PythonInterfaceLibrary
}
import edg.wir.{DesignPath, IndirectDesignPath, Refinements}
import edg.EdgirUtils.SimpleLibraryPath
import edg.util.Errorable
import edgrpc.compiler.{compiler => edgcompiler}
import edgrpc.hdl.{hdl => edgrpc}
import edgir.elem.elem
import edgir.ref.ref
import edgir.schema.schema

import java.io.{PrintWriter, StringWriter}
import scala.scalajs.js
import scala.scalajs.js.annotation._
import scala.scalajs.js.typedarray.Uint8Array

class PyodideInterface(pyodide: js.Dynamic) extends ProtobufInterface {
  protected val pyFunction = pyodide.globals.get("edgjs_process_request_bytes")

  protected var lastResponse: Option[edgrpc.HdlResponse] = None

  override def write(message: edgrpc.HdlRequest): Unit = {
    require(lastResponse.isEmpty, "pending response exists")
    val requestBytes = message.toByteArray
    val responsePy = pyFunction(EdgCompilerJs.bytesToUint8Array(requestBytes))
    val responseBytes = EdgCompilerJs.uint8ArrayToBytes(responsePy.asInstanceOf[Uint8Array])
    lastResponse = Some(edgrpc.HdlResponse.parseFrom(responseBytes))
  }

  override def read(): edgrpc.HdlResponse = {
    require(lastResponse.isDefined, "no response exists, call write(...) before")
    val response = lastResponse.get
    lastResponse = None
    response
  }
}

class LoggingPythonInterface(interface: ProtobufInterface, progressFn: js.Dynamic) extends PythonInterface(interface) {
  override def onLibraryRequest(element: ref.LibraryPath): Unit = {
    // this needs to be here to only print on requests that made it to Python (instead of just hit cache)
    progressFn(s"Compile ${element.toSimpleString}")
  }

  override def onLibraryRequestComplete(
      element: ref.LibraryPath,
      result: Errorable[(schema.Library.NS.Val, Option[edgrpc.Refinements])]
  ): Unit = {
    result match {
      case Errorable.Error(msg) =>
        progressFn(
          f"Error while compiling ${element.toSimpleString}: $msg"
        )
      case _ =>
    }
  }

  override def onElaborateGeneratorRequest(
      element: ref.LibraryPath,
      values: Map[ref.LocalPath, ExprValue]
  ): Unit = {
    val valuesString = values
      .map { case (path, value) => s"${ExprToString(path)}: ${value.toStringValue}" }
      .mkString(", ")
    progressFn(
      s"Generate ${element.toSimpleString} ($valuesString)"
    )
  }

  override def onElaborateGeneratorRequestComplete(
      element: ref.LibraryPath,
      values: Map[ref.LocalPath, ExprValue],
      result: Errorable[elem.HierarchyBlock]
  ): Unit = {
    result match {
      case Errorable.Error(msg) =>
        progressFn(
          f"Error while generating ${element.toSimpleString}: $msg"
        )
      case _ =>
    }
  }

  override def onRunRefinementPassComplete(
      refinementPass: ref.LibraryPath,
      result: Errorable[Map[DesignPath, ExprValue]]
  ): Unit = {
    result match {
      case Errorable.Error(msg) =>
        progressFn(
          f"Error while running refinement ${refinementPass.toSimpleString}: $msg"
        )
      case _ =>
    }
  }

  override def onRunBackendComplete(
      backend: ref.LibraryPath,
      result: Errorable[Map[DesignPath, String]]
  ): Unit = {
    result match {
      case Errorable.Error(msg) =>
        progressFn(
          f"Error while running backend ${backend.toSimpleString}: $msg"
        )
      case _ =>
    }
  }
}

@JSExportTopLevel("edgjs")
object EdgCompilerJs {
  def bytesToUint8Array(bytes: Array[Byte]): Uint8Array = {
    Uint8Array.from(js.Array(bytes.map(_.toShort): _*))
  }

  def uint8ArrayToBytes(uint8Array: Uint8Array): Array[Byte] = {
    val bytes = new Array[Byte](uint8Array.length)
    for (i <- 0 until uint8Array.length) {
      bytes(i) = uint8Array(i).toByte
    }
    bytes
  }

  private def constPropToSolved(vals: Map[IndirectDesignPath, ExprValue]): Seq[edgcompiler.CompilerResult.Value] = {
    vals.map { case (path, value) =>
      edgcompiler.CompilerResult.Value(
        path = Some(path.toLocalPath),
        value = Some(value.toLit)
      )
    }.toSeq
  }

  private def constPropConnectionToConnection(vals: Map[DesignPath, DesignPath])
      : Seq[edgcompiler.CompilerResult.Connection] = {
    vals.map { case (block, link) =>
      edgcompiler.CompilerResult.Connection(
        blockPort = Some(block.asIndirect.toLocalPath),
        linkPort = Some(link.asIndirect.toLocalPath)
      )
    }.toSeq
  }

  @JSExport
  def compile(progressFn: js.Dynamic, pyodide: js.Dynamic, requestBytes: Uint8Array): Uint8Array = {
    val request = edgcompiler.CompilerRequest.parseFrom(uint8ArrayToBytes(requestBytes))
    progressFn(s"Compiling ${request.design.get.getContents.getSelfClass.toSimpleString}")

    val pyLib = new PythonInterfaceLibrary()
    val pyodideInterface = new LoggingPythonInterface(new PyodideInterface(pyodide), progressFn)

    val result = pyLib.withPythonInterface(pyodideInterface) {
      try {
        val refinements = Refinements(request.getRefinements)
        val compiler = new Compiler(request.getDesign, pyLib, refinements)
        val compiled = compiler.compile()
        val errors = compiler.getErrors() ++ new DesignAssertionCheck(compiler).map(compiled) ++
          new DesignStructuralValidate().map(compiled) ++ new DesignRefsValidate().validate(compiled)
        edgcompiler.CompilerResult(
          design = Some(compiled),
          errors = errors.map(_.toIr),
          solvedValues = constPropToSolved(compiler.getAllSolved),
          connections = constPropConnectionToConnection(compiler.getAllConnections)
        )
      } catch {
        case e: Throwable =>
          val sw = new StringWriter()
          e.printStackTrace(new PrintWriter(sw))
          edgcompiler.CompilerResult(errors =
            Seq(edgcompiler.ErrorRecord(
              path = Some(DesignPath().asIndirect.toLocalPath),
              kind = "Internal error",
              name = "",
              details = sw.toString
            ))
          )
      }
    }

    bytesToUint8Array(result.toByteArray)
  }
}
