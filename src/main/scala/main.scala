package edgjs

import scala.scalajs.js
import scala.scalajs.js.annotation._

@JSExportTopLevel("edgjs")
object EdgJs {

  @JSExport
  def processData(input: String): String = {
    s"Processed: $input"
  }
}
