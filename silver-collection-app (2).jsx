import React, { useState, useEffect } from 'react';
import { Camera, Upload, Search, TrendingUp, Plus, X, Eye, Edit2, Trash2, DollarSign, Calendar, Award, Package, Scale, Shield, Coins } from 'lucide-react';

export default function SilverCollectionApp() {
  const [view, setView] = useState('collection');
  const [collection, setCollection] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [itemType, setItemType] = useState('coin');
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  // Load collection from storage
  useEffect(() => {
    loadCollection();
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Unable to access camera. Please check permissions or use file upload.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'captured-silver.jpg', { type: 'image/jpeg' });
        stopCamera();
        analyzeImage(file, itemType);
      }
    }, 'image/jpeg', 0.95);
  };

  const loadCollection = async () => {
    try {
      const result = await window.storage.list('silver:');
      if (result && result.keys) {
        const items = await Promise.all(
          result.keys.map(async (key) => {
            const data = await window.storage.get(key);
            return data ? JSON.parse(data.value) : null;
          })
        );
        setCollection(items.filter(Boolean));
      }
    } catch (error) {
      console.log('No existing collection found');
    } finally {
      setLoading(false);
    }
  };

  const analyzeImage = async (imageFile, type = 'coin') => {
    setAnalyzing(true);
    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const spotPriceResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: "What is the current spot price of silver per troy ounce in USD? Provide just the number and brief context."
            }
          ],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search"
            }
          ]
        })
      });

      const spotData = await spotPriceResponse.json();
      const spotPrice = spotData.content.map(item => item.type === "text" ? item.text : "").join("");

      let analysisPrompt = '';
      
      if (type === 'coin') {
        analysisPrompt = `Analyze this silver COIN image in detail. Identify all visible information and provide a response in JSON format (respond ONLY with valid JSON, no markdown, no preamble):
{
  "name": "Full coin name (e.g., American Silver Eagle, Canadian Maple Leaf)",
  "denomination": "Face value if applicable",
  "year": "Year minted",
  "mintMark": "Mint mark if visible",
  "mint": "Mint/Country of origin",
  "weight": "Weight in troy ounces (e.g., 1 oz, 0.5 oz)",
  "purity": "Silver purity (e.g., .999, .925)",
  "silverContent": "Actual silver content in troy oz",
  "series": "Series or special edition if applicable",
  "grade": "Condition grade if determinable (MS-70, BU, circulated, etc.)",
  "description": "Detailed description including design elements visible",
  "rarity": "Rarity assessment (common, scarce, rare)",
  "numismaticValue": "Estimated numismatic/collector value range",
  "identificationConfidence": "high/medium/low"
}`;
      } else if (type === 'bar') {
        analysisPrompt = `Analyze this silver BAR image in detail. Identify all visible information and provide a response in JSON format (respond ONLY with valid JSON, no markdown, no preamble):
{
  "name": "Full bar description",
  "manufacturer": "Refiner/manufacturer name",
  "weight": "Weight in troy ounces",
  "purity": "Silver purity (e.g., .999, .9999)",
  "serialNumber": "Serial number if visible",
  "assayMark": "Assay or certification marks",
  "type": "Type of bar (poured, minted, cast)",
  "design": "Description of design elements",
  "description": "Detailed description",
  "estimatedPremium": "Estimated premium over spot (%)",
  "identificationConfidence": "high/medium/low"
}`;
      } else {
        analysisPrompt = `Analyze this silver item image. Provide detailed information in JSON format (respond ONLY with valid JSON, no markdown, no preamble):
{
  "name": "Item name/type",
  "maker": "Maker or manufacturer if identifiable",
  "pattern": "Pattern name if applicable",
  "hallmarks": "Description of any hallmarks or marks visible",
  "period": "Estimated time period or age",
  "material": "Type of silver (Sterling, coin, plated, etc.)",
  "weight": "Estimated weight if determinable",
  "condition": "Condition assessment",
  "description": "Detailed description of the item",
  "estimatedValue": "Estimated value range",
  "identificationConfidence": "high/medium/low"
}`;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imageFile.type,
                    data: base64Data
                  }
                },
                {
                  type: "text",
                  text: analysisPrompt
                }
              ]
            }
          ]
        })
      });

      const data = await response.json();
      const analysisText = data.content.map(item => item.type === "text" ? item.text : "").join("");
      
      const cleanText = analysisText.replace(/```json|```/g, "").trim();
      const analysis = JSON.parse(cleanText);

      let searchQuery = '';
      if (type === 'coin') {
        searchQuery = `${analysis.year || ''} ${analysis.name} ${analysis.grade || ''} current market value price`;
      } else if (type === 'bar') {
        searchQuery = `${analysis.manufacturer || ''} ${analysis.weight || ''} silver bar current premium price`;
      } else {
        searchQuery = `${analysis.name} by ${analysis.maker}, ${analysis.pattern || ''} current market value`;
      }

      const priceResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Search for: ${searchQuery}. Provide current market value range and recent sales data.`
            }
          ],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search"
            }
          ]
        })
      });

      const priceData = await priceResponse.json();
      const priceInfo = priceData.content.map(item => item.type === "text" ? item.text : "").join("");

      const newItem = {
        id: Date.now().toString(),
        type: type,
        ...analysis,
        currentSpotPrice: spotPrice,
        currentMarketValue: priceInfo,
        imageData: `data:${imageFile.type};base64,${base64Data}`,
        dateAdded: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      await window.storage.set(`silver:${newItem.id}`, JSON.stringify(newItem));
      
      setCollection(prev => [newItem, ...prev]);
      setSelectedItem(newItem);
      setView('detail');
      
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze image. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      analyzeImage(file, itemType);
    }
  };

  const updateValue = async (itemId) => {
    const item = collection.find(i => i.id === itemId);
    if (!item) return;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Search for current market value of: ${item.name} by ${item.maker || item.manufacturer || item.mint}, ${item.pattern || ''} ${item.year || ''}. Provide updated price range and recent market trends.`
            }
          ],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search"
            }
          ]
        })
      });

      const data = await response.json();
      const priceInfo = data.content.map(i => i.type === "text" ? i.text : "").join("");

      const updatedItem = {
        ...item,
        currentMarketValue: priceInfo,
        lastUpdated: new Date().toISOString()
      };

      await window.storage.set(`silver:${itemId}`, JSON.stringify(updatedItem));
      setCollection(prev => prev.map(i => i.id === itemId ? updatedItem : i));
      if (selectedItem?.id === itemId) setSelectedItem(updatedItem);
      
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const deleteItem = async (itemId) => {
    if (!confirm('Remove this item from your registry?')) return;
    
    try {
      await window.storage.delete(`silver:${itemId}`);
      setCollection(prev => prev.filter(i => i.id !== itemId));
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
        setView('collection');
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const filteredCollection = collection.filter(item =>
    searchQuery === '' ||
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.maker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.mint?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.pattern?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedCollection = [...filteredCollection].sort((a, b) => {
    switch (sortBy) {
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'maker': return ((a.maker || a.manufacturer || a.mint) || '').localeCompare((b.maker || b.manufacturer || b.mint) || '');
      case 'date': return new Date(b.dateAdded) - new Date(a.dateAdded);
      default: return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-stone-900 to-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-zinc-700 border-t-zinc-400 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-zinc-400 text-lg tracking-wide">LOADING REGISTRY</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-stone-900 to-neutral-900 text-zinc-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500;600&family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {
          font-family: 'Inter', -apple-system, sans-serif;
        }
        
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Playfair Display', serif;
          letter-spacing: 0.02em;
        }
        
        .mono {
          font-family: 'IBM Plex Mono', monospace;
        }
        
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        
        .shimmer {
          animation: shimmer 2.5s infinite linear;
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(161, 161, 170, 0.15) 50%,
            transparent 100%
          );
          background-size: 1000px 100%;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .fade-in {
          animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .item-card {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(161, 161, 170, 0.1);
        }
        
        .item-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          border-color: rgba(161, 161, 170, 0.25);
        }
        
        input[type="file"] {
          display: none;
        }
        
        .metal-border {
          border: 1px solid;
          border-image: linear-gradient(135deg, rgba(161, 161, 170, 0.3), rgba(212, 212, 216, 0.1), rgba(161, 161, 170, 0.3)) 1;
        }
        
        .silver-gradient {
          background: linear-gradient(135deg, #71717a 0%, #a1a1aa 50%, #71717a 100%);
        }
        
        .precision-grid {
          background-image: 
            linear-gradient(rgba(161, 161, 170, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(161, 161, 170, 0.03) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <Shield className="w-10 h-10 text-zinc-400" strokeWidth={1.5} />
                <div>
                  <h1 className="text-5xl font-bold tracking-tight text-zinc-100">
                    STERLING REGISTRY
                  </h1>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="h-px w-12 bg-gradient-to-r from-zinc-700 to-transparent"></div>
                    <p className="text-zinc-500 text-sm tracking-[0.2em] uppercase mono">
                      Precious Metals Catalogue
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 items-center flex-wrap">
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="px-5 py-3 bg-zinc-900 border border-zinc-800 text-zinc-300 mono text-sm tracking-wider focus:outline-none focus:border-zinc-600 transition-all cursor-pointer"
              >
                <option value="coin">COIN</option>
                <option value="bar">BAR</option>
                <option value="other">OTHER</option>
              </select>
              
              <button
                onClick={() => setView('collection')}
                className={`px-6 py-3 border transition-all mono text-sm tracking-wider ${
                  view === 'collection'
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                REGISTRY
              </button>
              
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition-all flex items-center gap-3 text-zinc-100 mono text-sm tracking-wider"
              >
                <Camera size={18} />
                CAPTURE
              </button>
              
              <label className="px-6 py-3 silver-gradient hover:opacity-90 cursor-pointer transition-all flex items-center gap-3 text-zinc-950 mono text-sm tracking-wider font-medium">
                <Upload size={18} />
                UPLOAD
                <input type="file" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-zinc-950/98 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 shadow-2xl max-w-5xl w-full overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">CAPTURE {itemType.toUpperCase()}</h3>
              <button
                onClick={stopCamera}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <X size={28} strokeWidth={1.5} />
              </button>
            </div>
            
            <div className="relative bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Capture guide overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-8 border-2 border-zinc-500/30 border-dashed"></div>
                <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-zinc-400"></div>
                <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-zinc-400"></div>
                <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-zinc-400"></div>
                <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-zinc-400"></div>
              </div>
              
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-4">
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 bg-zinc-100 hover:bg-white rounded-full shadow-2xl transition-all flex items-center justify-center border-4 border-zinc-900"
                >
                  <div className="w-16 h-16 border-4 border-zinc-900 rounded-full"></div>
                </button>
                <div className="bg-zinc-900/90 backdrop-blur-sm px-6 py-3 border border-zinc-800 mono text-sm tracking-wider">
                  POSITION {itemType.toUpperCase()} WITHIN FRAME
                </div>
              </div>
            </div>
            
            <div className="px-8 py-5 bg-zinc-950/50 border-t border-zinc-800 text-sm text-zinc-500 mono tracking-wide">
              TIP: Capture both obverse and reverse sides for complete identification
            </div>
          </div>
        </div>
      )}

      {/* Analyzing Overlay */}
      {analyzing && (
        <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-800 shadow-2xl p-12 max-w-md mx-4 text-center">
            <div className="w-20 h-20 mx-auto mb-6 border-4 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div>
            <h3 className="text-3xl font-bold mb-3 tracking-tight">ANALYZING {itemType.toUpperCase()}</h3>
            <div className="h-px w-24 bg-gradient-to-r from-transparent via-zinc-700 to-transparent mx-auto mb-4"></div>
            <p className="text-zinc-400 mono text-sm tracking-wider leading-relaxed">
              {itemType === 'coin' 
                ? 'IDENTIFYING MINT • YEAR • GRADE • NUMISMATIC VALUE'
                : itemType === 'bar'
                ? 'READING MANUFACTURER • WEIGHT • PURITY • PREMIUM'
                : 'IDENTIFYING HALLMARKS • PATTERNS • MARKET VALUE'
              }
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-12 precision-grid">
        {view === 'collection' && (
          <div className="fade-in">
            {/* Search and Filter */}
            <div className="mb-10 flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-zinc-600" size={20} strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="SEARCH REGISTRY..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-5 py-4 bg-zinc-950/50 border border-zinc-800 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-all mono text-sm tracking-wider"
                />
              </div>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-6 py-4 bg-zinc-950/50 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer mono text-sm tracking-wider"
              >
                <option value="date">SORT: DATE</option>
                <option value="name">SORT: NAME</option>
                <option value="maker">SORT: MAKER</option>
              </select>
            </div>

            {/* Collection Grid */}
            {sortedCollection.length === 0 ? (
              <div className="text-center py-32">
                <Package size={80} className="mx-auto mb-6 text-zinc-700" strokeWidth={1} />
                <h3 className="text-3xl font-bold mb-3 text-zinc-300 tracking-tight">REGISTRY EMPTY</h3>
                <div className="h-px w-32 bg-gradient-to-r from-transparent via-zinc-800 to-transparent mx-auto mb-6"></div>
                <p className="text-zinc-500 mb-10 mono text-sm tracking-wider">
                  BEGIN CATALOGING YOUR PRECIOUS METALS COLLECTION
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={startCamera}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-all text-zinc-100 mono text-sm tracking-wider"
                  >
                    <Camera size={20} />
                    CAPTURE
                  </button>
                  <label className="inline-flex items-center gap-3 px-8 py-4 silver-gradient hover:opacity-90 cursor-pointer transition-all text-zinc-950 mono text-sm tracking-wider font-medium">
                    <Upload size={20} />
                    UPLOAD
                    <input type="file" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedCollection.map((item, index) => (
                    <div
                      key={item.id}
                      className="item-card bg-zinc-950/40 backdrop-blur-sm overflow-hidden cursor-pointer"
                      onClick={() => {
                        setSelectedItem(item);
                        setView('detail');
                      }}
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="aspect-square bg-zinc-900 relative overflow-hidden border-b border-zinc-800/50">
                        <img
                          src={item.imageData}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                          <div className="bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 px-3 py-1.5 mono text-xs tracking-widest uppercase">
                            {item.identificationConfidence}
                          </div>
                          <div className="bg-zinc-100 text-zinc-950 px-3 py-1.5 mono text-xs tracking-widest uppercase font-medium">
                            {item.type || 'OTHER'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-6">
                        <h3 className="text-xl font-bold mb-2 text-zinc-100 tracking-tight">{item.name}</h3>
                        
                        {item.type === 'coin' && (
                          <>
                            <p className="text-zinc-400 text-sm mb-1 mono tracking-wide">{item.mint || 'MINT UNKNOWN'}</p>
                            <div className="flex gap-3 items-center text-zinc-500 text-sm mono mb-4">
                              {item.year && <span>{item.year}</span>}
                              {item.year && item.weight && <span className="text-zinc-700">•</span>}
                              {item.weight && <span>{item.weight}</span>}
                            </div>
                          </>
                        )}
                        
                        {item.type === 'bar' && (
                          <>
                            <p className="text-zinc-400 text-sm mb-1 mono tracking-wide">{item.manufacturer || 'MANUFACTURER UNKNOWN'}</p>
                            <div className="flex gap-3 items-center text-zinc-500 text-sm mono mb-4">
                              {item.weight && <span>{item.weight}</span>}
                              {item.weight && item.purity && <span className="text-zinc-700">•</span>}
                              {item.purity && <span>{item.purity}</span>}
                            </div>
                          </>
                        )}
                        
                        {item.type === 'other' && (
                          <>
                            <p className="text-zinc-400 text-sm mb-3 mono tracking-wide">{item.maker || 'MAKER UNKNOWN'}</p>
                            {item.pattern && (
                              <p className="text-zinc-500 text-sm mb-4">{item.pattern}</p>
                            )}
                          </>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-zinc-600 pt-4 border-t border-zinc-800/50 mono tracking-wider">
                          <span>{item.period || item.grade || 'CATALOGUED'}</span>
                          <span>{new Date(item.dateAdded).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Collection Stats */}
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard
                    icon={<Package size={28} strokeWidth={1.5} />}
                    label="TOTAL ITEMS"
                    value={collection.length}
                  />
                  <StatCard
                    icon={<Award size={28} strokeWidth={1.5} />}
                    label="UNIQUE MAKERS"
                    value={new Set(collection.map(i => i.maker || i.manufacturer || i.mint).filter(Boolean)).size}
                  />
                  <StatCard
                    icon={<Scale size={28} strokeWidth={1.5} />}
                    label="TOTAL WEIGHT"
                    value={`${collection.filter(i => i.weight).reduce((sum, i) => {
                      const weight = parseFloat(i.weight);
                      return isNaN(weight) ? sum : sum + weight;
                    }, 0).toFixed(2)} oz`}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {view === 'detail' && selectedItem && (
          <div className="fade-in">
            <button
              onClick={() => setView('collection')}
              className="mb-8 text-zinc-500 hover:text-zinc-200 flex items-center gap-2 transition-colors mono text-sm tracking-wider"
            >
              ← RETURN TO REGISTRY
            </button>

            <div className="grid lg:grid-cols-2 gap-10">
              {/* Image */}
              <div className="bg-zinc-950/40 border border-zinc-800/50 overflow-hidden">
                <img
                  src={selectedItem.imageData}
                  alt={selectedItem.name}
                  className="w-full aspect-square object-cover"
                />
              </div>

              {/* Details */}
              <div>
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 mb-4 mono text-xs tracking-widest">
                    <div className="w-2 h-2 bg-zinc-400"></div>
                    {selectedItem.type === 'coin' ? 'SILVER COIN' : selectedItem.type === 'bar' ? 'SILVER BAR' : 'SILVER ITEM'}
                  </div>
                  <h2 className="text-5xl font-bold mb-3 tracking-tight leading-tight">{selectedItem.name}</h2>
                  {selectedItem.type === 'coin' && (
                    <>
                      <p className="text-2xl text-zinc-400 mb-2">{selectedItem.mint || 'MINT UNKNOWN'}</p>
                      {selectedItem.year && (
                        <p className="text-lg text-zinc-500 mono">{selectedItem.year}</p>
                      )}
                    </>
                  )}
                  {selectedItem.type === 'bar' && (
                    <p className="text-2xl text-zinc-400 mb-2">{selectedItem.manufacturer || 'MANUFACTURER UNKNOWN'}</p>
                  )}
                  {selectedItem.type === 'other' && (
                    <>
                      <p className="text-2xl text-zinc-400 mb-2">{selectedItem.maker || 'MAKER UNKNOWN'}</p>
                      {selectedItem.pattern && (
                        <p className="text-lg text-zinc-500">{selectedItem.pattern}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Specifications */}
                <div className="bg-zinc-950/60 border border-zinc-800 p-6 mb-6">
                  <h3 className="text-xs font-medium text-zinc-500 mb-4 tracking-widest mono">SPECIFICATIONS</h3>
                  <div className="space-y-3">
                    {selectedItem.type === 'coin' && (
                      <>
                        {selectedItem.denomination && <SpecRow label="DENOMINATION" value={selectedItem.denomination} />}
                        <SpecRow label="WEIGHT" value={selectedItem.weight} />
                        <SpecRow label="PURITY" value={selectedItem.purity} />
                        {selectedItem.silverContent && <SpecRow label="SILVER CONTENT" value={selectedItem.silverContent} />}
                        {selectedItem.mintMark && <SpecRow label="MINT MARK" value={selectedItem.mintMark} />}
                        {selectedItem.series && <SpecRow label="SERIES" value={selectedItem.series} />}
                        {selectedItem.grade && <SpecRow label="GRADE" value={selectedItem.grade} />}
                        {selectedItem.rarity && <SpecRow label="RARITY" value={selectedItem.rarity} />}
                      </>
                    )}
                    
                    {selectedItem.type === 'bar' && (
                      <>
                        <SpecRow label="WEIGHT" value={selectedItem.weight} />
                        <SpecRow label="PURITY" value={selectedItem.purity} />
                        {selectedItem.serialNumber && <SpecRow label="SERIAL NO." value={selectedItem.serialNumber} />}
                        {selectedItem.assayMark && <SpecRow label="ASSAY MARK" value={selectedItem.assayMark} />}
                        {selectedItem.design && <SpecRow label="TYPE" value={selectedItem.design} />}
                        {selectedItem.estimatedPremium && <SpecRow label="PREMIUM" value={selectedItem.estimatedPremium} />}
                      </>
                    )}
                    
                    {selectedItem.type === 'other' && (
                      <>
                        {selectedItem.material && <SpecRow label="MATERIAL" value={selectedItem.material} />}
                        {selectedItem.period && <SpecRow label="PERIOD" value={selectedItem.period} />}
                        {selectedItem.condition && <SpecRow label="CONDITION" value={selectedItem.condition} />}
                        {selectedItem.weight && <SpecRow label="WEIGHT" value={selectedItem.weight} />}
                        {selectedItem.hallmarks && <SpecRow label="HALLMARKS" value={selectedItem.hallmarks} />}
                      </>
                    )}
                  </div>
                </div>

                {/* Spot Price */}
                {(selectedItem.type === 'coin' || selectedItem.type === 'bar') && selectedItem.currentSpotPrice && (
                  <div className="bg-zinc-950/60 border border-zinc-800 p-6 mb-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xs font-medium text-zinc-500 tracking-widest mono">SPOT PRICE</h3>
                      <TrendingUp size={18} className="text-emerald-500" strokeWidth={1.5} />
                    </div>
                    <p className="text-zinc-300 mb-3 leading-relaxed">{selectedItem.currentSpotPrice}</p>
                    <p className="text-xs text-zinc-600 mono">
                      UPDATED: {new Date(selectedItem.lastUpdated).toLocaleString().toUpperCase()}
                    </p>
                  </div>
                )}

                {/* Market Value */}
                <div className="bg-zinc-950/60 border border-zinc-800 p-6 mb-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xs font-medium text-zinc-500 tracking-widest mono">
                      {selectedItem.type === 'coin' ? 'NUMISMATIC VALUE' : 'MARKET VALUE'}
                    </h3>
                    <DollarSign size={18} className="text-zinc-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-zinc-300 mb-4 leading-relaxed">
                    {selectedItem.numismaticValue || selectedItem.currentMarketValue || selectedItem.estimatedValue}
                  </p>
                  <button
                    onClick={() => updateValue(selectedItem.id)}
                    className="w-full px-5 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition-all flex items-center justify-center gap-2 text-zinc-100 mono text-sm tracking-wider"
                  >
                    <TrendingUp size={16} strokeWidth={1.5} />
                    UPDATE VALUATION
                  </button>
                  <p className="text-xs text-zinc-600 mt-3 mono">
                    UPDATED: {new Date(selectedItem.lastUpdated).toLocaleString().toUpperCase()}
                  </p>
                </div>

                {/* Description */}
                <div className="bg-zinc-950/60 border border-zinc-800 p-6 mb-6">
                  <h3 className="text-xs font-medium text-zinc-500 mb-4 tracking-widest mono">DESCRIPTION</h3>
                  <p className="text-zinc-400 leading-relaxed">{selectedItem.description}</p>
                </div>

                {/* Actions */}
                <button
                  onClick={() => deleteItem(selectedItem.id)}
                  className="px-6 py-3 bg-red-950/30 hover:bg-red-950/50 border border-red-900/50 text-red-400 transition-all flex items-center gap-2 mono text-sm tracking-wider"
                >
                  <Trash2 size={18} strokeWidth={1.5} />
                  REMOVE FROM REGISTRY
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-zinc-950/60 border border-zinc-800 p-8">
      <div className="flex items-start justify-between mb-4">
        <div className="text-zinc-600">{icon}</div>
      </div>
      <div className="text-xs text-zinc-600 mb-2 mono tracking-widest">{label}</div>
      <div className="text-4xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function SpecRow({ label, value }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-zinc-800/30">
      <span className="text-zinc-500 text-xs mono tracking-widest">{label}</span>
      <span className="text-zinc-300 text-sm text-right max-w-xs">{value || 'NOT SPECIFIED'}</span>
    </div>
  );
}

  // Load collection from storage
  useEffect(() => {
    loadCollection();
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Unable to access camera. Please check permissions or use file upload.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'captured-silver.jpg', { type: 'image/jpeg' });
        stopCamera();
        analyzeImage(file, itemType);
      }
    }, 'image/jpeg', 0.95);
  };

  const loadCollection = async () => {
    try {
      const result = await window.storage.list('silver:');
      if (result && result.keys) {
        const items = await Promise.all(
          result.keys.map(async (key) => {
            const data = await window.storage.get(key);
            return data ? JSON.parse(data.value) : null;
          })
        );
        setCollection(items.filter(Boolean));
      }
    } catch (error) {
      console.log('No existing collection found');
    } finally {
      setLoading(false);
    }
  };

  const analyzeImage = async (imageFile, type = 'coin') => {
    setAnalyzing(true);
    try {
      // Convert image to base64
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      // Get current spot silver price first
      const spotPriceResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: "What is the current spot price of silver per troy ounce in USD? Provide just the number and brief context."
            }
          ],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search"
            }
          ]
        })
      });

      const spotData = await spotPriceResponse.json();
      const spotPrice = spotData.content.map(item => item.type === "text" ? item.text : "").join("");

      // Create specialized prompt based on item type
      let analysisPrompt = '';
      
      if (type === 'coin') {
        analysisPrompt = `Analyze this silver COIN image in detail. Identify all visible information and provide a response in JSON format (respond ONLY with valid JSON, no markdown, no preamble):
{
  "name": "Full coin name (e.g., American Silver Eagle, Canadian Maple Leaf)",
  "denomination": "Face value if applicable",
  "year": "Year minted",
  "mintMark": "Mint mark if visible",
  "mint": "Mint/Country of origin",
  "weight": "Weight in troy ounces (e.g., 1 oz, 0.5 oz)",
  "purity": "Silver purity (e.g., .999, .925)",
  "silverContent": "Actual silver content in troy oz",
  "series": "Series or special edition if applicable",
  "grade": "Condition grade if determinable (MS-70, BU, circulated, etc.)",
  "description": "Detailed description including design elements visible",
  "rarity": "Rarity assessment (common, scarce, rare)",
  "numismaticValue": "Estimated numismatic/collector value range",
  "identificationConfidence": "high/medium/low"
}`;
      } else if (type === 'bar') {
        analysisPrompt = `Analyze this silver BAR image in detail. Identify all visible information and provide a response in JSON format (respond ONLY with valid JSON, no markdown, no preamble):
{
  "name": "Full bar description",
  "manufacturer": "Refiner/manufacturer name",
  "weight": "Weight in troy ounces",
  "purity": "Silver purity (e.g., .999, .9999)",
  "serialNumber": "Serial number if visible",
  "assayMark": "Assay or certification marks",
  "type": "Type of bar (poured, minted, cast)",
  "design": "Description of design elements",
  "description": "Detailed description",
  "estimatedPremium": "Estimated premium over spot (%)",
  "identificationConfidence": "high/medium/low"
}`;
      } else {
        analysisPrompt = `Analyze this silver item image. Provide detailed information in JSON format (respond ONLY with valid JSON, no markdown, no preamble):
{
  "name": "Item name/type",
  "maker": "Maker or manufacturer if identifiable",
  "pattern": "Pattern name if applicable",
  "hallmarks": "Description of any hallmarks or marks visible",
  "period": "Estimated time period or age",
  "material": "Type of silver (Sterling, coin, plated, etc.)",
  "weight": "Estimated weight if determinable",
  "condition": "Condition assessment",
  "description": "Detailed description of the item",
  "estimatedValue": "Estimated value range",
  "identificationConfidence": "high/medium/low"
}`;
      }

      // Call Claude API to analyze the silver item
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imageFile.type,
                    data: base64Data
                  }
                },
                {
                  type: "text",
                  text: analysisPrompt
                }
              ]
            }
          ]
        })
      });

      const data = await response.json();
      const analysisText = data.content.map(item => item.type === "text" ? item.text : "").join("");
      
      // Clean and parse JSON
      const cleanText = analysisText.replace(/```json|```/g, "").trim();
      const analysis = JSON.parse(cleanText);

      // Get current market value using web search
      let searchQuery = '';
      if (type === 'coin') {
        searchQuery = `${analysis.year || ''} ${analysis.name} ${analysis.grade || ''} current market value price`;
      } else if (type === 'bar') {
        searchQuery = `${analysis.manufacturer || ''} ${analysis.weight || ''} silver bar current premium price`;
      } else {
        searchQuery = `${analysis.name} by ${analysis.maker}, ${analysis.pattern || ''} current market value`;
      }

      const priceResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Search for: ${searchQuery}. Provide current market value range and recent sales data.`
            }
          ],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search"
            }
          ]
        })
      });

      const priceData = await priceResponse.json();
      const priceInfo = priceData.content.map(item => item.type === "text" ? item.text : "").join("");

      // Create new item
      const newItem = {
        id: Date.now().toString(),
        type: type,
        ...analysis,
        currentSpotPrice: spotPrice,
        currentMarketValue: priceInfo,
        imageData: `data:${imageFile.type};base64,${base64Data}`,
        dateAdded: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      // Save to storage
      await window.storage.set(`silver:${newItem.id}`, JSON.stringify(newItem));
      
      setCollection(prev => [newItem, ...prev]);
      setSelectedItem(newItem);
      setView('detail');
      
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze image. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      analyzeImage(file, itemType);
    }
  };

  const updateValue = async (itemId) => {
    const item = collection.find(i => i.id === itemId);
    if (!item) return;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Search for current market value of: ${item.name} by ${item.maker}, ${item.pattern || 'pattern unknown'}. Provide updated price range and recent market trends.`
            }
          ],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search"
            }
          ]
        })
      });

      const data = await response.json();
      const priceInfo = data.content.map(i => i.type === "text" ? i.text : "").join("");

      const updatedItem = {
        ...item,
        currentMarketValue: priceInfo,
        lastUpdated: new Date().toISOString()
      };

      await window.storage.set(`silver:${itemId}`, JSON.stringify(updatedItem));
      setCollection(prev => prev.map(i => i.id === itemId ? updatedItem : i));
      if (selectedItem?.id === itemId) setSelectedItem(updatedItem);
      
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const deleteItem = async (itemId) => {
    if (!confirm('Are you sure you want to remove this item from your collection?')) return;
    
    try {
      await window.storage.delete(`silver:${itemId}`);
      setCollection(prev => prev.filter(i => i.id !== itemId));
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
        setView('collection');
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const filteredCollection = collection.filter(item =>
    searchQuery === '' ||
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.maker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.pattern?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedCollection = [...filteredCollection].sort((a, b) => {
    switch (sortBy) {
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'maker': return (a.maker || '').localeCompare(b.maker || '');
      case 'date': return new Date(b.dateAdded) - new Date(a.dateAdded);
      default: return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-xl animate-pulse">Loading collection...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600&display=swap');
        
        * {
          font-family: 'Montserrat', sans-serif;
        }
        
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Cormorant Garamond', serif;
        }
        
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        
        .shimmer {
          animation: shimmer 2s infinite linear;
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(148, 163, 184, 0.1) 50%,
            transparent 100%
          );
          background-size: 1000px 100%;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        .item-card {
          transition: all 0.3s ease;
        }
        
        .item-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }
        
        input[type="file"] {
          display: none;
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200">
                Sterling Registry
              </h1>
              <p className="text-slate-400 text-sm mt-1 font-light tracking-wide">
                AI-Powered Silver Collection Management
              </p>
            </div>
            
            <div className="flex gap-3 items-center flex-wrap">
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-600 text-sm"
              >
                <option value="coin">Silver Coin</option>
                <option value="bar">Silver Bar</option>
                <option value="other">Other Silver</option>
              </select>
              
              <button
                onClick={() => setView('collection')}
                className={`px-5 py-2.5 rounded-lg transition-all ${
                  view === 'collection'
                    ? 'bg-slate-700 text-slate-100 shadow-lg'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Collection
              </button>
              
              <button
                onClick={startCamera}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2 font-medium"
              >
                <Camera size={18} />
                Take Photo
              </button>
              
              <label className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-lg cursor-pointer transition-all shadow-lg hover:shadow-xl flex items-center gap-2 font-medium">
                <Upload size={18} />
                Upload
                <input type="file" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-xl font-bold">Capture {itemType === 'coin' ? 'Coin' : itemType === 'bar' ? 'Bar' : 'Item'}</h3>
              <button
                onClick={stopCamera}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="relative bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4">
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 bg-white hover:bg-slate-200 rounded-full shadow-2xl transition-all flex items-center justify-center border-4 border-slate-800"
                >
                  <Camera size={28} className="text-slate-900" />
                </button>
              </div>
              
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-full text-sm">
                Position {itemType} clearly in frame
              </div>
            </div>
            
            <div className="p-4 bg-slate-900/50 text-sm text-slate-400 text-center">
              Tip: Capture both sides of coins for complete identification
            </div>
          </div>
        </div>
      )}

      {/* Analyzing Overlay */}
      {analyzing && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl max-w-md mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-amber-600 to-amber-700 shimmer" />
            <h3 className="text-2xl font-bold mb-2">Analyzing {itemType === 'coin' ? 'Coin' : itemType === 'bar' ? 'Bar' : 'Item'}</h3>
            <p className="text-slate-400">
              {itemType === 'coin' 
                ? 'Identifying year, mint, grade, and numismatic value...'
                : itemType === 'bar'
                ? 'Reading manufacturer, weight, purity, and premium...'
                : 'Identifying hallmarks, patterns, and market value...'
              }
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {view === 'collection' && (
          <div className="fade-in">
            {/* Search and Filter */}
            <div className="mb-6 flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by name, maker, or pattern..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 transition-all"
                />
              </div>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-600 cursor-pointer"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="maker">Sort by Maker</option>
              </select>
            </div>

            {/* Collection Grid */}
            {sortedCollection.length === 0 ? (
              <div className="text-center py-20">
                <Package size={64} className="mx-auto mb-4 text-slate-600" />
                <h3 className="text-2xl font-bold mb-2 text-slate-300">No Items Yet</h3>
                <p className="text-slate-400 mb-6">
                  Start cataloging your silver coins, bars, and collectibles
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg transition-all shadow-lg hover:shadow-xl font-medium"
                  >
                    <Camera size={20} />
                    Take Photo
                  </button>
                  <label className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-lg cursor-pointer transition-all shadow-lg hover:shadow-xl font-medium">
                    <Upload size={20} />
                    Upload Photo
                    <input type="file" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedCollection.map((item, index) => (
                  <div
                    key={item.id}
                    className="item-card bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden cursor-pointer backdrop-blur-sm"
                    onClick={() => {
                      setSelectedItem(item);
                      setView('detail');
                    }}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="aspect-square bg-slate-900 relative overflow-hidden">
                      <img
                        src={item.imageData}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3 flex gap-2">
                        <div className="bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
                          {item.identificationConfidence}
                        </div>
                        <div className="bg-amber-600/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium capitalize">
                          {item.type || 'other'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-5">
                      <h3 className="text-xl font-bold mb-1 text-slate-100">{item.name}</h3>
                      
                      {item.type === 'coin' && (
                        <>
                          <p className="text-amber-400 text-sm mb-1">{item.mint || 'Unknown Mint'}</p>
                          <div className="flex gap-2 items-center text-slate-400 text-sm mb-3">
                            {item.year && <span>{item.year}</span>}
                            {item.year && item.weight && <span>•</span>}
                            {item.weight && <span>{item.weight}</span>}
                          </div>
                        </>
                      )}
                      
                      {item.type === 'bar' && (
                        <>
                          <p className="text-amber-400 text-sm mb-1">{item.manufacturer || 'Unknown Manufacturer'}</p>
                          <div className="flex gap-2 items-center text-slate-400 text-sm mb-3">
                            {item.weight && <span>{item.weight}</span>}
                            {item.weight && item.purity && <span>•</span>}
                            {item.purity && <span>{item.purity}</span>}
                          </div>
                        </>
                      )}
                      
                      {item.type === 'other' && (
                        <>
                          <p className="text-amber-400 text-sm mb-2">{item.maker || 'Unknown Maker'}</p>
                          {item.pattern && (
                            <p className="text-slate-400 text-sm mb-3">{item.pattern}</p>
                          )}
                        </>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-700/50">
                        <span>{item.period || item.grade || 'Added'}</span>
                        <span>{new Date(item.dateAdded).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Collection Stats */}
            {collection.length > 0 && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Package className="text-amber-500" size={24} />
                    <span className="text-slate-400 text-sm">Total Items</span>
                  </div>
                  <div className="text-3xl font-bold">{collection.length}</div>
                </div>
                
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Award className="text-amber-500" size={24} />
                    <span className="text-slate-400 text-sm">Makers</span>
                  </div>
                  <div className="text-3xl font-bold">
                    {new Set(collection.map(i => i.maker).filter(Boolean)).size}
                  </div>
                </div>
                
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="text-amber-500" size={24} />
                    <span className="text-slate-400 text-sm">Oldest Item</span>
                  </div>
                  <div className="text-3xl font-bold">
                    {collection.map(i => i.period).filter(Boolean).sort()[0] || 'N/A'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'detail' && selectedItem && (
          <div className="fade-in">
            <button
              onClick={() => setView('collection')}
              className="mb-6 text-slate-400 hover:text-slate-200 flex items-center gap-2 transition-colors"
            >
              ← Back to Collection
            </button>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Image */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
                <img
                  src={selectedItem.imageData}
                  alt={selectedItem.name}
                  className="w-full aspect-square object-cover"
                />
              </div>

              {/* Details */}
              <div>
                <div className="mb-6">
                  <div className="inline-block px-3 py-1 bg-amber-600/20 border border-amber-600/30 rounded-full text-amber-400 text-xs font-medium mb-3">
                    {selectedItem.type === 'coin' ? 'Silver Coin' : selectedItem.type === 'bar' ? 'Silver Bar' : 'Silver Item'}
                  </div>
                  <h2 className="text-4xl font-bold mb-2">{selectedItem.name}</h2>
                  {selectedItem.type === 'coin' && (
                    <>
                      <p className="text-2xl text-amber-400 mb-1">{selectedItem.mint || 'Unknown Mint'}</p>
                      {selectedItem.year && (
                        <p className="text-lg text-slate-400">{selectedItem.year}</p>
                      )}
                    </>
                  )}
                  {selectedItem.type === 'bar' && (
                    <p className="text-2xl text-amber-400 mb-1">{selectedItem.manufacturer || 'Unknown Manufacturer'}</p>
                  )}
                  {selectedItem.type === 'other' && (
                    <>
                      <p className="text-2xl text-amber-400 mb-1">{selectedItem.maker || 'Unknown Maker'}</p>
                      {selectedItem.pattern && (
                        <p className="text-lg text-slate-400">{selectedItem.pattern}</p>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-4 mb-6">
                  {/* Coin-specific fields */}
                  {selectedItem.type === 'coin' && (
                    <>
                      {selectedItem.denomination && <DetailRow label="Denomination" value={selectedItem.denomination} />}
                      <DetailRow label="Weight" value={selectedItem.weight} />
                      <DetailRow label="Purity" value={selectedItem.purity} />
                      {selectedItem.silverContent && <DetailRow label="Silver Content" value={selectedItem.silverContent} />}
                      {selectedItem.mintMark && <DetailRow label="Mint Mark" value={selectedItem.mintMark} />}
                      {selectedItem.series && <DetailRow label="Series" value={selectedItem.series} />}
                      {selectedItem.grade && <DetailRow label="Grade" value={selectedItem.grade} />}
                      {selectedItem.rarity && <DetailRow label="Rarity" value={selectedItem.rarity} />}
                    </>
                  )}
                  
                  {/* Bar-specific fields */}
                  {selectedItem.type === 'bar' && (
                    <>
                      <DetailRow label="Weight" value={selectedItem.weight} />
                      <DetailRow label="Purity" value={selectedItem.purity} />
                      {selectedItem.serialNumber && <DetailRow label="Serial Number" value={selectedItem.serialNumber} />}
                      {selectedItem.assayMark && <DetailRow label="Assay Mark" value={selectedItem.assayMark} />}
                      {selectedItem.type && <DetailRow label="Bar Type" value={selectedItem.type} />}
                      {selectedItem.estimatedPremium && <DetailRow label="Premium Over Spot" value={selectedItem.estimatedPremium} />}
                    </>
                  )}
                  
                  {/* Other silver fields */}
                  {selectedItem.type === 'other' && (
                    <>
                      {selectedItem.material && <DetailRow label="Material" value={selectedItem.material} />}
                      {selectedItem.period && <DetailRow label="Period" value={selectedItem.period} />}
                      {selectedItem.condition && <DetailRow label="Condition" value={selectedItem.condition} />}
                      {selectedItem.weight && <DetailRow label="Weight" value={selectedItem.weight} />}
                      {selectedItem.hallmarks && <DetailRow label="Hallmarks" value={selectedItem.hallmarks} />}
                    </>
                  )}
                </div>

                {/* Spot Price for coins and bars */}
                {(selectedItem.type === 'coin' || selectedItem.type === 'bar') && selectedItem.currentSpotPrice && (
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 mb-6">
                    <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                      <TrendingUp size={20} className="text-green-500" />
                      Current Spot Price
                    </h3>
                    <p className="text-slate-300 mb-2">{selectedItem.currentSpotPrice}</p>
                    <p className="text-xs text-slate-500">
                      Last updated: {new Date(selectedItem.lastUpdated).toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 mb-6">
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <DollarSign size={20} className="text-amber-500" />
                    {selectedItem.type === 'coin' ? 'Numismatic Value' : 'Current Market Value'}
                  </h3>
                  <p className="text-slate-300 mb-3">
                    {selectedItem.numismaticValue || selectedItem.currentMarketValue || selectedItem.estimatedValue}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateValue(selectedItem.id)}
                      className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <TrendingUp size={16} />
                      Update Value
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Last updated: {new Date(selectedItem.lastUpdated).toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 mb-6">
                  <h3 className="text-lg font-bold mb-3">Description</h3>
                  <p className="text-slate-300 leading-relaxed">{selectedItem.description}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => deleteItem(selectedItem.id)}
                    className="px-5 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 rounded-lg transition-all flex items-center gap-2"
                  >
                    <Trash2 size={18} />
                    Remove from Collection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-slate-700/30">
      <span className="text-slate-400 text-sm font-medium">{label}</span>
      <span className="text-slate-200 text-right max-w-xs">{value || 'Not specified'}</span>
    </div>
  );
}
