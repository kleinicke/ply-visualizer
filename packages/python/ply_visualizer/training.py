"""Opt-in PyTorch hooks; importing this module does not import PyTorch."""
import warnings


class LayerInspection:
    """A removable forward hook which never replaces the module's output.

    `select` must return an (N, 3) point tensor. Updates happen every `every`
    forward calls. The caller owns the viewer's lifetime.
    """
    def __init__(self, module, viewer, *, select=lambda output: output, every=100):
        if not isinstance(every, int) or every < 1:
            raise ValueError("every must be a positive integer")
        self.calls = 0
        self.error = None
        self._viewer = viewer
        self._select = select
        self._every = every
        self._handle = module.register_forward_hook(self._capture)

    def _capture(self, module, args, output):
        self.calls += 1
        if (self.calls - 1) % self._every == 0:
            try:
                self._viewer.update(self._select(output), step=self.calls)
            except Exception as error:
                # Visualization errors should not invalidate a training forward.
                self.error = error
                self.close()
                warnings.warn(f"Layer inspection stopped: {error}", RuntimeWarning, stacklevel=2)
        return None

    def close(self):
        self._handle.remove()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()
