import React, { useState, useEffect, useRef, useCallback } from 'react';
import { translations } from './translations';
import { decodeAndCalculate, CalculationResult } from './utils';

// Constants for background images and gradients
const backgroundImages = [
    { id: 'bg1', path: 'https://picsum.photos/500/250?random=1' },
    { id: 'bg2', path: 'https://picsum.photos/500/250?random=2' },
    { id: 'bg3', path: 'https://picsum.photos/500/250?random=3' },
    { id: 'bg4', path: 'https://picsum.photos/500/250?random=4' }
];

const backgroundGradients = [
    { id: 'dawn', colors: ['#ffecd2', '#fcb69f'] },
    { id: 'sky', colors: ['#a18cd1', '#fbc2eb'] },
    { id: 'night', colors: ['#09203f', '#537895'] },
];

const App: React.FC = () => {
    // --- State ---
    const [activeTab, setActiveTab] = useState<'measure' | 'sim' | 'history'>('measure');
    const [inputVal, setInputVal] = useState('');
    const [history, setHistory] = useState<CalculationResult[]>([]);
    const [lastResult, setLastResult] = useState<CalculationResult | null>(null);
    const [status, setStatus] = useState<{ text: string, type: 'error' | 'success' | 'normal' }>({ text: '', type: 'normal' });
    const [isLoading, setIsLoading] = useState(false);
    const [showGuide, setShowGuide] = useState(false); // Modal State
    
    // Entry Modal State
    const [showEntryModal, setShowEntryModal] = useState(true);
    const [entryCountdown, setEntryCountdown] = useState(5);

    // Customization State
    const [customization, setCustomization] = useState({
        playerName: '',
        bgType: 'gradient' as 'image' | 'gradient' | 'uploaded',
        bgSource: backgroundGradients[1].colors.join(','), 
        textColor: 'white' as 'white' | 'black',
        textAlign: 'center' as 'center' | 'left' | 'right',
        showRange: true,
        uploadedBgUrl: null as string | null
    });

    // Simulator State
    const [potionCount, setPotionCount] = useState(0);
    const [simResult, setSimResult] = useState<number | null>(null);
    const [simExtremeNotice, setSimExtremeNotice] = useState('');

    // Refs
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const qrFileInputRef = useRef<HTMLInputElement>(null);
    const bgFileInputRef = useRef<HTMLInputElement>(null);

    const t = (key: string) => translations[key] || key;

    // --- Effects ---

    // Entry Countdown
    useEffect(() => {
        if (showEntryModal && entryCountdown > 0) {
            const timer = setTimeout(() => {
                setEntryCountdown(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [showEntryModal, entryCountdown]);

    // Auto-dismiss toast status after 3 seconds
    useEffect(() => {
        if (status.text) {
            const timer = setTimeout(() => {
                setStatus({ text: '', type: 'normal' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [status.text]);

    useEffect(() => {
        const savedHistory = localStorage.getItem('skyHeightHistory');
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) {
                console.error("Failed to load history");
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('skyHeightHistory', JSON.stringify(history));
    }, [history]);

    // Optimize Canvas Drawing with useCallback to prevent unnecessary re-definitions
    const drawContent = useCallback(() => {
        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawTextOverlay = () => {
            if (!lastResult) return;

            const { playerName, textColor, textAlign, showRange } = customization;

            ctx.fillStyle = textColor === 'white' ? '#FFFFFF' : '#1e293b';
            ctx.textAlign = textAlign;
            ctx.textBaseline = 'top';
            ctx.shadowColor = textColor === 'white' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
            ctx.shadowBlur = 4;

            let x;
            if (textAlign === 'left') x = 30;
            else if (textAlign === 'right') x = canvas.width - 30;
            else x = canvas.width / 2;

            const baseFont = '"Noto Sans SC", sans-serif';

            if (playerName) {
                ctx.font = `500 24px ${baseFont}`;
                ctx.fillText(playerName, x, 25);
            }

            ctx.font = `700 80px "Courier New", monospace`;
            ctx.fillText(lastResult.current.toFixed(4), x, playerName ? 65 : 55);
            
            ctx.font = `14px ${baseFont}`;
            ctx.fillText(t('res_current'), x, playerName ? 145 : 135);

            if (showRange) {
                ctx.font = `16px ${baseFont}`;
                const rangeText = `${t('res_tallest')} ${lastResult.tallest.toFixed(4)} | ${t('res_shortest')} ${lastResult.shortest.toFixed(4)}`;
                ctx.fillText(rangeText, x, 190);
            }

            ctx.font = `12px ${baseFont}`;
            ctx.globalAlpha = 0.7;
            ctx.textAlign = 'center';
            ctx.shadowBlur = 0;
            ctx.fillText('Konata光之子身高观测', canvas.width / 2, 225);
            ctx.globalAlpha = 1.0;
        };

        // Background
        if (customization.bgType === 'gradient') {
            const colors = customization.bgSource.split(',');
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, colors[0]);
            gradient.addColorStop(1, colors[1]);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawTextOverlay();
        } else {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.referrerPolicy = "no-referrer"; 
            img.src = customization.bgType === 'uploaded' && customization.uploadedBgUrl ? customization.uploadedBgUrl : customization.bgSource;
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                drawTextOverlay();
            };
            img.onerror = () => {
                ctx.fillStyle = '#6b8cce';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                drawTextOverlay();
            };
        }
    }, [customization, lastResult, t]); // Dependencies

    useEffect(() => {
        // Debounce slightly to avoid rapid redraws
        const timer = setTimeout(() => {
            drawContent();
        }, 50);
        return () => clearTimeout(timer);
    }, [drawContent]);

    // --- Actions ---

    const handleCalculate = () => {
        setLastResult(null);
        setIsLoading(true);
        setStatus({ text: t('status_calculating'), type: 'normal' });
        const rawData = inputVal.trim();
        
        if (!rawData) {
            setStatus({ text: t('status_error_empty'), type: 'error' });
            setIsLoading(false);
            return;
        }

        setTimeout(() => {
            const res = decodeAndCalculate(rawData);
            if ('error' in res && res.error) {
                setStatus({ text: res.error, type: 'error' });
            } else {
                const result = res as CalculationResult;
                setLastResult(result);
                setStatus({ text: t('status_success'), type: 'success' });
                setHistory(prev => {
                    const newHistory = [result, ...prev];
                    if (newHistory.length > 20) newHistory.pop();
                    return newHistory;
                });
                setPotionCount(0);
                setSimResult(null);
                setSimExtremeNotice('');
            }
            setIsLoading(false);
        }, 600);
    };

    const handleCopy = () => {
        if (!lastResult) return;
        const copyText = `${t('res_current')} ${lastResult.current.toFixed(4)}\n${t('res_tallest')} ${lastResult.tallest.toFixed(4)}\n${t('res_shortest')} ${lastResult.shortest.toFixed(4)}`;
        navigator.clipboard.writeText(copyText).then(() => {
            setStatus({ text: t('status_copy_success'), type: 'success' });
        }).catch(() => {
            setStatus({ text: t('status_copy_fail'), type: 'error' });
        });
    };

    const handleGenerateImage = () => {
        if (!previewCanvasRef.current) return;
        const link = document.createElement('a');
        const now = new Date();
        link.download = `Sky_Height_${now.getTime()}.png`;
        link.href = previewCanvasRef.current.toDataURL('image/png');
        link.click();
    };

    const handlePotionDrink = () => {
        if (!lastResult) {
            alert(t('sim_error_no_calc'));
            setActiveTab('measure');
            return;
        }
        setSimExtremeNotice('');
        const newRandomHeight = Math.random() * 4.0 - 2.0;
        const newHeightNumber = 7.6 - (8.3 * lastResult.scale) - (3 * newRandomHeight);
        
        setSimResult(newHeightNumber);
        if (newRandomHeight >= 1.96) setSimExtremeNotice(t('sim_extreme_tall'));
        else if (newRandomHeight <= -1.96) setSimExtremeNotice(t('sim_extreme_short'));
        
        setPotionCount(c => c + 1);
    };

    const handleQrUpload = async (file: File) => {
        if (!file || !file.type.startsWith('image/')) {
            setStatus({ text: t('status_error_general'), type: 'error' });
            return;
        }
        
        const jsQR = (window as any).jsQR;
        if (!jsQR) {
            setStatus({ text: "Error: jsQR not loaded.", type: 'error' });
            return;
        }

        try {
             const img = new Image();
             img.src = URL.createObjectURL(file);
             await new Promise((resolve, reject) => {
                 img.onload = resolve;
                 img.onerror = reject;
             });

             const canvas = qrCanvasRef.current!;
             const ctx = canvas.getContext('2d')!;
             canvas.width = img.width;
             canvas.height = img.height;
             ctx.drawImage(img, 0, 0);
             
             const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
             let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

             if (!code) {
                 code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
             }

             if (code && code.data) {
                 setInputVal(code.data);
             } else {
                 setStatus({ text: t('status_qr_fail'), type: 'error' });
             }
        } catch (e) {
             console.error(e);
             setStatus({ text: t('status_error_general'), type: 'error' });
        }
    };

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            if (customization.uploadedBgUrl) {
                URL.revokeObjectURL(customization.uploadedBgUrl);
            }
            const url = URL.createObjectURL(file);
            setCustomization(prev => ({
                ...prev,
                bgType: 'uploaded',
                uploadedBgUrl: url
            }));
        }
    };

    const handleDeleteHistory = (index: number) => {
        if (confirm(t('confirm_delete_item'))) {
            setHistory(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleHistoryNote = (index: number) => {
        const currentNote = history[index].note || "";
        const newNote = prompt(t('history_note_placeholder'), currentNote);
        if (newNote !== null) {
            const newHistory = [...history];
            newHistory[index].note = newNote.trim();
            setHistory(newHistory);
        }
    };

    const getHeightPercentage = (current: number, min: number, max: number) => {
        if (!min || !max) return 50;
        const pct = ((current - min) / (max - min)) * 100;
        return Math.min(Math.max(pct, 0), 100);
    };

    return (
        <>
            {/* Entry Confirmation Modal - Optimized for mobile scroll if needed */}
            {showEntryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all overflow-y-auto">
                    <div className="glass-modal w-full max-w-md rounded-3xl p-6 md:p-8 flex flex-col items-center text-center shadow-2xl border border-white/10 relative overflow-hidden animate-float my-auto">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 pointer-events-none"></div>

                        <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-white to-sky-200 tracking-wider">
                            {t('entry_title')}
                        </h2>
                        
                        <div className="space-y-4 md:space-y-5 text-sm text-white/90 leading-relaxed mb-4 md:mb-6 text-left bg-white/5 p-4 md:p-5 rounded-2xl border border-white/10 shadow-inner w-full">
                            <p dangerouslySetInnerHTML={{__html: t('entry_intro')}}></p>
                            <div className="h-px bg-white/10 my-1"></div>
                            <p className="bg-rose-500/20 p-3 rounded-lg border border-rose-500/30" dangerouslySetInnerHTML={{__html: t('entry_warning')}}></p>
                        </div>

                        <div className="w-full flex flex-col items-center mb-4 md:mb-6 gap-3">
                             <p className="text-xs text-sky-200/80 font-bold text-center leading-relaxed">
                                 BUG报告/新功能需求建议等<br/>
                                 联系QQ：3284669002
                             </p>
                             <a 
                                 href="https://qm.qq.com/q/TWmvW2gVEe" 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:shadow-violet-500/40 transition-all text-sm inline-block"
                             >
                                 点击添加好友
                             </a>
                        </div>

                        <button 
                            disabled={entryCountdown > 0}
                            onClick={() => setShowEntryModal(false)}
                            className={`w-full py-3 md:py-4 rounded-xl font-bold text-lg tracking-wide transition-all transform duration-300 ${
                                entryCountdown > 0 
                                ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5' 
                                : 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg hover:shadow-sky-500/40 hover:scale-[1.02] active:scale-95 border border-white/20'
                            }`}
                        >
                            {entryCountdown > 0 ? t('entry_btn_wait').replace('%s', entryCountdown.toString()) : t('entry_btn')}
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Card - Using my-auto for vertical center when possible, but scrolling when needed */}
            <div className={`glass rounded-3xl p-5 md:p-8 w-full text-white shadow-2xl transition-all duration-700 my-auto ${showEntryModal ? 'blur-sm scale-95 opacity-50 pointer-events-none' : 'blur-0 scale-100 opacity-100'}`}>
                {/* Header */}
                <header className="text-center mb-6 md:mb-8 relative">
                    <div className="w-16 h-1 bg-white/30 mx-auto rounded-full mb-4"></div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-wider drop-shadow-md mb-2">{t('title')}</h1>
                </header>

                {/* Navigation Tabs */}
                <div className="flex bg-black/40 p-1 rounded-2xl mb-6 md:mb-8 relative overflow-hidden backdrop-blur-sm">
                    {(['measure', 'sim', 'history'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all duration-300 relative z-10 ${activeTab === tab ? 'bg-white text-indigo-900 shadow-md scale-105' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                        >
                            {t(`tab_${tab}`)}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[300px]">
                    {/* MEASURE TAB */}
                    {activeTab === 'measure' && (
                        <div className="animate-float space-y-6">
                            {!lastResult ? (
                                <>
                                    {/* Upload Zone */}
                                    <div 
                                        className="border-2 border-dashed border-white/20 bg-black/20 rounded-3xl p-6 md:p-8 text-center cursor-pointer hover:bg-black/30 hover:border-white/50 transition-all group active:scale-95 touch-manipulation"
                                        onClick={() => qrFileInputRef.current?.click()}
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={(e) => { 
                                            e.preventDefault(); e.stopPropagation(); 
                                            if (e.dataTransfer.files.length > 0) handleQrUpload(e.dataTransfer.files[0]);
                                        }}
                                    >
                                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                        <p className="font-medium text-white/80">{t('upload_instruction')}</p>
                                        <input type="file" ref={qrFileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.length && handleQrUpload(e.target.files[0])} />
                                    </div>

                                    {/* Text Input - Text base to prevent zoom */}
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            className="w-full glass-input rounded-xl px-4 py-3 pl-10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all bg-black/30 text-base"
                                            placeholder={t('placeholder')}
                                            value={inputVal}
                                            onChange={(e) => setInputVal(e.target.value)}
                                        />
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                    </div>

                                    {/* Action Button */}
                                    <button 
                                        onClick={handleCalculate}
                                        disabled={isLoading}
                                        className="w-full glass-btn py-4 rounded-xl font-bold text-lg tracking-wide hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-white touch-manipulation"
                                    >
                                        {isLoading ? (
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : t('calculate_btn')}
                                    </button>
                                    
                                    {/* Instructions Toggle Button (Trigger Modal) */}
                                    <div className="text-center pt-2">
                                        <button 
                                            onClick={() => setShowGuide(true)}
                                            className="text-xs text-white/60 hover:text-white transition-colors py-2 px-6 border border-white/10 rounded-full bg-black/20 hover:bg-black/40 touch-manipulation"
                                        >
                                            {t('toggle_instructions')}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-6">
                                    {/* Result Display */}
                                    <div className="text-center">
                                        <span className="text-sm uppercase tracking-widest text-white/60">{t('res_current')}</span>
                                        <div className="text-6xl font-mono font-bold my-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-sky-200 drop-shadow-2xl filter">
                                            {lastResult.current.toFixed(4)}
                                        </div>
                                        <div className="flex justify-between text-xs text-white/60 px-8">
                                            <span>Min: {lastResult.shortest.toFixed(4)}</span>
                                            <span>Max: {lastResult.tallest.toFixed(4)}</span>
                                        </div>
                                        
                                        {/* Visual Scale */}
                                        <div className="h-2 w-full bg-black/40 rounded-full mt-3 relative overflow-hidden border border-white/5">
                                            <div 
                                                className="h-full bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.8)] rounded-full transition-all duration-1000 ease-out"
                                                style={{ width: `${getHeightPercentage(lastResult.current, lastResult.shortest, lastResult.tallest)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* Action Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={handleCopy} className="glass-btn py-3 rounded-lg text-sm hover:bg-white/20 transition-colors bg-black/20 touch-manipulation">
                                            {status.text === t('status_copy_success') ? t('copy_btn_copied') : t('copy_btn')}
                                        </button>
                                        <button onClick={() => {setLastResult(null); setInputVal('');}} className="glass-btn py-3 rounded-lg text-sm hover:bg-white/20 transition-colors bg-black/20 touch-manipulation">
                                            重新测量
                                        </button>
                                    </div>
                                    
                                    {/* Customization Card */}
                                    <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                                        <h3 className="font-bold mb-3 text-sm flex items-center gap-2 text-white/90">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            {t('customize_image')}
                                        </h3>
                                        
                                        <div className="mb-4 rounded-xl overflow-hidden shadow-lg border border-white/10">
                                            <canvas ref={previewCanvasRef} width={500} height={250} className="w-full h-auto block" />
                                        </div>

                                        <div className="space-y-3">
                                            <input 
                                                type="text" 
                                                placeholder={t('player_name_placeholder')}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-base text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                                                value={customization.playerName}
                                                onChange={e => setCustomization({...customization, playerName: e.target.value})}
                                            />
                                            
                                            {/* Custom Background Upload */}
                                            <div>
                                                <button 
                                                    onClick={() => bgFileInputRef.current?.click()}
                                                    className={`w-full py-2 border border-dashed rounded-lg text-xs transition-all flex items-center justify-center gap-2 touch-manipulation ${customization.bgType === 'uploaded' ? 'border-sky-400 text-sky-200 bg-sky-500/10' : 'border-white/30 text-white/60 hover:text-white hover:bg-white/5 hover:border-white/60'}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                    {t('bg_style_upload')}
                                                </button>
                                                <input 
                                                    type="file" 
                                                    ref={bgFileInputRef}
                                                    className="hidden" 
                                                    accept="image/*" 
                                                    onChange={handleBgUpload}
                                                />
                                            </div>

                                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                {backgroundGradients.map(grad => (
                                                    <div 
                                                        key={grad.id}
                                                        className={`w-8 h-8 rounded-full flex-shrink-0 cursor-pointer border-2 shadow-sm touch-manipulation ${customization.bgType === 'gradient' && customization.bgSource === grad.colors.join(',') ? 'border-white scale-110' : 'border-transparent opacity-80'}`}
                                                        style={{ background: `linear-gradient(135deg, ${grad.colors[0]}, ${grad.colors[1]})` }}
                                                        onClick={() => setCustomization({...customization, bgType: 'gradient', bgSource: grad.colors.join(',')})}
                                                    />
                                                ))}
                                                {backgroundImages.map(img => (
                                                     <div 
                                                        key={img.id}
                                                        className={`w-8 h-8 rounded-full flex-shrink-0 cursor-pointer border-2 bg-cover shadow-sm touch-manipulation ${customization.bgType === 'image' && customization.bgSource === img.path ? 'border-white scale-110' : 'border-transparent opacity-80'}`}
                                                        style={{ backgroundImage: `url(${img.path})` }}
                                                        onClick={() => setCustomization({...customization, bgType: 'image', bgSource: img.path})}
                                                    />
                                                ))}
                                            </div>

                                            <button onClick={handleGenerateImage} className="w-full bg-white/90 text-indigo-900 font-bold py-2 rounded-lg text-sm hover:bg-white transition-colors shadow-lg touch-manipulation">
                                                {t('image_btn')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SIMULATOR TAB */}
                    {activeTab === 'sim' && (
                        <div className="animate-float space-y-6 text-center">
                            <div className="w-20 h-20 bg-gradient-to-tr from-yellow-300 to-orange-500 rounded-full mx-auto shadow-[0_0_20px_rgba(253,186,116,0.4)] flex items-center justify-center mb-4 border border-white/20">
                                <span className="text-3xl">🧪</span>
                            </div>
                            <h2 className="text-xl font-bold">{t('sim_title')}</h2>
                            <p className="text-sm text-white/70 px-4">{t('sim_desc')}</p>

                            {!lastResult ? (
                                <div className="p-4 bg-rose-500/20 border border-rose-500/30 rounded-xl text-sm text-white/90">
                                    {t('sim_error_no_calc')}
                                    <button onClick={() => setActiveTab('measure')} className="block mx-auto mt-2 underline text-white font-bold">{t('tab_measure')}</button>
                                </div>
                            ) : (
                                <>
                                    <div className="glass p-6 rounded-2xl relative overflow-hidden bg-black/20">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
                                        <div className="text-sm text-white/60 mb-1">{t('sim_result_label')}</div>
                                        <div className="text-4xl font-mono font-bold text-white drop-shadow-md">
                                            {simResult !== null ? simResult.toFixed(4) : '?.????'}
                                        </div>
                                        {simExtremeNotice && (
                                            <div className="text-gold font-bold text-xs mt-1 animate-bounce">{simExtremeNotice}</div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-center gap-4 text-sm font-medium">
                                        <span>{t('sim_count_label')} <span className="text-gold text-lg">{potionCount}</span></span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={handlePotionDrink}
                                            className="bg-gradient-to-r from-amber-300 to-orange-500 text-amber-950 font-bold py-3 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all touch-manipulation"
                                        >
                                            {t('sim_drink_btn')}
                                        </button>
                                        <button 
                                            onClick={() => { setPotionCount(0); setSimResult(null); }}
                                            className="bg-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/20 transition-all border border-white/10 touch-manipulation"
                                        >
                                            {t('sim_reset_btn')}
                                        </button>
                                    </div>

                                    <div className="mt-4 p-4 bg-black/20 rounded-xl text-left border border-white/5">
                                        <p className="text-xs font-bold text-white/50 mb-2 uppercase">{t('sim_meta_title')}</p>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-white/80 touch-manipulation">
                                                <input type="checkbox" className="rounded bg-black/40 border-white/20 text-indigo-500 focus:ring-0 checked:bg-indigo-500" />
                                                {t('sim_meta_tall')}
                                            </label>
                                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-white/80 touch-manipulation">
                                                <input type="checkbox" className="rounded bg-black/40 border-white/20 text-indigo-500 focus:ring-0 checked:bg-indigo-500" />
                                                {t('sim_meta_short')}
                                            </label>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold">{t('history_title')}</h3>
                                {history.length > 0 && (
                                    <button onClick={() => confirm(t('confirm_clear_history')) && setHistory([])} className="text-xs text-white/60 hover:text-white bg-white/10 px-3 py-1 rounded-full touch-manipulation">
                                        {t('clear_history_btn')}
                                    </button>
                                )}
                            </div>
                            
                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {history.length === 0 ? (
                                    <div className="text-center py-10 text-white/30 italic">
                                        {t('status_copy_empty')}
                                    </div>
                                ) : (
                                    history.map((item, index) => (
                                        <div key={index} className="bg-black/30 rounded-xl p-4 relative group hover:bg-black/40 transition-colors border border-white/5">
                                            <button 
                                                onClick={() => handleDeleteHistory(index)}
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-white/50 hover:text-red-300 transition-opacity p-1 touch-manipulation"
                                            >
                                                ✕
                                            </button>
                                            <div className="flex justify-between items-baseline">
                                                <span className="font-mono font-bold text-lg text-sky-200">{item.current.toFixed(4)}</span>
                                                <span className="text-xs text-white/40">{new Date(item.timestamp).toLocaleDateString()}</span>
                                            </div>
                                            <div 
                                                onClick={() => handleHistoryNote(index)}
                                                className="text-xs mt-1 text-white/60 hover:text-white cursor-pointer truncate flex items-center gap-1 touch-manipulation"
                                            >
                                                <span className="opacity-50">✎</span> {item.note || t('history_note_placeholder')}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* MODAL: Measurement Guide - Fully responsive and scrollable */}
                {showGuide && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setShowGuide(false)}>
                        <div 
                            className="glass-modal w-full max-w-md max-h-[90dvh] rounded-2xl p-6 relative flex flex-col shadow-2xl overflow-hidden" 
                            onClick={e => e.stopPropagation()}
                        >
                            <button 
                                onClick={() => setShowGuide(false)}
                                className="absolute top-4 right-4 text-white/60 hover:text-white p-2 touch-manipulation z-10"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            <h2 className="text-xl font-bold mb-4 text-center sticky top-0 bg-transparent">{t('toggle_instructions')}</h2>
                            
                            <div className="overflow-y-auto custom-scrollbar pr-2 space-y-6 flex-1">
                                {/* Method 1 Group */}
                                <div className="space-y-6">
                                    {/* Method 1 Header */}
                                    <div className="p-3 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                                        <p className="text-white font-bold text-center text-sm" dangerouslySetInnerHTML={{__html: t('inst_4')}} />
                                    </div>

                                    {/* Step 1 */}
                                    <div className="space-y-2">
                                        <p className="text-sm text-white/90 leading-relaxed font-medium" dangerouslySetInnerHTML={{__html: t('inst_1')}} />
                                        <div className="rounded-lg overflow-hidden border border-white/10 shadow-lg bg-black/20">
                                            <img 
                                                src="https://gitee.com/konatatata/material/raw/master/p1.png" 
                                                alt="Guide Step 1" 
                                                loading="lazy"
                                                referrerPolicy="no-referrer"
                                                className="w-full h-auto object-cover block"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="space-y-2">
                                        <p className="text-sm text-white/90 leading-relaxed font-medium" dangerouslySetInnerHTML={{__html: t('inst_2')}} />
                                        <div className="rounded-lg overflow-hidden border border-white/10 shadow-lg bg-black/20">
                                            <img 
                                                src="https://gitee.com/konatatata/material/raw/master/p2.png" 
                                                alt="Guide Step 2" 
                                                loading="lazy"
                                                referrerPolicy="no-referrer"
                                                className="w-full h-auto object-cover block"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Method 2 */}
                                <div className="pt-6 border-t border-white/10 space-y-4">
                                     <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-500/30">
                                        <p className="text-white font-bold text-center text-sm" dangerouslySetInnerHTML={{__html: t('inst_5')}} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Hidden Canvas for QR processing */}
                <canvas ref={qrCanvasRef} className="hidden" />

                {/* Footer Status Toast */}
                {status.text && (
                    <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-sm font-medium shadow-xl backdrop-blur-md transition-all z-50 whitespace-nowrap animate-float ${status.type === 'error' ? 'bg-rose-600 text-white' : 'bg-white text-indigo-900'}`}>
                        {status.text}
                    </div>
                )}
                
                <div className="mt-8 text-center text-xs space-y-1">
                    <p className="text-white/40">{t('disclaimer_free')}</p>
                    <p className="text-rose-400 font-medium">{t('disclaimer_privacy')}</p>
                </div>
            </div>
        </>
    );
};

export default App;