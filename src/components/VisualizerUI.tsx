import { Upload, RotateCcw, Box, Layers, Link as LinkIcon, Loader2 } from 'lucide-react';
import type { MutableRefObject, ChangeEvent, FormEvent } from 'react';
import type { SplatData } from '../utils/SplatParser';

interface VisualizerUIProps {
    splatData: SplatData | null;
    source: string | null;
    urlInput: string;
    setUrlInput: (url: string) => void;
    handleUrlSubmit: (e: FormEvent) => void;
    handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: MutableRefObject<HTMLInputElement | null>;
    globalScale: number;
    setGlobalScale: (scale: number) => void;
    modelScale: number;
    setModelScale: (scale: number) => void;
    replayAnimation: () => void;
    loading: boolean;
}

const VisualizerUI = ({
    splatData,
    source,
    urlInput,
    setUrlInput,
    handleUrlSubmit,
    handleFileUpload,
    fileInputRef,
    globalScale,
    setGlobalScale,
    modelScale,
    setModelScale,
    replayAnimation,
    loading
}: VisualizerUIProps) => {
    return (
        <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between overflow-hidden">
            {/* Header & Meta */}
            <div className="pointer-events-auto flex items-start justify-between z-10">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl ring-1 ring-white/5 transition-all hover:bg-black/50">
                    <h1 className="text-xl font-bold tracking-tight text-white/90 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                        Gaussian Splat Viewer
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`w-2 h-2 rounded-full ${splatData ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-amber-500/50'}`} />
                        <p className="text-xs font-medium text-white/60 font-mono">
                            {splatData ? `${splatData.vertexCount.toLocaleString()} POINTS` : 'NO MODEL LOADED'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={replayAnimation}
                        disabled={!splatData || loading}
                        className="group relative bg-black/40 backdrop-blur-md border border-white/10 text-white/90 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2.5 shadow-lg active:scale-95"
                    >
                        <RotateCcw size={16} className="group-hover:-rotate-180 transition-transform duration-500" />
                        <span>Replay</span>
                    </button>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                        className="group relative bg-white/90 hover:bg-white text-black border border-transparent transition-all duration-300 px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2.5 shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} className="group-hover:-translate-y-0.5 transition-transform" />}
                        <span>Upload .splat</span>
                    </button>
                </div>
            </div>

            {/* URL Input - Floating Center */}
            {!splatData && !source && (
                <div className="pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md animate-in fade-in zoom-in duration-500">
                    <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl ring-1 ring-white/10">
                        <form onSubmit={handleUrlSubmit} className="space-y-4">
                            <div className="flex items-center gap-3 text-white/80 mb-2">
                                <LinkIcon size={18} />
                                <label className="text-sm font-semibold tracking-wide">Load from URL</label>
                            </div>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://example.com/model.splat"
                                    className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 transition-colors rounded-xl px-4 py-3 border border-white/10 focus:border-white/30 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                                />
                                <button
                                    type="submit"
                                    disabled={!urlInput.trim() || loading}
                                    className="absolute right-2 top-2 bottom-2 bg-white/10 hover:bg-white/20 text-white disabled:opacity-0 disabled:pointer-events-none transition-all px-4 rounded-lg text-xs font-semibold"
                                >
                                    Load
                                </button>
                            </div>
                            <p className="text-center text-xs text-white/30">
                                Supports .splat and .ply files
                            </p>
                        </form>
                    </div>
                </div>
            )}

            {/* Footer Controls */}
            {splatData && (
                <div className="pointer-events-auto self-center animate-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex gap-1 shadow-2xl ring-1 ring-white/5">

                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                            <Layers size={14} className="text-white/50" />
                            <div className="flex flex-col">
                                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Particles</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0.001"
                                        max="0.1"
                                        step="0.001"
                                        value={globalScale}
                                        onChange={(e) => setGlobalScale(parseFloat(e.target.value))}
                                        className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                    />
                                    <span className="text-xs font-mono text-white/80 w-8 text-right">{globalScale.toFixed(3)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="w-px bg-white/10 my-1" />

                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                            <Box size={14} className="text-white/50" />
                            <div className="flex flex-col">
                                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Scale</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="5.0"
                                        step="0.1"
                                        value={modelScale}
                                        onChange={(e) => setModelScale(parseFloat(e.target.value))}
                                        className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                    />
                                    <span className="text-xs font-mono text-white/80 w-8 text-right">{modelScale.toFixed(1)}x</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Hidden Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".splat,.ply"
                className="hidden"
                onChange={handleFileUpload}
            />

            {/* Loader Overlay */}
            {loading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <Loader2 size={48} className="text-white animate-spin mb-4 opacity-80" />
                    <p className="text-white/80 font-medium tracking-wide animate-pulse">Processing Gaussian Splats...</p>
                </div>
            )}
        </div>
    );
};

export default VisualizerUI;
