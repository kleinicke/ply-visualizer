from pathlib import Path
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ply_visualizer.session import _points_file

try:
    import numpy as np
except ImportError:
    np = None
try:
    import torch
except ImportError:
    torch = None


class ArrayTestBase(unittest.TestCase):
    def serialize(self, points, colors=None):
        with tempfile.TemporaryDirectory() as directory:
            data = _points_file(points, colors, Path(directory)).read_bytes()
        return data.split(b"end_header\n", 1)[1]


@unittest.skipIf(np is None, "NumPy is not installed")
class NumpyTests(ArrayTestBase):
    def test_strides_dtypes_and_input_unchanged(self):
        for dtype in (np.float16, np.float32, np.float64, np.int64):
            points = np.arange(18, dtype=dtype).reshape(3, 6).T[::-2]
            before = points.copy()
            points.flags.writeable = False
            with self.subTest(dtype=dtype):
                self.assertEqual(self.serialize(points), points.astype("<f4").tobytes())
                np.testing.assert_array_equal(points, before)

    def test_numpy_colors(self):
        self.assertEqual(self.serialize(np.array([[1., 2., 3.]]), np.array([[4, 5, 6]], dtype=np.uint8)), struct.pack("<fffBBB", 1, 2, 3, 4, 5, 6))

    def test_invalid_shapes_and_types(self):
        for points in (np.zeros((2, 4, 3)), np.zeros((3,)), np.zeros((1, 3), dtype=complex), np.zeros((1, 3), dtype=bool), np.array([["1", "2", "3"]]), np.ma.array([[1, 2, 3]], mask=[[True, False, False]])):
            with self.subTest(shape=points.shape, dtype=points.dtype), self.assertRaises(ValueError):
                self.serialize(points)


@unittest.skipIf(torch is None, "PyTorch is not installed")
class TorchTests(ArrayTestBase):
    def check_device(self, device):
        for dtype in (torch.float32, torch.float16, torch.bfloat16):
            # A transposed, non-leaf tensor tests strides and existing history.
            leaf = torch.arange(6, dtype=dtype, device=device).reshape(3, 2).requires_grad_()
            points = (leaf * 2).T
            colors = torch.tensor([[1., 2., 3.], [4., 5., 6.]], device=device, requires_grad=True)
            with self.subTest(device=device, dtype=dtype):
                for source in (points, points.detach()):
                    self.assertEqual(self.serialize(source, colors), struct.pack("<fffBBBfffBBB", 0, 4, 8, 1, 2, 3, 2, 6, 10, 4, 5, 6))
                self.assertEqual(points.device.type, device)
                self.assertTrue(points.requires_grad)
                self.assertIsNotNone(points.grad_fn)
                self.assertTrue(colors.requires_grad)
                self.assertIsNone(leaf.grad)
                points.sum().backward()
                torch.testing.assert_close(leaf.grad, torch.full_like(leaf, 2))

    def test_cpu_autograd_and_dtypes(self):
        self.check_device("cpu")

    @unittest.skipUnless(torch is not None and torch.cuda.is_available(), "CUDA GPU is unavailable")
    def test_cuda_autograd_and_dtypes(self):
        self.check_device("cuda")

    @unittest.skipUnless(torch is not None and torch.backends.mps.is_available(), "MPS GPU is unavailable")
    def test_mps_autograd_and_dtypes(self):
        self.check_device("mps")

    def test_int_and_lazy_negative(self):
        points = torch.tensor([[1, 2, 3]])
        self.assertEqual(self.serialize(points), struct.pack("<fff", 1, 2, 3))
        self.assertEqual(self.serialize(torch._neg_view(points)), struct.pack("<fff", -1, -2, -3))

    def test_parameter_inference_and_chunk_boundary(self):
        self.assertEqual(self.serialize(torch.nn.Parameter(torch.tensor([[1., 2., 3.]]))), struct.pack("<fff", 1, 2, 3))
        with torch.inference_mode():
            points = torch.ones(65537, 3)
            data = self.serialize(points)
        self.assertEqual(len(data), 65537 * 12)
        self.assertEqual(data[-12:], struct.pack("<fff", 1, 1, 1))

    def test_invalid_inputs(self):
        for points in (torch.zeros(2, 4, 3), torch.zeros(1, 3, dtype=torch.complex64), torch.zeros(1, 3, device="meta"), torch.zeros(1, 3).to_sparse(), torch.tensor([[float("inf"), 1, 2]])):
            with self.subTest(points=points), self.assertRaises(ValueError):
                self.serialize(points)

    @unittest.skipIf(np is None, "NumPy is not installed")
    def test_mixed_numpy_and_torch(self):
        self.assertEqual(self.serialize(np.array([[1, 2, 3]]), torch.tensor([[4, 5, 6]])), struct.pack("<fffBBB", 1, 2, 3, 4, 5, 6))
        self.assertEqual(self.serialize(torch.tensor([[1, 2, 3]]), np.array([[4, 5, 6]])), struct.pack("<fffBBB", 1, 2, 3, 4, 5, 6))


if __name__ == "__main__":
    unittest.main()
