from typing import Type

from edg import edgrpc, Block, edgir, builder, CompiledDesign, RefdesRefinementPass, NetlistBackend
from edg.electronics_model.BomBackend import GenerateBom
from edg.hdl_server.__main__ import process_request
from pyodide.ffi import to_js, JsArray


def edgjs_process_request_bytes(request_bytes: JsArray) -> JsArray:
    hdl_request = edgrpc.HdlRequest()
    hdl_request.ParseFromString(bytes(request_bytes))
    hdl_response = process_request(hdl_request)
    if hdl_response is None:
        return to_js(b"")
    return to_js(hdl_response.SerializeToString())


def compile_block(block: Type[Block]) -> bytes:
    block_obj = block()
    request = edgrpc.CompilerRequest(design=edgir.Design(contents=builder.elaborate_toplevel(block_obj)))
    block_obj.refinements().populate_proto(request.refinements)
    return request.SerializeToString()


def postprocess_compiled_result(result_bytes: JsArray) -> dict:
    result = edgrpc.CompilerResult()
    result.ParseFromString(bytes(result_bytes))
    compiled = CompiledDesign.from_compiler_result(result)
    compiled.append_values(RefdesRefinementPass().run(compiled))

    assert not result.errors, f"got compile errors: {result.errors}"

    design_name = compiled.design.contents.self_class.target.name.split('.')[-1]

    netlist_all = NetlistBackend().run(compiled)
    bom_all = GenerateBom().run(compiled)

    assert len(bom_all) == 1, "expect exactly one unified BoM"
    assert len(netlist_all) == 1, "expect exactly one unified netlist"

    return to_js({
        'name': design_name,
        'netlist': netlist_all[0][1],
        'bom': bom_all[0][1],
    })
