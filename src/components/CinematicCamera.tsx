import { useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { REVEAL_DELAY, CROSSFADE_DURATION } from './VisualizerConfig';

interface CinematicCameraProps {
    modelCenter: THREE.Vector3;
    startTimeRef: MutableRefObject<number>;
    isActive: boolean;
}

const CinematicCamera = ({ modelCenter, startTimeRef, isActive }: CinematicCameraProps) => {
    const { camera } = useThree();

    const path = useMemo(() => {
        const points = [];
        const center = modelCenter || new THREE.Vector3(0, 0, 0);
        const baseRadius = 2.6; // Más cerca para mejor zoom

        // Espiral ascendente progresiva (sin bajar del suelo)
        for (let i = 0; i <= 12; i++) {
            const angle = (i / 12) * Math.PI * 3; // 1.5 vueltas suaves
            const radius = baseRadius - (i / 12) * 0.2;
            const h = 0.8 + (i / 12) * 1.0;

            points.push(new THREE.Vector3(
                center.x + Math.cos(angle) * radius,
                center.y + h,
                center.z + Math.sin(angle) * radius
            ));
        }
        return new THREE.CatmullRomCurve3(points);
    }, [modelCenter]);

    // Reuse a single Vector3 for lookAt target — avoids a GC-triggering allocation every frame
    const lookTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);

    useFrame((state) => {
        if (!isActive || !startTimeRef.current) return;

        const elapsed = state.clock.elapsedTime - startTimeRef.current;
        const totalDuration = REVEAL_DELAY + CROSSFADE_DURATION + 1.0;
        const rawProgress = Math.min(elapsed / totalDuration, 1.0);

        // easeInOutCubic
        const easeProgress = rawProgress < 0.5
            ? 4 * rawProgress * rawProgress * rawProgress
            : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2;

        const pos = path.getPointAt(easeProgress);
        camera.position.lerp(pos, 0.05);
        camera.lookAt(lookTarget);
    });

    return null;
};

export default CinematicCamera;
