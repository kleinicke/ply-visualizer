# Camera Calibration and Profile Formats

This document describes common camera calibration file formats used in computer
vision, particularly for stereo depth processing.

## OpenCV Camera Calibration (camera_calibration.yml, intrinsics.xml)

**File extensions:** `.yml`, `.yaml`, `.xml` **Common names:**
`camera_calibration.yml`, `intrinsics.yml`, `camera_matrix.xml`

```yaml
%YAML:1.0
camera_matrix: !!opencv-matrix
   rows: 3
   cols: 3
   dt: d
   data: [ fx, 0, cx,
           0, fy, cy,
           0, 0, 1 ]
distortion_coefficients: !!opencv-matrix
   rows: 1
   cols: 5
   dt: d
   data: [ k1, k2, p1, p2, k3 ]
image_width: 640
image_height: 480
```

## ROS Camera Info (camera_info.yaml)

**File extensions:** `.yaml`, `.yml` **Common names:** `camera_info.yaml`,
`left_camera.yaml`, `right_camera.yaml`

```yaml
image_width: 640
image_height: 480
camera_name: camera
camera_matrix:
  rows: 3
  cols: 3
  data: [fx, 0, cx, 0, fy, cy, 0, 0, 1]
distortion_model: plumb_bob
distortion_coefficients:
  rows: 1
  cols: 5
  data: [k1, k2, p1, p2, k3]
rectification_matrix:
  rows: 3
  cols: 3
  data: [1, 0, 0, 0, 1, 0, 0, 0, 1]
projection_matrix:
  rows: 3
  cols: 4
  data: [fx, 0, cx, 0, 0, fy, cy, 0, 0, 0, 1, 0]
```

## Stereo Calibration (stereo_calibration.yml)

**File extensions:** `.yml`, `.yaml` **Common names:** `stereo_calibration.yml`,
`stereo_params.yaml`

```yaml
%YAML:1.0
left_camera_matrix: !!opencv-matrix
   rows: 3
   cols: 3
   dt: d
   data: [ fx_l, 0, cx_l, 0, fy_l, cy_l, 0, 0, 1 ]
right_camera_matrix: !!opencv-matrix
   rows: 3
   cols: 3
   dt: d
   data: [ fx_r, 0, cx_r, 0, fy_r, cy_r, 0, 0, 1 ]
left_distortion: !!opencv-matrix
   rows: 1
   cols: 5
   dt: d
   data: [ k1_l, k2_l, p1_l, p2_l, k3_l ]
right_distortion: !!opencv-matrix
   rows: 1
   cols: 5
   dt: d
   data: [ k1_r, k2_r, p1_r, p2_r, k3_r ]
rotation_matrix: !!opencv-matrix
   rows: 3
   cols: 3
   dt: d
   data: [ r11, r12, r13, r21, r22, r23, r31, r32, r33 ]
translation_vector: !!opencv-matrix
   rows: 3
   cols: 1
   dt: d
   data: [ tx, ty, tz ]
essential_matrix: !!opencv-matrix
   rows: 3
   cols: 3
   dt: d
   data: [ e11, e12, e13, e21, e22, e23, e31, e32, e33 ]
fundamental_matrix: !!opencv-matrix
   rows: 3
   cols: 3
   dt: d
   data: [ f11, f12, f13, f21, f22, f23, f31, f32, f33 ]
baseline: 120.0  # in mm
```

## COLMAP Camera Models (cameras.txt)

**File extensions:** `.txt` **Common names:** `cameras.txt`, `camera_models.txt`

```
# Camera list with one line of data per camera:
#   CAMERA_ID, MODEL, WIDTH, HEIGHT, PARAMS[]
1 PINHOLE 640 480 fx fy cx cy
2 RADIAL 640 480 f cx cy k1
3 OPENCV 640 480 fx fy cx cy k1 k2 p1 p2
4 OPENCV_FISHEYE 640 480 fx fy cx cy k1 k2 k3 k4
```

## Kalibr Camera Chain (camchain.yaml)

**File extensions:** `.yaml` **Common names:** `camchain.yaml`,
`camera_chain.yaml`

```yaml
cam0:
  camera_model: pinhole
  intrinsics: [fx, fy, cx, cy]
  distortion_model: radtan
  distortion_coeffs: [k1, k2, p1, p2]
  resolution: [640, 480]
  rostopic: /cam0/image_raw
cam1:
  camera_model: pinhole
  intrinsics: [fx, fy, cx, cy]
  distortion_model: radtan
  distortion_coeffs: [k1, k2, p1, p2]
  resolution: [640, 480]
  rostopic: /cam1/image_raw
  T_cn_cnm1: # Transform from cam0 to cam1
    - [r11, r12, r13, tx]
    - [r21, r22, r23, ty]
    - [r31, r32, r33, tz]
    - [0.0, 0.0, 0.0, 1.0]
```

## Intel RealSense Profile (.bag metadata)

**File extensions:** `.json`, `.cfg` **Common names:** `camera_profile.json`,
`realsense_config.json`

```json
{
  "device": {
    "serial_number": "123456789",
    "firmware_version": "5.12.7.100"
  },
  "color_stream": {
    "width": 640,
    "height": 480,
    "fps": 30,
    "format": "RGB8",
    "intrinsics": {
      "fx": 615.123,
      "fy": 615.456,
      "ppx": 320.789,
      "ppy": 240.123,
      "coeffs": [0.1, -0.2, 0.001, 0.002, 0.05]
    }
  },
  "depth_stream": {
    "width": 640,
    "height": 480,
    "fps": 30,
    "format": "Z16",
    "intrinsics": {
      "fx": 385.123,
      "fy": 385.456,
      "ppx": 320.789,
      "ppy": 240.123,
      "coeffs": [0.0, 0.0, 0.0, 0.0, 0.0]
    }
  },
  "extrinsics": {
    "rotation": [0.999, 0.001, -0.02, -0.001, 1.0, 0.001, 0.02, -0.001, 0.999],
    "translation": [-0.05, 0.0, 0.0]
  }
}
```

## ZED Camera Calibration (.conf)

**File extensions:** `.conf` **Common names:** `SN12345.conf`,
`calibration.conf`

```ini
[LEFT_CAM_HD]
fx=672.123
fy=672.456
cx=640.0
cy=360.0
k1=-0.123
k2=0.234
p1=0.001
p2=-0.002
k3=-0.456

[RIGHT_CAM_HD]
fx=671.789
fy=671.234
cx=640.0
cy=360.0
k1=-0.125
k2=0.236
p1=0.001
p2=-0.002
k3=-0.458

[STEREO]
Baseline=120.0
CV_HD=0.999 -0.001 0.02 -0.001 0.999 0.001 -0.02 0.001 0.999
RX_HD=-74.123
```

## Structure from Motion (SfM) Format (.txt)

**File extensions:** `.txt`, `.dat` **Common names:** `cameras.txt`,
`reconstruction.txt`

```
# Bundler format
<num_cameras> <num_points>
<camera_params1>
<camera_params2>
...

# Camera parameters format:
<f> <k1> <k2>
<R11> <R12> <R13>
<R21> <R22> <R23>
<R31> <R32> <R33>
<t1> <t2> <t3>
```

## Middlebury Stereo Dataset (calib.txt)

**File extensions:** `.txt` **Common names:** `calib.txt`, `calibration.txt`
**Used by:** Middlebury Stereo Evaluation, ETH3D Dataset (similar format)

```
# Stereo camera calibration parameters
cam0=[3997.684 0 1176.728; 0 3997.684 1011.728; 0 0 1]
cam1=[3997.684 0 1307.839; 0 3997.684 1011.728; 0 0 1]
doffs=131.111
baseline=193.001
width=2964
height=1988
ndisp=280
isint=0
vmin=31
vmax=257
dyavg=0.918
dymax=1.516
```

**Parameters:**

- `cam0`, `cam1`: Camera matrices in format `[f 0 cx; 0 f cy; 0 0 1]`
  - `f`: Focal length in pixels (same for fx, fy)
  - `cx`, `cy`: Principal point coordinates
- `doffs`: X-difference of principal points (cx1 - cx0)
- `baseline`: Camera baseline in mm
- `width`, `height`: Image dimensions in pixels
- `ndisp`: Conservative bound on disparity levels (0 to ndisp-1)
- `isint`: Whether GT disparities have integer precision (0=float, 1=integer)
- `vmin`, `vmax`: Tight bounds on min/max disparities for visualization
- `dyavg`, `dymax`: Average and maximum absolute y-disparities (calibration
  error indication)

**Disparity-to-Depth Conversion:**

```
Z = baseline * f / (d + doffs)
```

Where `d` is the disparity value from .pfm files, `Z` is depth in mm.

## TUM Dataset Format (associations.txt, camera.txt)

**File extensions:** `.txt` **Common names:** `camera.txt`, `groundtruth.txt`

```
# Camera parameters (TUM format)
# fx fy cx cy
525.0 525.0 319.5 239.5

# Associations file
timestamp_rgb rgb_filename timestamp_depth depth_filename
1305031102.175304 rgb/1305031102.175304.png 1305031102.160407 depth/1305031102.160407.png
```

## Parameter Definitions

### Common Intrinsic Parameters

- `fx, fy`: Focal lengths in pixels
- `cx, cy`: Principal point coordinates (image center)
- `k1, k2, k3`: Radial distortion coefficients
- `p1, p2`: Tangential distortion coefficients

### Stereo Parameters

- `baseline`: Distance between camera centers (mm)
- `R`: Rotation matrix between cameras (3x3)
- `T`: Translation vector between cameras (3x1)
- `E`: Essential matrix (3x3)
- `F`: Fundamental matrix (3x3)

## Camera Profile JSON Format

**File extensions:** `.json` **Common names:** `calibration.json`,
`cameras.json`, `camera_profile.json` **Used by:** 3D Visualizer extension for
depth-to-point cloud conversion

The 3D Visualizer currently supports a custom JSON format for camera
calibration:

```json
{
  "cameras": {
    "camera_0": {
      "fx": 525.0,
      "fy": 525.0,
      "cx": 319.5,
      "cy": 239.5,
      "camera_model": "pinhole-ideal",
      "k1": 0.1,
      "k2": -0.05,
      "p1": 0.001,
      "p2": 0.002
    },
    "left_camera": {
      "fx": 3997.684,
      "fy": 3997.684,
      "cx": 1176.728,
      "cy": 1011.728,
      "camera_model": "pinhole-opencv",
      "baseline": 193.001
    },
    "right_camera": {
      "fx": 3997.684,
      "fy": 3997.684,
      "cx": 1307.839,
      "cy": 1011.728,
      "camera_model": "pinhole-opencv",
      "baseline": 193.001
    }
  }
}
```

**Supported Camera Models:**

- `pinhole-ideal`: Standard pinhole camera (no distortion)
- `pinhole-opencv`: Pinhole with OpenCV distortion model
- `fisheye-equidistant`: Equidistant fisheye projection
- `fisheye-opencv`: OpenCV fisheye model
- `fisheye-kannala-brandt`: Kannala-Brandt polynomial fisheye model

**Usage in 3D Visualizer:**

1. Load calibration file via "📁 Load Calibration File" button
2. Select camera from dropdown (populated from JSON keys)
3. Camera parameters automatically populate the depth conversion form
4. Use for converting depth/disparity images to 3D point clouds

### File Usage Context

- **Single camera calibration**: OpenCV YAML, ROS camera_info
- **Stereo pairs**: Stereo calibration YAML, Kalibr camchain, Middlebury
  calib.txt
- **Multi-camera rigs**: COLMAP, Kalibr, Camera JSON
- **Commercial systems**: RealSense JSON, ZED conf
- **Research datasets**: TUM, KITTI, Middlebury, ETH3D formats
