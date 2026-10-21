/**
 * Pack Three geometries into transferable typed arrays so the tile worker
 * can finish merge/decode off the main thread.
 */
import { BufferAttribute, BufferGeometry } from 'three';
import type { BuiltTile } from './buildTile';

export type PackedMesh = {
  position: Float32Array;
  normal: Float32Array;
  index?: Uint32Array;
  color?: Float32Array;
  uv?: Float32Array;
  height?: Float32Array;
};

export type PackedTile = {
  key: string;
  buildings: PackedMesh | null;
  roofs: PackedMesh | null;
  parks: PackedMesh | null;
  water: PackedMesh | null;
  sidewalks: PackedMesh | null;
  roads: PackedMesh | null;
};

function copyFloat(geo: BufferGeometry, name: string): Float32Array | undefined {
  const attr = geo.getAttribute(name);
  if (!attr) return undefined;
  return new Float32Array(attr.array as ArrayLike<number>);
}

export function packGeometry(geo: BufferGeometry | null | undefined): PackedMesh | null {
  if (!geo) return null;
  const pos = geo.getAttribute('position');
  if (!pos) return null;
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal');
  if (!nrm) return null;
  const index = geo.getIndex();
  return {
    position: new Float32Array(pos.array as ArrayLike<number>),
    normal: new Float32Array(nrm.array as ArrayLike<number>),
    index: index ? new Uint32Array(index.array as ArrayLike<number>) : undefined,
    color: copyFloat(geo, 'color'),
    uv: copyFloat(geo, 'uv'),
    height: copyFloat(geo, 'aHeight'),
  };
}

export function unpackGeometry(mesh: PackedMesh | null | undefined): BufferGeometry | null {
  if (!mesh?.position?.length) return null;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(mesh.position, 3));
  geo.setAttribute('normal', new BufferAttribute(mesh.normal, 3));
  if (mesh.index?.length) geo.setIndex(new BufferAttribute(mesh.index, 1));
  if (mesh.color) geo.setAttribute('color', new BufferAttribute(mesh.color, 3));
  if (mesh.uv) geo.setAttribute('uv', new BufferAttribute(mesh.uv, 2));
  if (mesh.height) geo.setAttribute('aHeight', new BufferAttribute(mesh.height, 1));
  geo.computeBoundingSphere();
  return geo;
}

export function packBuiltTile(built: BuiltTile): PackedTile {
  return {
    key: built.key,
    buildings: packGeometry(built.buildings[0] ?? null),
    roofs: packGeometry(built.roofs[0] ?? null),
    parks: packGeometry(built.parks),
    water: packGeometry(built.water),
    sidewalks: packGeometry(built.sidewalks),
    roads: packGeometry(built.roads),
  };
}

export function unpackBuiltTile(packed: PackedTile): BuiltTile {
  const buildings = unpackGeometry(packed.buildings);
  const roofs = unpackGeometry(packed.roofs);
  return {
    key: packed.key,
    buildings: buildings ? [buildings] : [],
    roofs: roofs ? [roofs] : [],
    parks: unpackGeometry(packed.parks),
    water: unpackGeometry(packed.water),
    sidewalks: unpackGeometry(packed.sidewalks),
    roads: unpackGeometry(packed.roads),
    major: null,
  };
}

export function packedTransferList(packed: PackedTile): Transferable[] {
  const out: Transferable[] = [];
  const push = (mesh: PackedMesh | null) => {
    if (!mesh) return;
    out.push(mesh.position.buffer, mesh.normal.buffer);
    if (mesh.index) out.push(mesh.index.buffer);
    if (mesh.color) out.push(mesh.color.buffer);
    if (mesh.uv) out.push(mesh.uv.buffer);
    if (mesh.height) out.push(mesh.height.buffer);
  };
  push(packed.buildings);
  push(packed.roofs);
  push(packed.parks);
  push(packed.water);
  push(packed.sidewalks);
  push(packed.roads);
  return out;
}

export function disposePackedSources(built: BuiltTile) {
  built.buildings.forEach((geo) => geo.dispose());
  built.roofs.forEach((geo) => geo.dispose());
  built.parks?.dispose();
  built.water?.dispose();
  built.sidewalks?.dispose();
  built.roads?.dispose();
  built.major?.dispose();
}
