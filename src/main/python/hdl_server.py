from typing import Type

from edg import edgrpc, Block, edgir, builder, CompiledDesign, RefdesRefinementPass, NetlistBackend
from edg.electronics_model.BomBackend import GenerateBom
from edg.hdl_server.__main__ import process_request
from pyodide.ffi import to_js


def edgjs_process_request_bytes(request_bytes: bytes) -> bytes:
    hdl_request = edgrpc.HdlRequest()
    hdl_request.ParseFromString(request_bytes.to_py())
    hdl_response = process_request(hdl_request)
    if hdl_response is None:
        return b""
    return to_js(hdl_response.SerializeToString())


def compile_block(block: Type[Block]) -> bytes:
    block_obj = block()
    request = edgrpc.CompilerRequest(design=edgir.Design(contents=builder.elaborate_toplevel(block_obj)))
    block_obj.refinements().populate_proto(request.refinements)
    return request.SerializeToString()


def postprocess_compiled_result(result_bytes: bytes) -> dict:
    result = edgrpc.CompilerResult()
    result.ParseFromString(result_bytes.to_py())
    compiled = CompiledDesign.from_compiler_result(result)
    compiled.append_values(RefdesRefinementPass().run(compiled))

    if result.errors:
      return {'errors': compiled.errors_str()}

    netlist_all = NetlistBackend().run(compiled)
    netlists_dict = {'_'.join(edgir.local_path_to_str_list(path)): netlist for path, netlist in netlist_all}
    bom_all = GenerateBom().run(compiled)
    assert len(bom_all) == 1, "expect exactly one unified BoM"

    return to_js({
        'netlists': netlists_dict,
        'bom': bom_all[0][1],
    })
