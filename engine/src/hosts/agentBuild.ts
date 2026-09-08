/* eslint-disable @typescript-eslint/naming-convention -- MCP wire keys */
declare const __PLY_BUILD_INFO__: {
  package_version: string;
  commit: string;
  renderer_build_id: string;
};
export const agentBuild =
  typeof __PLY_BUILD_INFO__ === 'undefined'
    ? { package_version: 'development', commit: 'unknown', renderer_build_id: 'unbundled' }
    : __PLY_BUILD_INFO__;
