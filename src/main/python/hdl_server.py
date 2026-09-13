from typing import Type

from edg import edgrpc, Block, edgir, builder
from edg.hdl_server.__main__ import process_request


def edgjs_process_request_bytes(request_bytes: bytes) -> bytes:
    hdl_request = edgrpc.HdlRequest()
    hdl_request.ParseFromString(request_bytes)
    hdl_response = process_request(hdl_request)
    if hdl_response is None:
        return b""
    return hdl_response.SerializeToString()


def compile_request(block: Type[Block]) -> bytes:
    block_obj = block()
    request = edgrpc.CompilerRequest(design=edgir.Design(contents=builder.elaborate_toplevel(block_obj)))
    request.SerializeToString()
