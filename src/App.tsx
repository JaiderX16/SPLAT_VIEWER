import { useState, useRef, useEffect, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Stats, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';

// Internal Components
import PointCloudScene from './components/PointCloudScene';
import LocalSplatViewer from './components/LocalSplatViewer';
import CinematicCamera from './components/CinematicCamera';
import TransitionController from './components/TransitionController';
import VisualizerUI from './components/VisualizerUI';

// Logic & Config
import { parseSplat } from './utils/SplatParser';
import type { SplatData } from './utils/SplatParser';
import { DEFAULT_PARTICLE_SIZE } from './components/VisualizerConfig';

import './App.css';

export default function App() {
  // --- State ---
  const [splatData, setSplatData] = useState<SplatData | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [format, setFormat] = useState<number | undefined>(undefined);
  const [globalScale, setGlobalScale] = useState(DEFAULT_PARTICLE_SIZE);
  const [modelScale, setModelScale] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [showPointCloud, setShowPointCloud] = useState(true);
  const [isCinematic, setIsCinematic] = useState(false);
  const [dpr, setDpr] = useState(1); // Start at 1.0 (standard) instead of 1.5
  const [quality, setQuality] = useState<'low' | 'high'>('high');

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(0) as MutableRefObject<number>;
  const animationState = useRef({ pointOpacity: 1, fullOpacity: 0 });
  const doneRef = useRef(false);

  // --- Effects ---
  useEffect(() => {
    if (splatData && source) {
      startTimeRef.current = 0;
      animationState.current = { pointOpacity: 1, fullOpacity: 0 };
      doneRef.current = false;
      setShowPointCloud(true);
      setIsCinematic(true);
      setModelScale(1.5);
    }
  }, [splatData, source]);

  const replayAnimation = useCallback(() => {
    startTimeRef.current = 0;
    animationState.current = { pointOpacity: 1, fullOpacity: 0 };
    doneRef.current = false;
    setShowPointCloud(true);
    setIsCinematic(true);
  }, []);

  // Auto-load demo model
  useEffect(() => {
    const demoUrl = '/models/model.splat';
    setLoading(true);

    fetch(demoUrl)
      .then(res => {
        if (!res.ok) throw new Error("Demo model not found");
        return res.arrayBuffer();
      })
      .then(buffer => {
        setSplatData(parseSplat(buffer));
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        setSource(blobUrl);
        setFormat(0);
      })
      .catch(err => console.log('Demo load skipped:', err))
      .finally(() => setLoading(false));
  }, []);

  // --- Handlers ---
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.splat', '.ply'];
    const fileName = file.name.toLowerCase();
    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
      alert('Please upload a .splat or .ply file');
      return;
    }

    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      setSplatData(parseSplat(buffer));
      const objectUrl = URL.createObjectURL(file);
      setSource(objectUrl);
      setFormat(fileName.endsWith('.ply') ? 2 : 0);
    } catch (err) {
      console.error(err);
      alert('Failed to load file');
    }
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);


  return (
    <div className="relative w-full h-screen bg-black text-white font-sans overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0.5, 2.0], fov: 60 }}
          dpr={dpr}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
          }}
          shadows={false}
        >
          <PerformanceMonitor
            ms={200}
            iterations={3}
            onDecline={() => setDpr(1)}
            onIncline={() => setDpr(quality === 'high' ? 1.5 : 1.1)}
          />
          <color attach="background" args={['#050505']} />

          <Grid
            infiniteGrid
            fadeDistance={50}
            fadeStrength={1}
            cellSize={1}
            sectionSize={5}
            sectionColor="#666666"
            cellColor="#444444"
            position={[0, -0.01, 0]}
          />

          {/* Axis Helpers */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
            <planeGeometry args={[100, 0.01]} />
            <meshBasicMaterial color="#ff3b3b" transparent opacity={0.5} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, -0.005, 0]}>
            <planeGeometry args={[100, 0.01]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
          </mesh>

          <GizmoHelper alignment="bottom-left" margin={[100, 100]}>
            <GizmoViewport axisColors={['#ff3653', '#0adb4d', '#2c8fff']} labelColor="white" />
          </GizmoHelper>

          <group rotation={[Math.PI, 0, 0]} scale={[modelScale, modelScale, modelScale]}>
            {splatData && showPointCloud && (
              <PointCloudScene
                data={splatData}
                globalScale={globalScale}
                animationState={animationState}
                startTimeRef={startTimeRef}
                quality={quality}
              />
            )}

            {source && (
              <LocalSplatViewer
                key={source}
                source={source}
                format={format}
                animationState={animationState}
              />
            )}
          </group>

          {splatData && source && (
            <>
              <CinematicCamera
                modelCenter={new THREE.Vector3(0, 0, 0)}
                startTimeRef={startTimeRef}
                isActive={isCinematic}
              />
              <TransitionController
                animationState={animationState}
                setShowPointCloud={setShowPointCloud}
                startTimeRef={startTimeRef}
                setCinematicActive={setIsCinematic}
                doneRef={doneRef}
              />
            </>
          )}

          <OrbitControls
            makeDefault
            autoRotate={!isCinematic}
            autoRotateSpeed={0.5}
            enableDamping
            onStart={() => setIsCinematic(false)}
          />
          <Stats />
        </Canvas>
      </div>

      <VisualizerUI
        splatData={splatData}
        source={source}
        handleFileUpload={handleFileUpload}
        fileInputRef={fileInputRef}
        globalScale={globalScale}
        setGlobalScale={setGlobalScale}
        modelScale={modelScale}
        setModelScale={setModelScale}
        replayAnimation={replayAnimation}
        loading={loading}
        quality={quality}
        setQuality={setQuality}
      />
    </div>
  );
}
