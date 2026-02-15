
import { useFrame, useThree } from '@react-three/fiber';
import { REVEAL_DELAY, CROSSFADE_DURATION } from './VisualizerConfig';
import type { MutableRefObject } from 'react';

interface TransitionControllerProps {
    animationState: MutableRefObject<{ pointOpacity: number; fullOpacity: number }>;
    setShowPointCloud: (show: boolean) => void;
    startTimeRef: MutableRefObject<number>;
    setCinematicActive: (active: boolean) => void;
    doneRef: MutableRefObject<boolean>;
}

const TransitionController = ({
    animationState,
    setShowPointCloud,
    startTimeRef,
    setCinematicActive,
    doneRef
}: TransitionControllerProps) => {
    const { clock } = useThree();

    useFrame(() => {
        if (!startTimeRef.current) {
            startTimeRef.current = clock.elapsedTime;
        }

        const elapsed = clock.elapsedTime - startTimeRef.current;

        if (elapsed > REVEAL_DELAY) {
            const progress = (elapsed - REVEAL_DELAY) / CROSSFADE_DURATION;
            // Restore full animation to 1.0
            const t = Math.min(progress, 1.0);

            // Full model fades in linearly
            animationState.current.fullOpacity = t;

            // Point cloud stays full until halfway, then fades out
            let pointOp = 1.0;
            if (t > 0.5) {
                pointOp = 1.0 - ((t - 0.5) / 0.5);
            }
            animationState.current.pointOpacity = pointOp;

            // Enable completion logic: hide points, show full model
            if (t >= 1 && !doneRef.current) {
                doneRef.current = true;
                animationState.current.fullOpacity = 1;
                animationState.current.pointOpacity = 0;
                setShowPointCloud(false);
            }

            // Cinematic camera cleanup
            if (doneRef.current && elapsed > REVEAL_DELAY + CROSSFADE_DURATION + 1.0) {
                setCinematicActive(false);
            }
        }
    });

    return null;
};

export default TransitionController;
