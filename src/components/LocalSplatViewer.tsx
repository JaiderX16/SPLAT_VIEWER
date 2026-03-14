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
        const opacity = animationState.current.fullOpacity;

        // Fast visibility toggle
        if (groupRef.current) {
            groupRef.current.visible = opacity > 0.001;
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
