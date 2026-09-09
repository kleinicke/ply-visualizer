"""Normalize array inputs without requiring NumPy or PyTorch for file viewing."""
import sys


def point_rows(value, name):
    """Yield real (N, 3) rows; tensor device/autograd handling is internal.

    Tensor inputs necessarily have torch loaded already. Inspect that module
    rather than importing a potentially large optional dependency on every show.
    Transfer tensors to CPU once, then convert bounded chunks to Python rows;
    this also works for bfloat16 without depending on NumPy dtype support.
    """
    torch = sys.modules.get("torch")
    if torch is not None and isinstance(value, torch.Tensor):
        if value.is_meta:
            raise ValueError(f"{name} is a meta tensor with no data to visualize")
        if value.is_nested or value.layout != torch.strided or value.is_quantized:
            raise ValueError(f"{name} must be a dense, non-quantized tensor")
        _check_shape(value.shape, name)
        if value.is_complex() or value.dtype == torch.bool:
            raise ValueError(f"{name} must contain real numeric values")
        # Never detach in-place or change the original tensor's device/gradient.
        # cpu() is synchronous: serialized rows must contain completed data.
        cpu = value.detach().cpu().resolve_neg()
        return _tensor_rows(cpu)

    numpy = sys.modules.get("numpy")
    if numpy is not None and isinstance(value, numpy.ndarray):
        _check_shape(value.shape, name)
        if numpy.ma.isMaskedArray(value) or value.dtype.kind not in "iuf":
            raise ValueError(f"{name} must contain real numeric values (no masks)")
        # Iteration respects strides, including transposes and reversed slices.
        return value
    return value


def _check_shape(shape, name):
    if len(shape) != 2 or shape[1] != 3:
        raise ValueError(f"{name} must have shape (N, 3); got {tuple(shape)}. Select a batch explicitly, e.g. points[0].")


def _tensor_rows(cpu):
    for start in range(0, len(cpu), 65536):
        yield from cpu[start:start + 65536].tolist()
