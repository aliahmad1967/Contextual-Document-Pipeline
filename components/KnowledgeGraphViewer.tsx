import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { KnowledgeGraph, GraphNode, GraphEdge } from '../types';
import { 
  X, Maximize, ZoomIn, ZoomOut, Search, Activity, Share2, Info, 
  Download, Settings2, Sliders, Layers, Network, Focus, Users, 
  Zap, Magnet, GitBranch, Minimize, Sparkles
} from 'lucide-react';

interface Props {
  data: KnowledgeGraph;
  onClose: () => void;
}

// Extend types for internal graph logic
interface ExtendedNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  val?: number; // visual size
  neighbors?: ExtendedNode[];
  links?: ExtendedLink[];
}

interface ExtendedLink extends Omit<GraphEdge, 'source' | 'target'> {
  source: ExtendedNode;
  target: ExtendedNode;
}

const KnowledgeGraphViewer: React.FC<Props> = ({ data, onClose }) => {
  const fgRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Layout State
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });
  const [selectedNode, setSelectedNode] = useState<ExtendedNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<ExtendedLink>>(new Set());
  const [hoverNode, setHoverNode] = useState<ExtendedNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Customization State
  const [showSettings, setShowSettings] = useState(false);
  const [groupByType, setGroupByType] = useState(false);
  const [pruneLeafNodes, setPruneLeafNodes] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [physics, setPhysics] = useState({
    charge: -160,
    linkDistance: 60,
    particleSpeed: 0.005
  });

  // Resize handler
  useEffect(() => {
    const updateDimensions = () => {
        if (containerRef.current) {
            setDimensions({
                w: containerRef.current.clientWidth,
                h: containerRef.current.clientHeight
            });
        }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Process Graph Data
  const { graphData, metrics, topNodes } = useMemo(() => {
    // 1. Deep clone to prevent mutation issues
    let nodes: ExtendedNode[] = data.nodes.map(n => ({ ...n, neighbors: [], links: [], val: 1 }));
    let links = data.edges.map(e => ({ ...e }));

    // 2. Build map & calculate neighbors
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const linkObjs: ExtendedLink[] = [];

    links.forEach(link => {
        const source = nodeMap.get(link.source as any);
        const target = nodeMap.get(link.target as any);
        if (source && target) {
            source.neighbors?.push(target);
            target.neighbors?.push(source);
            source.val = (source.val || 1) + 0.4;
            target.val = (target.val || 1) + 0.4;
            
            const lObj = { ...link, source, target } as ExtendedLink;
            linkObjs.push(lObj);
            source.links?.push(lObj);
            target.links?.push(lObj);
        }
    });

    // 3. Filtering Logic
    let activeNodes = nodes;
    let activeLinks = linkObjs;

    if (focusNodeId) {
        const focusNode = nodeMap.get(focusNodeId);
        if (focusNode) {
            const allowedIds = new Set([focusNodeId, ...(focusNode.neighbors?.map(n => n.id) || [])]);
            activeNodes = activeNodes.filter(n => allowedIds.has(n.id));
            activeLinks = activeLinks.filter(l => allowedIds.has(l.source.id) && allowedIds.has(l.target.id));
        }
    } 
    else if (pruneLeafNodes) {
        activeNodes = activeNodes.filter(n => (n.neighbors?.length || 0) > 1);
        const activeIds = new Set(activeNodes.map(n => n.id));
        activeLinks = activeLinks.filter(l => activeIds.has(l.source.id) && activeIds.has(l.target.id));
    }

    const density = activeNodes.length > 1 ? (2 * activeLinks.length) / (activeNodes.length * (activeNodes.length - 1)) : 0;
    const sortedNodes = [...activeNodes].sort((a, b) => (b.val || 0) - (a.val || 0));

    return {
        graphData: { nodes: activeNodes, links: activeLinks },
        metrics: {
            nodeCount: activeNodes.length,
            edgeCount: activeLinks.length,
            density: density.toFixed(3),
            avgDegree: activeNodes.length ? (activeLinks.length / activeNodes.length * 2).toFixed(1) : '0'
        },
        topNodes: sortedNodes.slice(0, 5)
    };
  }, [data, pruneLeafNodes, focusNodeId]);

  // Apply Physics Updates
  useEffect(() => {
    if (!fgRef.current) return;
    fgRef.current.d3Force('charge')?.strength(physics.charge);
    fgRef.current.d3Force('link')?.distance(physics.linkDistance);

    if (groupByType) {
        const typeFoci: Record<string, {x: number, y: number}> = {
            'Person': { x: -180, y: -120 },
            'Organization': { x: 180, y: -120 },
            'Location': { x: 0, y: 180 },
            'default': { x: 0, y: 0 }
        };

        fgRef.current.d3Force('cluster', (alpha: any) => {
            for (const node of graphData.nodes) {
                const type = node.type || 'default';
                let focus = typeFoci['default'];
                for (const key in typeFoci) {
                    if (type.includes(key)) {
                        focus = typeFoci[key];
                        break;
                    }
                }
                if (node.vx !== undefined && node.vy !== undefined && node.x !== undefined && node.y !== undefined) {
                    node.vx += (focus.x - node.x) * alpha * 0.12;
                    node.vy += (focus.y - node.y) * alpha * 0.12;
                }
            }
        });
    } else {
        fgRef.current.d3Force('cluster', null);
    }

    fgRef.current.d3ReheatSimulation();
  }, [physics.charge, physics.linkDistance, groupByType, graphData]);

  const updateHighlights = useCallback((node: ExtendedNode | null) => {
    if (!node) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }
    const newHighlightNodes = new Set<string>([node.id]);
    const newHighlightLinks = new Set<ExtendedLink>();
    
    graphData.links.forEach((link: any) => {
        if (link.source.id === node.id || link.target.id === node.id) {
            newHighlightLinks.add(link);
            newHighlightNodes.add(link.source.id);
            newHighlightNodes.add(link.target.id);
        }
    });

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
  }, [graphData]);

  const handleNodeClick = useCallback((node: ExtendedNode) => {
    setSelectedNode(node);
    updateHighlights(node);
    fgRef.current?.centerAt(node.x, node.y, 1000);
    fgRef.current?.zoom(4, 2000);
  }, [updateHighlights]);

  const handleNodeHover = useCallback((node: ExtendedNode | null) => {
    setHoverNode(node);
    if (!selectedNode) {
        updateHighlights(node);
    }
  }, [selectedNode, updateHighlights]);

  const handleBackgroundClick = () => {
    setSelectedNode(null);
    updateHighlights(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.toLowerCase();
    if (!query) return;
    const match = graphData.nodes.find(n => n.label.toLowerCase().includes(query));
    if (match) handleNodeClick(match);
  };

  const NODE_R = 6;
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = selectedNode?.id === node.id;
    const isHighlighted = highlightNodes.has(node.id);
    const isHovered = hoverNode?.id === node.id;
    const isDimmed = (selectedNode || hoverNode || highlightNodes.size > 0) && !isHighlighted;

    let fill = '#64748b';
    const type = node.type?.toLowerCase() || '';
    if (type.includes('person')) fill = '#3b82f6';
    else if (type.includes('org')) fill = '#a855f7';
    else if (type.includes('loc')) fill = '#10b981';
    
    ctx.globalAlpha = isDimmed ? 0.15 : 1;

    // Draw Pulse for Selected/Hovered
    if (isSelected || isHovered) {
        const time = performance.now() / 1000;
        const pulse = Math.sin(time * 4) * 0.5 + 0.5; // 0 to 1
        ctx.beginPath();
        ctx.arc(node.x, node.y, NODE_R * (1.5 + pulse * 0.5), 0, 2 * Math.PI, false);
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
    }

    // Shadow for depth
    if (!isDimmed) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10 / globalScale;
        ctx.shadowOffsetX = 2 / globalScale;
        ctx.shadowOffsetY = 2 / globalScale;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_R, 0, 2 * Math.PI, false);
    ctx.fillStyle = fill;
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = isSelected ? '#fff' : (isHighlighted ? 'rgba(255,255,255,0.5)' : '#1e293b');
    ctx.lineWidth = (isSelected ? 2.5 : 1.5) / globalScale;
    ctx.stroke();

    const shouldShowLabel = globalScale > 2.2 || isSelected || isHovered || topNodes.includes(node);
    if (shouldShowLabel) {
        const fontSize = 13 / globalScale;
        ctx.font = `${isSelected || isHovered ? 'bold' : ''} ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isSelected ? '#fff' : (isHovered ? '#10b981' : 'rgba(255, 255, 255, 0.85)');
        
        // Label background for legibility
        if (isSelected || isHovered) {
          const textWidth = ctx.measureText(node.label).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.fillRect(node.x - textWidth/2 - 2, node.y + NODE_R + 2, textWidth + 4, fontSize + 4);
          ctx.fillStyle = isSelected ? '#fff' : '#10b981';
        }
        
        ctx.fillText(node.label, node.x, node.y + NODE_R + fontSize + 2);
    }
    
    ctx.globalAlpha = 1;
  }, [selectedNode, highlightNodes, hoverNode, topNodes]);

  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
     const isHighlighted = highlightLinks.has(link);
     const isDimmed = (selectedNode || hoverNode || highlightNodes.size > 0) && !isHighlighted;
     
     ctx.globalAlpha = isDimmed ? 0.05 : (isHighlighted ? 0.8 : 0.4);

     ctx.beginPath();
     ctx.moveTo(link.source.x, link.source.y);
     ctx.lineTo(link.target.x, link.target.y);
     
     const type = link.relation?.toLowerCase() || '';
     let stroke = '#475569';
     if (isHighlighted) stroke = '#10b981';
     
     ctx.strokeStyle = stroke;
     ctx.lineWidth = (isHighlighted ? 2.5 : 1.2) / globalScale;
     ctx.stroke();

     // Label on link if highlighted
     if (isHighlighted && globalScale > 1.5) {
        const fontSize = 10 / globalScale;
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = '#10b981';
        ctx.textAlign = 'center';
        const midX = (link.source.x + link.target.x) / 2;
        const midY = (link.source.y + link.target.y) / 2;
        ctx.fillText(link.relation, midX, midY - 5);
     }

     ctx.globalAlpha = 1;
  }, [selectedNode, highlightLinks, hoverNode, highlightNodes.size]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-brand-dark border border-slate-700 rounded-2xl w-full h-full flex shadow-2xl overflow-hidden relative">
         
         <div ref={containerRef} className="flex-1 relative bg-slate-950 overflow-hidden cursor-move">
            
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
                <div className="bg-brand-panel/80 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 shadow-2xl pointer-events-auto flex items-center gap-4 transition-all hover:bg-brand-panel">
                    <div className="p-3 bg-brand-accent/20 rounded-lg text-brand-accent shadow-inner">
                        <Network size={22} />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-base tracking-tight flex items-center gap-2">
                          Knowledge Intelligence
                        </h2>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1"><span className="text-brand-accent font-mono font-bold">{metrics.nodeCount}</span> Entities</span>
                            <span className="w-px h-3 bg-slate-700"></span>
                            <span className="flex items-center gap-1"><span className="text-brand-accent font-mono font-bold">{metrics.edgeCount}</span> Relations</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pointer-events-auto">
                     <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Search entities..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            dir="auto"
                            className="bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-100 pl-10 pr-4 py-2.5 rounded-xl text-sm w-48 focus:w-72 transition-all focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent"
                        />
                     </form>
                     
                     <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2.5 border rounded-xl transition-all shadow-lg ${showSettings ? 'bg-brand-accent text-white border-brand-accent ring-2 ring-brand-accent/30' : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}
                        title="Graph Settings"
                     >
                        <Settings2 size={22} />
                     </button>
                     
                     <button onClick={onClose} className="p-2.5 bg-slate-800/80 hover:bg-red-500/20 hover:text-red-400 border border-slate-700 rounded-xl text-slate-400 transition-all shadow-lg">
                        <X size={22} />
                     </button>
                </div>
            </div>

            {/* Settings Overlay */}
            {showSettings && (
                <div className="absolute top-24 right-4 z-20 w-72 bg-brand-panel/90 backdrop-blur-2xl border border-slate-700/50 rounded-2xl shadow-2xl p-5 animate-in slide-in-from-right-8 pointer-events-auto">
                    <div className="flex items-center justify-between mb-5 border-b border-slate-700/50 pb-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Sliders size={16} /> Visualization Config</h3>
                        <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition-colors"><X size={16} /></button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-3 block flex items-center gap-2">
                              <Layers size={14}/> Semantic Layout
                            </label>
                            <div className="space-y-2.5">
                                <button 
                                    onClick={() => setGroupByType(!groupByType)}
                                    className={`w-full text-xs flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${groupByType ? 'bg-brand-accent/20 border-brand-accent text-brand-accent' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    <span className="font-medium">Force Cluster by Type</span>
                                    <Users size={14} className={groupByType ? 'animate-pulse' : ''} />
                                </button>
                                <button 
                                    onClick={() => setPruneLeafNodes(!pruneLeafNodes)}
                                    disabled={!!focusNodeId}
                                    className={`w-full text-xs flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${pruneLeafNodes ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'} ${focusNodeId ? 'opacity-30 cursor-not-allowed' : ''}`}
                                >
                                    <span className="font-medium">Prune Noise (Leaf Nodes)</span>
                                    <GitBranch size={14} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-3 block flex items-center gap-2">
                              <Zap size={14}/> Dynamic Physics
                            </label>
                            <div className="space-y-4 px-1">
                                <div>
                                    <div className="flex justify-between text-[10px] text-slate-400 mb-2 font-mono">
                                        <span>REPULSION</span>
                                        <span className="text-brand-accent">{Math.abs(physics.charge)}</span>
                                    </div>
                                    <input 
                                        type="range" min="100" max="800" step="10"
                                        value={Math.abs(physics.charge)}
                                        onChange={(e) => setPhysics(p => ({...p, charge: -Number(e.target.value)}))}
                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[10px] text-slate-400 mb-2 font-mono">
                                        <span>EDGE TENSION</span>
                                        <span className="text-brand-accent">{physics.linkDistance}</span>
                                    </div>
                                    <input 
                                        type="range" min="30" max="150" step="5"
                                        value={physics.linkDistance}
                                        onChange={(e) => setPhysics(p => ({...p, linkDistance: Number(e.target.value)}))}
                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="pt-2">
                          <button onClick={handleSearch} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-2">
                            <RefreshCw size={14} /> Reset Viewport
                          </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Render Graph */}
            {dimensions.w > 0 && (
                <ForceGraph2D
                    ref={fgRef}
                    width={dimensions.w}
                    height={dimensions.h}
                    graphData={graphData}
                    
                    nodeLabel="label"
                    nodeRelSize={NODE_R}
                    
                    nodeCanvasObject={paintNode}
                    linkCanvasObject={paintLink}
                    
                    onNodeClick={handleNodeClick}
                    onNodeHover={handleNodeHover}
                    onBackgroundClick={handleBackgroundClick}
                    
                    cooldownTicks={100}
                    d3AlphaDecay={0.02}
                    d3VelocityDecay={0.3}
                    
                    backgroundColor="#020617"
                    enableNodeDrag={true}
                    enableZoomInteraction={true}
                    
                    // Enhanced interaction particles for highlighted links
                    linkDirectionalParticles={(link: any) => highlightLinks.has(link) ? 5 : 0}
                    linkDirectionalParticleSpeed={0.006}
                    linkDirectionalParticleWidth={2}
                    linkDirectionalParticleColor={() => '#10b981'}
                />
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-8 left-8 flex flex-col gap-3 pointer-events-none">
                <div className="pointer-events-auto flex flex-col bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                    <button onClick={() => fgRef.current?.zoomIn()} className="p-3 hover:bg-slate-700 text-slate-300 border-b border-slate-700 transition-colors"><ZoomIn size={20}/></button>
                    <button onClick={() => fgRef.current?.zoomOut()} className="p-3 hover:bg-slate-700 text-slate-300 border-b border-slate-700 transition-colors"><ZoomOut size={20}/></button>
                    <button onClick={() => fgRef.current?.zoomToFit(1000)} className="p-3 hover:bg-slate-700 text-slate-300 transition-colors"><Maximize size={20}/></button>
                </div>
            </div>
            
            {focusNodeId && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-in slide-in-from-bottom-8">
                    <div className="bg-brand-accent text-brand-dark px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-4 border border-white/20">
                        <span className="text-xs font-black uppercase tracking-widest">Isolated Viewport</span>
                        <button 
                            onClick={() => setFocusNodeId(null)}
                            className="bg-brand-dark/20 hover:bg-brand-dark/40 rounded-full p-1 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
         </div>

         {/* Sidebar */}
         <div className={`w-88 bg-brand-panel/30 backdrop-blur-3xl border-l border-slate-700/50 flex flex-col transition-all duration-500 ease-out ${selectedNode ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 absolute right-0 h-full'}`}>
            
            {selectedNode && (
                <div className="flex flex-col h-full animate-in slide-in-from-right duration-500">
                    <div className="p-6 border-b border-slate-700/50 bg-slate-900/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                          <Network size={120} />
                        </div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                             <span className={`text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full border ${
                               selectedNode.type.toLowerCase().includes('person') ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                               selectedNode.type.toLowerCase().includes('org') ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                               'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                             }`}>
                                {selectedNode.type}
                             </span>
                             <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-white bg-slate-800/50 p-1 rounded-full transition-all"><X size={16} /></button>
                        </div>
                        <h2 dir="auto" className="text-2xl font-black text-white leading-tight mb-2 tracking-tight">{selectedNode.label}</h2>
                        
                        <div className="mt-6 flex gap-2 relative z-10">
                            {focusNodeId === selectedNode.id ? (
                                <button 
                                    onClick={() => setFocusNodeId(null)}
                                    className="flex-1 bg-slate-800 text-slate-300 text-xs font-bold py-2.5 rounded-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700"
                                >
                                    <Minimize size={14} /> Global View
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setFocusNodeId(selectedNode.id)}
                                    className="flex-1 bg-brand-accent/10 text-brand-accent border border-brand-accent/40 text-xs font-bold py-2.5 rounded-xl hover:bg-brand-accent/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Focus size={14} /> Isolate Entity
                                </button>
                            )}
                            <button className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl border border-slate-700 transition-all">
                              <Share2 size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                              <GitBranch size={12} className="text-brand-accent" /> Semantic Network
                          </h3>
                          <span className="text-[10px] font-mono bg-slate-800/50 text-slate-400 px-2 py-0.5 rounded-full">{highlightLinks.size} Rel</span>
                        </div>
                        
                        <div className="space-y-4">
                            {Array.from(highlightLinks).map((link: ExtendedLink, i) => {
                                const isSource = link.source.id === selectedNode.id;
                                const otherNode = isSource ? link.target : link.source;
                                return (
                                    <div 
                                      key={i} 
                                      className="group p-4 rounded-2xl bg-slate-900/40 border border-slate-700/50 hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-all cursor-pointer animate-in slide-in-from-bottom-4" 
                                      style={{ animationDelay: `${i * 50}ms` }}
                                      onClick={() => handleNodeClick(otherNode)}
                                    >
                                        <div className="flex items-center gap-3 mb-2.5">
                                            <div className={`p-1.5 rounded-lg ${isSource ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                              {isSource ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                            </div>
                                            <span dir="auto" className="text-[10px] font-mono text-slate-500 italic uppercase tracking-wider">{link.relation}</span>
                                        </div>
                                        <div dir="auto" className="font-bold text-slate-100 text-base group-hover:text-brand-accent transition-colors tracking-tight">
                                            {otherNode.label}
                                        </div>
                                        <div className="mt-2 text-[10px] text-slate-600 font-medium">TYPE: {otherNode.type.toUpperCase()}</div>
                                    </div>
                                )
                            })}
                            
                            {highlightLinks.size === 0 && (
                              <div className="text-center py-12">
                                <Info className="mx-auto text-slate-700 mb-2" size={32} />
                                <p className="text-xs text-slate-500">No semantic relations discovered for this entity.</p>
                              </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
         </div>

      </div>
    </div>
  );
};

// Internal icon helpers not in types
const ArrowUpRight = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
);
const ArrowDownLeft = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="7" x2="7" y2="17"></line><polyline points="17 17 7 17 7 7"></polyline></svg>
);
const RefreshCw = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
);

export default KnowledgeGraphViewer;