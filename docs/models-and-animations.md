# Models and animations

GLTF/GLB, FBX, Collada (`.dae`) and 3DS retain their scene hierarchy and
original materials. GLTF/GLB, FBX and Collada animation clips have play/pause,
clip selection, looping, speed and timeline controls. Double-click the timeline
to return to the start. Mesh visibility, wireframe and file transforms apply to
the whole model. STL and OBJ retain their existing mesh workflows.

In VS Code, keep supporting buffers and textures beside the model or in its
subdirectories. In the website file picker, select the model and its supporting
files together. Missing optional textures appear as resource warnings; missing
required buffers prevent loading. Exporter-specific features may be unsupported
by the Three.js loaders (including some Collada skin/morph controller
combinations); Draco/KTX2/Meshopt decoders are not configured. 3DS is loaded as
a static scene. This supports model animations, not MP4/WebM playback.

Real upstream samples and reproducible download/test instructions are documented
in [model fixtures](model-fixtures.md).
