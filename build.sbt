import org.scalajs.linker.interface.ModuleSplitStyle

lazy val edgCompiler = (project in file("PolymorphicBlocks/compiler"))  // proto imported transitively
  .enablePlugins(ScalaJSPlugin)

lazy val edgWebCompiler = project.in(file("."))
  .dependsOn(edgCompiler % "compile->compile; test->test")
  .enablePlugins(ScalaJSPlugin)
  .settings(
    scalaVersion := "2.13.18",

    scalaJSUseMainModuleInitializer := false,  // compile as library

    /* Configure Scala.js to emit modules in the optimal way to
     * connect to Vite's incremental reload.
     * - emit ECMAScript modules
     * - emit as many small modules as possible for classes in the "livechart" package
     * - emit as few (large) modules as possible for all other classes
     *   (in particular, for the standard library)
     */
    scalaJSLinkerConfig ~= {
      _.withModuleKind(ModuleKind.ESModule)
        .withModuleSplitStyle(
          ModuleSplitStyle.SmallModulesFor(List("edg")))
    },

    /* Depend on the scalajs-dom library.
     * It provides static types for the browser DOM APIs.
     */
    libraryDependencies += "org.scala-js" %%% "scalajs-dom" % "2.8.1",
  )
