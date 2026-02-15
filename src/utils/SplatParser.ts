import * as THREE from 'three';
import { MAX_ANIMATED_POINTS } from '../components/VisualizerConfig';

export interface SplatData {
    positions: Float32Array;
    colors: Float32Array;
    scales: Float32Array;
    opacities: Float32Array;
    vertexCount: number;
    center: THREE.Vector3;
    minY: number;
}

export function parseSplat(buffer: ArrayBuffer): SplatData {
    const rowLength = 32;
    const totalVertexCount = Math.floor(buffer.byteLength / rowLength);

    // Downsample if too large to keep animation smooth
    let step = 1;
    if (totalVertexCount > MAX_ANIMATED_POINTS) {
        step = Math.ceil(totalVertexCount / MAX_ANIMATED_POINTS);
        console.log(`⚡ Optimizing: Downsampling point cloud by factor of ${step} (${totalVertexCount} -> ~${Math.floor(totalVertexCount / step)} points)`);
    }

    const vertexCount = Math.floor(totalVertexCount / step);

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const scales = new Float32Array(vertexCount);
    const opacities = new Float32Array(vertexCount);

    const f_buffer = new Float32Array(buffer);
    const u_buffer = new Uint8Array(buffer);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertexCount; i++) {
        const srcIndex = i * step;
        const x = f_buffer[srcIndex * 8 + 0];
        const y = f_buffer[srcIndex * 8 + 1];
        const z = f_buffer[srcIndex * 8 + 2];

        positions[i * 3 + 0] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;

        const sx = f_buffer[srcIndex * 8 + 3];
        const sy = f_buffer[srcIndex * 8 + 4];
        const sz = f_buffer[srcIndex * 8 + 5];
        scales[i] = Math.exp((sx + sy + sz) / 3.0);

        colors[i * 3 + 0] = u_buffer[srcIndex * 32 + 24] / 255;
        colors[i * 3 + 1] = u_buffer[srcIndex * 32 + 25] / 255;
        colors[i * 3 + 2] = u_buffer[srcIndex * 32 + 26] / 255;
        opacities[i] = u_buffer[srcIndex * 32 + 27] / 255;
    }

    const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    return { positions, colors, scales, opacities, vertexCount, center, minY };
}
