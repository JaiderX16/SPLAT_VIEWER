import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Splat } from '@react-three/drei';
import * as THREE from 'three';

interface LocalSplatViewerProps {
    source: string | null;
    format: number | undefined;
    animationState: MutableRefObject<{ pointOpacity: number; fullOpacity: number }>;
}

const LocalSplatViewer = ({ source, animationState }: LocalSplatViewerProps) => {
    const groupRef = useRef<THREE.Group>(null);

    const materialsRef = useRef<THREE.Material[]>([]);
    const traverseCount = useRef(0);

    useFrame(() => {
        const opacity = animationState.current.fullOpacity;

        // Optimize: Only traverse every 30 frames and only until we find materials
        if (groupRef.current && materialsRef.current.length === 0 && traverseCount.current % 30 === 0) {
            groupRef.current.traverse((child: any) => {
                if (child.isMesh && child.material) {
                    const material = child.material;
                    if (!material.userData.shaderPatched) {
                        material.userData.shaderPatched = true;
                        material.transparent = true;

                        material.onBeforeCompile = (shader: any) => {
                            shader.uniforms.uRevealProgress = { value: 0 };
                            shader.uniforms.uGlobalOpacity = { value: 0 };
                            material.userData.shaderUniforms = shader.uniforms;

                            shader.vertexShader = 'uniform float uRevealProgress;\n' + shader.vertexShader;
                            shader.vertexShader = shader.vertexShader.replace(
                                'vec4 centerAndScaleData = texelFetch(centerAndScaleTexture, texPos, 0);',
                                `
                                vec4 centerAndScaleData = texelFetch(centerAndScaleTexture, texPos, 0);
                                float dist = length(centerAndScaleData.xyz);
                                float t = clamp(uRevealProgress * 4.0 - dist * 0.5, 0.0, 1.0);
                                float revealScale = smoothstep(0.0, 1.0, t);
                                centerAndScaleData.w *= revealScale;
                                `
                            );

                            shader.fragmentShader = 'uniform float uGlobalOpacity;\n' + shader.fragmentShader;
                            shader.fragmentShader = shader.fragmentShader.replace(
                                'void main () {',
                                'void main () {\n'
                            ).replace(
                                '#include <alphatest_fragment>',
                                `
                                diffuseColor.a *= uGlobalOpacity;
                                #include <alphatest_fragment>
                                `
                            );
                        };
                        material.needsUpdate = true;
                        materialsRef.current.push(material);
                    }
                }
            });
        }

        // Update cached materials
        for (const material of materialsRef.current) {
            if (material.userData.shaderUniforms) {
                material.userData.shaderUniforms.uRevealProgress.value = opacity;
                material.userData.shaderUniforms.uGlobalOpacity.value = opacity;
            }
        }

        // Fast visibility toggle
        if (groupRef.current) {
            groupRef.current.visible = opacity > 0.001;
        }

        traverseCount.current++;
    });

    if (!source) return null;

    return (
        <group ref={groupRef} rotation={[Math.PI, 0, 0]}>
            <Splat
                src={source}
                toneMapped={false}
                alphaTest={0.1}
            />
        </group>
    );
};

export default LocalSplatViewer;
