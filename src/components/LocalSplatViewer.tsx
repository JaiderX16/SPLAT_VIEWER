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

    useFrame(() => {
        if (groupRef.current) {
            const opacity = animationState.current.fullOpacity;

            groupRef.current.traverse((child: any) => {
                if (child.isMesh && child.material) {
                    const material = child.material;

                    // Inject uniforms if not present
                    if (!material.userData.shaderPatched) {
                        material.userData.shaderPatched = true;
                        material.transparent = true;

                        material.onBeforeCompile = (shader: any) => {
                            shader.uniforms.uRevealProgress = { value: 0 };
                            shader.uniforms.uGlobalOpacity = { value: 0 };

                            // Make uniforms accessible for updates
                            material.userData.shaderUniforms = shader.uniforms;

                            // Vertex Shader Patch: Scale by distance
                            shader.vertexShader = 'uniform float uRevealProgress;\n' + shader.vertexShader;
                            shader.vertexShader = shader.vertexShader.replace(
                                'vec4 centerAndScaleData = texelFetch(centerAndScaleTexture, texPos, 0);',
                                `
                                vec4 centerAndScaleData = texelFetch(centerAndScaleTexture, texPos, 0);
                                float dist = length(centerAndScaleData.xyz);
                                // Reveal logic matching point cloud style (radial wave)
                                // Progress * 3.0 ensures the wave passes through the whole model (adjust as needed)
                                float t = clamp(uRevealProgress * 4.0 - dist * 0.5, 0.0, 1.0);
                                float revealScale = smoothstep(0.0, 1.0, t);
                                centerAndScaleData.w *= revealScale;
                                `
                            );

                            // Fragment Shader Patch: Global Opacity
                            shader.fragmentShader = 'uniform float uGlobalOpacity;\n' + shader.fragmentShader;
                            shader.fragmentShader = shader.fragmentShader.replace(
                                'void main () {',
                                'void main () {\n'
                            ).replace(
                                '#include <alphatest_fragment>',
                                `
                                // Apply global opacity
                                diffuseColor.a *= uGlobalOpacity;
                                #include <alphatest_fragment>
                                `
                            );
                        };
                        material.needsUpdate = true;
                    }

                    // Update uniforms
                    if (material.userData.shaderUniforms) {
                        material.userData.shaderUniforms.uRevealProgress.value = opacity; // Drive reveal with opacity
                        material.userData.shaderUniforms.uGlobalOpacity.value = opacity;
                    }

                    // Fallback helpers
                    child.visible = opacity > 0.001;
                    if (material.transparent !== true) material.transparent = true;
                }
            });
        }
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
