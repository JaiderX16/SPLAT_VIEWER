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
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<AnimatedShaderMaterial>(null);

    const { geometry, material } = useMemo(() => {
        if (!data) return { geometry: null, material: null };

        const geo = new THREE.InstancedBufferGeometry();

        // Base quad
        const baseGeometry = new THREE.PlaneGeometry(1, 1);
        geo.setAttribute('position', baseGeometry.attributes.position);
        geo.setAttribute('uv', baseGeometry.attributes.uv);
        geo.setIndex(baseGeometry.index);

        // Instance attributes
        geo.setAttribute('instPosition', new THREE.InstancedBufferAttribute(data.positions, 3));
        geo.setAttribute('instColor', new THREE.InstancedBufferAttribute(data.colors, 3));
        geo.setAttribute('instScale', new THREE.InstancedBufferAttribute(data.scales, 1));
        geo.setAttribute('instOpacity', new THREE.InstancedBufferAttribute(data.opacities, 1));

        // Quality-based point density
        const targetCount = quality === 'low' ? Math.floor(data.vertexCount * 0.4) : data.vertexCount;
        geo.instanceCount = targetCount;

        // Compute bounding sphere for frustum culling
        // Gaussian splats are usually centered around origin or have a known distribution
        // For a benchmark, we can approximate or compute it from positions if performance allows
        // Here we'll compute it once from the data
        const positions = data.positions;
        let maxDistSq = 0;
        for (let i = 0; i < positions.length; i += 3) {
            const d2 = positions[i] ** 2 + positions[i + 1] ** 2 + positions[i + 2] ** 2;
            if (d2 > maxDistSq) maxDistSq = d2;
        }
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), Math.sqrt(maxDistSq) + 1);

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

                    // Simplified animation for performance
                    float animationScale = clamp(t * 2.0, 0.0, 1.0);
                    if (t > 0.0 && t < 1.0) {
                        // Subtle bounce if needed, but linear is faster
                        animationScale = mix(0.0, 0.35, t); 
                    } else if (t >= 1.0) {
                        animationScale = 0.35;
                    }

                    vec4 mvPosition = modelViewMatrix * vec4(instPosition, 1.0);
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

                    // Faster alpha calculation
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

        return { geometry: geo, material: mat };
    }, [data]);

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

    if (!geometry || !material) return null;

    return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={true} />;
};

export default PointCloudScene;
