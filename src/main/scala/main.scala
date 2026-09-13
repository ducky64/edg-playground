package edgjs

import edg.compiler.{Compiler, DesignAssertionCheck, DesignRefsValidate, DesignStructuralValidate, ExprValue, ProtobufInterface, PythonInterface, PythonInterfaceLibrary}
import edg.wir.{DesignPath, IndirectDesignPath, Refinements}
import edgrpc.compiler.{compiler => edgcompiler}
import edgrpc.hdl.{hdl => edgrpc}

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
    val responsePy = pyFunction(Uint8Array.from(js.Array(requestBytes.map(_.toShort):_*)))
    val responseArray = responsePy.toJs().asInstanceOf[Uint8Array]
    val responseBytes = new Array[Byte](responseArray.length)
    for (i <- 0 until responseArray.length) {
      responseBytes(i) = responseArray(i).toByte
    }
    lastResponse = Some(edgrpc.HdlResponse.parseFrom(responseBytes))
  }

  override def read(): edgrpc.HdlResponse = {
    require(lastResponse.isDefined, "no response exists, call write(...) before")
    val response = lastResponse.get
    lastResponse = None
    response
  }
}

@JSExportTopLevel("edgjs")
object EdgCompilerJs {
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
  def compile(pyodide: js.Dynamic, requestBytes: Array[Byte]): Array[Byte] = {
    val request = edgcompiler.CompilerRequest.parseFrom(requestBytes)

    val pyLib = new PythonInterfaceLibrary()
    val pyodideInterface = new PythonInterface(new PyodideInterface(pyodide))

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

    result.toByteArray
  }
}
