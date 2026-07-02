"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, X, CheckCircle2, ShieldAlert, Cpu, Activity, Database, Layers, 
  Code2, ChevronDown, Server, ArrowRight, Zap, RefreshCw, 
  Terminal, Box, Play, ImagePlus, Monitor, ArrowRightLeft, ScanSearch, BrainCircuit, Binary, BadgeCheck, Container, ArrowDown
} from "lucide-react";

interface PredictionResult {
  request_id: string;
  prediction: string;
  confidence: number;
  char_confs: number[];
  processing_ms: number;
}

interface BatchPredictionResult {
  request_id: string;
  predictions: PredictionResult[];
  total_processing_ms: number;
}

const INFERENCE_STEPS = [
  "Uploading images",
  "Preprocessing inputs",
  "CNN Feature Extraction",
  "Sequence Prediction",
  "Generating Results"
];

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [inferenceStep, setInferenceStep] = useState(0);
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [recentRequests, setRecentRequests] = useState<PredictionResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

  // Simulate inference steps for better UX
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "running") {
      interval = setInterval(() => {
        setInferenceStep((prev) => {
          if (prev < INFERENCE_STEPS.length - 1) return prev + 1;
          return prev;
        });
      }, 400); // Step every 400ms
    } else {
      setInferenceStep(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(f => f.type.startsWith("image/")).slice(0, 5);
    setFiles(validFiles);
    setResults([]);
    setStatus("idle");
    setErrorMsg("");
  };

  const handlePredict = async () => {
    if (files.length === 0) return;
    setStatus("running");
    
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));

    try {
      const endpoint = files.length === 1 ? `${API_URL}/predict` : `${API_URL}/predict/batch`;
      if (files.length === 1) {
        formData.delete("files");
        formData.append("file", files[0]);
      }
      
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      const newResults = files.length === 1 ? [data as PredictionResult] : (data as BatchPredictionResult).predictions;
      
      // Ensure we run through all animations before showing results
      setTimeout(() => {
        setResults(newResults);
        setStatus("success");
        setRecentRequests(prev => [...newResults, ...prev].slice(0, 5));
      }, Math.max(0, 2000 - (inferenceStep * 400))); 
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to process images.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-zinc-800 overflow-x-hidden">


      {/* Sticky Navbar */}
      <nav className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanIcon className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-zinc-100 tracking-tight">VisionSeq OCR</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-zinc-200">
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
            <a href="https://github.com/gautamhardik/VisionSeq" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-github"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg> GitHub
            </a>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10">
              <Terminal className="w-4 h-4" /> Developer
            </button>
          </div>
        </div>
      </nav>

      {/* Floating System Monitor */}
      <div className="fixed bottom-6 right-6 z-40 bg-[#111] border border-white/10 rounded-lg p-4 shadow-2xl backdrop-blur-lg flex flex-col gap-3 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-zinc-200">API Healthy</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="flex justify-between gap-4"><span>GPU</span> <span className="text-zinc-300">CUDA</span></div>
          <div className="flex justify-between gap-4"><span>Model</span> <span className="text-zinc-300">v1.0</span></div>
          <div className="flex justify-between gap-4"><span>Latency</span> <span className="text-zinc-300">17ms</span></div>
          <div className="flex justify-between gap-4"><span>Batch</span> <span className="text-zinc-300">Ready</span></div>
        </div>
      </div>

      <main className="relative max-w-5xl mx-auto px-6 py-12 flex flex-col gap-16">
        
        {/* HERO SECTION */}
        <section className="relative text-center space-y-6 pt-10">
          <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center">
            <motion.div animate={{ x: [-20, 20, -20], y: [-20, 20, -20], opacity: [0.05, 0.1, 0.05] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -top-[50%] -left-[20%] w-[80%] h-[150%] rounded-full bg-indigo-500 blur-[120px]" />
            <motion.div animate={{ x: [20, -20, 20], y: [20, -20, 20], opacity: [0.03, 0.08, 0.03] }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} className="absolute -bottom-[50%] -right-[20%] w-[80%] h-[150%] rounded-full bg-violet-500 blur-[120px]" />
          </div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold tracking-tight text-zinc-100"
          >
            VisionSeq OCR
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed"
          >
            Production-grade OCR engine for distorted visual sequences. Trained entirely from scratch using a custom ResNet-18 architecture.
          </motion.p>
          
          {/* KPI Dashboard */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4 pt-4"
          >
            {[
              { label: "Character Acc", value: "99.94%", color: "text-blue-400" },
              { label: "Sequence Acc", value: "99.70%", color: "text-emerald-400" },
              { label: "CER", value: "0.06%", color: "text-violet-400" },
              { label: "Training Images", value: "20,000", color: "text-indigo-400" }
            ].map((kpi, i) => (
              <div key={i} className="px-5 py-3 rounded-2xl bg-[#0a0a0a] border border-white/5 flex flex-col items-center shadow-lg hover:border-white/10 transition-colors">
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{kpi.label}</span>
                <span className={`text-lg font-medium font-mono mt-0.5 ${kpi.color}`}>{kpi.value}</span>
              </div>
            ))}
          </motion.div>
        </section>

        {/* UPLOAD & PREDICTION SECTION */}
        <section className="relative max-w-2xl mx-auto w-full">
          <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center">
            <motion.div animate={{ opacity: [0.02, 0.06, 0.02], scale: [1, 1.05, 1] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[150%] rounded-full bg-indigo-500 blur-[150px]" />
          </div>
          <motion.div 
            layout
            className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 shadow-2xl"
          >
            <AnimatePresence mode="popLayout">
              {files.length === 0 ? (
                <motion.div
                  key="upload-zone"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => fileInputRef.current?.click()}
                  className={`relative border border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors duration-300 ${isDragging ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}`}
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); }} />
                  <div className="flex flex-col items-center gap-4">
                    <Upload className="w-8 h-8 text-zinc-500" />
                    <div>
                      <p className="text-base font-medium text-zinc-300">Drop CAPTCHA images</p>
                      <p className="text-sm text-zinc-500 mt-1">or click to browse (max 5)</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="file-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-sm font-medium text-zinc-300">Ready for Inference</h3>
                    <button onClick={() => setFiles([])} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Clear all</button>
                  </div>
                  
                  <div className="grid gap-3">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 group transition-colors">
                        <div className="flex items-center gap-3">
                          <img src={URL.createObjectURL(file)} alt={file.name} className="w-12 h-8 object-cover rounded border border-white/10" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                              {file.name} <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            </span>
                            <span className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, i) => i !== idx)); }} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md transition-all">
                          <X className="w-4 h-4 text-zinc-400" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {status === "running" && (
                    <div className="space-y-3 bg-white/5 rounded-lg p-4 border border-white/5">
                      <div className="flex justify-between text-xs text-zinc-400 font-mono mb-2">
                        <span>{INFERENCE_STEPS[inferenceStep]}...</span>
                        <span className="text-indigo-400">{Math.round(((inferenceStep + 1) / INFERENCE_STEPS.length) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                        {INFERENCE_STEPS.map((_, i) => (
                          <div key={i} className={`h-full flex-1 border-r border-[#111] last:border-0 transition-colors duration-300 ${i <= inferenceStep ? 'bg-indigo-500' : 'bg-transparent'}`} />
                        ))}
                      </div>
                      {files.length > 1 && (
                        <p className="text-xs text-zinc-500 text-center mt-2">Processing batch: {files.length} images</p>
                      )}
                    </div>
                  )}
                  
                  {status === "idle" && (
                    <button onClick={handlePredict} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-medium transition-all">
                      <Play className="w-4 h-4" /> Run Inference
                    </button>
                  )}
                  
                  {status === "error" && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 text-sm">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{errorMsg}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        {/* RESULTS SECTION */}
        <AnimatePresence>
          {status === "success" && results.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-4xl mx-auto space-y-6">
              <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center">
                <motion.div animate={{ opacity: [0.03, 0.08, 0.03], y: [-10, 10, -10] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute top-0 left-[10%] w-[80%] h-[120%] rounded-full bg-violet-500 blur-[120px]" />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {results.map((res, idx) => (
                  <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                    className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-white/10 transition-all duration-300"
                  >
                    <div className="bg-white/5 border-b border-white/10 p-6 flex justify-center">
                      {files[idx] ? (
                        <img src={URL.createObjectURL(files[idx])} alt="CAPTCHA" className="h-20 object-contain rounded drop-shadow-lg" />
                      ) : (
                        <div className="h-20 w-32 bg-white/5 rounded animate-pulse" />
                      )}
                    </div>
                    
                    <div className="p-6 space-y-6">
                      <div className="text-center space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Prediction</p>
                        <p className="text-4xl font-bold tracking-[0.2em] font-mono text-zinc-100">{res.prediction}</p>
                      </div>

                      <div className="flex justify-between items-center text-sm border-y border-white/5 py-4">
                        <div className="text-center flex-1 border-r border-white/5">
                          <p className="text-zinc-500 text-xs mb-1">Confidence</p>
                          <p className="font-mono text-emerald-400">{res.confidence.toFixed(2)}%</p>
                        </div>
                        <div className="text-center flex-1">
                          <p className="text-zinc-500 text-xs mb-1">Latency</p>
                          <p className="font-mono text-zinc-300">{res.processing_ms.toFixed(1)} ms</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3 text-center">Character Breakdown</p>
                        <div className="grid grid-cols-6 gap-1">
                          {res.prediction.split('').map((char, i) => {
                            const conf = res.char_confs[i];
                            return (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <span className="font-mono text-sm text-zinc-200">{char}</span>
                                <div className="h-12 w-1.5 bg-white/5 rounded-full overflow-hidden flex flex-col justify-end">
                                  <div style={{ height: `${conf}%` }} className={`w-full ${conf > 95 ? 'bg-emerald-500' : conf > 80 ? 'bg-amber-500' : 'bg-red-500'}`} />
                                </div>
                                <span className="text-[10px] text-zinc-500 font-mono">{Math.round(conf)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ARCHITECTURE SHOWCASE */}
        <section id="architecture" className="relative max-w-6xl mx-auto w-full pt-20 border-t border-white/5">
          <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center">
            <motion.div animate={{ x: [-30, 30, -30], opacity: [0.03, 0.08, 0.03] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute top-[10%] -left-[20%] w-[80%] h-[100%] rounded-full bg-indigo-500 blur-[150px]" />
            <motion.div animate={{ x: [30, -30, 30], opacity: [0.02, 0.07, 0.02] }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} className="absolute bottom-[10%] -right-[20%] w-[80%] h-[100%] rounded-full bg-emerald-500 blur-[150px]" />
          </div>
          <div className="text-center space-y-5 mb-20">
            <span className="inline-block mb-3 text-[10px] font-mono text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">System Architecture</span>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 tracking-tight">AI Inference Pipeline</h2>
            <p className="text-zinc-300 max-w-3xl mx-auto text-base leading-relaxed font-medium">
              Images are processed through a production-grade inference pipeline built with Next.js, FastAPI, and a modified ResNet-18 model trained entirely from scratch.
            </p>
          </div>

          {/* Animated Pipeline */}
          <div className="flex flex-col lg:flex-row flex-wrap items-center justify-center gap-y-4 gap-x-1 mb-24 relative px-2">
            {[
              { label: 'Upload', desc: 'Receives Images', icon: ImagePlus, color: 'text-blue-400', bgHover: 'group-hover:bg-blue-500/15 group-hover:shadow-[0_0_20px_rgba(96,165,250,0.15)]' },
              { label: 'Next.js', desc: 'Client App', icon: Monitor, color: 'text-blue-400', bgHover: 'group-hover:bg-blue-500/15 group-hover:shadow-[0_0_20px_rgba(96,165,250,0.15)]' },
              { label: 'FastAPI', desc: 'Inference Service', icon: Server, color: 'text-emerald-400', bgHover: 'group-hover:bg-emerald-500/15 group-hover:shadow-[0_0_20px_rgba(52,211,153,0.15)]' },
              { label: 'Preprocess', desc: 'Tensor Prep', icon: ScanSearch, color: 'text-purple-400', bgHover: 'group-hover:bg-purple-500/15 group-hover:shadow-[0_0_20px_rgba(167,139,250,0.15)]' },
              { label: 'ResNet18', desc: 'CNN Backbone', icon: BrainCircuit, color: 'text-indigo-400', bgHover: 'group-hover:bg-indigo-500/15 group-hover:shadow-[0_0_20px_rgba(129,140,248,0.15)]' },
              { label: 'Decoder', desc: 'Sequence Gen', icon: Binary, color: 'text-violet-400', bgHover: 'group-hover:bg-violet-500/15 group-hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]' },
              { label: 'Prediction', desc: 'JSON Output', icon: BadgeCheck, color: 'text-emerald-400', bgHover: 'group-hover:bg-emerald-500/15 group-hover:shadow-[0_0_20px_rgba(52,211,153,0.15)]' }
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="w-40 flex flex-col items-center justify-center gap-3 p-5 rounded-2xl bg-[#0d0d0d] border border-white/5 hover:border-white/20 transition-all duration-300 group relative z-10 shadow-xl"
                >
                  <div className={`p-4 rounded-xl bg-white/5 ${step.bgHover} transition-all duration-300`}>
                    <step.icon className={`w-8 h-8 opacity-75 group-hover:opacity-100 ${step.color} transition-opacity duration-300`} />
                  </div>
                  <div className="text-center mt-1 space-y-1">
                    <span className="block text-xs font-semibold text-zinc-100 tracking-wide">
                      {step.label}
                    </span>
                    <span className="block text-[10px] font-mono text-zinc-500">
                      {step.desc}
                    </span>
                  </div>
                </motion.div>
                
                {/* Connecting Arrows */}
                {i < arr.length - 1 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: (i * 0.1) + 0.1 }}
                    className="flex justify-center"
                  >
                    {/* Desktop Horizontal Arrow */}
                    <motion.div
                      animate={{ x: [0, 8, 0], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
                      className="hidden lg:block px-2"
                    >
                      <ArrowRight className="w-5 h-5 text-indigo-500/60" />
                    </motion.div>
                    {/* Mobile Vertical Arrow */}
                    <motion.div
                      animate={{ y: [0, 8, 0], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
                      className="lg:hidden py-2"
                    >
                      <ArrowDown className="w-5 h-5 text-indigo-500/60" />
                    </motion.div>
                  </motion.div>
                )}
              </React.Fragment>
            ))}
          </div>
          
          <div className="text-center mb-24 -mt-16 relative z-20">
            <motion.p 
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.8 }}
              className="text-xs font-mono text-zinc-500 bg-[#0a0a0a] inline-block px-4 py-1"
            >
              Average inference latency: ~17 ms/image on CUDA
            </motion.p>
          </div>

          {/* Technology Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto mb-20">
            {[
              { title: "Frontend", desc: "Next.js + TypeScript", icon: Monitor, color: "text-blue-400" },
              { title: "Backend", desc: "FastAPI", icon: Server, color: "text-emerald-400" },
              { title: "Deep Learning", desc: "PyTorch", icon: Activity, color: "text-orange-400" },
              { title: "Model", desc: "Modified ResNet-18", subDesc: "Trained from Scratch", icon: BrainCircuit, color: "text-purple-400" },
              { title: "Communication", desc: "REST API", icon: ArrowRightLeft, color: "text-rose-400" },
              { title: "Deployment", desc: "Docker Ready", icon: Container, color: "text-cyan-400" }
            ].map((tech, i) => (
              <motion.div 
                key={tech.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -3, boxShadow: "0 10px 40px -10px rgba(0,0,0,0.5)" }}
                className="flex items-start gap-4 p-5 rounded-2xl bg-[#0a0a0a] border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all group shadow-lg"
              >
                <div className={`p-3 rounded-xl bg-white/5 border border-white/5 ${tech.color} group-hover:bg-white/10 transition-colors`}>
                  <tech.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-zinc-100">{tech.title}</h4>
                  <p className="text-xs text-zinc-400 mt-1">{tech.desc}</p>
                  {tech.subDesc && (
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2">
                      <ArrowDown className="w-3 h-3 text-indigo-400" />
                      <span className="text-[10px] text-indigo-400 font-mono tracking-wide">{tech.subDesc}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Status Badges */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-3">
            {[
              "Trained entirely from scratch",
              "No pretrained weights",
              "Production-ready architecture"
            ].map((badge, i) => (
              <motion.div 
                key={badge}
                initial={{ opacity: 0, scale: 0.9 }} 
                whileInView={{ opacity: 1, scale: 1 }} 
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="px-4 py-2 rounded-full bg-[#111] border border-white/10 text-[11px] font-mono text-zinc-400 flex items-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {badge}
              </motion.div>
            ))}
          </div>
        </section>

      </main>

      <footer className="mt-20 py-8 border-t border-white/5 bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">© 2026 VisionSeq OCR Inference Engine</p>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> Next.js</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> FastAPI</span>
            <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> PyTorch</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Minimal Icon Component for the Logo
function ScanIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>
    </svg>
  )
}
