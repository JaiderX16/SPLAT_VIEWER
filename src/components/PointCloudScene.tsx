import { useRef, useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SplatData } from '../utils/SplatParser';

interface PointCloudSceneProps {
    data: SplatData | null;
    globalScale: number;
    animationState: MutableRefObject<{ pointOpacity: number; fullOpacity: number }>;
    startTimeRef: MutableRefObject<number>;
    quality?: 'low' | 'high';
}

interface AnimatedShaderMaterial extends THREE.ShaderMaterial {
    uniforms: {
        uTime: { value: number };
        uGlobalScale: { value: number };
        uGlobalOpacity: { value: number };
    };
}

const PointCloudScene = ({ data, globalScale, animationState, startTimeRef, quality = 'high' }: PointCloudSceneProps) => {
    const materialRef = useRef<AnimatedShaderMaterial>(null);

    const { chunks, material } = useMemo(() => {
        if (!data) return { chunks: [], material: null };

        const chunks: { geometry: THREE.InstancedBufferGeometry }[] = [];
        const numPoints = data.vertexCount;
        const targetCount = quality === 'low' ? Math.floor(numPoints * 0.4) : numPoints;

        // --- 1. Define Grid (2x2x2 for 8 chunks) ---
        const divisions = 2;
        const gridIndices: number[][] = Array.from({ length: divisions ** 3 }, () => []);

        // Find bounding box for spatial division
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < numPoints * 3; i += 3) {
            minX = Math.min(minX, data.positions[i]);
            minY = Math.min(minY, data.positions[i + 1]);
            minZ = Math.min(minZ, data.positions[i + 2]);
            maxX = Math.max(maxX, data.positions[i]);
            maxY = Math.max(maxY, data.positions[i + 1]);
            maxZ = Math.max(maxZ, data.positions[i + 2]);
        }

        const sizeX = (maxX - minX) || 1;
        const sizeY = (maxY - minY) || 1;
        const sizeZ = (maxZ - minZ) || 1;

        // --- 2. Assign points to chunks ---
        // We only process targetCount points if low quality is set
        const step = quality === 'low' ? Math.floor(numPoints / targetCount) : 1;

        for (let i = 0; i < numPoints; i += step) {
            const idx = i * 3;
            const px = data.positions[idx];
            const py = data.positions[idx + 1];
            const pz = data.positions[idx + 2];

            const ix = Math.min(divisions - 1, Math.floor(((px - minX) / sizeX) * divisions));
            const iy = Math.min(divisions - 1, Math.floor(((py - minY) / sizeY) * divisions));
            const iz = Math.min(divisions - 1, Math.floor(((pz - minZ) / sizeZ) * divisions));

            const gridIdx = ix + iy * divisions + iz * (divisions ** 2);
            gridIndices[gridIdx].push(i);
        }

        // --- 3. Create Geometries for each chunk ---
        const baseGeometry = new THREE.PlaneGeometry(1, 1);

        gridIndices.forEach((indices) => {
            if (indices.length === 0) return;

            const geo = new THREE.InstancedBufferGeometry();
            geo.setAttribute('position', baseGeometry.attributes.position);
            geo.setAttribute('uv', baseGeometry.attributes.uv);
            geo.setIndex(baseGeometry.index);

            const count = indices.length;
            const pos = new Float32Array(count * 3);
            const col = new Float32Array(count * 3);
            const scl = new Float32Array(count);
            const opa = new Float32Array(count);

            let maxDistSq = 0;
            const center = new THREE.Vector3(0, 0, 0);

            indices.forEach((pointIdx, i) => {
                const srcIdx = pointIdx * 3;
                pos[i * 3] = data.positions[srcIdx];
                pos[i * 3 + 1] = data.positions[srcIdx + 1];
                pos[i * 3 + 2] = data.positions[srcIdx + 2];

                col[i * 3] = data.colors[srcIdx];
                col[i * 3 + 1] = data.colors[srcIdx + 1];
                col[i * 3 + 2] = data.colors[srcIdx + 2];

                scl[i] = data.scales[pointIdx];
                opa[i] = data.opacities[pointIdx];

                const d2 = pos[i * 3] ** 2 + pos[i * 3 + 1] ** 2 + pos[i * 3 + 2] ** 2;
                if (d2 > maxDistSq) maxDistSq = d2;

                center.x += pos[i * 3];
                center.y += pos[i * 3 + 1];
                center.z += pos[i * 3 + 2];
            });

            center.divideScalar(count);

            // Recalculate radius from actual center of chunk
            let radius = 0;
            for (let i = 0; i < count; i++) {
                const dx = pos[i * 3] - center.x;
                const dy = pos[i * 3 + 1] - center.y;
                const dz = pos[i * 3 + 2] - center.z;
                radius = Math.max(radius, dx * dx + dy * dy + dz * dz);
            }

            geo.setAttribute('instPosition', new THREE.InstancedBufferAttribute(pos, 3));
            geo.setAttribute('instColor', new THREE.InstancedBufferAttribute(col, 3));
            geo.setAttribute('instScale', new THREE.InstancedBufferAttribute(scl, 1));
            geo.setAttribute('instOpacity', new THREE.InstancedBufferAttribute(opa, 1));
            geo.instanceCount = count;
            geo.boundingSphere = new THREE.Sphere(center, Math.sqrt(radius) + 0.5);

            chunks.push({ geometry: geo });
        });

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uGlobalScale: { value: 1.0 },
                uGlobalOpacity: { value: 1.0 },
            },
            vertexShader: /* glsl */ `
                attribute vec3 instPosition;
                attribute vec3 instColor;
                attribute float instScale;
                attribute float instOpacity;

                uniform float uTime;
                uniform float uGlobalScale;

                varying vec3 vColor;
                varying float vOpacity;
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    vColor = instColor;
                    vOpacity = instOpacity;

                    float dist = length(instPosition);
                    float triggerTime = dist * 0.5;
                    float t = clamp(uTime - triggerTime, 0.0, 1.0);

                    // Simple linear reveal - no shockwave, no peak, no elongation
                    float animationScale = smoothstep(0.0, 1.0, t) * 0.35;

                    vec4 mvPosition = modelViewMatrix * vec4(instPosition, 1.0);
                    
                    // Apply scale uniformly to the quad
                    float finalScale = instScale * animationScale * uGlobalScale;
                    mvPosition.xyz += vec3(position.x * finalScale, position.y * finalScale, 0.0);

                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: /* glsl */ `
                varying vec3 vColor;
                varying float vOpacity;
                varying vec2 vUv;

                uniform float uGlobalOpacity;

                void main() {
                    vec2 center = vUv - 0.5;
                    float distSq = dot(center, center);
                    if (distSq > 0.25) discard;

                    float alpha = (1.0 - distSq * 4.0) * vOpacity * uGlobalOpacity;
                    if (alpha < 0.05) discard;

                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
        }) as AnimatedShaderMaterial;

        return { chunks, material: mat };
    }, [data, quality]);

    useEffect(() => {
        if (material) {
            materialRef.current = material;
        }
    }, [material]);

    useEffect(() => {
        if (materialRef.current) {
            materialRef.current.uniforms.uGlobalScale.value = globalScale;
        }
    }, [globalScale]);

    useFrame((state) => {
        if (!materialRef.current || !startTimeRef.current) return;

        // Drive time-based radial wave animation
        const elapsed = state.clock.elapsedTime - startTimeRef.current;
        materialRef.current.uniforms.uTime.value = elapsed;

        // Drive opacity from shared animation ref (no re-renders)
        materialRef.current.uniforms.uGlobalOpacity.value = animationState.current.pointOpacity;
    });

    if (!chunks.length || !material) return null;

    return (
        <>
            {chunks.map((chunk, i) => (
                <mesh key={i} geometry={chunk.geometry} material={material} frustumCulled={true} />
            ))}
        </>
    );
};

export default PointCloudScene;
