/* eslint-disable @typescript-eslint/naming-convention -- Match the public MCP schemas. */
import * as vscode from 'vscode';
import Ajv from 'ajv/dist/2020';
import * as fs from 'fs/promises';
import * as path from 'path';
import { gunzipSync } from 'zlib';
import { nativeAgentPanels as panels } from './panels';
import type { PointCloudEditorProvider } from '../pointCloudEditorProvider';

export const operations: Record<string, string> = {
  inspect_3d_scene: 'inspect',
  set_3d_camera: 'camera',
  capture_3d_view: 'capture',
  navigate_3d_view: 'navigate',
  set_3d_appearance: 'appearance',
  set_3d_object: 'object',
  transform_3d_object: 'transform',
  measure_3d_scene: 'measure',
  control_3d_video: 'video',
  align_3d_clouds: 'alignment',
  pick_3d_point: 'pick',
  manage_3d_views: 'views',
  select_3d_region: 'selection',
  manage_3d_selections: 'named_selections',
  compare_3d_clouds: 'comparison',
  preview_3d_views: 'multi_view',
};
const limit = 256 * 1024 * 1024;
const ajv = new Ajv({ strict: false, strictNumbers: true, useDefaults: true, allErrors: true });
const contributions: any[] = require('../../package.json').contributes.languageModelTools;
const validators = new Map(
  contributions.map(t => [t.toolReferenceName, ajv.compile(t.inputSchema)])
);

async function allowedPath(value: string, writing = false): Promise<string> {
  const roots = await Promise.all(
    (vscode.workspace.workspaceFolders ?? []).map(folder => fs.realpath(folder.uri.fsPath))
  );
  if (!roots.length) {
    throw new Error('Open a trusted workspace folder to load or export files.');
  }
  const absolute = path.resolve(roots[0], value);
  const resolved = writing
    ? path.join(await fs.realpath(path.dirname(absolute)), path.basename(absolute))
    : await fs.realpath(absolute);
  if (
    !roots.some(root => {
      const relative = path.relative(root, resolved);
      return (
        relative === '' ||
        (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
      );
    })
  ) {
    throw new Error(
      'File is outside the open workspace folders. Add its folder to the workspace first.'
    );
  }
  return resolved;
}
async function asset(value: string) {
  const resolved = await allowedPath(value);
  const stat = await fs.stat(resolved);
  if (!stat.isFile() || stat.size > limit) {
    throw new Error('Expected a regular file of at most 256 MiB');
  }
  return {
    name: path.basename(resolved),
    base64: (await fs.readFile(resolved)).toString('base64'),
  };
}
async function newArtifact(value: string, suffix: string): Promise<string> {
  const target = await allowedPath(value, true);
  if (path.extname(target).toLowerCase() !== suffix) {
    throw new Error(`Expected a ${suffix} artifact path`);
  }
  try {
    await fs.lstat(target);
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      return target;
    }
    throw e;
  }
  throw new Error('Artifact already exists; choose a new path');
}

async function download(
  url: string,
  filename: string | undefined,
  maxBytes: number,
  token: vscode.CancellationToken
) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Use a direct HTTP(S) URL without embedded credentials');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  const cancelled = token.onCancellationRequested(() => controller.abort());
  try {
    if (token.isCancellationRequested) {
      throw new vscode.CancellationError();
    }
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response.body as any) {
      size += chunk.length;
      if (size > maxBytes) {
        controller.abort();
        throw new Error('Download exceeds max_bytes');
      }
      chunks.push(Buffer.from(chunk));
    }
    let bytes = Buffer.concat(chunks);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      bytes = gunzipSync(bytes, { maxOutputLength: maxBytes });
    }
    const name =
      filename ?? decodeURIComponent(new URL(response.url).pathname.split('/').pop() || 'download');
    return { name: path.basename(name).replace(/\.gz$/i, ''), base64: bytes.toString('base64') };
  } finally {
    clearTimeout(timer);
    cancelled.dispose();
  }
}

export async function invokeNativeTool(
  name: string,
  input: Record<string, any>,
  provider: PointCloudEditorProvider,
  token: vscode.CancellationToken
): Promise<any> {
  if (!vscode.workspace.isTrusted) {
    throw new Error('3D agent tools require a trusted workspace');
  }
  if (token.isCancellationRequested) {
    throw new vscode.CancellationError();
  }
  const a = structuredClone(input);
  const validate = validators.get(name);
  if (!validate || !validate(a)) {
    throw new Error('Invalid tool arguments: ' + ajv.errorsText(validate?.errors));
  }
  for (const key of Object.keys(a)) {
    if (a[key] === null) {
      delete a[key];
    }
  }
  const request = (operation: string, args: Record<string, any> = a) =>
    panels.request(a.scene_id, operation, args, token);
  if (name === 'list_3d_scenes') {
    return {
      scenes: panels.list(),
      extension_version: require('../../package.json').version,
      host: 'vscode',
    };
  }
  if (name === 'close_3d_scene') {
    panels.close(a.scene_id);
    return { closed: true, scene_id: a.scene_id };
  }
  if (operations[name]) {
    return request(operations[name]);
  }
  if (
    [
      'open_3d_files',
      'open_3d_url',
      'open_depth_image',
      'visualize_points',
      'update_3d_scene',
    ].includes(name)
  ) {
    let files: any[] = [],
      depth: any;
    if (name === 'open_3d_files') {
      for (const file of a.paths) {
        files.push(await asset(file));
      }
    }
    if (name === 'open_3d_url') {
      const urls = Array.isArray(a.url) ? a.url : [a.url];
      if (!urls.length || urls.length > 32 || (urls.length > 1 && a.filename)) {
        throw new Error('Provide 1..32 URLs; filename is only supported for one URL');
      }
      for (const url of urls) {
        files.push(await download(url, a.filename, a.max_bytes, token));
      }
    }
    if (name === 'open_depth_image') {
      const roles: Record<string, number> = {};
      const add = async (role: string, file: string) => {
        roles[role] = files.length;
        files.push(await asset(file));
      };
      if (a.colmap_image) {
        if (a.calibration || a.rgb || a.confidence || a.mask) {
          throw new Error(
            'COLMAP workspace mode derives calibration and does not accept explicit companions'
          );
        }
        const root = await allowedPath(a.path);
        const sparse = path.join(root, 'sparse');
        const find = async (stem: string) => {
          for (const dir of [sparse, path.join(sparse, '0')]) {
            for (const suffix of ['.bin', '.txt']) {
              const file = path.join(dir, stem + suffix);
              try {
                await fs.access(file);
                return file;
              } catch {
                /* Next conventional sparse model path. */
              }
            }
          }
          throw new Error(`COLMAP ${stem}.bin/.txt not found under sparse or sparse/0`);
        };
        await add(
          'depth',
          path.join(root, 'stereo', 'depth_maps', `${a.colmap_image}.${a.colmap_variant}.bin`)
        );
        await add('cameras', await find('cameras'));
        await add('images', await find('images'));
      } else {
        if (!a.calibration) {
          throw new Error(
            'Explicit depth calibration is required; read parameters from surrounding files/context'
          );
        }
        await add('depth', a.path);
        for (const role of ['rgb', 'mask', 'confidence']) {
          if (a[role]) {
            await add(role, a[role]);
          }
        }
        a.calibration = {
          camera_model: 'pinhole-ideal',
          image_rectified: false,
          convention: 'opencv',
          value_scale: 1,
          value_offset: 0,
          disparity_offset: 0,
          coefficients: [],
          invalid_values: [0],
          sources: {},
          ...a.calibration,
        };
      }
      depth = {
        version: 1,
        asset_count: files.length,
        roles,
        calibration: a.calibration,
        colmap_image: a.colmap_image,
      };
    }
    if (files.reduce((n, f) => n + f.base64.length * 0.75, 0) > limit) {
      throw new Error('One native load is limited to 256 MiB total; add files in separate calls');
    }
    const created = !a.scene_id;
    if (created) {
      a.scene_id = panels.id(await provider.createAgentScene());
    }
    try {
      return await request('native_load', {
        files,
        depth,
        points: a.points,
        colors: a.colors,
        target: a.target,
        vectors: a.vectors,
        vector_scale: a.vector_scale,
        replace: name === 'update_3d_scene',
      });
    } catch (error) {
      if (created) {
        panels.close(a.scene_id);
      }
      throw error;
    }
  }
  if (name === 'manage_3d_scene_states' && a.action !== 'export_models') {
    if (a.action !== 'list' && !a.name) {
      throw new Error('name is required');
    }
    if (!['import', 'export'].includes(a.action)) {
      return request('scene_states');
    }
    if (!a.path) {
      throw new Error('path is required');
    }
    if (a.action === 'import') {
      const file = await allowedPath(a.path);
      if (path.extname(file) !== '.json' || (await fs.stat(file)).size > 4 * 1024 * 1024) {
        throw new Error('Expected a scene-state .json of at most 4 MiB');
      }
      const state = JSON.parse(await fs.readFile(file, 'utf8'));
      let result = await request('scene_states', { ...a, state });
      if (a.restore) {
        result = await request('scene_states', { action: 'restore', name: a.name });
      }
      return { ...result, path: file };
    }
    const file = await newArtifact(a.path, '.json');
    const result = await request('scene_states');
    const bytes = Buffer.from(JSON.stringify(result.state));
    if (bytes.length > 4 * 1024 * 1024) {
      throw new Error('Scene state exceeds 4 MiB');
    }
    await fs.writeFile(file, bytes, { flag: 'wx' });
    return { path: file, bytes: bytes.length, name: a.name };
  }
  if (
    name === 'export_3d_selection' ||
    (name === 'manage_3d_scene_states' && a.action === 'export_models')
  ) {
    if (!a.path) {
      throw new Error('path is required');
    }
    const models = a.action === 'export_models';
    const file = await newArtifact(a.path, models ? '.glb' : '.ply');
    const meta = await request('export_subset', {
      action: 'start',
      name: a.name,
      scope: models ? 'models' : 'selection',
    });
    try {
      if (!(meta.size > 0 && meta.size <= limit)) {
        throw new Error('Export exceeds 256 MiB');
      }
      const chunks: Buffer[] = [];
      let offset = 0;
      while (offset < meta.size) {
        const chunk = await request('export_subset', {
          action: 'chunk',
          export_id: meta.export_id,
          offset,
        });
        const bytes = Buffer.from(chunk.data, 'base64');
        if (
          chunk.offset !== offset ||
          chunk.size !== meta.size ||
          !bytes.length ||
          bytes.length > Math.min(512 * 1024, meta.size - offset)
        ) {
          throw new Error('Invalid export chunk');
        }
        chunks.push(bytes);
        offset += bytes.length;
      }
      await fs.writeFile(file, Buffer.concat(chunks), { flag: 'wx' });
      return {
        path: file,
        bytes: meta.size,
        points: meta.points,
        attributes: meta.attributes,
        models: meta.models,
        animations: meta.animations,
      };
    } finally {
      await request('export_subset', { action: 'release', export_id: meta.export_id }).catch(
        () => undefined
      );
    }
  }
  throw new Error(`Unknown native tool: ${name}`);
}

export function registerNativeAgentTools(
  context: vscode.ExtensionContext,
  provider: PointCloudEditorProvider
) {
  for (const tool of contributions) {
    context.subscriptions.push(
      vscode.lm.registerTool(tool.name, {
        prepareInvocation(options) {
          const destination = options.input as any;
          return {
            invocationMessage: tool.displayName,
            ...(destination.path &&
            ['export_3d_selection', 'manage_3d_scene_states'].includes(tool.toolReferenceName)
              ? {
                  confirmationMessages: {
                    title: tool.displayName,
                    message: `Access scene artifact: ${destination.path}`,
                  },
                }
              : {}),
          };
        },
        async invoke(options, token) {
          try {
            const result = await invokeNativeTool(
              tool.toolReferenceName,
              options.input as any,
              provider,
              token
            );
            const content: (vscode.LanguageModelTextPart | vscode.LanguageModelDataPart)[] = [];
            if (result.png) {
              content.push(
                vscode.LanguageModelDataPart.image(Buffer.from(result.png, 'base64'), 'image/png')
              );
              delete result.png;
            }
            content.unshift(
              new vscode.LanguageModelTextPart(JSON.stringify({ ok: true, ...result }))
            );
            return new vscode.LanguageModelToolResult(content);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                JSON.stringify({
                  ok: false,
                  code: token.isCancellationRequested ? 'CANCELLED' : 'VIEWER_ERROR',
                  message: error instanceof Error ? error.message : String(error),
                })
              ),
            ]);
          }
        },
      })
    );
  }
}
